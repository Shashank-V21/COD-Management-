import React, { useState } from 'react';
import { Transaction } from '../types';
import { formatCurrency, formatDisplayDate } from '../lib/utils';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmationModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !transaction) return null;

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(transaction.id);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center space-x-3 text-red-600 mb-3">
          <div className="p-2.5 bg-red-100 rounded-full">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Delete Transaction Record</h3>
            <p className="text-xs text-slate-500">This action will remove the record from Excel file</p>
          </div>
        </div>

        <div className="my-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Rider:</span>
            <strong className="text-slate-900">{transaction.riderName}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Date & Time:</span>
            <span className="text-slate-800">{formatDisplayDate(transaction.date)} | {transaction.time}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Amount:</span>
            <strong className="text-blue-700">{formatCurrency(transaction.codAmount)} ({transaction.paymentMode})</strong>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};
