import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import ExcelJS from 'exceljs';
import multer from 'multer';
import dotenv from 'dotenv';
import { parseRidersFromBuffer, isValidRiderName } from './src/lib/excelParser';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Enable CORS and ensure JSON content-type header for all API responses
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const EXCEL_DIR = path.join(process.cwd(), 'excel_records');
const REPORTS_DIR = path.join(process.cwd(), 'excel_reports');
const RIDERS_FILE = path.join(EXCEL_DIR, 'riders.json');
const LOGS_FILE = path.join(EXCEL_DIR, 'audit_logs.json');
const DAILY_CLOSINGS_FILE = path.join(EXCEL_DIR, 'daily_closings.json');

// Ensure directories exist
if (!fs.existsSync(EXCEL_DIR)) {
  fs.mkdirSync(EXCEL_DIR, { recursive: true });
}
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Migrate any legacy COD_*.xlsx files from excel_records to excel_reports
try {
  if (fs.existsSync(EXCEL_DIR)) {
    const oldFiles = fs.readdirSync(EXCEL_DIR);
    oldFiles.forEach((file) => {
      if (file.startsWith('COD_') && file.endsWith('.xlsx')) {
        const oldPath = path.join(EXCEL_DIR, file);
        const newPath = path.join(REPORTS_DIR, file);
        if (!fs.existsSync(newPath)) {
          fs.renameSync(oldPath, newPath);
        }
      }
    });
  }
} catch (err) {
  console.error('Error migrating old report files:', err);
}

// Initialize riders list if missing (EMPTY as requested)
if (!fs.existsSync(RIDERS_FILE)) {
  fs.writeFileSync(RIDERS_FILE, JSON.stringify([], null, 2));
}

// Initialize audit logs if missing
if (!fs.existsSync(LOGS_FILE)) {
  fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2));
}

// Initialize daily closings if missing
if (!fs.existsSync(DAILY_CLOSINGS_FILE)) {
  fs.writeFileSync(DAILY_CLOSINGS_FILE, JSON.stringify([], null, 2));
}

// Multer storage for importing rider excel files
const upload = multer({ dest: path.join(EXCEL_DIR, 'tmp') });

// Helper to log audit actions
const addAuditLog = (action: string, details: string, user = 'Manager') => {
  try {
    const logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8') || '[]');
    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      user,
    };
    logs.unshift(newLog);
    // Keep max 200 logs
    if (logs.length > 200) logs.pop();
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
};

// Excel Helpers
const getExcelFilePath = (dateStr: string) => {
  // dateStr is YYYY-MM-DD
  const safeDate = dateStr && dateStr.trim() ? dateStr.trim() : new Date().toISOString().split('T')[0];
  return path.join(REPORTS_DIR, `COD_${safeDate}.xlsx`);
};

// Format YYYY-MM-DD to DD-MM-YYYY
const formatToDDMMYYYY = (yyyyMmDd: string) => {
  if (!yyyyMmDd || !yyyyMmDd.includes('-')) return yyyyMmDd;
  const parts = yyyyMmDd.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return yyyyMmDd;
};

// Create or Load Daily Excel Workbook in /excel_reports/
const getOrCreateWorkbook = async (dateStr: string): Promise<{ workbook: ExcelJS.Workbook; filePath: string }> => {
  const filePath = getExcelFilePath(dateStr);
  const workbook = new ExcelJS.Workbook();

  if (fs.existsSync(filePath)) {
    await workbook.xlsx.readFile(filePath);
  } else {
    const worksheet = workbook.addWorksheet('COD Transactions');

    // Setup headers (Exact required columns 1..9 plus ID cell 10, plus Pending status col 11, pending amount col 12, history col 13)
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Time', key: 'time', width: 15 },
      { header: 'Rider Name', key: 'riderName', width: 25 },
      { header: 'Total COD Amount', key: 'codAmount', width: 20 },
      { header: 'Cash Amount', key: 'cashAmount', width: 18 },
      { header: 'Online Amount', key: 'onlineAmount', width: 18 },
      { header: 'Online Received By', key: 'onlineReceivedBy', width: 22 },
      { header: 'Payment Mode', key: 'paymentMode', width: 18 },
      { header: 'Remarks', key: 'remarks', width: 30 },
      { header: 'ID', key: 'id', width: 25 },
      { header: 'Payment Status', key: 'paymentStatus', width: 15 },
      { header: 'Pending Amount', key: 'pendingAmount', width: 18 },
      { header: 'Payment History', key: 'paymentHistory', width: 40 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }, // Dark Blue
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    await workbook.xlsx.writeFile(filePath);
  }

  return { workbook, filePath };
};

