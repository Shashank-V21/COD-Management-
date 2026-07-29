import { Transaction, Rider, AuditLog } from '../types';

// Local storage fallback helpers for resilience across hosting environments (Express vs Vercel Static)
const KEYS = {
  RIDERS: 'cod_app_riders',
  TRANSACTIONS: 'cod_app_transactions',
  AUDIT_LOGS: 'cod_app_audit_logs',
};

function getLocalRiders(): Rider[] {
  try {
    const raw = localStorage.getItem(KEYS.RIDERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalRiders(riders: Rider[]): void {
  try {
    localStorage.setItem(KEYS.RIDERS, JSON.stringify(riders));
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
  }): Promise<Transaction[]> {
    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.paymentMode) query.append('paymentMode', params.paymentMode);
    if (params?.onlineReceiver) query.append('onlineReceiver', params.onlineReceiver);

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

  async createTransaction(payload: Partial<Transaction>): Promise<Transaction> {
    const fallback = () => {
      const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newTx: Transaction = {
        id: txId,
        date: payload.date || new Date().toISOString().split('T')[0],
        time: payload.time || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        riderName: payload.riderName || 'Unknown',
        codAmount: Number(payload.codAmount) || 0,
        cashAmount: Number(payload.cashAmount) || 0,
        onlineAmount: Number(payload.onlineAmount) || 0,
        onlineReceivedBy: payload.onlineReceivedBy || '',
        paymentMode: payload.paymentMode || 'Cash',
        remarks: payload.remarks || '',
      };
      const existing = getLocalTransactions();
      saveLocalTransactions([newTx, ...existing]);
      addLocalAuditLog(
        'CREATE',
        `Added transaction ₹${newTx.codAmount} (${newTx.paymentMode}) for ${newTx.riderName}`
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
    if (!existing.some((t) => t.id === created.id)) {
      saveLocalTransactions([created, ...existing]);
    }
    return created;
  },

  async updateTransaction(id: string, payload: Partial<Transaction>): Promise<void> {
    const fallback = () => {
      const existing = getLocalTransactions();
      const idx = existing.findIndex((t) => t.id === id);
      if (idx !== -1) {
        existing[idx] = { ...existing[idx], ...payload };
        saveLocalTransactions(existing);
        addLocalAuditLog('UPDATE', `Updated transaction ${id} for ${payload.riderName || existing[idx].riderName}`);
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

  async deleteTransaction(id: string): Promise<void> {
    const fallback = () => {
      const existing = getLocalTransactions();
      const filtered = existing.filter((t) => t.id !== id);
      saveLocalTransactions(filtered);
      addLocalAuditLog('DELETE', `Deleted transaction ${id}`);
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

    const riders = data.riders || [];
    if (riders.length > 0) {
      saveLocalRiders(riders);
    }
    return riders.length > 0 ? riders : getLocalRiders();
  },

  async addRider(rider: { name: string; phone?: string; vehicleNumber?: string }): Promise<Rider> {
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
      addLocalAuditLog('CREATE', `Added new rider: ${newRider.name}`);
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

  async deleteRider(id: string): Promise<void> {
    const fallback = () => {
      const existing = getLocalRiders();
      const target = existing.find((r) => r.id === id);
      const filtered = existing.filter((r) => r.id !== id);
      saveLocalRiders(filtered);
      if (target) {
        addLocalAuditLog('DELETE', `Deleted rider: ${target.name}`);
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

  async importRiders(file: File): Promise<{ count: number; riders: Rider[] }> {
    const fallback = async () => {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const existing = getLocalRiders();
      let added = 0;
      const newRiders: Rider[] = [...existing];

      lines.forEach((line) => {
        const parts = line.split(',');
        const candidateName = parts[0]?.replace(/"/g, '').trim();
        if (
          candidateName &&
          !candidateName.toLowerCase().includes('name') &&
          !candidateName.toLowerCase().includes('rider') &&
          !newRiders.some((r) => r.name.toLowerCase() === candidateName.toLowerCase())
        ) {
          const newR: Rider = {
            id: `rider_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: candidateName,
            phone: parts[1]?.trim() || '',
            vehicleNumber: parts[2]?.trim() || '',
            status: 'Active',
          };
          newRiders.push(newR);
          added++;
        }
      });

      saveLocalRiders(newRiders);
      addLocalAuditLog('IMPORT_RIDERS', `Imported ${added} riders from file`);
      return { count: added, riders: newRiders };
    };

    const formData = new FormData();
    formData.append('file', file);

    const data = await safeFetchJson<{ count: number; riders: Rider[] }>(
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

    return data;
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

