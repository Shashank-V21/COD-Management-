import ExcelJS from 'exceljs';
import { Rider, Transaction, DailyClosingReport, AuditLog, BackupFile } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

export interface BackupData {
  riders: Rider[];
  transactions: Transaction[];
  dailyClosings: DailyClosingReport[];
  auditLogs: AuditLog[];
}

/**
 * Generates an Excel workbook (.xlsx) containing 5 sheets:
 * 1. Transactions
 * 2. Pending Payments
 * 3. Riders
 * 4. Daily Closings
 * 5. Audit Logs
 */
export async function createBackupExcelWorkbook(data: BackupData): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'COD Management System';
  workbook.lastModifiedBy = 'Automatic Daily Backup System';
  workbook.created = new Date();

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' }, // Dark Blue
  };
  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Arial',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  const cellBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  const styleHeader = (row: ExcelJS.Row) => {
    row.height = 26;
    row.font = headerFont;
    row.fill = headerFill;
    row.alignment = { vertical: 'middle', horizontal: 'center' };
  };

  const styleDataRow = (row: ExcelJS.Row) => {
    row.height = 20;
    row.eachCell((cell) => {
      cell.border = cellBorder;
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle' };
    });
  };

  // ----------------------------------------------------
  // 1. TRANSACTIONS SHEET
  // ----------------------------------------------------
  const txSheet = workbook.addWorksheet('Transactions');
  txSheet.columns = [
    { header: 'ID', key: 'id', width: 30 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Time', key: 'time', width: 12 },
    { header: 'Rider Name', key: 'riderName', width: 25 },
    { header: 'COD Amount (₹)', key: 'codAmount', width: 18 },
    { header: 'Cash Amount (₹)', key: 'cashAmount', width: 18 },
    { header: 'Online Amount (₹)', key: 'onlineAmount', width: 18 },
    { header: 'Online Received By', key: 'onlineReceivedBy', width: 20 },
    { header: 'Payment Mode', key: 'paymentMode', width: 18 },
    { header: 'Payment Status', key: 'paymentStatus', width: 16 },
    { header: 'Pending Amount (₹)', key: 'pendingAmount', width: 18 },
    { header: 'Remarks', key: 'remarks', width: 30 },
    { header: 'Created At', key: 'createdAt', width: 22 },
  ];
  styleHeader(txSheet.getRow(1));

  data.transactions.forEach((tx) => {
    const row = txSheet.addRow({
      id: tx.id,
      date: tx.date,
      time: tx.time,
      riderName: tx.riderName,
      codAmount: tx.codAmount || 0,
      cashAmount: tx.cashAmount || 0,
      onlineAmount: tx.onlineAmount || 0,
      onlineReceivedBy: tx.onlineReceivedBy || '—',
      paymentMode: tx.paymentMode,
      paymentStatus: tx.paymentStatus || 'Paid',
      pendingAmount: tx.pendingAmount || 0,
      remarks: tx.remarks || '',
      createdAt: tx.createdAt || tx.date,
    });
    styleDataRow(row);
  });

  // ----------------------------------------------------
  // 2. PENDING PAYMENTS SHEET
  // ----------------------------------------------------
  const pendingSheet = workbook.addWorksheet('Pending Payments');
  pendingSheet.columns = [
    { header: 'Transaction ID', key: 'id', width: 30 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Time', key: 'time', width: 12 },
    { header: 'Rider Name', key: 'riderName', width: 25 },
    { header: 'Total COD (₹)', key: 'codAmount', width: 18 },
    { header: 'Cash Collected (₹)', key: 'cashAmount', width: 18 },
    { header: 'Online Collected (₹)', key: 'onlineAmount', width: 18 },
    { header: 'Pending Amount (₹)', key: 'pendingAmount', width: 20 },
    { header: 'Payment Status', key: 'paymentStatus', width: 16 },
    { header: 'Payment History', key: 'paymentHistory', width: 45 },
    { header: 'Remarks', key: 'remarks', width: 30 },
  ];
  styleHeader(pendingSheet.getRow(1));

  const pendingTxs = data.transactions.filter(
    (t) => t.paymentStatus === 'Pending' || (t.pendingAmount && t.pendingAmount > 0)
  );

  pendingTxs.forEach((tx) => {
    const historySummary = Array.isArray(tx.paymentHistory)
      ? tx.paymentHistory.map((h) => `${h.date}: ₹${h.amountReceived} (${h.paymentMode || 'Cash'})`).join(' | ')
      : '—';

    const row = pendingSheet.addRow({
      id: tx.id,
      date: tx.date,
      time: tx.time,
      riderName: tx.riderName,
      codAmount: tx.codAmount || 0,
      cashAmount: tx.cashAmount || 0,
      onlineAmount: tx.onlineAmount || 0,
      pendingAmount: tx.pendingAmount || 0,
      paymentStatus: tx.paymentStatus || 'Pending',
      paymentHistory: historySummary,
      remarks: tx.remarks || '',
    });
    styleDataRow(row);
  });

  // ----------------------------------------------------
  // 3. RIDERS SHEET
  // ----------------------------------------------------
  const riderSheet = workbook.addWorksheet('Riders');
  riderSheet.columns = [
    { header: 'Rider ID', key: 'id', width: 30 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Phone Number', key: 'phone', width: 18 },
    { header: 'Vehicle Number', key: 'vehicleNumber', width: 20 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Total Deliveries', key: 'totalDeliveries', width: 18 },
  ];
  styleHeader(riderSheet.getRow(1));

  data.riders.forEach((r) => {
    const row = riderSheet.addRow({
      id: r.id,
      name: r.name,
      phone: r.phone || '—',
      vehicleNumber: r.vehicleNumber || '—',
      status: r.status || 'Active',
      totalDeliveries: r.totalDeliveries || 0,
    });
    styleDataRow(row);
  });

  // ----------------------------------------------------
  // 4. DAILY CLOSINGS SHEET
  // ----------------------------------------------------
  const closingsSheet = workbook.addWorksheet('Daily Closings');
  closingsSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Closed At', key: 'closedAt', width: 22 },
    { header: 'Total Transactions', key: 'totalTransactions', width: 20 },
    { header: 'Total COD (₹)', key: 'totalCod', width: 18 },
    { header: 'Total Cash (₹)', key: 'totalCash', width: 18 },
    { header: 'Total Online (₹)', key: 'totalOnline', width: 18 },
    { header: 'Shashank Online (₹)', key: 'shashankOnline', width: 20 },
    { header: 'Akshay Online (₹)', key: 'akshayOnline', width: 20 },
    { header: 'Total Riders', key: 'totalRiders', width: 15 },
    { header: 'Reconciliation Status', key: 'status', width: 20 },
    { header: 'Closing Notes', key: 'notes', width: 35 },
  ];
  styleHeader(closingsSheet.getRow(1));

  data.dailyClosings.forEach((c) => {
    const row = closingsSheet.addRow({
      date: c.date,
      closedAt: c.closedAt || '—',
      totalTransactions: c.totalTransactions || 0,
      totalCod: c.totalCod || 0,
      totalCash: c.totalCash || 0,
      totalOnline: c.totalOnline || 0,
      shashankOnline: c.shashankOnline || 0,
      akshayOnline: c.akshayOnline || 0,
      totalRiders: c.totalRiders || 0,
      status: c.status || 'Balanced',
      notes: c.notes || '',
    });
    styleDataRow(row);
  });

  // ----------------------------------------------------
  // 5. AUDIT LOGS SHEET
  // ----------------------------------------------------
  const auditSheet = workbook.addWorksheet('Audit Logs');
  auditSheet.columns = [
    { header: 'Log ID', key: 'id', width: 30 },
    { header: 'Timestamp', key: 'timestamp', width: 24 },
    { header: 'Action', key: 'action', width: 18 },
    { header: 'Details', key: 'details', width: 45 },
    { header: 'User', key: 'user', width: 22 },
  ];
  styleHeader(auditSheet.getRow(1));

  data.auditLogs.forEach((l) => {
    const row = auditSheet.addRow({
      id: l.id,
      timestamp: l.timestamp,
      action: l.action,
      details: l.details,
      user: l.user || 'System',
    });
    styleDataRow(row);
  });

  return workbook;
}

/**
 * Uploads a backup file to Supabase Storage in the 'backups' bucket.
 * Enforces NO OVERWRITE (upsert: false).
 */
export async function uploadBackupToSupabase(
  fileName: string,
  buffer: ArrayBuffer | Uint8Array | Blob
): Promise<{ success: boolean; alreadyExists?: boolean; error?: string; url?: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    // 1. Check if backups bucket exists or ensure file doesn't exist
    const { data: existingFiles } = await supabase.storage.from('backups').list('', {
      search: fileName,
    });

    const fileExists = existingFiles && existingFiles.some((f) => f.name === fileName);
    if (fileExists) {
      const publicUrl = supabase.storage.from('backups').getPublicUrl(fileName).data.publicUrl;
      return {
        success: true,
        alreadyExists: true,
        url: publicUrl,
        error: `File ${fileName} already exists in Supabase Storage and was preserved (non-overwrite).`,
      };
    }

    // 2. Upload with upsert: false
    const { data, error } = await supabase.storage.from('backups').upload(fileName, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: false,
    });

    if (error) {
      if (error.message?.includes('already exists') || (error as any).statusCode === '409') {
        const publicUrl = supabase.storage.from('backups').getPublicUrl(fileName).data.publicUrl;
        return {
          success: true,
          alreadyExists: true,
          url: publicUrl,
        };
      }
      return { success: false, error: error.message };
    }

    const publicUrl = supabase.storage.from('backups').getPublicUrl(fileName).data.publicUrl;
    return { success: true, url: publicUrl };
  } catch (err: any) {
    return { success: false, error: err.message || 'Storage upload failed' };
  }
}

/**
 * Lists all backups stored in Supabase Storage.
 */
export async function fetchSupabaseBackupsList(): Promise<BackupFile[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase.storage.from('backups').list('', {
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (error || !data) return [];

    return data
      .filter((f) => f.name.endsWith('.xlsx'))
      .map((f) => {
        const dateMatch = f.name.match(/COD_(\d{4}-\d{2}-\d{2})/);
        const dateStr = dateMatch ? dateMatch[1] : f.created_at?.split('T')[0] || '';
        const sizeKb = f.metadata?.size ? (f.metadata.size / 1024).toFixed(1) + ' KB' : '—';
        const publicUrl = supabase.storage.from('backups').getPublicUrl(f.name).data.publicUrl;

        return {
          fileName: f.name,
          date: dateStr,
          size: f.metadata?.size || 0,
          sizeFormatted: sizeKb,
          createdAt: f.created_at || new Date().toISOString(),
          downloadUrl: publicUrl,
          storageType: 'Supabase Storage',
        };
      });
  } catch (err) {
    console.error('Failed to list Supabase backups:', err);
    return [];
  }
}
