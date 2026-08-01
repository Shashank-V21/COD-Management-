import { Transaction, DashboardStats } from '../types';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

export const getTodayFormattedDate = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getYesterdayFormattedDate = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
  }
  return dateStr;
};

export const getCurrentTimeFormatted = (): string => {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  const hoursStr = hours < 10 ? '0' + hours : hours;
  return `${hoursStr}:${minutesStr} ${ampm}`;
};

export const calculateStats = (transactions: Transaction[]): DashboardStats => {
  let totalCodCollected = 0;
  let cashCollection = 0;
  let onlineCollection = 0;
  let onlineByShashank = 0;
  let onlineByAkshay = 0;
  const onlineByReceiver: Record<string, number> = {};
  let totalPendingAmount = 0;
  const ridersSet = new Set<string>();
  const pendingRidersSet = new Set<string>();

  transactions.forEach((tx) => {
    totalCodCollected += Number(tx.codAmount) || 0;
    cashCollection += Number(tx.cashAmount) || 0;
    const onlineAmt = Number(tx.onlineAmount) || 0;
    onlineCollection += onlineAmt;

    if (tx.onlineReceivedBy) {
      const rec = tx.onlineReceivedBy.trim();
      if (rec) {
        onlineByReceiver[rec] = (onlineByReceiver[rec] || 0) + onlineAmt;
      }
    }

    if (tx.onlineReceivedBy === 'Shashank') {
      onlineByShashank += onlineAmt;
    } else if (tx.onlineReceivedBy === 'Akshay') {
      onlineByAkshay += onlineAmt;
    }

    if (tx.riderName) {
      ridersSet.add(tx.riderName.trim().toLowerCase());
    }

    if (tx.paymentStatus === 'Pending' && (tx.pendingAmount || 0) > 0) {
      totalPendingAmount += Number(tx.pendingAmount) || 0;
      if (tx.riderName) {
        pendingRidersSet.add(tx.riderName.trim().toLowerCase());
      }
    }
  });

  return {
    totalTransactions: transactions.length,
    totalCodCollected,
    cashCollection,
    onlineCollection,
    onlineByShashank,
    onlineByAkshay,
    onlineByReceiver,
    totalRidersPaid: ridersSet.size,
    pendingRidersCount: pendingRidersSet.size,
    totalPendingAmount,
  };
};

export const generateWhatsAppReceiptLink = (tx: Transaction, hubName = 'Hub Ops'): string => {
  const text = `*${hubName} - COD Payment Receipt*
--------------------------------
📅 *Date:* ${formatDisplayDate(tx.date)} | ${tx.time}
👤 *Rider:* ${tx.riderName}
💵 *Total COD:* ₹${tx.codAmount.toLocaleString('en-IN')}
💳 *Payment Mode:* ${tx.paymentMode}

*Breakdown:*
• Cash: ₹${tx.cashAmount.toLocaleString('en-IN')}
• Online: ₹${tx.onlineAmount.toLocaleString('en-IN')}${tx.onlineReceivedBy ? ` (Received by: ${tx.onlineReceivedBy})` : ''}
${tx.paymentStatus === 'Pending' ? `• Pending Amount: ₹${(tx.pendingAmount || 0).toLocaleString('en-IN')}\n` : ''}
${tx.remarks ? `📝 *Remarks:* ${tx.remarks}\n` : ''}--------------------------------
*Status:* ${tx.paymentStatus === 'Pending' ? '⏳ Pending Payment' : '✅ Verified & Saved'}
Thank you!`;

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
};

export const exportToCSV = (transactions: Transaction[], filename = 'COD_Report.csv') => {
  const headers = [
    'Date',
    'Time',
    'Rider Name',
    'Total COD Amount',
    'Cash Amount',
    'Online Amount',
    'Online Received By',
    'Payment Mode',
    'Payment Status',
    'Pending Amount',
    'Remarks',
  ];

  const rows = transactions.map((t) => [
    formatDisplayDate(t.date),
    t.time,
    `"${(t.riderName || '').replace(/"/g, '""')}"`,
    t.codAmount,
    t.cashAmount,
    t.onlineAmount,
    t.onlineReceivedBy || '-',
    t.paymentMode,
    t.paymentStatus || 'Paid',
    t.pendingAmount || 0,
    `"${(t.remarks || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportPendingToCSV = (pendingTransactions: Transaction[], filename = 'Pending_COD_Report.csv') => {
  const headers = [
    'Rider Name',
    'Date',
    'Total COD Amount',
    'Amount Received',
    'Pending Amount',
    'Status',
    'Last Updated Date',
    'Remarks',
  ];

  const rows = pendingTransactions.map((t) => {
    const amountReceived = (t.cashAmount || 0) + (t.onlineAmount || 0);
    return [
      `"${(t.riderName || '').replace(/"/g, '""')}"`,
      formatDisplayDate(t.date),
      t.codAmount,
      amountReceived,
      t.pendingAmount || 0,
      t.paymentStatus || 'Pending',
      formatDisplayDate(t.date),
      `"${(t.remarks || '').replace(/"/g, '""')}"`,
    ];
  });

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