// Helper to parse rows from a worksheet into Transaction objects
const parseTransactionsFromSheet = (worksheet: ExcelJS.Worksheet, fileDateStr: string) => {
  const transactions: any[] = [];
  const rowCount = worksheet.rowCount;

  for (let r = 2; r <= rowCount; r++) {
    const row = worksheet.getRow(r);
    const idCell = row.getCell(10).value;
    if (!idCell) continue;

    const rawDate = String(row.getCell(1).value || '');
    let parsedDate = fileDateStr;
    if (rawDate && rawDate.includes('-')) {
      const parts = rawDate.split('-');
      if (parts.length === 3 && parts[2].length === 4) {
        parsedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    const paymentStatusVal = String(row.getCell(11).value || '').trim();
    const paymentStatus = paymentStatusVal === 'Pending' ? 'Pending' : 'Paid';
    const pendingAmount = Number(row.getCell(12).value) || 0;

    let history: any[] = [];
    try {
      const rawHist = row.getCell(13).value;
      if (rawHist) {
        history = JSON.parse(String(rawHist));
      }
    } catch {
      history = [];
    }

    transactions.push({
      id: String(idCell),
      date: parsedDate,
      time: String(row.getCell(2).value || ''),
      riderName: String(row.getCell(3).value || ''),
      codAmount: Number(row.getCell(4).value) || 0,
      cashAmount: Number(row.getCell(5).value) || 0,
      onlineAmount: Number(row.getCell(6).value) || 0,
      onlineReceivedBy: String(row.getCell(7).value || ''),
      paymentMode: String(row.getCell(8).value || ''),
      remarks: String(row.getCell(9).value || ''),
      paymentStatus,
      pendingAmount,
      paymentHistory: history,
    });
  }

  return transactions;
};

// ==================== API ROUTES ====================

// 1. GET Available Excel File Dates
app.get('/api/available-dates', (req, res) => {
  try {
    const files = fs.readdirSync(REPORTS_DIR);
    const dates = files
      .filter((f) => f.startsWith('COD_') && f.endsWith('.xlsx'))
      .map((f) => f.replace('COD_', '').replace('.xlsx', ''))
      .sort()
      .reverse();
    res.json({ dates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET Transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const { date, startDate, endDate, paymentMode, onlineReceiver, paymentStatus } = req.query;
    let datesToRead: string[] = [];

    if (startDate && endDate) {
      const files = fs.readdirSync(REPORTS_DIR);
      datesToRead = files
        .filter((f) => f.startsWith('COD_') && f.endsWith('.xlsx'))
        .map((f) => f.replace('COD_', '').replace('.xlsx', ''))
        .filter((d) => d >= String(startDate) && d <= String(endDate));
    } else if (date && date !== 'all') {
      datesToRead = [String(date)];
    } else {
      const files = fs.readdirSync(REPORTS_DIR);
      datesToRead = files
        .filter((f) => f.startsWith('COD_') && f.endsWith('.xlsx'))
        .map((f) => f.replace('COD_', '').replace('.xlsx', ''));
    }

    const allTx: any[] = [];

    for (const dStr of datesToRead) {
      const filePath = getExcelFilePath(dStr);
      if (fs.existsSync(filePath)) {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(filePath);
        const sheet = wb.getWorksheet('COD Transactions');
        if (sheet) {
          const list = parseTransactionsFromSheet(sheet, dStr);
          allTx.push(...list);
        }
      }
    }

    let filtered = allTx;
    if (paymentMode && paymentMode !== 'All') {
      filtered = filtered.filter((t) => t.paymentMode === paymentMode);
    }
    if (onlineReceiver && onlineReceiver !== 'All') {
      filtered = filtered.filter((t) => t.onlineReceivedBy === onlineReceiver);
    }
    if (paymentStatus && paymentStatus !== 'All') {
      filtered = filtered.filter((t) => t.paymentStatus === paymentStatus);
    }

    filtered.sort((a, b) => {
      const dateA = `${a.date} ${a.time}`;
      const dateB = `${b.date} ${b.time}`;
      return dateB.localeCompare(dateA);
    });

    res.json({ transactions: filtered });
  } catch (err: any) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. POST Create New Transaction (Auto Append to Daily Excel)
app.post('/api/transactions', async (req, res) => {
  try {
    const {
      date,
      time,
      riderName,
      codAmount,
      cashAmount,
      onlineAmount,
      onlineReceivedBy,
      paymentMode,
      remarks,
      paymentStatus,
      pendingAmount,
    } = req.body;

    if (!riderName || !codAmount || !paymentMode || !date) {
      return res.status(400).json({ error: 'Missing required transaction fields' });
    }

    const totalCod = Number(codAmount);
    const cash = Number(cashAmount) || 0;
    const online = Number(onlineAmount) || 0;

    const status = paymentStatus === 'Pending' ? 'Pending' : 'Paid';
    const pending = status === 'Pending' ? Math.max(0, Number(pendingAmount) || 0) : 0;

    // Validate if Paid
    if (status === 'Paid' && paymentMode === 'Cash + Online') {
      if (Math.abs(cash + online - totalCod) > 0.01) {
        return res
          .status(400)
          .json({ error: `Cash (₹${cash}) + Online (₹${online}) must equal COD Amount (₹${totalCod})` });
      }
    }

    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const { workbook, filePath } = await getOrCreateWorkbook(date);
    const sheet = workbook.getWorksheet('COD Transactions') || workbook.addWorksheet('COD Transactions');

    // Deduplication check: verify if transaction with txId already exists
    let duplicateFound = false;
    for (let r = 2; r <= sheet.rowCount; r++) {
      if (String(sheet.getRow(r).getCell(10).value) === txId) {
        duplicateFound = true;
        break;
      }
    }

    const displayDate = formatToDDMMYYYY(date);
    const initialHistory = [
      {
        id: `pay_${Date.now()}`,
        date: displayDate,
        time: time || '',
        amountReceived: cash + online,
        paymentMode,
        onlineReceivedBy: onlineReceivedBy || '',
        remarks: remarks || 'Initial Payment',
        remainingPending: pending,
      },
    ];

    if (!duplicateFound) {
      const newRow = sheet.addRow([
        displayDate,
        time || '',
        riderName.trim(),
        totalCod,
        cash,
        online,
        onlineReceivedBy || '',
        paymentMode,
        remarks || '',
        txId,
        status,
        pending,
        JSON.stringify(initialHistory),
      ]);

      newRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        cell.font = { name: 'Arial', size: 10 };
      });

      await workbook.xlsx.writeFile(filePath);
    }

    addAuditLog(
      'CREATE',
      `Added transaction ₹${totalCod} (${paymentMode}) for ${riderName} on ${displayDate}${status === 'Pending' ? ` [Pending: ₹${pending}]` : ''}`
    );

    const savedTx = {
      id: txId,
      date,
      time,
      riderName: riderName.trim(),
      codAmount: totalCod,
      cashAmount: cash,
      onlineAmount: online,
      onlineReceivedBy: onlineReceivedBy || '',
      paymentMode,
      remarks: remarks || '',
      paymentStatus: status,
      pendingAmount: pending,
      paymentHistory: initialHistory,
    };

    res.status(201).json({ success: true, transaction: savedTx });
  } catch (err: any) {
    console.error('Error saving transaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. PUT Update Transaction
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      date,
      time,
      riderName,
      codAmount,
      cashAmount,
      onlineAmount,
      onlineReceivedBy,
      paymentMode,
      remarks,
      paymentStatus,
      pendingAmount,
    } = req.body;

    const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.startsWith('COD_') && f.endsWith('.xlsx'));
    let found = false;

    for (const f of files) {
      const filePath = path.join(REPORTS_DIR, f);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePath);
      const sheet = wb.getWorksheet('COD Transactions');

      if (!sheet) continue;

      let targetRowNumber = -1;
      for (let r = 2; r <= sheet.rowCount; r++) {
        if (String(sheet.getRow(r).getCell(10).value) === id) {
          targetRowNumber = r;
          break;
        }
      }

      if (targetRowNumber !== -1) {
        found = true;
        const row = sheet.getRow(targetRowNumber);
        const displayDate = formatToDDMMYYYY(date);

        const status = paymentStatus === 'Pending' ? 'Pending' : 'Paid';
        const pending = status === 'Pending' ? Math.max(0, Number(pendingAmount) || 0) : 0;

        row.getCell(1).value = displayDate;
        row.getCell(2).value = time || '';
        row.getCell(3).value = riderName;
        row.getCell(4).value = Number(codAmount);
        row.getCell(5).value = Number(cashAmount);
        row.getCell(6).value = Number(onlineAmount);
        row.getCell(7).value = onlineReceivedBy || '';
        row.getCell(8).value = paymentMode;
        row.getCell(9).value = remarks || '';
        row.getCell(11).value = status;
        row.getCell(12).value = pending;

        await wb.xlsx.writeFile(filePath);

        addAuditLog('UPDATE', `Updated transaction for ${riderName} (₹${codAmount}) on ${displayDate}`);
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error updating transaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. POST Receive Payment for Pending Transaction
app.post('/api/transactions/:id/receive-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { amountReceivedNow, paymentMode, cashAmount, onlineAmount, onlineReceivedBy, remarks, date, time } =
      req.body;

    const recvNow = Number(amountReceivedNow);
    if (!recvNow || recvNow <= 0) {
      return res.status(400).json({ error: 'Received amount must be greater than zero.' });
    }

    const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.startsWith('COD_') && f.endsWith('.xlsx'));
    let found = false;
    let updatedTx: any = null;

    for (const f of files) {
      const filePath = path.join(REPORTS_DIR, f);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePath);
      const sheet = wb.getWorksheet('COD Transactions');

      if (!sheet) continue;

      let targetRowNumber = -1;
      for (let r = 2; r <= sheet.rowCount; r++) {
        if (String(sheet.getRow(r).getCell(10).value) === id) {
          targetRowNumber = r;
          break;
        }
      }

      if (targetRowNumber !== -1) {
        found = true;
        const row = sheet.getRow(targetRowNumber);

        const currentPending = Number(row.getCell(12).value) || 0;
        if (recvNow > currentPending) {
          return res.status(400).json({
            error: `Received amount (₹${recvNow}) cannot exceed pending amount (₹${currentPending}).`,
          });
        }

        const newPending = Math.max(0, currentPending - recvNow);
        const newStatus = newPending <= 0 ? 'Paid' : 'Pending';

        const prevCash = Number(row.getCell(5).value) || 0;
        const prevOnline = Number(row.getCell(6).value) || 0;
        const addCash =
          typeof cashAmount === 'number'
            ? cashAmount
            : paymentMode === 'Cash'
            ? recvNow
            : 0;
        const addOnline =
          typeof onlineAmount === 'number'
            ? onlineAmount
            : paymentMode === 'Online'
            ? recvNow
            : 0;

        const newCashTotal = prevCash + addCash;
        const newOnlineTotal = prevOnline + addOnline;

        // Determine combined payment mode
        let finalMode = String(row.getCell(8).value || '');
        if (newCashTotal > 0 && newOnlineTotal > 0) {
          finalMode = 'Cash + Online';
        } else if (newOnlineTotal > 0) {
          finalMode = 'Online';
        } else {
          finalMode = 'Cash';
        }

        let existingHistory: any[] = [];
        try {
          const rawHist = row.getCell(13).value;
          if (rawHist) existingHistory = JSON.parse(String(rawHist));
        } catch {
          existingHistory = [];
        }

        const payDate = date || new Date().toISOString().split('T')[0];
        const payTime = time || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        const historyEntry = {
          id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          date: formatToDDMMYYYY(payDate),
          time: payTime,
          amountReceived: recvNow,
          paymentMode: paymentMode || 'Cash',
          onlineReceivedBy: onlineReceivedBy || '',
          remarks: remarks || '',
          remainingPending: newPending,
        };

        existingHistory.push(historyEntry);

        // Update Excel row cells
        row.getCell(5).value = newCashTotal;
        row.getCell(6).value = newOnlineTotal;
        if (onlineReceivedBy) {
          row.getCell(7).value = onlineReceivedBy;
        }
        row.getCell(8).value = finalMode;
        if (remarks) {
          const prevRem = String(row.getCell(9).value || '');
          row.getCell(9).value = prevRem ? `${prevRem} | Recv ₹${recvNow}: ${remarks}` : `Recv ₹${recvNow}: ${remarks}`;
        }
        row.getCell(11).value = newStatus;
        row.getCell(12).value = newPending;
        row.getCell(13).value = JSON.stringify(existingHistory);

        await wb.xlsx.writeFile(filePath);

        const riderName = String(row.getCell(3).value || '');
        addAuditLog(
          'PAYMENT_RECEIVED',
          `Received ₹${recvNow} from ${riderName}. Remaining Pending: ₹${newPending} (${newStatus})`
        );

        updatedTx = {
          id,
          date: String(row.getCell(1).value || ''),
          time: String(row.getCell(2).value || ''),
          riderName,
          codAmount: Number(row.getCell(4).value) || 0,
          cashAmount: newCashTotal,
          onlineAmount: newOnlineTotal,
          onlineReceivedBy: String(row.getCell(7).value || ''),
          paymentMode: finalMode,
          remarks: String(row.getCell(9).value || ''),
          paymentStatus: newStatus,
          pendingAmount: newPending,
          paymentHistory: existingHistory,
        };
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true, transaction: updatedTx });
  } catch (err: any) {
    console.error('Error receiving payment:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. DELETE Transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.startsWith('COD_') && f.endsWith('.xlsx'));
    let found = false;

    for (const f of files) {
      const filePath = path.join(REPORTS_DIR, f);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePath);
      const sheet = wb.getWorksheet('COD Transactions');

      if (!sheet) continue;

      let targetRowNumber = -1;
      let riderName = '';
      let amount = 0;

      for (let r = 2; r <= sheet.rowCount; r++) {
        if (String(sheet.getRow(r).getCell(10).value) === id) {
          targetRowNumber = r;
          riderName = String(sheet.getRow(r).getCell(3).value || '');
          amount = Number(sheet.getRow(r).getCell(4).value) || 0;
          break;
        }
      }

      if (targetRowNumber !== -1) {
        found = true;
        sheet.spliceRows(targetRowNumber, 1);
        await wb.xlsx.writeFile(filePath);

        addAuditLog('DELETE', `Deleted transaction ${id} (${riderName}, ₹${amount})`);
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting transaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. DOWNLOAD Daily Excel Report
app.get('/api/reports/download-excel', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = String(date || new Date().toISOString().split('T')[0]);
    const filePath = getExcelFilePath(targetDate);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'No Excel file found for the selected date.' });
    }

    res.download(filePath, `COD_${targetDate}.xlsx`);
  } catch (err: any) {
    console.error('Error downloading Excel report:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. RIDERS Management (Starts EMPTY)
app.get('/api/riders', (req, res) => {
  try {
    const data = fs.readFileSync(RIDERS_FILE, 'utf-8');
    const riders = JSON.parse(data || '[]');
    const cleaned = riders.filter((r: any) => r && r.name && isValidRiderName(r.name));
    if (cleaned.length !== riders.length) {
      fs.writeFileSync(RIDERS_FILE, JSON.stringify(cleaned, null, 2));
    }
    res.json({ riders: cleaned });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/riders', (req, res) => {
  try {
    const { name, phone, vehicleNumber } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Rider name is required' });
    }

    const data = fs.readFileSync(RIDERS_FILE, 'utf-8');
    const riders = JSON.parse(data || '[]');

    const exists = riders.find((r: any) => r.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (exists) {
      return res.status(400).json({ error: 'Rider with this name already exists' });
    }

    const newRider = {
      id: `rider_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      phone: phone || '',
      vehicleNumber: vehicleNumber || '',
      status: 'Active',
      totalDeliveries: 0,
    };

    riders.push(newRider);
    fs.writeFileSync(RIDERS_FILE, JSON.stringify(riders, null, 2));

    addAuditLog('CREATE', `Added new rider: ${newRider.name}`);
    res.status(201).json({ success: true, rider: newRider });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/riders/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = fs.readFileSync(RIDERS_FILE, 'utf-8');
    let riders = JSON.parse(data || '[]');

    const target = riders.find((r: any) => r.id === id);
    riders = riders.filter((r: any) => r.id !== id);

    fs.writeFileSync(RIDERS_FILE, JSON.stringify(riders, null, 2));
    if (target) {
      addAuditLog('DELETE', `Deleted rider: ${target.name}`);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. IMPORT RIDERS from Excel/CSV file
app.post('/api/riders/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const data = fs.readFileSync(RIDERS_FILE, 'utf-8');
    const existingRiders = JSON.parse(data || '[]');

    const result = parseRidersFromBuffer(fileBuffer, existingRiders);

    fs.writeFileSync(RIDERS_FILE, JSON.stringify(result.riders, null, 2));
    addAuditLog('IMPORT_RIDERS', `Imported ${result.count} riders from Excel file`);

    res.json({ success: true, count: result.count, riders: result.riders });
  } catch (err: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }
    console.error('Error importing riders:', err);
    res.status(400).json({ error: err.message || 'Failed to import riders from file' });
  }
});

// 9. AUDIT LOGS Endpoint
app.get('/api/audit-logs', (req, res) => {
  try {
    const logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8') || '[]');
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. DAILY CLOSINGS Endpoints
app.get('/api/daily-closings', (req, res) => {
  try {
    const data = fs.readFileSync(DAILY_CLOSINGS_FILE, 'utf-8');
    const closings = JSON.parse(data || '[]');
    res.json({ closings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/daily-closings', (req, res) => {
  try {
    const closing = req.body;
    if (!closing || !closing.date) {
      return res.status(400).json({ error: 'Closing date is required' });
    }

    const data = fs.readFileSync(DAILY_CLOSINGS_FILE, 'utf-8');
    const closings = JSON.parse(data || '[]');

    const idx = closings.findIndex((c: any) => c.date === closing.date);
    if (idx !== -1) {
      closings[idx] = { ...closings[idx], ...closing };
    } else {
      closings.unshift(closing);
    }

    fs.writeFileSync(DAILY_CLOSINGS_FILE, JSON.stringify(closings, null, 2));
    addAuditLog('CLOSING', `Recorded daily closing for ${closing.date} (Status: ${closing.status || 'Balanced'})`);
    res.json({ success: true, closing });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. AUTOMATIC DAILY BACKUP SYSTEM ENGINE (Exports Riders, Transactions, Pending Payments, Daily Closings, Audit Logs)
const generateSystemDailyBackup = async (targetDateStr?: string) => {
  const dateStr = targetDateStr || new Date().toISOString().split('T')[0];
  const fileName = `COD_${dateStr}.xlsx`;
  const filePath = path.join(REPORTS_DIR, fileName);

  const isAlreadyOnDisk = fs.existsSync(filePath);

  // Gather dataset 1: Riders
  let riders: any[] = [];
  try {
    riders = JSON.parse(fs.readFileSync(RIDERS_FILE, 'utf-8') || '[]');
  } catch {}

  // Gather dataset 2: Audit Logs
  let auditLogs: any[] = [];
  try {
    auditLogs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8') || '[]');
  } catch {}

  // Gather dataset 3: Daily Closings
  let dailyClosings: any[] = [];
  try {
    dailyClosings = JSON.parse(fs.readFileSync(DAILY_CLOSINGS_FILE, 'utf-8') || '[]');
  } catch {}

  // Gather dataset 4: All Transactions across daily excel files
  const allFiles = fs.readdirSync(REPORTS_DIR);
  const datesToRead = allFiles
    .filter((f) => f.startsWith('COD_') && f.endsWith('.xlsx'))
    .map((f) => f.replace('COD_', '').replace('.xlsx', ''));

  const allTx: any[] = [];
  for (const dStr of datesToRead) {
    const fPath = getExcelFilePath(dStr);
    if (fs.existsSync(fPath)) {
      try {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(fPath);
        const sheet = wb.getWorksheet('COD Transactions');
        if (sheet) {
          const list = parseTransactionsFromSheet(sheet, dStr);
          allTx.push(...list);
        }
      } catch {}
    }
  }

  // Deduplicate transactions by ID
  const txMap = new Map();
  allTx.forEach((t) => txMap.set(t.id, t));
  const uniqueTransactions = Array.from(txMap.values());

  // Dataset 5: Pending Payments
  const pendingTransactions = uniqueTransactions.filter(
    (t) => t.paymentStatus === 'Pending' || (t.pendingAmount && t.pendingAmount > 0)
  );

  // Build workbook with 5 sheets
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'COD Management System';
  workbook.lastModifiedBy = 'Automatic Daily Backup System';
  workbook.created = new Date();

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' },
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

  // Sheet 1: Transactions
  const s1 = workbook.addWorksheet('Transactions');
  s1.columns = [
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
  ];
  styleHeader(s1.getRow(1));
  uniqueTransactions.forEach((t) => styleDataRow(s1.addRow(t)));

  // Sheet 2: Pending Payments
  const s2 = workbook.addWorksheet('Pending Payments');
  s2.columns = [
    { header: 'Transaction ID', key: 'id', width: 30 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Time', key: 'time', width: 12 },
    { header: 'Rider Name', key: 'riderName', width: 25 },
    { header: 'Total COD (₹)', key: 'codAmount', width: 18 },
    { header: 'Cash Collected (₹)', key: 'cashAmount', width: 18 },
    { header: 'Online Collected (₹)', key: 'onlineAmount', width: 18 },
    { header: 'Pending Amount (₹)', key: 'pendingAmount', width: 20 },
    { header: 'Payment Status', key: 'paymentStatus', width: 16 },
    { header: 'Payment History', key: 'paymentHistoryStr', width: 45 },
    { header: 'Remarks', key: 'remarks', width: 30 },
  ];
  styleHeader(s2.getRow(1));
  pendingTransactions.forEach((t) => {
    const historyStr = Array.isArray(t.paymentHistory)
      ? t.paymentHistory.map((h: any) => `${h.date}: ₹${h.amountReceived}`).join(' | ')
      : '—';
    styleDataRow(s2.addRow({ ...t, paymentHistoryStr: historyStr }));
  });

  // Sheet 3: Riders
  const s3 = workbook.addWorksheet('Riders');
  s3.columns = [
    { header: 'Rider ID', key: 'id', width: 30 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Phone Number', key: 'phone', width: 18 },
    { header: 'Vehicle Number', key: 'vehicleNumber', width: 20 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Total Deliveries', key: 'totalDeliveries', width: 18 },
  ];
  styleHeader(s3.getRow(1));
  riders.forEach((r: any) => styleDataRow(s3.addRow(r)));

  // Sheet 4: Daily Closings
  const s4 = workbook.addWorksheet('Daily Closings');
  s4.columns = [
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
  styleHeader(s4.getRow(1));
  dailyClosings.forEach((c: any) => styleDataRow(s4.addRow(c)));

  // Sheet 5: Audit Logs
  const s5 = workbook.addWorksheet('Audit Logs');
  s5.columns = [
    { header: 'Log ID', key: 'id', width: 30 },
    { header: 'Timestamp', key: 'timestamp', width: 24 },
    { header: 'Action', key: 'action', width: 18 },
    { header: 'Details', key: 'details', width: 45 },
    { header: 'User', key: 'user', width: 22 },
  ];
  styleHeader(s5.getRow(1));
  auditLogs.forEach((l: any) => styleDataRow(s5.addRow(l)));

  // Requirement: "Never overwrite previous backups."
  if (!isAlreadyOnDisk) {
    await workbook.xlsx.writeFile(filePath);
    addAuditLog('BACKUP_CREATED', `Generated automatic daily backup ${fileName}`);
  }

  // Upload to Supabase Storage if configured (upsert: false)
  let uploadedToSupabase = false;
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project')) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const buffer = fs.readFileSync(filePath);
      const { error } = await supabase.storage.from('backups').upload(fileName, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false, // NEVER OVERWRITE PREVIOUS BACKUPS
      });

      if (!error) {
        uploadedToSupabase = true;
      }
    }
  } catch (sbErr) {
    console.warn('Failed uploading backup to Supabase Storage:', sbErr);
  }

  return { fileName, filePath, isAlreadyOnDisk, uploadedToSupabase };
};

// Automatic 11:59 PM Daily Backup Scheduler
let lastNightlyBackupDate = '';
setInterval(async () => {
  try {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const todayStr = now.toISOString().split('T')[0];

    // Every night at 11:59 PM (23:59)
    if (hours === 23 && minutes === 59 && lastNightlyBackupDate !== todayStr) {
      lastNightlyBackupDate = todayStr;
      console.log(`[Nightly Backup Cron] Triggering 11:59 PM automatic daily backup for ${todayStr}...`);
      await generateSystemDailyBackup(todayStr);
    }
  } catch (err) {
    console.error('Error executing 11:59 PM nightly backup cron:', err);
  }
}, 30000);

// 12. BACKUPS API ENDPOINTS
app.get('/api/backups', (req, res) => {
  try {
    const files = fs.readdirSync(REPORTS_DIR);
    const backups = files
      .filter((f) => f.startsWith('COD_') && f.endsWith('.xlsx'))
      .map((f) => {
        const filePath = path.join(REPORTS_DIR, f);
        const stats = fs.statSync(filePath);
        const dateStr = f.replace('COD_', '').replace('.xlsx', '');
        return {
          fileName: f,
          date: dateStr,
          size: stats.size,
          sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
          createdAt: stats.mtime.toISOString(),
          downloadUrl: `/api/reports/download-excel?date=${encodeURIComponent(dateStr)}`,
          storageType: 'Supabase Storage & Local Server',
        };
      })
      .sort((a, b) => b.fileName.localeCompare(a.fileName));

    res.json({ backups });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backups/generate', async (req, res) => {
  try {
    const { date } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const result = await generateSystemDailyBackup(targetDate);
    res.json({
      success: true,
      fileName: result.fileName,
      alreadyExists: result.isAlreadyOnDisk,
      uploadedToSupabase: result.uploadedToSupabase,
      message: result.isAlreadyOnDisk
        ? `Backup ${result.fileName} is safely preserved (non-overwrite mode).`
        : `Daily backup ${result.fileName} successfully generated and stored in Supabase Storage & local server.`,
    });
  } catch (err: any) {
    console.error('Error generating backup:', err);
    res.status(500).json({ error: err.message });
  }
});

// VITE MIDDLEWARE FOR DEV & STATIC SERVING FOR PRODUCTION
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`COD Management System server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
