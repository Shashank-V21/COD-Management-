import React, { useState } from 'react';
import { Transaction, PaymentMode, OnlineReceiver } from '../types';
import { getCurrentTimeFormatted, formatDisplayDate } from '../lib/utils';
import {
  X,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  History,
  CreditCard,
  Banknote,
  User,
} from 'lucide-react';

interface MarkAsPaidModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitPayment: (
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
    }
  ) => Promise<void>;
}

export const MarkAsPaidModal: React.FC<MarkAsPaidModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onSubmitPayment,
}) => {
  if (!isOpen || !transaction) return null;

  const currentPending = transaction.pendingAmount || 0;

  const [amountReceivedNow, setAmountReceivedNow] = useState<string>(
    currentPending.toString()
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [onlineAmount, setOnlineAmount] = useState<string>('');
  const [onlineReceivedBy, setOnlineReceivedBy] = useState<OnlineReceiver | ''>(
    transaction.onlineReceivedBy || 'Shashank'
  );
  const [date, setDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [time, setTime] = useState<string>(getCurrentTimeFormatted());
  const [remarks, setRemarks] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pay' | 'history'>('pay');

  const recvNow = Number(amountReceivedNow) || 0;
  const remainingAfterPayment = Math.max(0, currentPending - recvNow);

  const numCash = Number(cashAmount) || 0;
  const numOnline = Number(onlineAmount) || 0;
  const splitSum = numCash + numOnline;
  const isSplitValid =
    paymentMode !== 'Cash + Online' ||
    (numCash >= 0 && numOnline >= 0 && Math.abs(splitSum - recvNow) < 0.01);

  const handlePaymentModeChange = (mode: PaymentMode) => {
    setPaymentMode(mode);
    if (mode === 'Cash + Online') {
      if (recvNow > 0) {
        if (Math.abs(numCash + numOnline - recvNow) > 0.01) {
          const half = Math.round(recvNow / 2);
          setCashAmount(half.toString());
          setOnlineAmount((recvNow - half).toString());
        }
      } else {
        setCashAmount('0');
        setOnlineAmount('0');
      }
    }
  };

  const handleAmountReceivedChange = (val: string) => {
    setAmountReceivedNow(val);
    const newRecv = Number(val) || 0;
    if (paymentMode === 'Cash + Online') {
      const currentCash = Number(cashAmount) || 0;
      if (currentCash <= newRecv) {
        setOnlineAmount(Math.max(0, newRecv - currentCash).toString());
      } else {
        setCashAmount(newRecv.toString());
        setOnlineAmount('0');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (recvNow <= 0) {
      setErrorMsg('Amount received now must be greater than zero.');
      return;
    }

    if (recvNow > currentPending) {
      setErrorMsg(
        `Received amount (₹${recvNow.toLocaleString(
          'en-IN'
        )}) cannot exceed pending amount (₹${currentPending.toLocaleString('en-IN')}).`
      );
      return;
    }

    if (paymentMode === 'Cash + Online') {
      if (!isSplitValid) {
        setErrorMsg('Cash + Online total must equal Amount Received.');
        return;
      }
    }

    if ((paymentMode === 'Online' || paymentMode === 'Cash + Online') && !onlineReceivedBy) {
      setErrorMsg('Please select who received the online payment.');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalCash =
        paymentMode === 'Cash'
          ? recvNow
          : paymentMode === 'Cash + Online'
          ? numCash
          : 0;
      const finalOnline =
        paymentMode === 'Online'
          ? recvNow
          : paymentMode === 'Cash + Online'
          ? numOnline
          : 0;

      await onSubmitPayment(transaction.id, {
        amountReceivedNow: recvNow,
        paymentMode,
        cashAmount: finalCash,
        onlineAmount: finalOnline,
        onlineReceivedBy: paymentMode === 'Cash' ? '' : onlineReceivedBy,
        remarks: remarks.trim(),
        date,
        time,
      });

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Receive Pending Payment
              </h3>
              <p className="text-xs text-slate-300">
                Rider: <span className="font-semibold text-amber-300">{transaction.riderName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('pay')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'pay'
                ? 'border-amber-600 text-amber-700 bg-white rounded-t-lg border-x border-t border-slate-200'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <IndianRupee className="w-3.5 h-3.5" /> Collect Payment
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'history'
                ? 'border-amber-600 text-amber-700 bg-white rounded-t-lg border-x border-t border-slate-200'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Payment History ({transaction.paymentHistory?.length || 0})
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'pay' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Summary Stats Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-3 gap-3 text-center">
                <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total COD</span>
                  <span className="text-sm font-extrabold text-slate-800">
                    ₹{transaction.codAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Current Pending</span>
                  <span className="text-sm font-extrabold text-amber-600">
                    ₹{currentPending.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">After Payment</span>
                  <span className={`text-sm font-extrabold ${remainingAfterPayment === 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                    ₹{remainingAfterPayment.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Amount Received Now Input */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Amount Received Now (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={currentPending}
                    step="any"
                    required
                    value={amountReceivedNow}
                    onChange={(e) => handleAmountReceivedChange(e.target.value)}
                    className="w-full pl-9 pr-24 py-2.5 bg-white border border-slate-300 rounded-xl text-base font-extrabold text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                  <IndianRupee className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
                  <button
                    type="button"
                    onClick={() => handleAmountReceivedChange(currentPending.toString())}
                    className="absolute right-2 top-2 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md text-[11px] font-bold"
                  >
                    Full ₹{currentPending}
                  </button>
                </div>
              </div>

              {/* Payment Mode selector */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Payment Mode for Received Amount
                </label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
                  {(['Cash', 'Online', 'Cash + Online'] as PaymentMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handlePaymentModeChange(mode)}
                      className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all text-center ${
                        paymentMode === mode
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash + Online Split Breakdown Fields */}
              {paymentMode === 'Cash + Online' && (
                <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                    <span className="text-xs font-bold text-amber-900">
                      Split Payment Breakdown
                    </span>
                    {isSplitValid ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sum Matches!
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full">
                        <AlertCircle className="w-3.5 h-3.5" /> Sum: ₹{splitSum} (Required: ₹{recvNow})
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Cash Amount Input */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Cash Amount (₹) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={cashAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCashAmount(val);
                          if (recvNow > 0 && val !== '') {
                            const remain = Math.max(0, recvNow - Number(val));
                            setOnlineAmount(remain.toString());
                          }
                        }}
                        className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    {/* Online Amount Input */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Online Amount (₹) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={onlineAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOnlineAmount(val);
                          if (recvNow > 0 && val !== '') {
                            const remain = Math.max(0, recvNow - Number(val));
                            setCashAmount(remain.toString());
                          }
                        }}
                        className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {!isSplitValid && (
                    <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Cash + Online total must equal Amount Received.
                    </p>
                  )}
                </div>
              )}

              {/* Online Received By if Online/Split */}
              {(paymentMode === 'Online' || paymentMode === 'Cash + Online') && (
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Online Received By <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={onlineReceivedBy}
                    onChange={(e) => setOnlineReceivedBy(e.target.value as OnlineReceiver)}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Shashank">Shashank</option>
                    <option value="Akshay">Akshay</option>
                  </select>
                </div>
              )}

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Time
                  </label>
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remarks / Payment Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received via PhonePe / Cash given at desk"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (paymentMode === 'Cash + Online' && !isSplitValid)}
                  className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    'Processing...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Confirm Payment (₹{recvNow.toLocaleString('en-IN')})
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* History Tab */
            <div className="space-y-3">
              {transaction.paymentHistory && transaction.paymentHistory.length > 0 ? (
                transaction.paymentHistory.map((h, i) => (
                  <div
                    key={h.id || i}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-extrabold text-slate-900">
                          ₹{h.amountReceived.toLocaleString('en-IN')}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                          {h.paymentMode || 'Cash'}
                        </span>
                        {h.onlineReceivedBy && (
                          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px]">
                            By {h.onlineReceivedBy}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-[11px]">
                        {h.date} at {h.time}
                      </p>
                      {h.remarks && (
                        <p className="text-slate-700 italic mt-1">{h.remarks}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Remaining</span>
                      <span className="font-bold text-amber-700">
                        ₹{(h.remainingPending || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No payment history recorded yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
