import React, { useState, useEffect } from 'react';
import { User, LoanRecord, MonthlyStat } from '../types';
import { 
  Activity, 
  Wallet, 
  TrendingUp, 
  Users, 
  ClipboardList, 
  LogOut, 
  AlertCircle,
  Clock,
  ShieldAlert,
  RotateCcw,
  X,
  Check,
  Database,
  ChevronLeft,
  ChevronRight,
  BarChart3
} from 'lucide-react';

interface AdminDashboardProps {
  user: User | null;
  loans: LoanRecord[];
  registeredUsersCount: number;
  systemBudget: number;
  rankProfit: number;
  loanProfit: number;
  monthlyStats: MonthlyStat[];
  onResetRankProfit: () => void;
  onResetLoanProfit: () => void;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  user, 
  loans, 
  registeredUsersCount, 
  systemBudget, 
  rankProfit, 
  loanProfit,
  onResetRankProfit, 
  onResetLoanProfit,
  monthlyStats,
  onLogout 
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLoanResetConfirm, setShowLoanResetConfirm] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; message?: string; error?: string } | null>(null);
  const [isCheckingDb, setIsCheckingDb] = useState(false);
  const [isBudgetExpanded, setIsBudgetExpanded] = useState(false);
  const [isLoansExpanded, setIsLoansExpanded] = useState(false);
  
  const checkDbStatus = async () => {
    setIsCheckingDb(true);
    try {
      const response = await fetch('/api/supabase-status');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Server không trả về JSON (Content-Type: ${contentType}). Nội dung: ${text.substring(0, 50)}...`);
      }

      const data = await response.json();
      setDbStatus(data);
    } catch (e: any) {
      console.error("Database status check error:", e);
      setDbStatus({ connected: false, error: `Lỗi kết nối API: ${e.message || 'Lỗi không xác định'}` });
    } finally {
      setIsCheckingDb(false);
    }
  };

  useEffect(() => {
    checkDbStatus();
    const interval = setInterval(checkDbStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const settledLoans = loans.filter(l => l.status === 'ĐÃ TẤT TOÁN');
  const pendingLoans = loans.filter(l => l.status === 'CHỜ DUYỆT' || l.status === 'CHỜ TẤT TOÁN');
  
  const today = new Date();
  const overdueLoans = loans.filter(l => {
    if (l.status !== 'ĐANG NỢ' && l.status !== 'CHỜ TẤT TOÁN') return false;
    const [d, m, y] = l.date.split('/').map(Number);
    const dueDate = new Date(y, m - 1, d);
    return dueDate < today;
  });

  const profitFromFees = loans
    .filter(l => l.status === 'ĐÃ TẤT TOÁN')
    .reduce((acc, curr) => acc + (curr.amount * 0.15), 0);
    
  const totalFines = loans
    .filter(l => l.status === 'ĐÃ TẤT TOÁN')
    .reduce((acc, curr) => acc + (curr.fine || 0), 0);
    
  const totalProfit = profitFromFees + totalFines;

  const totalDisbursed = loans.filter(l => l.status !== 'BỊ TỪ CHỐI' && l.status !== 'CHỜ DUYỆT').reduce((acc, curr) => acc + curr.amount, 0);
  const totalCollected = settledLoans.reduce((acc, curr) => acc + curr.amount, 0);
  const activeDebt = totalDisbursed - totalCollected;

  const isBudgetAlarm = systemBudget <= 2000000;

  const handleConfirmReset = () => {
    onResetRankProfit();
    setShowResetConfirm(false);
  };

  const handleConfirmLoanReset = () => {
    onResetLoanProfit();
    setShowLoanResetConfirm(false);
  };

  return (
    <div className="w-full bg-[#0a0a0a] px-5 pb-32 space-y-6 pt-6 animate-in fade-in duration-700">
      <div className="flex justify-between items-center px-1 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#ff8c00] to-[#ff5f00] rounded-2xl flex items-center justify-center font-black text-black text-sm shadow-lg shadow-orange-500/20">
            NDV
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tighter uppercase leading-none">NDV Money Admin</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em]">Hệ thống trực tuyến</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Database Status */}
          <div className="relative group">
            <button 
              onClick={checkDbStatus} 
              disabled={isCheckingDb}
              className={`w-11 h-11 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${isCheckingDb ? 'animate-spin' : ''}`}
            >
              {dbStatus?.connected ? (
                <span className="text-[10px] font-black text-green-500 uppercase">OK</span>
              ) : (
                <Database size={20} className={dbStatus?.error ? 'text-red-500' : 'text-gray-500'} />
              )}
            </button>
            
            {dbStatus?.error && (
              <div className="absolute -bottom-14 right-0 z-[300] w-48 animate-in slide-in-from-top-2 duration-300">
                <div className="bg-red-600 text-white text-[9px] font-black py-2 px-4 rounded-xl flex items-center gap-2 shadow-xl relative">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="uppercase leading-tight">{dbStatus.error}</span>
                  <div className="absolute -top-1 right-5 w-2 h-2 bg-red-600 rotate-45"></div>
                </div>
              </div>
            )}
          </div>

          <button onClick={onLogout} className="w-11 h-11 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-90">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* TỔNG QUAN HỆ THỐNG - SINGLE FRAME */}
      <div className="bg-[#111111] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
              <BarChart3 size={20} />
            </div>
            <h3 className="text-[13px] font-black text-white uppercase tracking-[0.2em]">TỔNG QUAN HỆ THỐNG</h3>
          </div>
          
          {isBudgetAlarm && (
            <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20 animate-pulse">
              <AlertCircle size={12} className="text-red-500" />
              <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Ngân sách thấp</span>
            </div>
          )}
        </div>

        <div className="p-1 space-y-1">
          {/* Section 1: Lợi nhuận (Profit) - Always Visible or Primary */}
          <div className="bg-white/[0.02] rounded-[2rem] m-2 overflow-hidden border border-white/5">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
                  <TrendingUp size={20} />
                </div>
                <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">THỐNG KÊ LỢI NHUẬN</h3>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-3xl p-6 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                    Tổng lợi nhuận hệ thống
                  </p>
                  <p className="text-3xl font-black text-green-500 tracking-tighter">
                    {(loanProfit + rankProfit).toLocaleString()} đ
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-black shadow-lg shadow-green-500/20">
                  <TrendingUp size={24} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/40 border border-white/5 rounded-3xl p-5 space-y-4 relative overflow-hidden">
                  <div className="flex justify-between items-center">
                    <div className="w-9 h-9 bg-[#ff8c00]/10 rounded-xl flex items-center justify-center text-[#ff8c00]">
                      <Activity size={18} />
                    </div>
                    <button 
                      onClick={() => setShowLoanResetConfirm(true)}
                      className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center text-gray-600 hover:text-[#ff8c00] active:scale-90 transition-all"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Phí & Phạt vay</p>
                    <p className="text-base font-black text-[#ff8c00]">
                      {loanProfit.toLocaleString()} đ
                    </p>
                  </div>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-3xl p-5 space-y-4 relative overflow-hidden">
                  <div className="flex justify-between items-center">
                    <div className="w-9 h-9 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500">
                      <TrendingUp size={18} />
                    </div>
                    <button 
                      onClick={() => setShowResetConfirm(true)}
                      className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center text-gray-600 hover:text-[#ff8c00] active:scale-90 transition-all"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Phí nâng hạng</p>
                    <p className="text-base font-black text-purple-500">
                      {rankProfit.toLocaleString()} đ
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Ngân sách (Budget) - Collapsible */}
          <div className="bg-white/[0.02] rounded-[2rem] m-2 overflow-hidden border border-white/5">
            <button 
              onClick={() => setIsBudgetExpanded(!isBudgetExpanded)}
              className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#ff8c00]/10 rounded-xl flex items-center justify-center text-[#ff8c00]">
                  <Wallet size={20} />
                </div>
                <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">CẤU HÌNH NGÂN SÁCH</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                  {isBudgetExpanded ? 'Thu gọn' : 'Mở rộng'}
                </span>
                <div className={`transition-transform duration-300 ${isBudgetExpanded ? 'rotate-180' : ''}`}>
                  <ChevronRight size={16} className="text-gray-500" />
                </div>
              </div>
            </button>

            {isBudgetExpanded && (
              <div className="p-6 pt-0 space-y-6 animate-in slide-in-from-top-2 duration-300">
                <div className="bg-black/40 border border-white/5 rounded-3xl p-6 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Ngân sách hiện tại</p>
                    <p className={`text-3xl font-black tracking-tight ${isBudgetAlarm ? 'text-red-500' : 'text-white'}`}>{systemBudget.toLocaleString()} đ</p>
                  </div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isBudgetAlarm ? 'bg-red-500/20 text-red-500' : 'bg-[#ff8c00]/10 text-[#ff8c00]'}`}>
                    <Wallet size={24} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/40 border border-white/5 rounded-3xl p-5 space-y-2">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Đã giải ngân</p>
                    <p className="text-base font-black text-white">{totalDisbursed.toLocaleString()} đ</p>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-3xl p-5 space-y-2">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Đã thu hồi</p>
                    <p className="text-base font-black text-green-500">{totalCollected.toLocaleString()} đ</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-end px-1">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Tổng dư nợ thị trường</p>
                    <p className="text-xl font-black text-red-500">{activeDebt.toLocaleString()} đ</p>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500/60 transition-all duration-1000" style={{ width: `${Math.min(100, (activeDebt / (systemBudget + activeDebt || 1)) * 100)}%` }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Khoản vay (Loans) - Collapsible */}
          <div className="bg-white/[0.02] rounded-[2rem] m-2 overflow-hidden border border-white/5">
            <button 
              onClick={() => setIsLoansExpanded(!isLoansExpanded)}
              className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                  <ClipboardList size={20} />
                </div>
                <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">QUẢN LÝ KHOẢN VAY</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                  {isLoansExpanded ? 'Thu gọn' : 'Mở rộng'}
                </span>
                <div className={`transition-transform duration-300 ${isLoansExpanded ? 'rotate-180' : ''}`}>
                  <ChevronRight size={16} className="text-gray-500" />
                </div>
              </div>
            </button>

            {isLoansExpanded && (
              <div className="p-6 pt-0 grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                <div className="bg-black/40 border border-white/5 rounded-3xl p-5 space-y-4 relative">
                  <div className="flex justify-between items-center">
                    <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                      <Clock size={18} />
                    </div>
                    {pendingLoans.length > 0 && <div className="w-2 h-2 bg-red-600 rounded-full animate-ping"></div>}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Lệnh chờ duyệt</p>
                    <p className="text-xl font-black text-white">{pendingLoans.length}</p>
                  </div>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-3xl p-5 space-y-4">
                  <div className="w-9 h-9 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500">
                    <ShieldAlert size={18} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">HĐ Quá hạn</p>
                    <p className="text-xl font-black text-red-500">{overdueLoans.length}</p>
                  </div>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-3xl p-5 space-y-4">
                  <div className="w-9 h-9 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
                    <Check size={18} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Đã tất toán</p>
                    <p className="text-xl font-black text-white">{settledLoans.length}</p>
                  </div>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-3xl p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                      <Users size={18} />
                    </div>
                    <span className="text-[7px] font-black text-gray-700 uppercase">Active</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Người dùng</p>
                    <p className="text-xl font-black text-white">{registeredUsersCount}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-orange-500/20 w-full max-w-sm rounded-[2.5rem] p-8 space-y-8 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-500"></div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500">
                 <RotateCcw size={32} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">RESET THỐNG KÊ?</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed px-4">
                  Bạn có chắc chắn muốn đặt lại thống kê <span className="text-orange-500">Phí Nâng Hạng</span> về 0? Hành động này không ảnh hưởng đến số dư người dùng.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
               <button 
                 onClick={() => setShowResetConfirm(false)}
                 className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <X size={14} /> HỦY BỎ
               </button>
               <button 
                 onClick={handleConfirmReset}
                 className="flex-1 py-4 bg-orange-600 rounded-2xl text-[10px] font-black text-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/40"
               >
                 <Check size={14} /> ĐỒNG Ý
               </button>
            </div>
          </div>
        </div>
      )}

      {showLoanResetConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-orange-500/20 w-full max-w-sm rounded-[2.5rem] p-8 space-y-8 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-500"></div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500">
                 <RotateCcw size={32} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">RESET LỢI NHUẬN?</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed px-4">
                  Bạn có chắc chắn muốn đặt lại thống kê <span className="text-orange-500">Lợi nhuận từ Phí & Phạt</span> về 0? Hành động này không ảnh hưởng đến số dư người dùng.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
               <button 
                 onClick={() => setShowLoanResetConfirm(false)}
                 className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <X size={14} /> HỦY BỎ
               </button>
               <button 
                 onClick={handleConfirmLoanReset}
                 className="flex-1 py-4 bg-orange-600 rounded-2xl text-[10px] font-black text-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/40"
               >
                 <Check size={14} /> ĐỒNG Ý
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;