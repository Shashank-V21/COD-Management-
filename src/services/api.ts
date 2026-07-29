import { Transaction, Rider, AuditLog } from '../types';

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

    const res = await fetch(`/api/transactions?${query.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch transactions');
    }
    const data = await res.json();
    return data.transactions || [];
  },

  async createTransaction(payload: Partial<Transaction>): Promise<Transaction> {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create transaction');
    }
    return data.transaction;
  },

  async updateTransaction(id: string, payload: Partial<Transaction>): Promise<void> {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update transaction');
    }
  },

  async deleteTransaction(id: string): Promise<void> {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete transaction');
    }
  },

  async getAvailableDates(): Promise<string[]> {
    const res = await fetch('/api/available-dates');
    if (!res.ok) return [];
    const data = await res.json();
    return data.dates || [];
  },

  // Riders
  async getRiders(): Promise<Rider[]> {
    const res = await fetch('/api/riders');
    if (!res.ok) return [];
    const data = await res.json();
    return data.riders || [];
  },

  async addRider(rider: { name: string; phone?: string; vehicleNumber?: string }): Promise<Rider> {
    const res = await fetch('/api/riders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rider),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to add rider');
    }
    return data.rider;
  },

  async deleteRider(id: string): Promise<void> {
    const res = await fetch(`/api/riders/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete rider');
    }
  },

  async importRiders(file: File): Promise<{ count: number; riders: Rider[] }> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/riders/import', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to import riders');
    }
    return data;
  },

  // Audit logs
  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch('/api/audit-logs');
    if (!res.ok) return [];
    const data = await res.json();
    return data.logs || [];
  },

  // Excel file direct link
  getExcelDownloadUrl(date: string): string {
    return `/api/reports/download-excel?date=${encodeURIComponent(date)}`;
  },
};
