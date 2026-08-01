import React, { useState } from 'react';
import { Transaction, DashboardStats } from '../types';
import { formatCurrency, formatDisplayDate, calculateStats } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, X, Printer, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../services/api';

interface DailyClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  transactions: Transaction[];
}

export const DailyClosingModal: React.FC<DailyClosingModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  transactions,
}) => {
  const { storeSettings } = useAuth();
  if (!isOpen) return null;

  const stats: DashboardStats = calculateStats(transactions);
  const [cashCounted, setCashCounted] = useState<string>(stats.cashCollection.toString());
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [isCompleted, setIsCompleted] = useState(false);

  const numCashCounted = Number(cashCounted) || 0;
  const cashDiscrepancy = numCashCounted - stats.cashCollection;

  const onlineReceivers = Array.isArray(storeSettings?.onlineReceivers) && storeSettings.onlineReceivers.length > 0
    ? storeSettings.onlineReceivers
    : Object.keys(stats.onlineByReceiver || {});

  const handleDownloadClosingPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('EXPRESS LOGISTICS HUB - DAILY CLOSING REPORT', 14, 15);
    doc.setFontSize(10);
    doc.text(`Date: ${formatDisplayDate(selectedDate)} | Closed At: ${new Date().toLocaleTimeString('en-IN')}`, 14, 22);
    doc.text(`Status: ${cashDiscrepancy === 0 ? 'BALANCED' : 'DISCREPANCY DETECTED'}`, 14, 27);

    const receiverPdfRows = onlineReceivers.map((rec) => [
      `Online - ${rec}`,
      `Rs. ${(stats.onlineByReceiver?.[rec] || 0).toLocaleString('en-IN')}`,
    ]);

    autoTable(doc, {
      head: [['Metric', 'Amount (INR)']],
      body: [
        ['Total Transactions', `${stats.totalTransactions}`],
        ['Total COD Collected', `Rs. ${stats.totalCodCollected.toLocaleString('en-IN')}`],
        ['System Cash Expected', `Rs. ${stats.cashCollection.toLocaleString('en-IN')}`],
        ['Physical Cash Counted', `Rs. ${numCashCounted.toLocaleString('en-IN')}`],
        ['Cash Difference', `Rs. ${cashDiscrepancy.toLocaleString('en-IN')}`],
        ['Total Online Collected', `Rs. ${stats.onlineCollection.toLocaleString('en-IN')}`],
        ...receiverPdfRows,
        ['Unique Riders Paid', `${stats.totalRidersPaid}`],
      ],
      startY: 32,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });

    if (closingNotes) {
      doc.text(`Closing Manager Notes: ${closingNotes}`, 14, (doc as any).lastAutoTable.finalY + 10);
    }

    doc.save(`Daily_Closing_${selectedDate}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center space-x-2 text-blue-700">
            <ShieldCheck className="w-6 h-6" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Daily Hub Closing Reconciliation</h3>
              <p className="text-xs text-slate-500">Date: {formatDisplayDate(selectedDate)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-4 space-y-4 text-xs">
          {/* Summary Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-500 block">Total Transactions:</span>
              <strong className="text-slate-900 text-sm">{stats.totalTransactions}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Total COD Collected:</span>
              <strong className="text-blue-700 text-sm">{formatCurrency(stats.totalCodCollected)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">System Cash Expected:</span>
              <strong className="text-emerald-700 text-sm">{formatCurrency(stats.cashCollection)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Total Online:</span>
              <strong className="text-indigo-700 text-sm">{formatCurrency(stats.onlineCollection)}</strong>
            </div>
          </div>

          {/* Online Breakdown */}
          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-1">
            <p className="font-bold text-indigo-900">Online Collections Breakdown</p>
            {onlineReceivers.map((rec) => (
              <div key={rec} className="flex justify-between text-indigo-800">
                <span>{rec} Account:</span>
                <strong>{formatCurrency(stats.onlineByReceiver?.[rec] || 0)}</strong>
              </div>
            ))}
          </div>

          {/* Physical Cash Vault Verification */}
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
            <label className="block font-bold text-amber-900">Count Physical Cash in Drawer (₹)</label>
            <input
              type="number"
              value={cashCounted}
              onChange={(e) => setCashCounted(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm font-extrabold text-slate-900"
            />

            {cashDiscrepancy === 0 ? (
              <p className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Cash is Perfectly Balanced!
              </p>
            ) : (
              <p className="text-red-700 font-bold flex items-center gap-1 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5" /> Discrepancy: {formatCurrency(cashDiscrepancy)}
              </p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Closing Manager Notes</label>
            <input
              type="text"
              placeholder="e.g. Vault verified by Senior Manager, handed over to Shift B..."
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleDownloadClosingPDF}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Export PDF Report
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                await api.saveDailyClosing({
                  date: selectedDate,
                  closedAt: new Date().toISOString(),
                  totalTransactions: stats.totalTransactions,
                  totalCod: stats.totalCodCollected,
                  totalCash: stats.cashCollection,
                  totalOnline: stats.onlineCollection,
                  shashankOnline: stats.onlineByShashank,
                  akshayOnline: stats.onlineByAkshay,
                  totalRiders: stats.totalRidersPaid,
                  status: cashDiscrepancy === 0 ? 'Balanced' : 'Discrepancy',
                  notes: closingNotes,
                });
              } catch (e) {
                console.error('Failed saving daily closing:', e);
              }
              setIsCompleted(true);
              setTimeout(() => {
                setIsCompleted(false);
                onClose();
              }, 1200);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
          >
            {isCompleted ? 'Closing Recorded ✓' : 'Complete Daily Closing'}
          </button>
        </div>
      </div>
    </div>
  );
};
