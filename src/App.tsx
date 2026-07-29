import React, { useState, useEffect } from 'react';
import { Transaction, Rider, DashboardStats } from './types';
import { getTodayFormattedDate, calculateStats } from './lib/utils';
import { api } from './services/api';

import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { TransactionForm } from './components/TransactionForm';
import { TransactionTable } from './components/TransactionTable';
import { EditTransactionModal } from './components/EditTransactionModal';
import { DeleteConfirmationModal } from './components/DeleteConfirmationModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ReportsView } from './components/ReportsView';
import { RiderManagement } from './components/RiderManagement';
import { DailyClosingModal } from './components/DailyClosingModal';
import { AuditLogsView } from './components/AuditLogsView';

import { LayoutDashboard, FileSpreadsheet, TrendingUp, Users, Shield, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayFormattedDate());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ledger' | 'reports' | 'riders' | 'audit'>('dashboard');

  // Data States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal States
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [receiptTransaction, setReceiptTransaction] = useState<Transaction | null>(null);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState<boolean>(false);
  const [isAddRiderModalOpen, setIsAddRiderModalOpen] = useState<boolean>(false);

  // Load Transactions for Selected Date
  const loadTransactions = async (dateStr: string) => {
    try {
      const data = await api.getTransactions({ date: dateStr });
      setTransactions(data);
    } catch (err) {
      console.error('Error loading transactions:', err);
    }
  };

  // Load Riders (Starts EMPTY)
  const loadRiders = async () => {
    try {
      const data = await api.getRiders();
      setRiders(data);
    } catch (err) {
      console.error('Error loading riders:', err);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadTransactions(selectedDate), loadRiders()]).finally(() => {
      setIsLoading(false);
    });
  }, [selectedDate]);

  // Submit New Transaction
  const handleCreateTransaction = async (data: Partial<Transaction>) => {
    await api.createTransaction(data);
    await loadTransactions(selectedDate);
    await loadRiders(); // Refresh riders count if new
  };

  // Update Transaction
  const handleUpdateTransaction = async (id: string, updated: Partial<Transaction>) => {
    await api.updateTransaction(id, updated);
    await loadTransactions(selectedDate);
  };

  // Delete Transaction
  const handleDeleteTransaction = async (id: string) => {
    await api.deleteTransaction(id);
    await loadTransactions(selectedDate);
  };

  // Add Rider
  const handleAddRider = async (newRider: { name: string; phone?: string; vehicleNumber?: string }) => {
    await api.addRider(newRider);
    await loadRiders();
  };

  // Delete Rider
  const handleDeleteRider = async (id: string) => {
    await api.deleteRider(id);
    await loadRiders();
  };

  // Import Riders
  const handleImportRiders = async (file: File) => {
    const res = await api.importRiders(file);
    await loadRiders();
    return res;
  };

  // Calculate Dashboard Stats
  const stats: DashboardStats = calculateStats(transactions);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased flex flex-col">
      {/* Top Header */}
      <Header
        selectedDate={selectedDate}
        onDateChange={(d) => setSelectedDate(d)}
        onOpenClosingModal={() => setIsClosingModalOpen(true)}
        onOpenAddRiderModal={() => setActiveTab('riders')}
        riderCount={riders.length}
      />

      {/* Main Navigation Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard & Entry</span>
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'ledger'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Saved Transactions Ledger</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-extrabold">
                {transactions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'reports'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Reports & Closing</span>
            </button>

            <button
              onClick={() => setActiveTab('riders')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'riders'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Rider Directory</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-800 font-bold">
                {riders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'audit'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Audit Logs</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <div>
            {/* Top Stats Cards */}
            <StatsCards stats={stats} selectedDate={selectedDate} />

            {/* New COD Entry Form */}
            <TransactionForm
              riders={riders}
              selectedDate={selectedDate}
              onSubmit={handleCreateTransaction}
              onAddRiderQuick={async (name) => {
                await handleAddRider({ name });
              }}
              onRemoveRiderQuick={handleDeleteRider}
            />

            {/* Transactions Ledger Table for Active Date */}
            <TransactionTable
              transactions={transactions}
              selectedDate={selectedDate}
              onEdit={(tx) => setEditingTransaction(tx)}
              onDelete={(tx) => setDeletingTransaction(tx)}
              onViewReceipt={(tx) => setReceiptTransaction(tx)}
              onDownloadExcel={(d) => window.open(api.getExcelDownloadUrl(d), '_blank')}
            />
          </div>
        )}

        {activeTab === 'ledger' && (
          <div>
            <TransactionTable
              transactions={transactions}
              selectedDate={selectedDate}
              onEdit={(tx) => setEditingTransaction(tx)}
              onDelete={(tx) => setDeletingTransaction(tx)}
              onViewReceipt={(tx) => setReceiptTransaction(tx)}
              onDownloadExcel={(d) => window.open(api.getExcelDownloadUrl(d), '_blank')}
            />
          </div>
        )}

        {activeTab === 'reports' && <ReportsView />}

        {activeTab === 'riders' && (
          <RiderManagement
            riders={riders}
            onAddRider={handleAddRider}
            onDeleteRider={handleDeleteRider}
            onImportRiders={handleImportRiders}
          />
        )}

        {activeTab === 'audit' && <AuditLogsView />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 COD Management System • Logistics Operations Hub</p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Excel Storage:
              COD_{selectedDate}.xlsx
            </span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <EditTransactionModal
        transaction={editingTransaction}
        riders={riders}
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={handleUpdateTransaction}
      />

      <DeleteConfirmationModal
        transaction={deletingTransaction}
        isOpen={!!deletingTransaction}
        onClose={() => setDeletingTransaction(null)}
        onConfirm={handleDeleteTransaction}
      />

      <ReceiptModal
        transaction={receiptTransaction}
        isOpen={!!receiptTransaction}
        onClose={() => setReceiptTransaction(null)}
      />

      <DailyClosingModal
        isOpen={isClosingModalOpen}
        onClose={() => setIsClosingModalOpen(false)}
        selectedDate={selectedDate}
        transactions={transactions}
      />
    </div>
  );
}
