import React from 'react';
import { Truck, Calendar, ShieldCheck, UserPlus, CheckCircle2, User, Cloud, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onOpenClosingModal: () => void;
  onOpenAddRiderModal: () => void;
  onOpenAuthModal: () => void;
  riderCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  selectedDate,
  onDateChange,
  onOpenClosingModal,
  onOpenAddRiderModal,
  onOpenAuthModal,
  riderCount,
}) => {
  const { profile, user, role, isCloudConnected } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Brand & Hub Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">COD Management System</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Auto Excel Saved
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Logistics Delivery Hub & Cash Reconciliation</p>
            </div>
          </div>

          {/* Controls: Date Picker & Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Supabase / Auth Indicator Button */}
            <button
              onClick={onOpenAuthModal}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs ${
                isCloudConnected
                  ? 'bg-slate-900 text-white border-slate-800 hover:bg-slate-800'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
            >
              {isCloudConnected ? (
                <Cloud className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              ) : (
                <Database className="w-3.5 h-3.5 text-amber-600" />
              )}
              <div className="flex items-center space-x-1.5">
                <span>{profile?.fullName || (user ? user.email : 'Account / Cloud')}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md font-bold text-[10px] ${
                    role === 'Admin' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                  }`}
                >
                  {role}
                </span>
              </div>
            </button>

            {/* Active Date Indicator */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs">
              <div className="flex items-center px-2 py-1 text-slate-600 font-medium">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                <span>Date:</span>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="bg-white px-2.5 py-1 rounded border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Quick Action: Add Rider */}
            <button
              onClick={onOpenAddRiderModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition-colors shadow-2xs"
            >
              <UserPlus className="w-3.5 h-3.5 text-slate-600" />
              <span>Add Rider</span>
              {riderCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px]">
                  {riderCount}
                </span>
              )}
            </button>

            {/* Daily Closing Button */}
            <button
              onClick={onOpenClosingModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Daily Closing</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

