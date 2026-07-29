import React, { useState, useEffect } from 'react';
import { Transaction, PaymentMode, OnlineReceiver, Rider } from '../types';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  riders: Rider[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updated: Partial<Transaction>) => Promise<void>;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  riders,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !transaction) return null;

  const [riderName, setRiderName] = useState(transaction.riderName);
  const [codAmount, setCodAmount] = useState<string>(transaction.codAmount.toString());
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(transaction.paymentMode);
  const [cashAmount, setCashAmount] = useState<string>(transaction.cashAmount.toString());
  const [onlineAmount, setOnlineAmount] = useState<string>(transaction.onlineAmount.toString());
  const [onlineReceivedBy, setOnlineReceivedBy] = useState<OnlineReceiver | ''>(
    transaction.onlineReceivedBy || 'Shashank'
  );
  const [date, setDate] = useState<string>(transaction.date);
  const [time, setTime] = useState<string>(transaction.time);
  const [remarks, setRemarks] = useState<string>(transaction.remarks || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numCod = Number(codAmount) || 0;
  const numCash = Number(cashAmount) || 0;
  const numOnline = Number(onlineAmount) || 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!riderName.trim()) {
      setErrorMsg('Rider Name is required');
      return;
    }

    if (numCod <= 0) {
      setErrorMsg('COD Amount must be greater than zero');
      return;
    }

    if (paymentMode === 'Cash + Online') {
      if (Math.abs(numCash + numOnline - numCod) > 0.01) {
        setErrorMsg(`Cash (₹${numCash}) + Online (₹${numOnline}) must equal COD Amount (₹${numCod})`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSave(transaction.id, {
        riderName: riderName.trim(),
        codAmount: numCod,
        cashAmount: paymentMode === 'Online' ? 0 : numCash,
        onlineAmount: paymentMode === 'Cash' ? 0 : numOnline,
        onlineReceivedBy: paymentMode === 'Cash' ? '' : onlineReceivedBy,
        paymentMode,
        date,
        time,
        remarks: remarks.trim(),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">Edit COD Transaction</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rider Name</label>
              <input
                type="text"
                value={riderName}
                onChange={(e) => setRiderName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">COD Amount (₹)</label>
              <input
                type="number"
                value={codAmount}
                onChange={(e) => setCodAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => {
                const mode = e.target.value as PaymentMode;
                setPaymentMode(mode);
                if (mode === 'Cash') {
                  setCashAmount(codAmount);
                  setOnlineAmount('0');
                } else if (mode === 'Online') {
                  setCashAmount('0');
                  setOnlineAmount(codAmount);
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
            >
              <option value="Cash">Cash</option>
              <option value="Online">Online</option>
              <option value="Cash + Online">Cash + Online</option>
            </select>
          </div>

          {paymentMode === 'Cash + Online' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cash (₹)</label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Online (₹)</label>
                <input
                  type="number"
                  value={onlineAmount}
                  onChange={(e) => setOnlineAmount(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-bold"
                />
              </div>
            </div>
          )}

          {paymentMode !== 'Cash' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Online Received By</label>
              <select
                value={onlineReceivedBy}
                onChange={(e) => setOnlineReceivedBy(e.target.value as OnlineReceiver)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
              >
                <option value="Shashank">Shashank</option>
                <option value="Akshay">Akshay</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
