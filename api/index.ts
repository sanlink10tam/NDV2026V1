import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

const isValidUrl = (url: string) => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

if (!SUPABASE_URL || !SUPABASE_KEY || !isValidUrl(SUPABASE_URL)) {
  console.error("CRITICAL ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing or invalid.");
}

const supabase = (SUPABASE_URL && SUPABASE_KEY && isValidUrl(SUPABASE_URL)) 
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const STORAGE_LIMIT_MB = 45; // Virtual limit for demo purposes

const router = express.Router();

router.use(cors());
router.use(express.json({ limit: '50mb' }));

// Helper to estimate JSON size in MB
const getStorageUsage = (data: any) => {
  const str = JSON.stringify(data);
  return (Buffer.byteLength(str, 'utf8') / (1024 * 1024));
};

// Auto-cleanup task: Delete notifications and old loans
const autoCleanupStorage = async () => {
  try {
    const now = new Date();
    
    // 1. Cleanup Notifications: Keep only 7 most recent per user
    const { data: users } = await supabase.from('users').select('id');
    if (users) {
      for (const user of users) {
        const { data: notifs } = await supabase.from('notifications')
          .select('id')
          .eq('userId', user.id)
          .order('id', { ascending: false });
        
        if (notifs && notifs.length > 7) {
          const toDelete = notifs.slice(7).map(n => n.id);
          await supabase.from('notifications').delete().in('id', toDelete);
        }
      }
    }

    // 2. Cleanup Loans:
    // - Delete Rejected loans older than 3 days
    // - Delete Settled loans older than 7 days
    // Note: We use updatedAt if available, or parse createdAt
    const { data: allLoans } = await supabase.from('loans').select('id, status, createdAt, updatedAt');
    if (allLoans) {
      const idsToDelete: string[] = [];
      const threeDaysAgo = now.getTime() - (3 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);

      for (const loan of allLoans) {
        // EXPLICIT PROTECTION: Never delete loans that are not Rejected or Settled
        if (loan.status !== 'BỊ TỪ CHỐI' && loan.status !== 'ĐÃ TẤT TOÁN') {
          continue;
        }

        let loanTime = loan.updatedAt || 0;
        if (!loanTime && loan.createdAt) {
          // Parse "HH:mm:ss DD/MM/YYYY"
          try {
            const parts = loan.createdAt.split(' ');
            if (parts.length === 2) {
              const [d, m, y] = parts[1].split('/').map(Number);
              const [h, min, s] = parts[0].split(':').map(Number);
              loanTime = new Date(y, m - 1, d, h, min, s).getTime();
            }
          } catch (e) {}
        }

        if (loanTime) {
          if (loan.status === 'BỊ TỪ CHỐI' && loanTime < threeDaysAgo) {
            idsToDelete.push(loan.id);
          } else if (loan.status === 'ĐÃ TẤT TOÁN' && loanTime < sevenDaysAgo) {
            idsToDelete.push(loan.id);
          }
        }
      }

      if (idsToDelete.length > 0) {
        console.log(`[Cleanup] Deleting ${idsToDelete.length} old loans`);
        await supabase.from('loans').delete().in('id', idsToDelete);
      }
    }
  } catch (e) {
    console.error("Lỗi auto-cleanup:", e);
  }
};

// Supabase Status check for Admin
router.get("/supabase-status", async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ 
        connected: false, 
        error: "Chưa cấu hình Supabase hoặc URL không hợp lệ. Vui lòng kiểm tra biến môi trường." 
      });
    }
    
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    
    if (error) {
      return res.json({ 
        connected: false, 
        error: `Lỗi kết nối Supabase: ${error.message} (${error.code})` 
      });
    }
    
    res.json({ connected: true, message: "Kết nối Supabase ổn định" });
  } catch (e: any) {
    res.json({ connected: false, error: `Lỗi hệ thống: ${e.message}` });
  }
});

