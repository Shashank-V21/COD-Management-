import { Transaction, Rider, AuditLog, PaymentMode, OnlineReceiver, PaymentHistoryEntry, DailyClosingReport } from '../types';
import { parseRidersFromBuffer, isValidRiderName } from '../lib/excelParser';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Local storage fallback helpers for resilience across hosting environments (Express vs Vercel Static)
const KEYS = {
  RIDERS: 'cod_app_riders',
  TRANSACTIONS: 'cod_app_transactions',
  AUDIT_LOGS: 'cod_app_audit_logs',
};

// Realtime subscription helper for multi-user sync
export function subscribeToRealtimeChanges(onUpdate: () => void) {
  if (!isSupabaseConfigured() || !supabase) return () => {};

  const channel = supabase
    .channel('cod-app-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => onUpdate())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => onUpdate())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_closings' }, () => onUpdate())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => onUpdate())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Auto-purge any stale browser cached riders on first load after directory reset
if (typeof window !== 'undefined') {
  try {
    const RESET_KEY = 'cod_app_riders_reset_v5';
    if (!localStorage.getItem(RESET_KEY)) {
      localStorage.removeItem(KEYS.RIDERS);
      localStorage.setItem(RESET_KEY, 'true');
    }
  } catch {}
}

function getLocalRiders(): Rider[] {
  try {
    const raw = localStorage.getItem(KEYS.RIDERS);
    if (!raw) return [];
    const parsed: Rider[] = JSON.parse(raw);
    const cleaned = parsed.filter((r) => r && isValidRiderName(r.name));
    if (cleaned.length !== parsed.length) {
      saveLocalRiders(cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

function saveLocalRiders(riders: Rider[]): void {
  try {
    const cleaned = riders.filter((r) => r && isValidRiderName(r.name));
    localStorage.setItem(KEYS.RIDERS, JSON.stringify(cleaned));
  } catch (err) {
    console.error('Failed to save riders locally:', err);
  }
}

function getLocalTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(KEYS.TRANSACTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTransactions(txs: Transaction[]): void {
  try {
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
  } catch (err) {
    console.error('Failed to save transactions locally:', err);
  }
}

function getLocalAuditLogs(): AuditLog[] {
  try {
    const raw = localStorage.getItem(KEYS.AUDIT_LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addLocalAuditLog(
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT_RIDERS' | 'CLOSING',
  details: string,
  user = 'Manager'
): void {
  try {
    const logs = getLocalAuditLogs();
    const newLog: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      user,
    };
    logs.unshift(newLog);
    localStorage.setItem(KEYS.AUDIT_LOGS, JSON.stringify(logs.slice(0, 200)));

    if (isSupabaseConfigured() && supabase) {
      supabase.from('audit_logs').insert({
        id: newLog.id,
        timestamp: newLog.timestamp,
        action: newLog.action,
        details: newLog.details,
        user_email: user,
      }).then();
    }
  } catch (err) {
    console.error('Failed to write local audit log:', err);
  }
}


/**
 * Safe fetch helper that handles Content-Type validation and non-JSON HTML error responses
 * gracefully without throwing SyntaxError: Unexpected token 'T'.
 */
async function safeFetchJson<T>(
  url: string,
  options?: RequestInit,
  fallbackFn?: () => T | Promise<T>
): Promise<T> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (res.ok) {
      if (isJson) {
        return (await res.json()) as T;
      }
      // Received 200 OK but it was HTML (e.g. SPA index.html fallback on static host)
      if (fallbackFn) {
        return await fallbackFn();
      }
      const text = await res.text();
      throw new Error(`Non-JSON response from server: ${text.slice(0, 80)}`);
    } else {
      // Received non-2xx status code
      if (isJson) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed with status ${res.status}`);
      } else {
        // Returned HTML 404 or text error
        if (fallbackFn) {
          return await fallbackFn();
        }
        const text = await res.text();
        if (res.status === 404 || text.includes('The page could not be found') || text.includes('<!DOCTYPE html>')) {
          throw new Error('API route not available');
        }
        throw new Error(text.slice(0, 100) || `Server error (${res.status})`);
      }
    }
  } catch (err: any) {
    // If it is an explicit validation error thrown above, rethrow
    if (
      err.message &&
      !err.message.includes('fetch') &&
      !err.message.includes('Unexpected token') &&
      !err.message.includes('not valid JSON') &&
      !err.message.includes('JSON') &&
      !err.message.includes('Failed to fetch') &&
      !err.message.includes('API route not available') &&
      !err.message.includes('Non-JSON response')
    ) {
      throw err;
    }

    // Trigger fallback if provided
    if (fallbackFn) {
      return await fallbackFn();
    }
    throw new Error(err.message || 'Server connection issue');
  }
}

export const api = {
  // Transactions
  async getTransactions(params?: {
    date?: string;
    startDate?: string;
    endDate?: string;
    paymentMode?: string;
    onlineReceiver?: string;
    paymentStatus?: string;
  }): Promise<Transaction[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('transactions').select('*');

        if (params?.date && params.date !== 'all') {
          query = query.eq('date', params.date);
        } else if (params?.startDate && params?.endDate) {
          query = query.gte('date', params.startDate).lte('date', params.endDate);
        }
        if (params?.paymentMode && params.paymentMode !== 'All') {
          query = query.eq('payment_mode', params.paymentMode);
        }
        if (params?.onlineReceiver && params.onlineReceiver !== 'All') {
          query = query.eq('online_received_by', params.onlineReceiver);
        }
        if (params?.paymentStatus && params.paymentStatus !== 'All') {
          query = query.eq('payment_status', params.paymentStatus);
        }

        const { data, error } = await query.order('date', { ascending: false }).order('time', { ascending: false });

        if (!error && data) {
          const mapped: Transaction[] = data.map((item) => ({
            id: item.id,
            date: item.date,
            time: item.time,
            riderName: item.rider_name,
            codAmount: Number(item.cod_amount) || 0,
            cashAmount: Number(item.cash_amount) || 0,
            onlineAmount: Number(item.online_amount) || 0,
            onlineReceivedBy: (item.online_received_by as OnlineReceiver | '') || '',
            paymentMode: item.payment_mode as PaymentMode,
            remarks: item.remarks || '',
            createdAt: item.created_at,
            paymentStatus: item.payment_status as any,
            pendingAmount: Number(item.pending_amount) || 0,
            paymentHistory: Array.isArray(item.payment_history) ? item.payment_history : [],
          }));
          saveLocalTransactions(mapped);
          return mapped;
        }
      } catch (e) {
        console.warn('Supabase getTransactions failed:', e);
      }
    }

    const query = new URLSearchParams();

    if (params?.date) query.append('date', params.date);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.paymentMode) query.append('paymentMode', params.paymentMode);
    if (params?.onlineReceiver) query.append('onlineReceiver', params.onlineReceiver);
    if (params?.paymentStatus) query.append('paymentStatus', params.paymentStatus);

    const fallback = () => {
      let list = getLocalTransactions();
      if (params?.date && params.date !== 'all') {
        list = list.filter((t) => t.date === params.date);
      } else if (params?.startDate && params?.endDate) {
        list = list.filter((t) => t.date >= params.startDate! && t.date <= params.endDate!);
      }
      if (params?.paymentMode && params.paymentMode !== 'All') {
        list = list.filter((t) => t.paymentMode === params.paymentMode);
      }
      if (params?.onlineReceiver && params.onlineReceiver !== 'All') {
        list = list.filter((t) => t.onlineReceivedBy === params.onlineReceiver);
      }
      if (params?.paymentStatus && params.paymentStatus !== 'All') {
        list = list.filter((t) => t.paymentStatus === params.paymentStatus);
      }
      return list.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
    };

    const data = await safeFetchJson<{ transactions: Transaction[] }>(
      `/api/transactions?${query.toString()}`,
      undefined,
      async () => ({ transactions: fallback() })
    );

    const txs = data.transactions || [];
    // Cache local
    if (txs.length > 0) {
      const existing = getLocalTransactions();
      const map = new Map(existing.map((t) => [t.id, t]));
      txs.forEach((t) => map.set(t.id, t));
      saveLocalTransactions(Array.from(map.values()));
    }
    return txs;
  },

  async createTransaction(payload: Partial<Transaction>, userEmail?: string): Promise<Transaction> {
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const status = payload.paymentStatus === 'Pending' ? 'Pending' : 'Paid';
    const pending = status === 'Pending' ? Math.max(0, Number(payload.pendingAmount) || 0) : 0;
    const initialHistory: PaymentHistoryEntry[] = [
      {
        id: `pay_${Date.now()}`,
        date: payload.date || new Date().toISOString().split('T')[0],
        time: payload.time || '',
        amountReceived: (Number(payload.cashAmount) || 0) + (Number(payload.onlineAmount) || 0),
        paymentMode: payload.paymentMode || 'Cash',
        onlineReceivedBy: (payload.onlineReceivedBy as OnlineReceiver | '') || '',
        remarks: payload.remarks || 'Initial Payment',
        remainingPending: pending,
      },
    ];

    const newTx: Transaction = {
      id: txId,
      date: payload.date || new Date().toISOString().split('T')[0],
      time: payload.time || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      riderName: payload.riderName || 'Unknown',
      codAmount: Number(payload.codAmount) || 0,
      cashAmount: Number(payload.cashAmount) || 0,
      onlineAmount: Number(payload.onlineAmount) || 0,
      onlineReceivedBy: (payload.onlineReceivedBy as OnlineReceiver | '') || '',
      paymentMode: payload.paymentMode || 'Cash',
      remarks: payload.remarks || '',
      paymentStatus: status,
      pendingAmount: pending,
      paymentHistory: initialHistory,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('transactions').insert({
          id: newTx.id,
          date: newTx.date,
          time: newTx.time,
          rider_name: newTx.riderName,
          cod_amount: newTx.codAmount,
          cash_amount: newTx.cashAmount,
          online_amount: newTx.onlineAmount,
          online_received_by: newTx.onlineReceivedBy,
          payment_mode: newTx.paymentMode,
          remarks: newTx.remarks,
          payment_status: newTx.paymentStatus,
          pending_amount: newTx.pendingAmount,
          payment_history: newTx.paymentHistory,
          created_by: userEmail || 'Staff',
        });

        if (!error) {
          const existing = getLocalTransactions();
          saveLocalTransactions([newTx, ...existing]);
          addLocalAuditLog(
            'CREATE',
            `Added transaction ₹${newTx.codAmount} (${newTx.paymentMode}) for ${newTx.riderName}`,
            userEmail
          );
          return newTx;
        }
      } catch (err) {
        console.error('Supabase write failed:', err);
      }
    }

    const fallback = () => {
      const existing = getLocalTransactions();
      saveLocalTransactions([newTx, ...existing]);
      addLocalAuditLog(
        'CREATE',
        `Added transaction ₹${newTx.codAmount} (${newTx.paymentMode}) for ${newTx.riderName}`,
        userEmail
      );
      return { success: true, transaction: newTx };
    };

    const data = await safeFetchJson<{ success: boolean; transaction: Transaction }>(
      '/api/transactions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      fallback
    );

    const created = data.transaction;
    const existing = getLocalTransactions();
    const idx = existing.findIndex((t) => t.id === created.id);
    if (idx !== -1) {
      existing[idx] = created;
      saveLocalTransactions(existing);
    } else {
      saveLocalTransactions([created, ...existing]);
    }
    return created;
  },


  async updateTransaction(id: string, payload: Partial<Transaction>, userEmail?: string): Promise<void> {
    const fallback = () => {
      const existing = getLocalTransactions();
      const idx = existing.findIndex((t) => t.id === id);
      if (idx !== -1) {
        existing[idx] = { ...existing[idx], ...payload };
        saveLocalTransactions(existing);
        addLocalAuditLog('UPDATE', `Updated transaction ${id} for ${payload.riderName || existing[idx].riderName}`, userEmail);
      }
    };

    await safeFetchJson<{ success: boolean }>(
      `/api/transactions/${id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      async () => {
        fallback();
        return { success: true };
      }
    );
  },

  async receivePendingPayment(
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
    },
    userEmail?: string
  ): Promise<Transaction> {
    const fallback = () => {
      const existing = getLocalTransactions();
      const idx = existing.findIndex((t) => t.id === id);
      if (idx === -1) {
        throw new Error('Transaction not found');
      }

      const tx = existing[idx];
      const currentPending = tx.pendingAmount || 0;
      const recvNow = Number(payload.amountReceivedNow);

      if (recvNow > currentPending) {
        throw new Error(`Received amount (₹${recvNow}) cannot exceed pending amount (₹${currentPending}).`);
      }

      const newPending = Math.max(0, currentPending - recvNow);
      const newStatus = newPending <= 0 ? 'Paid' : 'Pending';

      const addCash = payload.cashAmount || (payload.paymentMode === 'Cash' ? recvNow : 0);
      const addOnline = payload.onlineAmount || (payload.paymentMode === 'Online' ? recvNow : 0);

      const newCashTotal = (tx.cashAmount || 0) + addCash;
      const newOnlineTotal = (tx.onlineAmount || 0) + addOnline;

      let finalMode: PaymentMode = tx.paymentMode;
      if (newCashTotal > 0 && newOnlineTotal > 0) finalMode = 'Cash + Online';
      else if (newOnlineTotal > 0) finalMode = 'Online';
      else finalMode = 'Cash';

      const history = tx.paymentHistory ? [...tx.paymentHistory] : [];
      const payDate = payload.date || new Date().toISOString().split('T')[0];
      const payTime = payload.time || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      history.push({
        id: `pay_${Date.now()}`,
        date: payDate,
        time: payTime,
        amountReceived: recvNow,
        paymentMode: payload.paymentMode,
        onlineReceivedBy: (payload.onlineReceivedBy as OnlineReceiver | '') || '',
        remarks: payload.remarks || '',
        remainingPending: newPending,
      });

      const updatedTx: Transaction = {
        ...tx,
        cashAmount: newCashTotal,
        onlineAmount: newOnlineTotal,
        paymentMode: finalMode,
        onlineReceivedBy: (payload.onlineReceivedBy as OnlineReceiver | '') || tx.onlineReceivedBy,
        paymentStatus: newStatus,
        pendingAmount: newPending,
        paymentHistory: history,
        remarks: payload.remarks
          ? tx.remarks
            ? `${tx.remarks} | Recv ₹${recvNow}: ${payload.remarks}`
            : `Recv ₹${recvNow}: ${payload.remarks}`
          : tx.remarks,
      };

      existing[idx] = updatedTx;
      saveLocalTransactions(existing);
      addLocalAuditLog(
        'UPDATE',
        `Received ₹${recvNow} from ${tx.riderName}. Remaining Pending: ₹${newPending} (${newStatus})`,
        userEmail
      );

      return { success: true, transaction: updatedTx };
    };

    const data = await safeFetchJson<{ success: boolean; transaction: Transaction }>(
      `/api/transactions/${id}/receive-payment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      async () => fallback()
    );

    const updated = data.transaction;
    const existing = getLocalTransactions();
    const idx = existing.findIndex((t) => t.id === updated.id);
    if (idx !== -1) {
      existing[idx] = updated;
      saveLocalTransactions(existing);
    }
    return updated;
  },

  async deleteTransaction(id: string, userEmail?: string): Promise<void> {
    const fallback = () => {
      const existing = getLocalTransactions();
      const filtered = existing.filter((t) => t.id !== id);
      saveLocalTransactions(filtered);
      addLocalAuditLog('DELETE', `Deleted transaction ${id}`, userEmail);
    };

    await safeFetchJson<{ success: boolean }>(
      `/api/transactions/${id}`,
      { method: 'DELETE' },
      async () => {
        fallback();
        return { success: true };
      }
    );
  },

  async getAvailableDates(): Promise<string[]> {
    const fallback = () => {
      const txs = getLocalTransactions();
      const dates = Array.from(new Set(txs.map((t) => t.date))).sort().reverse();
      return dates.length > 0 ? dates : [new Date().toISOString().split('T')[0]];
    };

    const data = await safeFetchJson<{ dates: string[] }>('/api/available-dates', undefined, async () => ({
      dates: fallback(),
    }));

    return data.dates || [];
  },

  // Riders
  async getRiders(): Promise<Rider[]> {
    const fallback = () => getLocalRiders();

    const data = await safeFetchJson<{ riders: Rider[] }>('/api/riders', undefined, async () => ({
      riders: fallback(),
    }));

    if (Array.isArray(data.riders)) {
      saveLocalRiders(data.riders);
      return data.riders;
    }
    return getLocalRiders();
  },

  async addRider(rider: { name: string; phone?: string; vehicleNumber?: string }, userEmail?: string): Promise<Rider> {
    const trimmedName = rider.name.trim();
    if (!trimmedName) {
      throw new Error('Rider name is required');
    }

    const fallback = (): { success: boolean; rider: Rider } => {
      const existing = getLocalRiders();
      if (existing.some((r) => r.name.toLowerCase().trim() === trimmedName.toLowerCase())) {
        throw new Error('Rider with this name already exists');
      }
      const newRider: Rider = {
        id: `rider_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: trimmedName,
        phone: rider.phone?.trim() || '',
        vehicleNumber: rider.vehicleNumber?.trim() || '',
        status: 'Active',
        totalDeliveries: 0,
      };
      const updated = [newRider, ...existing];
      saveLocalRiders(updated);
      addLocalAuditLog('CREATE', `Added new rider: ${newRider.name}`, userEmail);
      return { success: true, rider: newRider };
    };

    const data = await safeFetchJson<{ success: boolean; rider: Rider }>(
      '/api/riders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rider),
      },
      fallback
    );

    const createdRider = data.rider;

    // Sync local storage
    const currentLocals = getLocalRiders();
    if (!currentLocals.some((r) => r.id === createdRider.id)) {
      saveLocalRiders([createdRider, ...currentLocals]);
    }

    return createdRider;
  },

  async deleteRider(id: string, userEmail?: string): Promise<void> {
    const fallback = () => {
      const existing = getLocalRiders();
      const target = existing.find((r) => r.id === id);
      const filtered = existing.filter((r) => r.id !== id);
      saveLocalRiders(filtered);
      if (target) {
        addLocalAuditLog('DELETE', `Deleted rider: ${target.name}`, userEmail);
      }
    };

    await safeFetchJson<{ success: boolean }>(
      `/api/riders/${id}`,
      { method: 'DELETE' },
      async () => {
        fallback();
        return { success: true };
      }
    );
  },

  async importRiders(file: File, userEmail?: string): Promise<{ count: number; riders: Rider[] }> {
    const fallback = async () => {
      const buffer = await file.arrayBuffer();
      const existing = getLocalRiders();
      const result = parseRidersFromBuffer(buffer, existing);
      saveLocalRiders(result.riders);
      addLocalAuditLog('IMPORT_RIDERS', `Imported ${result.count} riders from Excel file`, userEmail);
      return { success: true, count: result.count, riders: result.riders };
    };

    const formData = new FormData();
    formData.append('file', file);

    const data = await safeFetchJson<{ success: boolean; count: number; riders: Rider[] }>(
      '/api/riders/import',
      {
        method: 'POST',
        body: formData,
      },
      fallback
    );

    if (data.riders && data.riders.length > 0) {
      saveLocalRiders(data.riders);
    }

    return { count: data.count, riders: data.riders || getLocalRiders() };
  },


  // Audit logs
  async getAuditLogs(): Promise<AuditLog[]> {
    const fallback = () => getLocalAuditLogs();

    const data = await safeFetchJson<{ logs: AuditLog[] }>('/api/audit-logs', undefined, async () => ({
      logs: fallback(),
    }));

    return data.logs || getLocalAuditLogs();
  },

  // Excel file direct link
  getExcelDownloadUrl(date: string): string {
    return `/api/reports/download-excel?date=${encodeURIComponent(date)}`;
  },
};

