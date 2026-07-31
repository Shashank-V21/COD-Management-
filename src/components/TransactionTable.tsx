import React, { useState } from 'react';
import { Transaction } from '../types';
import { formatCurrency, formatDisplayDate, exportToCSV } from '../lib/utils';
import {
  FileSpreadsheet,
  FileText,
  Printer,
  Edit2,
  Trash2,
  Filter,
  Calendar,
  CreditCard,
  UserCheck,
  Receipt,
  Download,
  AlertCircle,
  X,
  Search,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TransactionTableProps {
  transactions: Transaction[];
  selectedDate: string;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onViewReceipt: (tx: Transaction) => void;
  onDownloadExcel?: (date: string) => void;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  selectedDate,
  onEdit,
  onDelete,
  onViewReceipt,
  onDownloadExcel,
}) => {
  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('All');
  const [receiverFilter, setReceiverFilter] = useState<string>('All');

  // Excel Download Date State (defaults to selectedDate or today)
  const [excelDownloadDate, setExcelDownloadDate] = useState<string>(
    selectedDate || new Date().toISOString().split('T')[0]
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Synchronize excel download date with selectedDate
  React.useEffect(() => {
    if (selectedDate) {
      setExcelDownloadDate(selectedDate);
    }
  }, [selectedDate]);

  // Handle Date-Based Excel Download
  const handleDownloadExcel = async () => {
    setDownloadError(null);
    setIsDownloading(true);

    try {
      const targetDate = excelDownloadDate || selectedDate || new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/reports/download-excel?date=${encodeURIComponent(targetDate)}`);

      if (!res.ok) {
        let errorMsg = 'No Excel file found for the selected date.';
        try {
          const data = await res.json();
          if (data?.error) errorMsg = data.error;
        } catch (e) {}
        setDownloadError(errorMsg);
        return;
      }

      // Successful download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `COD_${targetDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Download error:', err);
      setDownloadError('No Excel file found for the selected date.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Apply filters
  const filteredTransactions = transactions.filter((tx) => {
    // Search Term Filter (Rider Name, Remarks, Time)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matchesRider = tx.riderName?.toLowerCase().includes(term);
      const matchesRemarks = tx.remarks?.toLowerCase().includes(term);
      const matchesTime = tx.time?.toLowerCase().includes(term);
      if (!matchesRider && !matchesRemarks && !matchesTime) {
        return false;
      }
    }
    // Payment Mode Filter
    if (paymentModeFilter !== 'All' && tx.paymentMode !== paymentModeFilter) {
      return false;
    }
    // Online Receiver Filter
    if (receiverFilter !== 'All' && tx.onlineReceivedBy !== receiverFilter) {
      return false;
    }
    return true;
  });

  // Calculate Filtered Totals
  const totalFilteredCod = filteredTransactions.reduce((acc, t) => acc + (t.codAmount || 0), 0);
  const totalFilteredCash = filteredTransactions.reduce((acc, t) => acc + (t.cashAmount || 0), 0);
  const totalFilteredOnline = filteredTransactions.reduce((acc, t) => acc + (t.onlineAmount || 0), 0);

  // Generate PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('COD Management System - Saved Transactions Ledger', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated Date: ${new Date().toLocaleString('en-IN')}`, 14, 22);
    doc.text(`Active Date: ${selectedDate} | Total Records: ${filteredTransactions.length} | Total COD: Rs. ${totalFilteredCod.toLocaleString('en-IN')}`, 14, 27);

    const tableRows = filteredTransactions.map((t) => [
      formatDisplayDate(t.date),
      t.time,
      t.riderName,
      `Rs. ${t.codAmount}`,
      `Rs. ${t.cashAmount}`,
      `Rs. ${t.onlineAmount}`,
      t.onlineReceivedBy || '-',
      t.paymentMode,
      t.remarks || '-',
    ]);

    autoTable(doc, {
      head: [['Date', 'Time', 'Rider Name', 'Total COD', 'Cash', 'Online', 'Online By', 'Mode', 'Remarks']],
      body: tableRows,
      startY: 32,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' },
    });

    doc.save(`COD_Ledger_${selectedDate}.pdf`);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Table Header & Toolbar */}
      <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" /> Saved Transactions Ledger
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Recorded in daily Excel file for <span className="font-bold text-slate-800">{selectedDate}</span>: <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800">COD_{selectedDate}.xlsx</code>
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker for Excel Download */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500 font-medium hidden sm:inline">Date:</span>
            <input
              type="date"
              value={excelDownloadDate}
              onChange={(e) => {
                setExcelDownloadDate(e.target.value);
                setDownloadError(null);
              }}
              className="bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
              title="Select date for Excel download"
            />
          </div>

          <button
            onClick={handleDownloadExcel}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
            title="Download native Excel file for selected date"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloading ? 'Downloading...' : 'Download Excel (.xlsx)'}</span>
          </button>

          <button
            onClick={() => exportToCSV(filteredTransactions, `COD_Ledger_${selectedDate}.csv`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-red-600" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Download Error Banner */}
      {downloadError && (
        <div className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{downloadError}</span>
          </div>
          <button
            onClick={() => setDownloadError(null)}
            className="p-1 text-amber-700 hover:text-amber-950 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Controls */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-700 mr-1">
          <Filter className="w-4 h-4 text-blue-600" /> Filter Ledger:
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search rider / remarks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent font-medium text-slate-900 focus:outline-hidden text-xs w-36 sm:w-48 placeholder:text-slate-400"
          />
        </div>

        {/* Payment Mode Filter */}
        <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
          <CreditCard className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-600 font-medium">Mode:</span>
          <select
            value={paymentModeFilter}
            onChange={(e) => setPaymentModeFilter(e.target.value)}
            className="bg-transparent font-bold text-slate-900 focus:outline-hidden"
          >
            <option value="All">All Modes</option>
            <option value="Cash">Cash</option>
            <option value="Online">Online</option>
            <option value="Cash + Online">Cash + Online</option>
          </select>
        </div>

        {/* Online Receiver Filter */}
        <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
          <UserCheck className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-600 font-medium">Online Receiver:</span>
          <select
            value={receiverFilter}
            onChange={(e) => setReceiverFilter(e.target.value)}
            className="bg-transparent font-bold text-slate-900 focus:outline-hidden"
          >
            <option value="All">All Receivers</option>
            <option value="Shashank">Shashank</option>
            <option value="Akshay">Akshay</option>
          </select>
        </div>

        {(searchTerm !== '' || paymentModeFilter !== 'All' || receiverFilter !== 'All') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setPaymentModeFilter('All');
              setReceiverFilter('All');
            }}
            className="text-blue-600 hover:underline font-semibold text-xs ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider font-bold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-3">Time</th>
              <th className="py-3 px-4">Rider Name</th>
              <th className="py-3 px-4 text-right">Total COD</th>
              <th className="py-3 px-4 text-right">Cash</th>
              <th className="py-3 px-4 text-right">Online</th>
              <th className="py-3 px-4">Online Received By</th>
              <th className="py-3 px-3">Payment Mode</th>
              <th className="py-3 px-3 text-center">Status</th>
              <th className="py-3 px-4">Remarks</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                    {formatDisplayDate(tx.date)}
                  </td>
                  <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{tx.time}</td>
                  <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{tx.riderName}</td>
                  <td className="py-3 px-4 font-extrabold text-blue-700 text-right whitespace-nowrap">
                    {formatCurrency(tx.codAmount)}
                  </td>
                  <td className="py-3 px-4 text-emerald-700 font-semibold text-right whitespace-nowrap">
                    {tx.cashAmount > 0 ? formatCurrency(tx.cashAmount) : '—'}
                  </td>
                  <td className="py-3 px-4 text-indigo-700 font-semibold text-right whitespace-nowrap">
                    {tx.onlineAmount > 0 ? formatCurrency(tx.onlineAmount) : '—'}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {tx.onlineReceivedBy ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {tx.onlineReceivedBy}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        tx.paymentMode === 'Cash'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tx.paymentMode === 'Online'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {tx.paymentMode}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    {tx.paymentStatus === 'Pending' && (tx.pendingAmount || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                        Pending (₹{tx.pendingAmount})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                        Paid
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{tx.remarks || '—'}</td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => onViewReceipt(tx)}
                        className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-colors"
                        title="View Digital Receipt"
                      >
                        <Receipt className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEdit(tx)}
                        className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-md transition-colors"
                        title="Edit Entry"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(tx)}
                        className="p-1.5 hover:bg-red-50 text-red-600 rounded-md transition-colors"
                        title="Delete Entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <FileSpreadsheet className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No transactions recorded for date {selectedDate}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Use the COD Entry form above to record rider collections for this date or select another date from the header.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>

          {/* Table Footer Summary Row */}
          {filteredTransactions.length > 0 && (
            <tfoot className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300">
              <tr>
                <td colSpan={3} className="py-3 px-4 text-right">
                  Total Filtered Summary ({filteredTransactions.length} entries):
                </td>
                <td className="py-3 px-4 text-right text-blue-700 text-sm font-extrabold">
                  {formatCurrency(totalFilteredCod)}
                </td>
                <td className="py-3 px-4 text-right text-emerald-700">{formatCurrency(totalFilteredCash)}</td>
                <td className="py-3 px-4 text-right text-indigo-700">{formatCurrency(totalFilteredOnline)}</td>
                <td colSpan={5}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
