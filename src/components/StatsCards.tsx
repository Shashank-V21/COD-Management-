import React from 'react';
import { DashboardStats } from '../types';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { Wallet, CreditCard, Banknote, Users, ArrowUpRight, UserCheck, Clock, IndianRupee } from 'lucide-react';

interface StatsCardsProps {
  stats: DashboardStats;
  selectedDate: string;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const { storeSettings } = useAuth();
  const receiverLabel = Array.isArray(storeSettings?.onlineReceivers) && storeSettings.onlineReceivers.length > 0
    ? storeSettings.onlineReceivers.join(' / ')
    : 'Shashank / Akshay';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      {/* 1. Total COD Collected */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-blue-300 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total COD</span>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-xl font-extrabold text-slate-900">{formatCurrency(stats.totalCodCollected)}</h3>
        </div>
        <p className="text-xs text-slate-500 mt-1 font-medium">{stats.totalTransactions} Transactions</p>
      </div>

      {/* 2. Cash Collection */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-emerald-300 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cash Collection</span>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <Banknote className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-xl font-extrabold text-slate-900">{formatCurrency(stats.cashCollection)}</h3>
        </div>
        <p className="text-xs text-slate-500 mt-1 font-medium">In Cash Vault</p>
      </div>

      {/* 3. Online Collection */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-indigo-300 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Online Collection</span>
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <CreditCard className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-xl font-extrabold text-slate-900">{formatCurrency(stats.onlineCollection)}</h3>
        </div>
        <p className="text-xs text-slate-500 mt-1 font-medium truncate" title={receiverLabel}>{receiverLabel}</p>
      </div>

      {/* 4. Total Riders Paid */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Riders Paid</span>
          <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-xl font-extrabold text-slate-900">{stats.totalRidersPaid}</h3>
        </div>
        <p className="text-xs text-slate-500 mt-1 font-medium">Fully Settled</p>
      </div>

      {/* 5. Pending Riders Card */}
      <div className="bg-amber-50/70 rounded-xl p-4 border border-amber-200 shadow-xs hover:border-amber-400 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Pending Riders</span>
          <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-xl font-extrabold text-amber-950">{stats.pendingRidersCount || 0}</h3>
          <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>
        <p className="text-xs text-amber-700 mt-1 font-medium">Unsettled Riders</p>
      </div>

      {/* 6. Pending Amount Card */}
      <div className="bg-amber-100/80 rounded-xl p-4 border border-amber-300 shadow-xs hover:border-amber-500 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Pending Amount</span>
          <div className="p-2 bg-amber-200 text-amber-800 rounded-lg">
            <IndianRupee className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-xl font-black text-amber-950">{formatCurrency(stats.totalPendingAmount || 0)}</h3>
        </div>
        <p className="text-xs text-amber-800 mt-1 font-medium">To Be Collected</p>
      </div>
    </div>
  );
};
