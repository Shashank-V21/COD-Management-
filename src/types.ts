export type PaymentMode = 'Cash' | 'Online' | 'Cash + Online';

export type OnlineReceiver = 'Shashank' | 'Akshay';

export type PaymentStatus = 'Paid' | 'Pending';

export interface PaymentHistoryEntry {
  id?: string;
  date: string;
  time: string;
  amountReceived: number;
  paymentMode?: PaymentMode;
  onlineReceivedBy?: OnlineReceiver | '';
  remarks?: string;
  remainingPending?: number;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // hh:mm AM/PM
  riderName: string;
  codAmount: number;
  cashAmount: number;
  onlineAmount: number;
  onlineReceivedBy: OnlineReceiver | '';
  paymentMode: PaymentMode;
  remarks?: string;
  createdAt?: string;
  paymentStatus?: PaymentStatus; // 'Paid' | 'Pending'
  pendingAmount?: number; // Default 0
  paymentHistory?: PaymentHistoryEntry[];
}

export interface Rider {
  id: string;
  name: string;
  phone?: string;
  vehicleNumber?: string;
  status: 'Active' | 'Inactive';
  totalDeliveries?: number;
}

export interface DashboardStats {
  totalTransactions: number;
  totalCodCollected: number;
  cashCollection: number;
  onlineCollection: number;
  onlineByShashank: number;
  onlineByAkshay: number;
  totalRidersPaid: number;
  pendingRidersCount?: number;
  totalPendingAmount?: number;
}

export interface TransactionFilter {
  dateFilter: string; // 'all' | 'today' | 'yesterday' | 'custom' or YYYY-MM-DD
  customStartDate?: string;
  customEndDate?: string;
  paymentMode: string; // 'All' | 'Cash' | 'Online' | 'Cash + Online'
  onlineReceiver: string; // 'All' | 'Shashank' | 'Akshay'
  paymentStatus?: string; // 'All' | 'Paid' | 'Pending'
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CLOSING' | 'IMPORT_RIDERS' | 'PAYMENT_RECEIVED';
  details: string;
  user?: string;
}

export interface DailyClosingReport {
  date: string;
  closedAt: string;
  totalTransactions: number;
  totalCod: number;
  totalCash: number;
  totalOnline: number;
  shashankOnline: number;
  akshayOnline: number;
  totalRiders: number;
  status: 'Balanced' | 'Discrepancy';
  notes?: string;
}

export type UserRole = 'Admin' | 'Staff';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
  createdAt?: string;
}

