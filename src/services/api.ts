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

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      action,
      details,
      user,
    };
    logs.unshift(newLog);
    localStorage.setItem(KEYS.AUDIT_LOGS, JSON.stringify(logs.slice(0, 200)));

    if (isSupabaseConfigured() && supabase) {
      supabase.auth.getUser().then(({ data }) => {
        const userId = data?.user?.id || null;
        supabase.from('audit_logs').insert({
          id: newLog.id,
          timestamp: newLog.timestamp,
          action: newLog.action,
          details: newLog.details,
          user_email: user,
          user_id: userId,
        }).then();
      });
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
    const txId = generateUUID();
    const status = payload.paymentStatus === 'Pending' ? 'Pending' : 'Paid';
    const pending = status === 'Pending' ? Math.max(0, Number(payload.pendingAmount) || 0) : 0;
    const initialHistory: PaymentHistoryEntry[] = [
      {
        id: generateUUID(),
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
        const authUser = (await supabase.auth.getUser())?.data?.user;
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
          created_by: authUser?.id || null,
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
    const isConfig = isSupabaseConfigured();
    console.log('[SUPABASE updateTransaction STATUS]', { isConfigured: isConfig, hasSupabaseClient: Boolean(supabase), transactionId: id });

    if (isConfig && supabase) {
      const { data: authUserData } = await supabase.auth.getUser();
      const authUserId = authUserData?.user?.id || null;

      const updateData: any = {};
      if (payload.date !== undefined) updateData.date = payload.date;
      if (payload.time !== undefined) updateData.time = payload.time;
      if (payload.riderName !== undefined) updateData.rider_name = payload.riderName;
      if (payload.codAmount !== undefined) updateData.cod_amount = payload.codAmount;
      if (payload.cashAmount !== undefined) updateData.cash_amount = payload.cashAmount;
      if (payload.onlineAmount !== undefined) updateData.online_amount = payload.onlineAmount;
      if (payload.onlineReceivedBy !== undefined) updateData.online_received_by = payload.onlineReceivedBy;
      if (payload.paymentMode !== undefined) updateData.payment_mode = payload.paymentMode;
      if (payload.remarks !== undefined) updateData.remarks = payload.remarks;
      if (payload.paymentStatus !== undefined) updateData.payment_status = payload.paymentStatus;
      if (payload.pendingAmount !== undefined) updateData.pending_amount = payload.pendingAmount;
      if (payload.paymentHistory !== undefined) updateData.payment_history = payload.paymentHistory;
      updateData.updated_at = new Date().toISOString();

      console.log('[SUPABASE UPDATE BEFORE]', {
        transactionId: id,
        payment_status: updateData.payment_status,
        pending_amount: updateData.pending_amount,
        authenticatedUserId: authUserId,
        updateData,
      });

      const { data: updatedRows, error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', id)
        .select();

      console.log('[SUPABASE UPDATE AFTER]', {
        transactionId: id,
        payment_status: updateData.payment_status,
        pending_amount: updateData.pending_amount,
        authenticatedUserId: authUserId,
        supabaseResponse: updatedRows,
        supabaseError: error,
        rowsUpdated: updatedRows ? updatedRows.length : 0,
      });

      if (error) {
        const exactErrorMsg = `Supabase Update Failed: [${error.code}] ${error.message}${
          error.details ? ` - ${error.details}` : ''
        }`;
        console.error('[EXACT SUPABASE UPDATE ERROR]', exactErrorMsg, error);
        throw new Error(exactErrorMsg);
      }

      if (!updatedRows || updatedRows.length === 0) {
        const exactErrorMsg = `Supabase Update Failed: 0 rows updated for transaction ID '${id}'. Row not found or RLS policy blocked update.`;
        console.error('[EXACT SUPABASE UPDATE ERROR]', exactErrorMsg);
        throw new Error(exactErrorMsg);
      }

      try {
        await supabase.from('audit_logs').insert({
          action: 'UPDATE',
          details: `Updated transaction ${id} for ${payload.riderName || 'Rider'}`,
          user_email: userEmail || 'Authenticated User',
          user_id: authUserId,
        });
      } catch (e) {
        console.warn('Audit log insert error:', e);
      }
      return;
    }

    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errMsg = err.error || 'Failed to update transaction on server.';
      console.error('[EXACT EXPRESS API ERROR]', errMsg);
      throw new Error(errMsg);
    }
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
    userEmail?: string,
    userName?: string
  ): Promise<Transaction> {
    const recvNow = Number(payload.amountReceivedNow);
    if (isNaN(recvNow) || recvNow <= 0) {
      throw new Error('Amount received must be greater than zero.');
    }

    const isConfig = isSupabaseConfigured();
    console.log('[SUPABASE CONFIG CHECK]', {
      isSupabaseConfigured: isConfig,
      hasSupabaseClient: Boolean(supabase),
      targetTransactionId: id,
    });

    if (isConfig && supabase) {
      // 1. Get authenticated user ID
      const { data: authUserData } = await supabase.auth.getUser();
      const authUserId = authUserData?.user?.id || null;

      console.log('[SUPABASE FETCH BEFORE]', {
        transactionId: id,
        authenticatedUserId: authUserId,
      });

      // 2. Fetch transaction directly from Supabase
      const { data: existingTx, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();

      console.log('[SUPABASE FETCH AFTER]', {
        transactionId: id,
        authenticatedUserId: authUserId,
        existingTx,
        fetchError,
      });

      if (fetchError || !existingTx) {
        const errorDetails = fetchError
          ? `Code: ${fetchError.code}, Message: ${fetchError.message}, Details: ${fetchError.details || 'None'}`
          : 'Transaction row not found in Supabase';
        console.error('[SUPABASE FETCH ERROR]', errorDetails);
        throw new Error(`Failed to find transaction in database: ${errorDetails}`);
      }

      const currentPending = Number(existingTx.pending_amount) || 0;
      if (recvNow > currentPending) {
        throw new Error(
          `Received amount (₹${recvNow}) cannot exceed pending amount (₹${currentPending}).`
        );
      }

      const newPending = Math.max(0, currentPending - recvNow);
      // Set payment_status = 'Paid' when pending_amount is 0 or when marked as paid
      const newStatus = newPending <= 0 ? 'Paid' : 'Pending';

      const addCash =
        typeof payload.cashAmount === 'number'
          ? payload.cashAmount
          : payload.paymentMode === 'Cash'
          ? recvNow
          : 0;
      const addOnline =
        typeof payload.onlineAmount === 'number'
          ? payload.onlineAmount
          : payload.paymentMode === 'Online'
          ? recvNow
          : 0;

      const newCashTotal = (Number(existingTx.cash_amount) || 0) + addCash;
      const newOnlineTotal = (Number(existingTx.online_amount) || 0) + addOnline;

      let finalMode: PaymentMode = existingTx.payment_mode as PaymentMode;
      if (newCashTotal > 0 && newOnlineTotal > 0) finalMode = 'Cash + Online';
      else if (newOnlineTotal > 0) finalMode = 'Online';
      else finalMode = 'Cash';

      const history: PaymentHistoryEntry[] = Array.isArray(existingTx.payment_history)
        ? [...existingTx.payment_history]
        : [];

      const payDate = payload.date || new Date().toISOString().split('T')[0];
      const payTime =
        payload.time ||
        new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      // Append record to payment_history with paid_at (current timestamp) and updated_by (current authenticated user)
      const nowIso = new Date().toISOString();
      const updatedBy = userEmail || userName || authUserData?.user?.email || 'Authenticated User';

      const newEntry: PaymentHistoryEntry = {
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        date: payDate,
        time: payTime,
        amountReceived: recvNow,
        paymentMode: payload.paymentMode,
        onlineReceivedBy: (payload.onlineReceivedBy as OnlineReceiver | '') || '',
        remarks: payload.remarks || '',
        remainingPending: newPending,
        paid_at: nowIso,
        updated_by: updatedBy,
      };

      history.push(newEntry);

      let updatedRemarks = existingTx.remarks || '';
      if (payload.remarks) {
        updatedRemarks = updatedRemarks
          ? `${updatedRemarks} | Recv ₹${recvNow}: ${payload.remarks}`
          : `Recv ₹${recvNow}: ${payload.remarks}`;
      }

      const updatePayload = {
        payment_status: newStatus,
        pending_amount: newPending,
        cash_amount: newCashTotal,
        online_amount: newOnlineTotal,
        online_received_by: (payload.onlineReceivedBy as OnlineReceiver | '') || existingTx.online_received_by || '',
        payment_mode: finalMode,
        remarks: updatedRemarks,
        payment_history: history,
        updated_at: nowIso,
      };

      // 1 & 2: Console log before Supabase update
      console.log('[SUPABASE UPDATE BEFORE]', {
        transactionId: id,
        payment_status: newStatus,
        pending_amount: newPending,
        authenticatedUserId: authUserId,
        updatePayload,
      });

      // Execute update in Supabase and select updated rows
      const { data: updatedRows, error: updateError } = await supabase
        .from('transactions')
        .update(updatePayload)
        .eq('id', id)
        .select();

      // 1 & 2: Console log after Supabase update
      console.log('[SUPABASE UPDATE AFTER]', {
        transactionId: id,
        payment_status: newStatus,
        pending_amount: newPending,
        authenticatedUserId: authUserId,
        supabaseResponse: updatedRows,
        supabaseError: updateError,
        rowsUpdated: updatedRows ? updatedRows.length : 0,
      });

      // 3 & 7: Print exact error if update query fails
      if (updateError) {
        const exactErrorMsg = `Supabase Update Failed: [${updateError.code}] ${updateError.message}${
          updateError.details ? ` - Details: ${updateError.details}` : ''
        }${updateError.hint ? ` - Hint: ${updateError.hint}` : ''}`;
        console.error('[EXACT SUPABASE UPDATE ERROR]', exactErrorMsg, updateError);
        throw new Error(exactErrorMsg);
      }

      // 4 & 5: Verify exactly one row was updated
      if (!updatedRows || updatedRows.length === 0) {
        const exactErrorMsg = `Supabase Update Failed: 0 rows updated for transaction ID '${id}'. Row not found or RLS policy blocked update.`;
        console.error('[EXACT SUPABASE UPDATE ERROR]', exactErrorMsg);
        throw new Error(exactErrorMsg);
      }

      if (updatedRows.length > 1) {
        console.warn(`[SUPABASE UPDATE WARNING] Expected 1 row updated, but got ${updatedRows.length} rows.`);
      }

      const updatedRow = updatedRows[0];

      // Record Audit Log in Supabase
      try {
        await supabase.from('audit_logs').insert({
          action: 'PAYMENT_RECEIVED',
          details: `Marked as Paid / Received ₹${recvNow} from ${existingTx.rider_name}. Remaining Pending: ₹${newPending} (${newStatus})`,
          user_email: updatedBy,
          user_id: authUserId,
        });
      } catch (e) {
        console.warn('Audit log write failed:', e);
      }

      const updatedTx: Transaction = {
        id: updatedRow.id,
        date: updatedRow.date,
        time: updatedRow.time,
        riderName: updatedRow.rider_name,
        codAmount: Number(updatedRow.cod_amount) || 0,
        cashAmount: Number(updatedRow.cash_amount) || 0,
        onlineAmount: Number(updatedRow.online_amount) || 0,
        onlineReceivedBy: (updatedRow.online_received_by as OnlineReceiver | '') || '',
        paymentMode: updatedRow.payment_mode as PaymentMode,
        remarks: updatedRow.remarks || '',
        createdAt: updatedRow.created_at,
        paymentStatus: updatedRow.payment_status as any,
        pendingAmount: Number(updatedRow.pending_amount) || 0,
        paymentHistory: Array.isArray(updatedRow.payment_history) ? updatedRow.payment_history : [],
      };

      return updatedTx;
    }

    // Fallback if Supabase is not configured
    console.log('[FALLBACK EXPRESS API] Calling /api/transactions/:id/receive-payment');
    const res = await fetch(`/api/transactions/${id}/receive-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const errMsg = errJson.error || 'Failed to update transaction on server.';
      console.error('[EXACT EXPRESS API ERROR]', errMsg);
      throw new Error(errMsg);
    }

    const data = await res.json();
    return data.transaction;
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
        id: generateUUID(),
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

  // Daily Closings
  async getDailyClosings(): Promise<DailyClosingReport[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('daily_closings').select('*').order('date', { ascending: false });
        if (!error && data) {
          return data.map((item) => ({
            date: item.date,
            closedAt: item.closed_at,
            totalTransactions: item.total_transactions,
            totalCod: Number(item.total_cod) || 0,
            totalCash: Number(item.total_cash) || 0,
            totalOnline: Number(item.total_online) || 0,
            shashankOnline: Number(item.shashank_online) || 0,
            akshayOnline: Number(item.akshay_online) || 0,
            totalRiders: item.total_riders,
            status: item.status,
            notes: item.notes || '',
          }));
        }
      } catch (e) {
        console.warn('Supabase getDailyClosings failed:', e);
      }
    }

    const data = await safeFetchJson<{ closings: DailyClosingReport[] }>('/api/daily-closings', undefined, async () => ({
      closings: [],
    }));

    return data.closings || [];
  },

  async saveDailyClosing(closing: DailyClosingReport, userEmail?: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('daily_closings').upsert({
          date: closing.date,
          closed_at: closing.closedAt,
          total_transactions: closing.totalTransactions,
          total_cod: closing.totalCod,
          total_cash: closing.totalCash,
          total_online: closing.totalOnline,
          shashank_online: closing.shashankOnline,
          akshay_online: closing.akshayOnline,
          total_riders: closing.totalRiders,
          status: closing.status,
          notes: closing.notes || '',
        });
      } catch (err) {
        console.warn('Supabase daily closing save failed:', err);
      }
    }

    await safeFetchJson<{ success: boolean }>(
      '/api/daily-closings',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(closing),
      },
      async () => {
        addLocalAuditLog('CLOSING', `Recorded daily closing for ${closing.date} (${closing.status})`, userEmail);
        return { success: true };
      }
    );
  },

  // Daily Backup System
  async getBackups(): Promise<import('../types').BackupFile[]> {
    // 1. Try Supabase Storage list first
    if (isSupabaseConfigured() && supabase) {
      try {
        const { fetchSupabaseBackupsList } = await import('../lib/backupService');
        const sbList = await fetchSupabaseBackupsList();
        if (sbList.length > 0) {
          return sbList;
        }
      } catch (err) {
        console.warn('Supabase backups list failed:', err);
      }
    }

    // 2. Fallback to Express server API
    const data = await safeFetchJson<{ backups: import('../types').BackupFile[] }>('/api/backups', undefined, async () => ({
      backups: [],
    }));

    return data.backups || [];
  },

  async generateDailyBackup(date?: string, userEmail?: string): Promise<{ success: boolean; message: string; fileName: string }> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Try server endpoint first
    try {
      const data = await safeFetchJson<{ success: boolean; message: string; fileName: string }>(
        '/api/backups/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: targetDate }),
        }
      );
      if (data && data.success) {
        return data;
      }
    } catch {}

    // Pure Client-side Fallback (if server not running)
    const { createBackupExcelWorkbook, uploadBackupToSupabase } = await import('../lib/backupService');
    const riders = await this.getRiders();
    const transactions = await this.getTransactions();
    const dailyClosings = await this.getDailyClosings();
    const auditLogs = await this.getAuditLogs();

    const workbook = await createBackupExcelWorkbook({ riders, transactions, dailyClosings, auditLogs });
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `COD_${targetDate}.xlsx`;

    const uploadRes = await uploadBackupToSupabase(fileName, buffer);
    addLocalAuditLog('CREATE', `Generated daily backup ${fileName}`, userEmail);

    return {
      success: true,
      fileName,
      message: uploadRes.alreadyExists
        ? `Backup ${fileName} is safely preserved in Supabase Storage (non-overwrite mode).`
        : `Daily backup ${fileName} created and stored successfully!`,
    };
  },

  // Excel file direct link
  getExcelDownloadUrl(date: string): string {
    return `/api/reports/download-excel?date=${encodeURIComponent(date)}`;
  },
};

