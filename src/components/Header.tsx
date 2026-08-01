import React, { useState } from 'react';
import { Truck, Calendar, ShieldCheck, UserPlus, CheckCircle2, LogOut, Users, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserManagementModal } from './UserManagementModal';
import { SettingsModal } from './SettingsModal';

interface HeaderProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onOpenClosingModal: () => void;
  onOpenAddRiderModal: () => void;
  riderCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  selectedDate,
  onDateChange,
  onOpenClosingModal,
  onOpenAddRiderModal,
  riderCount,
}) => {
  const { profile, user, role, signOut, storeSettings } = useAuth();
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out of COD Management System?')) {
      await signOut();
    }
  };

  const displayStoreName = storeSettings?.storeName?.trim() || 'COD Management System';

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Brand & Hub Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">{displayStoreName}</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Auto Excel Saved
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Logistics Delivery Hub & Cash Reconciliation</p>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">

            {/* User Profile Badge & Sign Out Control */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs gap-1.5">
              <div className="flex items-center space-x-2 px-2 py-1">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[11px]">
                  {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 text-[11px] leading-none">
                    {profile?.fullName || (user?.email ? user.email.split('@')[0] : 'User')}
                  </span>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    {user?.email || 'Authenticated'}
                  </span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded-md font-extrabold text-[10px] uppercase tracking-wider ${
                    role === 'Admin'
                      ? 'bg-blue-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {role}
                </span>
              </div>

              {/* Settings Button */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
                title="Store Settings & Online Payment Receivers"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Hub Admin Team Provisioning Button */}
              {role === 'Admin' && (
                <button
                  onClick={() => setIsUserManagementOpen(true)}
                  className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200"
                  title="Manage Staff & Create Accounts"
                >
                  <Users className="w-4 h-4" />
                </button>
              )}

              {/* Logout Button */}
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition-colors border border-rose-200 flex items-center gap-1.5 cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>

            {/* Active Date Indicator */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs">
              <div className="flex items-center px-2 py-1 text-slate-600 font-medium">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                <span>Date:</span>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="bg-white px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Quick Action: Add Rider */}
            <button
              onClick={onOpenAddRiderModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-medium transition-colors shadow-2xs cursor-pointer"
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
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Daily Closing</span>
            </button>
          </div>
        </div>
      </header>

      {/* Admin User Management Modal */}
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
      />

      {/* Store Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};
