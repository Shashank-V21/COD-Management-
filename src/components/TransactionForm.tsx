import React, { useState, useEffect, useRef } from 'react';
import { PaymentMode, OnlineReceiver, Rider, Transaction } from '../types';
import { getCurrentTimeFormatted } from '../lib/utils';
import {
  PlusCircle,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Sparkles,
  User,
  IndianRupee,
  CreditCard,
  Banknote,
  RotateCcw,
} from 'lucide-react';

interface TransactionFormProps {
  riders: Rider[];
  selectedDate: string;
  onSubmit: (data: Partial<Transaction>) => Promise<void>;
  onAddRiderQuick: (name: string) => Promise<void>;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  riders,
  selectedDate,
  onSubmit,
  onAddRiderQuick,
}) => {
  // Form State
  const [riderName, setRiderName] = useState('');
  const [isRiderDropdownOpen, setIsRiderDropdownOpen] = useState(false);
  const [codAmount, setCodAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [onlineAmount, setOnlineAmount] = useState<string>('');
  const [onlineReceivedBy, setOnlineReceivedBy] = useState<OnlineReceiver | ''>('Shashank');
  const [date, setDate] = useState<string>(selectedDate);
  const [time, setTime] = useState<string>(getCurrentTimeFormatted());
  const [remarks, setRemarks] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync date when header date changes
  useEffect(() => {
    setDate(selectedDate);
  }, [selectedDate]);

  // Keep time updated
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(getCurrentTimeFormatted());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Handle Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRiderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync split amounts when mode or codAmount changes
  useEffect(() => {
    const numCod = Number(codAmount) || 0;
    if (paymentMode === 'Cash') {
      setCashAmount(numCod > 0 ? numCod.toString() : '');
      setOnlineAmount('0');
    } else if (paymentMode === 'Online') {
      setCashAmount('0');
      setOnlineAmount(numCod > 0 ? numCod.toString() : '');
      if (!onlineReceivedBy) setOnlineReceivedBy('Shashank');
    } else if (paymentMode === 'Cash + Online') {
      // Default to 50/50 split if empty
      if (numCod > 0 && (!cashAmount || cashAmount === '0')) {
        const half = Math.floor(numCod / 2);
        setCashAmount(half.toString());
        setOnlineAmount((numCod - half).toString());
      }
      if (!onlineReceivedBy) setOnlineReceivedBy('Shashank');
    }
  }, [paymentMode, codAmount]);

  // Filtered Riders List
  const filteredRiders = riders.filter((r) =>
    r.name.toLowerCase().includes(riderName.trim().toLowerCase())
  );

  // Split calculation validation
  const numCod = Number(codAmount) || 0;
  const numCash = Number(cashAmount) || 0;
  const numOnline = Number(onlineAmount) || 0;
  const currentSum = numCash + numOnline;
  const isSplitValid = paymentMode !== 'Cash + Online' || Math.abs(currentSum - numCod) < 0.01;

  const handleSelectRider = (name: string) => {
    setRiderName(name);
    setIsRiderDropdownOpen(false);
  };

  const handleCreateNewRiderQuick = async () => {
    if (!riderName.trim()) return;
    try {
      await onAddRiderQuick(riderName.trim());
      setIsRiderDropdownOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add rider');
    }
  };

  const resetForm = () => {
    setRiderName('');
    setCodAmount('');
    setPaymentMode('Cash');
    setCashAmount('');
    setOnlineAmount('');
    setOnlineReceivedBy('Shashank');
    setRemarks('');
    setErrorMsg(null);
    setSuccessMsg(null);
    setTime(getCurrentTimeFormatted());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Form Validations
    if (!riderName || !riderName.trim()) {
      setErrorMsg('Rider Name is required.');
      return;
    }

    if (!codAmount || Number(codAmount) <= 0) {
      setErrorMsg('Please enter a valid COD Amount greater than zero.');
      return;
    }

    if (numCash < 0 || numOnline < 0) {
      setErrorMsg('Negative values are not allowed.');
      return;
    }

    if (paymentMode === 'Cash + Online') {
      if (!isSplitValid) {
        setErrorMsg(
          `Cash (₹${numCash}) + Online (₹${numOnline}) = ₹${currentSum}. It must equal COD Amount (₹${numCod}).`
        );
        return;
      }
      if (!onlineReceivedBy) {
        setErrorMsg('Please select Online Received By (Shashank or Akshay).');
        return;
      }
    }

    if (paymentMode === 'Online' && !onlineReceivedBy) {
      setErrorMsg('Please select Online Received By (Shashank or Akshay).');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
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

      setSuccessMsg(`Entry saved for ${riderName.trim()} (₹${numCod})!`);
      resetForm();

      // Clear success notification after 3.5s
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      {/* Form Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
            <PlusCircle className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">New COD Entry</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
          <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-blue-600" /> {date}
          </span>
          <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-blue-600" /> {time}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        {/* Messages */}
        {errorMsg && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
          {/* 1. Rider Name (Searchable dropdown) */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Rider Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Type or select rider..."
                value={riderName}
                onChange={(e) => {
                  setRiderName(e.target.value);
                  setIsRiderDropdownOpen(true);
                }}
                onFocus={() => setIsRiderDropdownOpen(true)}
                className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>

            {/* Dropdown Menu */}
            {isRiderDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto py-1">
                {filteredRiders.length > 0 ? (
                  filteredRiders.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleSelectRider(r.name)}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 text-xs text-slate-800 font-medium flex items-center justify-between transition-colors"
                    >
                      <span>{r.name}</span>
                      {r.vehicleNumber && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          {r.vehicleNumber}
                        </span>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-slate-500">
                    <p className="mb-2">No existing rider found for "{riderName}"</p>
                    {riderName.trim() && (
                      <button
                        type="button"
                        onClick={handleCreateNewRiderQuick}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-semibold text-xs transition-colors"
                      >
                        <Sparkles className="w-3 h-3" /> Save "{riderName.trim()}" as New Rider
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. COD Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              COD Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="any"
                placeholder="e.g. 1500"
                value={codAmount}
                onChange={(e) => setCodAmount(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* 3. Payment Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Payment Mode <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
              {(['Cash', 'Online', 'Cash + Online'] as PaymentMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all text-center ${
                    paymentMode === mode
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Mode Fields */}
        {paymentMode === 'Cash' && (
          <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-xl mb-5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-900">Cash Payment Mode Selected</p>
                <p className="text-xs text-emerald-700">Full amount collected in Cash to vault</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Cash Amount</span>
              <span className="text-lg font-extrabold text-slate-900">₹{numCod.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}

        {paymentMode === 'Online' && (
          <div className="bg-indigo-50/60 border border-indigo-200 p-4 rounded-xl mb-5 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-900">Online Payment Mode Selected</p>
                <p className="text-xs text-indigo-700">Online Amount: ₹{numCod.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Online Received By <span className="text-red-500">*</span>
              </label>
              <select
                value={onlineReceivedBy}
                onChange={(e) => setOnlineReceivedBy(e.target.value as OnlineReceiver)}
                className="w-full py-2 px-3 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Shashank">Shashank</option>
                <option value="Akshay">Akshay</option>
              </select>
            </div>
          </div>
        )}

        {paymentMode === 'Cash + Online' && (
          <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-xl mb-5 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-3">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                  Split Payment Breakdown
                </span>
                <span className="text-xs text-amber-900 font-medium">
                  Cash + Online must equal Total COD (₹{numCod})
                </span>
              </div>

              {/* Realtime Validation Indicator */}
              {isSplitValid ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Split Sum Matches!
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
                  <AlertCircle className="w-3.5 h-3.5" /> Sum: ₹{currentSum} (Diff: ₹
                  {Math.abs(numCod - currentSum)})
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cash Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cash Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={cashAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCashAmount(val);
                    // auto calculate online if valid COD
                    if (numCod > 0 && val !== '') {
                      const remain = Math.max(0, numCod - Number(val));
                      setOnlineAmount(remain.toString());
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Online Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Online Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={onlineAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOnlineAmount(val);
                    if (numCod > 0 && val !== '') {
                      const remain = Math.max(0, numCod - Number(val));
                      setCashAmount(remain.toString());
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Online Received By */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Online Received By <span className="text-red-500">*</span>
                </label>
                <select
                  value={onlineReceivedBy}
                  onChange={(e) => setOnlineReceivedBy(e.target.value as OnlineReceiver)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Shashank">Shashank</option>
                  <option value="Akshay">Akshay</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Remarks & Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Package #402, GPay ID, Partial return note..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Saving to Excel...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Save COD Entry
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
