import React from 'react';
import { DashboardStats } from '../types';
import { formatCurrency } from '../lib/utils';
import { Wallet, CreditCard, Banknote, Users, ArrowUpRight, UserCheck } from 'lucide-react';

interface StatsCardsProps {
  stats: DashboardStats;
  selectedDate: string;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Total COD Collected */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-blue-300 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total COD Collected</span>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-2xl font-extrabold text-slate-900">{formatCurrency(stats.totalCodCollected)}</h3>
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <ArrowUpRight className="w-3 h-3" /> Today
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 font-medium">{stats.totalTransactions} Total Transactions</p>
      </div>

      {/* 2. Cash Collection */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-emerald-300 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cash Collection</span>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <Banknote className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-2xl font-extrabold text-slate-900">{formatCurrency(stats.cashCollection)}</h3>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            {stats.totalCodCollected > 0
              ? `${Math.round((stats.cashCollection / stats.totalCodCollected) * 100)}%`
              : '0%'}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 font-medium">In Physical Vault/Drawer</p>
      </div>

      {/* 3. Online Collection */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-indigo-300 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Online Collection</span>
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-2xl font-extrabold text-slate-900">{formatCurrency(stats.onlineCollection)}</h3>
          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
            {stats.totalCodCollected > 0
              ? `${Math.round((stats.onlineCollection / stats.totalCodCollected) * 100)}%`
              : '0%'}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600 font-medium">
          <span className="truncate">
            Shashank: <strong className="text-slate-900">{formatCurrency(stats.onlineByShashank)}</strong>
          </span>
          <span className="text-slate-300">•</span>
          <span className="truncate">
            Akshay: <strong className="text-slate-900">{formatCurrency(stats.onlineByAkshay)}</strong>
          </span>
        </div>
      </div>

      {/* 4. Total Riders Paid Today */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Riders Processed</span>
          <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-2xl font-extrabold text-slate-900">{stats.totalRidersPaid}</h3>
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
            <UserCheck className="w-3 h-3" /> Unique
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 font-medium">Avg per rider: {stats.totalRidersPaid > 0 ? formatCurrency(Math.round(stats.totalCodCollected / stats.totalRidersPaid)) : '₹0'}</p>
      </div>
    </div>
  );
};
