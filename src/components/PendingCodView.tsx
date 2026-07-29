import React, { useState } from 'react';
import { Transaction, PaymentMode, OnlineReceiver } from '../types';
import { formatDisplayDate, exportPendingToCSV } from '../lib/utils';
import { MarkAsPaidModal } from './MarkAsPaidModal';
import {
  Clock,
  IndianRupee,
  Users,
  Search,
  FileSpreadsheet,
  FileText,
  Download,
  History,
  CheckCircle2,
  Calendar,
  CreditCard,
  Banknote,
  Eye,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface PendingCodViewProps {
  transactions: Transaction[];
  onReceivePayment: (
    id: string,
    payload: {
      amountReceivedNow: number;
      paymentMode: PaymentMode;
      cashAmount?: number;
      onlineAmount?: number;
      onlineReceivedBy?: OnlineReceiver | '';
      remarks?: string;
      date?: string;
      time?: string;
    }
  ) => Promise<void>;
  onRefreshData?: () => void;
}

export const PendingCodView: React.FC<PendingCodViewProps> = ({
  transactions,
  onReceivePayment,
  onRefreshData,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTxForPayment, setSelectedTxForPayment] = useState<Transaction | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [historyTx, setHistoryTx] = useState<Transaction | null>(null);

  // Filter only pending transactions with pendingAmount > 0
  const pendingTransactions = transactions.filter(
    (tx) => tx.paymentStatus === 'Pending' && (tx.pendingAmount || 0) > 0
  );

  // Filter by Search Term
  const filteredTransactions = pendingTransactions.filter((tx) =>
    tx.riderName.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  // Summary Metrics
  const totalPendingAmount = pendingTransactions.reduce(
    (sum, tx) => sum + (tx.pendingAmount || 0),
    0
  );

  const pendingRidersSet = new Set(
    pendingTransactions.map((tx) => tx.riderName.trim().toLowerCase())
  );
  const pendingRidersCount = pendingRidersSet.size;

  // Export handlers
  const handleExportExcel = () => {
    const data = filteredTransactions.map((tx) => ({
      'Rider Name': tx.riderName,
      'Date': formatDisplayDate(tx.date),
      'Time': tx.time,
      'Total COD Amount': tx.codAmount,
      'Amount Received': tx.codAmount - (tx.pendingAmount || 0),
      'Pending Amount': tx.pendingAmount || 0,
      'Payment Status': tx.paymentStatus || 'Pending',
      'Payment Mode': tx.paymentMode,
      'Online Received By': tx.onlineReceivedBy || '-',
      'Remarks': tx.remarks || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pending COD');
    XLSX.writeFile(workbook, `Pending_COD_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Pending COD Management Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()} | Pending Riders: ${pendingRidersCount} | Total Pending: Rs. ${totalPendingAmount}`, 14, 22);

    const tableColumn = [
      'Rider Name',
      'Date',
      'Total COD',
      'Received',
      'Pending',
      'Mode',
      'Remarks',
    ];

    const tableRows = filteredTransactions.map((tx) => [
      tx.riderName,
      formatDisplayDate(tx.date),
      `Rs. ${tx.codAmount}`,
      `Rs. ${tx.codAmount - (tx.pendingAmount || 0)}`,
      `Rs. ${tx.pendingAmount || 0}`,
      tx.paymentMode,
      tx.remarks || '-',
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [217, 119, 6] },
    });

    doc.save(`Pending_COD_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportCSV = () => {
    exportPendingToCSV(
      filteredTransactions,
      `Pending_COD_Report_${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Pending COD Management
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Track and collect outstanding pending cash-on-delivery payments from riders
            </p>
          </div>
        </div>

        {/* Action / Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
            title="Export to Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
            title="Export to PDF"
          >
            <FileText className="w-4 h-4 text-rose-600" /> PDF
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
            title="Export to CSV"
          >
            <Download className="w-4 h-4 text-blue-600" /> CSV
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-2xl p-6 shadow-md relative overflow-hidden flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-100 uppercase tracking-wider mb-1">
              Total Outstanding Pending Amount
            </p>
            <h2 className="text-3xl font-black text-white tracking-tight">
              ₹{totalPendingAmount.toLocaleString('en-IN')}
            </h2>
            <p className="text-xs text-amber-100/80 mt-1">
              Across {pendingTransactions.length} pending transaction entries
            </p>
          </div>
          <div className="p-3 bg-white/15 rounded-2xl backdrop-blur-xs">
            <IndianRupee className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Total Pending Riders
            </p>
            <h2 className="text-3xl font-black text-white tracking-tight">
              {pendingRidersCount}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Riders with pending COD balances
            </p>
          </div>
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xs">
            <Users className="w-8 h-8 text-slate-200" />
          </div>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search pending rider name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
        <div className="text-xs font-bold text-slate-500">
          Showing {filteredTransactions.length} of {pendingTransactions.length} Pending Records
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Rider Name</th>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4 text-right">Total COD</th>
                <th className="py-3.5 px-4 text-right">Received So Far</th>
                <th className="py-3.5 px-4 text-right">Pending Amount</th>
                <th className="py-3.5 px-4">Payment Mode</th>
                <th className="py-3.5 px-4">Remarks</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const receivedSoFar = tx.codAmount - (tx.pendingAmount || 0);
                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-amber-50/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {tx.riderName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatDisplayDate(tx.date)}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block">{tx.time}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        ₹{tx.codAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-700 whitespace-nowrap">
                        ₹{receivedSoFar.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-amber-600 whitespace-nowrap">
                        ₹{(tx.pendingAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {tx.paymentMode}
                        </span>
                        {tx.onlineReceivedBy && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            By {tx.onlineReceivedBy}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs text-slate-500 truncate">
                        {tx.remarks || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedTxForPayment(tx);
                              setIsPaymentModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-2xs transition-all flex items-center gap-1"
                          >
                            <IndianRupee className="w-3 h-3" /> Mark as Paid
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                      <p className="font-bold text-slate-700 text-sm">
                        No Pending COD Records Found
                      </p>
                      <p className="text-xs text-slate-400">
                        All riders have settled their COD payments in full!
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mark As Paid Modal */}
      <MarkAsPaidModal
        transaction={selectedTxForPayment}
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedTxForPayment(null);
        }}
        onSubmitPayment={async (id, payload) => {
          await onReceivePayment(id, payload);
          if (onRefreshData) onRefreshData();
        }}
      />
    </div>
  );
};
