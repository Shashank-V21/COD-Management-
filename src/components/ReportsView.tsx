import React, { useState, useEffect } from 'react';
import { Transaction, DashboardStats, BackupFile } from '../types';
import {
  formatCurrency,
  formatDisplayDate,
  getTodayFormattedDate,
  getYesterdayFormattedDate,
  calculateStats,
  exportToCSV,
} from '../lib/utils';
import { api } from '../services/api';
import {
  FileSpreadsheet,
  Calendar,
  Download,
  FileText,
  Printer,
  TrendingUp,
  Banknote,
  CreditCard,
  UserCheck,
  CheckCircle,
  Database,
  Clock,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Lock,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const ReportsView: React.FC = () => {
  const [reportType, setReportType] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(getTodayFormattedDate());
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayFormattedDate());

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Daily Backups state
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  // Load report data based on selection
  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      let data: Transaction[] = [];
      if (reportType === 'today') {
        data = await api.getTransactions({ date: getTodayFormattedDate() });
      } else if (reportType === 'yesterday') {
        data = await api.getTransactions({ date: getYesterdayFormattedDate() });
      } else {
        data = await api.getTransactions({ startDate: customStartDate, endDate: customEndDate });
      }
      setTransactions(data);
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBackupsList = async () => {
    try {
      const list = await api.getBackups();
      setBackups(list);
    } catch (err) {
      console.error('Failed loading backups list:', err);
    }
  };

  useEffect(() => {
    fetchReportData();
    fetchBackupsList();
  }, [reportType, customStartDate, customEndDate]);

  const handleManualBackup = async () => {
    setIsGeneratingBackup(true);
    setBackupMessage(null);
    try {
      const res = await api.generateDailyBackup(getTodayFormattedDate());
      setBackupMessage(res.message);
      await fetchBackupsList();
    } catch (err: any) {
      setBackupMessage(`Backup generation failed: ${err.message}`);
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const stats: DashboardStats = calculateStats(transactions);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const titleDate =
      reportType === 'today'
        ? `Today (${formatDisplayDate(getTodayFormattedDate())})`
        : reportType === 'yesterday'
        ? `Yesterday (${formatDisplayDate(getYesterdayFormattedDate())})`
        : `${formatDisplayDate(customStartDate)} to ${formatDisplayDate(customEndDate)}`;

    doc.setFontSize(16);
    doc.text('COD Hub Operations - Reconciliation Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Period: ${titleDate}`, 14, 22);
    doc.text(
      `Total Transactions: ${stats.totalTransactions} | Total COD: Rs. ${stats.totalCodCollected.toLocaleString('en-IN')}`,
      14,
      27
    );
    doc.text(
      `Cash: Rs. ${stats.cashCollection.toLocaleString('en-IN')} | Online: Rs. ${stats.onlineCollection.toLocaleString('en-IN')} (Shashank: Rs. ${stats.onlineByShashank.toLocaleString('en-IN')}, Akshay: Rs. ${stats.onlineByAkshay.toLocaleString('en-IN')})`,
      14,
      32
    );

    const rows = transactions.map((t) => [
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
      body: rows,
      startY: 37,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 175] },
    });

    doc.save(`COD_Report_${reportType}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" /> Reconciliation & Daily Reports
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Generate and export daily Hub COD summaries from Excel records
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setReportType('today')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                reportType === 'today' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setReportType('yesterday')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                reportType === 'yesterday' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setReportType('custom')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                reportType === 'custom' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Custom Range
            </button>
          </div>

          {reportType === 'custom' && (
            <div className="flex items-center gap-2 text-xs bg-slate-50 p-1.5 rounded-lg border border-slate-200">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded font-semibold"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded font-semibold"
              />
            </div>
          )}
        </div>
      </div>

      {/* Report Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2 text-xs font-semibold uppercase tracking-wider">
            <span>Total Collection</span>
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{formatCurrency(stats.totalCodCollected)}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">{stats.totalTransactions} Transactions Processed</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2 text-xs font-semibold uppercase tracking-wider">
            <span>Cash Collection</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-700">{formatCurrency(stats.cashCollection)}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">Physical Cash in Vault</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2 text-xs font-semibold uppercase tracking-wider">
            <span>Online Collection</span>
            <CreditCard className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-extrabold text-indigo-700">{formatCurrency(stats.onlineCollection)}</p>
          <div className="flex items-center gap-2 text-xs text-slate-600 mt-2 pt-2 border-t border-slate-100">
            <span>
              Shashank: <strong>{formatCurrency(stats.onlineByShashank)}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Akshay: <strong>{formatCurrency(stats.onlineByAkshay)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Report Export Bar & Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" /> Report Details ({transactions.length} Records)
          </h3>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const dateParam = reportType === 'today' ? getTodayFormattedDate() : getYesterdayFormattedDate();
                window.open(api.getExcelDownloadUrl(dateParam), '_blank');
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download Excel (.xlsx)
            </button>

            <button
              onClick={() => exportToCSV(transactions, `COD_Report_${reportType}.csv`)}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" /> Export CSV
            </button>

            <button
              onClick={handleExportPDF}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-red-600" /> Export PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Time</th>
                <th className="py-3 px-4">Rider Name</th>
                <th className="py-3 px-4 text-right">Total COD</th>
                <th className="py-3 px-4 text-right">Cash</th>
                <th className="py-3 px-4 text-right">Online</th>
                <th className="py-3 px-4">Online Receiver</th>
                <th className="py-3 px-3">Payment Mode</th>
                <th className="py-3 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{formatDisplayDate(tx.date)}</td>
                    <td className="py-3 px-3 text-slate-600">{tx.time}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{tx.riderName}</td>
                    <td className="py-3 px-4 font-extrabold text-blue-700 text-right">
                      {formatCurrency(tx.codAmount)}
                    </td>
                    <td className="py-3 px-4 text-emerald-700 font-semibold text-right">
                      {tx.cashAmount > 0 ? formatCurrency(tx.cashAmount) : '—'}
                    </td>
                    <td className="py-3 px-4 text-indigo-700 font-semibold text-right">
                      {tx.onlineAmount > 0 ? formatCurrency(tx.onlineAmount) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {tx.onlineReceivedBy ? (
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                          {tx.onlineReceivedBy}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-800">
                        {tx.paymentMode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{tx.remarks || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No transactions found for the selected report period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Automatic Daily Backup System Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white mt-0.5">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Automatic Daily Backup Archives</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Nightly at 11:59 PM
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Every night at 11:59 PM, all riders, transactions, pending payments, daily closings, and audit logs are exported to <code className="text-blue-300 bg-slate-800 px-1.5 py-0.5 rounded">COD_YYYY-MM-DD.xlsx</code> and stored in Supabase Storage.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchBackupsList}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
              title="Refresh backups list"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>

            <button
              onClick={handleManualBackup}
              disabled={isGeneratingBackup}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            >
              {isGeneratingBackup ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating Backup...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-blue-200" /> Export Backup Now
                </>
              )}
            </button>
          </div>
        </div>

        {backupMessage && (
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> {backupMessage}
          </div>
        )}

        {/* Backups Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Backup File</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Included Datasets</th>
                <th className="py-3 px-4">File Size</th>
                <th className="py-3 px-4">Storage Location</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {backups.length > 0 ? (
                backups.map((b) => (
                  <tr key={b.fileName} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{b.fileName}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{formatDisplayDate(b.date)}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700 border border-slate-200">
                        5 Sheets (Riders, Txs, Pending, Closings, Logs)
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-600">{b.sizeFormatted || '—'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Supabase Storage (Immutable)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={b.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" /> Download (.xlsx)
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <Database className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No backup files found yet. Click <strong>Export Backup Now</strong> or wait for the automatic 11:59 PM nightly backup schedule.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
