import React from 'react';
import { Transaction } from '../types';
import { formatCurrency, formatDisplayDate, generateWhatsAppReceiptLink } from '../lib/utils';
import { X, Share2, Printer, CheckCircle2, Truck } from 'lucide-react';

interface ReceiptModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, isOpen, onClose }) => {
  if (!isOpen || !transaction) return null;

  const whatsappUrl = generateWhatsAppReceiptLink(transaction);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">COD Payment Receipt</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div className="my-5 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 font-mono text-xs text-slate-800 space-y-3">
          <div className="text-center border-b border-slate-200 pb-2">
            <p className="font-bold text-sm text-slate-900 font-sans">EXPRESS LOGISTICS HUB</p>
            <p className="text-[10px] text-slate-500 font-sans">COD Acknowledgement Voucher</p>
            <p className="text-[10px] text-slate-400 mt-1">ID: {transaction.id}</p>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Date:</span>
              <span>{formatDisplayDate(transaction.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Time:</span>
              <span>{transaction.time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Rider:</span>
              <strong className="font-bold text-slate-900 font-sans">{transaction.riderName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mode:</span>
              <span className="font-bold text-blue-700">{transaction.paymentMode}</span>
            </div>
          </div>

          <div className="border-t border-b border-slate-200 py-2 space-y-1">
            <div className="flex justify-between">
              <span>Cash Amount:</span>
              <span>₹{transaction.cashAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>Online Amount:</span>
              <span>₹{transaction.onlineAmount.toLocaleString('en-IN')}</span>
            </div>
            {transaction.onlineReceivedBy && (
              <div className="flex justify-between text-[11px] text-indigo-700">
                <span>Receiver:</span>
                <span>{transaction.onlineReceivedBy}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-baseline pt-1 font-sans">
            <span className="font-bold text-slate-700">TOTAL COD COLLECTED:</span>
            <span className="text-base font-extrabold text-slate-900">
              ₹{transaction.codAmount.toLocaleString('en-IN')}
            </span>
          </div>

          {transaction.remarks && (
            <p className="text-[10px] italic text-slate-500 pt-1 font-sans border-t border-slate-200">
              Remarks: {transaction.remarks}
            </p>
          )}

          <div className="text-center pt-2 text-[10px] text-emerald-700 font-sans font-bold flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified & Saved in Excel Ledger
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Share2 className="w-3.5 h-3.5" /> Share WhatsApp
          </a>

          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>
    </div>
  );
};
