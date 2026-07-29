import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import ExcelJS from 'exceljs';
import multer from 'multer';
import { parseRidersFromBuffer, isValidRiderName } from './src/lib/excelParser';

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

    // Setup headers (Exact required columns 1..9 plus ID cell 10)
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
    const { date, startDate, endDate, paymentMode, onlineReceiver } = req.query;
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
    const { date, time, riderName, codAmount, cashAmount, onlineAmount, onlineReceivedBy, paymentMode, remarks } =
      req.body;

    if (!riderName || !codAmount || !paymentMode || !date) {
      return res.status(400).json({ error: 'Missing required transaction fields' });
    }

    const totalCod = Number(codAmount);
    const cash = Number(cashAmount) || 0;
    const online = Number(onlineAmount) || 0;

    if (paymentMode === 'Cash + Online') {
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

    if (!duplicateFound) {
      const displayDate = formatToDDMMYYYY(date);
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

    const displayDate = formatToDDMMYYYY(date);
    addAuditLog(
      'CREATE',
      `Added transaction ₹${totalCod} (${paymentMode}) for ${riderName} on ${displayDate}`
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
    const { date, time, riderName, codAmount, cashAmount, onlineAmount, onlineReceivedBy, paymentMode, remarks } =
      req.body;

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

        row.getCell(1).value = displayDate;
        row.getCell(2).value = time || '';
        row.getCell(3).value = riderName;
        row.getCell(4).value = Number(codAmount);
        row.getCell(5).value = Number(cashAmount);
        row.getCell(6).value = Number(onlineAmount);
        row.getCell(7).value = onlineReceivedBy || '';
        row.getCell(8).value = paymentMode;
        row.getCell(9).value = remarks || '';
        row.commit();

        await wb.xlsx.writeFile(filePath);

        addAuditLog('UPDATE', `Updated transaction ${id} for ${riderName} (₹${codAmount})`);
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: 'Transaction not found in Excel records' });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error updating transaction:', err);
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
    const { filePath } = await getOrCreateWorkbook(targetDate);

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