// API Routes
router.get("/data", async (req, res) => {
  try {
    if (!supabase) {
      return res.json({
        users: [],
        loans: [],
        notifications: [],
        budget: 30000000,
        rankProfit: 0,
        loanProfit: 0,
        monthlyStats: [],
        storageFull: false,
        storageUsage: "0.00",
        warning: "Supabase chưa được cấu hình"
      });
    }
    const { data: users } = await supabase.from('users').select('*');
    const { data: loans } = await supabase.from('loans').select('*');
    const { data: notifications } = await supabase.from('notifications').select('*');
    const { data: config } = await supabase.from('config').select('*');

    const budget = config?.find(c => c.key === 'budget')?.value || 30000000;
    const rankProfit = config?.find(c => c.key === 'rankProfit')?.value || 0;
    const loanProfit = config?.find(c => c.key === 'loanProfit')?.value || 0;
    const monthlyStats = config?.find(c => c.key === 'monthlyStats')?.value || [];

    const payload = {
      users: users || [],
      loans: loans || [],
      notifications: notifications || [],
      budget,
      rankProfit,
      loanProfit,
      monthlyStats
    };

    const usage = getStorageUsage(payload);
    const isFull = usage > STORAGE_LIMIT_MB;

    // Run cleanup in background if usage is high
    if (usage > STORAGE_LIMIT_MB * 0.8) {
      autoCleanupStorage();
    }

    res.json({
      ...payload,
      storageFull: isFull,
      storageUsage: usage.toFixed(2)
    });
  } catch (e) {
    console.error("Lỗi trong /api/data:", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/users", async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const incomingUsers = req.body;
    if (!Array.isArray(incomingUsers)) {
      return res.status(400).json({ error: "Dữ liệu phải là mảng" });
    }

    for (const user of incomingUsers) {
      const { error } = await supabase.from('users').upsert(user, { onConflict: 'id' });
      if (error) console.error(`Lỗi upsert user ${user.id}:`, error);
    }
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/loans", async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const incomingLoans = req.body;
    if (!Array.isArray(incomingLoans)) {
      return res.status(400).json({ error: "Dữ liệu phải là mảng" });
    }

    for (const loan of incomingLoans) {
      const { error } = await supabase.from('loans').upsert(loan, { onConflict: 'id' });
      if (error) console.error(`Lỗi upsert loan ${loan.id}:`, error);
    }
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/notifications", async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const incomingNotifs = req.body;
    if (!Array.isArray(incomingNotifs)) {
      return res.status(400).json({ error: "Dữ liệu phải là mảng" });
    }

    for (const notif of incomingNotifs) {
      const { error } = await supabase.from('notifications').upsert(notif, { onConflict: 'id' });
      if (error) console.error(`Lỗi upsert notification ${notif.id}:`, error);
    }
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/budget", async (req, res) => {
  try {
    const { budget } = req.body;
    await supabase.from('config').upsert({ key: 'budget', value: budget }, { onConflict: 'key' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/rankProfit", async (req, res) => {
  try {
    const { rankProfit } = req.body;
    await supabase.from('config').upsert({ key: 'rankProfit', value: rankProfit }, { onConflict: 'key' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/loanProfit", async (req, res) => {
  try {
    const { loanProfit } = req.body;
    await supabase.from('config').upsert({ key: 'loanProfit', value: loanProfit }, { onConflict: 'key' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/monthlyStats", async (req, res) => {
  try {
    const { monthlyStats } = req.body;
    await supabase.from('config').upsert({ key: 'monthlyStats', value: monthlyStats }, { onConflict: 'key' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    await supabase.from('users').delete().eq('id', userId);
    await supabase.from('loans').delete().eq('userId', userId);
    await supabase.from('notifications').delete().eq('userId', userId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/sync", async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { users, loans, notifications, budget, rankProfit, loanProfit, monthlyStats } = req.body;
    
    const tasks = [];
    
    if (users && Array.isArray(users)) {
      tasks.push(supabase.from('users').upsert(users, { onConflict: 'id' }));
    }
    
    if (loans && Array.isArray(loans)) {
      tasks.push(supabase.from('loans').upsert(loans, { onConflict: 'id' }));
    }
    
    if (notifications && Array.isArray(notifications)) {
      tasks.push(supabase.from('notifications').upsert(notifications, { onConflict: 'id' }));
    }
    
    if (budget !== undefined) {
      tasks.push(supabase.from('config').upsert({ key: 'budget', value: budget }, { onConflict: 'key' }));
    }
    
    if (rankProfit !== undefined) {
      tasks.push(supabase.from('config').upsert({ key: 'rankProfit', value: rankProfit }, { onConflict: 'key' }));
    }

    if (loanProfit !== undefined) {
      tasks.push(supabase.from('config').upsert({ key: 'loanProfit', value: loanProfit }, { onConflict: 'key' }));
    }

    if (monthlyStats !== undefined) {
      tasks.push(supabase.from('config').upsert({ key: 'monthlyStats', value: monthlyStats }, { onConflict: 'key' }));
    }
    
    const results = await Promise.all(tasks);
    const errors = results.filter(r => r.error).map(r => r.error);
    
    if (errors.length > 0) {
      console.error("Sync errors:", errors);
      return res.status(207).json({ success: false, errors });
    }
    
    res.json({ success: true });
  } catch (e: any) {
    console.error("Lỗi trong /api/sync:", e);
    res.status(500).json({ error: e.message || "Internal Server Error" });
  }
});

// 404 handler for API routes
router.use((req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use("/api", router);

export default app;
