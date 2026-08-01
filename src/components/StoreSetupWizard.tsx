import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Store, CreditCard, Plus, Trash2, ArrowRight, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';

interface StoreSetupWizardProps {
  onComplete: () => void;
}

export const StoreSetupWizard: React.FC<StoreSetupWizardProps> = ({ onComplete }) => {
  const { updateStoreSettings } = useAuth();

  const [storeName, setStoreName] = useState('');
  const [receivers, setReceivers] = useState<string[]>(['', '']); // Receiver 1 (req), Receiver 2 (opt)
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReceiverChange = (index: number, val: string) => {
    const updated = [...receivers];
    updated[index] = val;
    setReceivers(updated);
  };

  const handleAddReceiver = () => {
    setReceivers([...receivers, '']);
  };

  const handleRemoveReceiver = (index: number) => {
    if (receivers.length <= 1) return; // Keep at least receiver 1
    const updated = receivers.filter((_, idx) => idx !== index);
    setReceivers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg(null);

    const trimmedStoreName = storeName.trim();
    if (!trimmedStoreName) {
      setErrorMsg('Please enter your Store Name.');
      return;
    }

    const receiver1 = receivers[0]?.trim();
    if (!receiver1) {
      setErrorMsg('Online Payment Receiver 1 is required.');
      return;
    }

    // Filter out blank receiver strings
    const cleanedReceivers = receivers
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    if (cleanedReceivers.length === 0) {
      setErrorMsg('At least one Online Payment Receiver is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateStoreSettings({
        storeName: trimmedStoreName,
        onlineReceivers: cleanedReceivers,
        setupCompleted: true,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onComplete();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save store setup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans text-slate-100">
      <div className="w-full max-w-xl bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
        
        {/* Wizard Header Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold tracking-widest uppercase bg-white/20 px-2 py-0.5 rounded-full">
                Step 1 of 1 • One-Time Configuration
              </span>
              <h1 className="text-xl font-black tracking-tight mt-0.5">Store Setup Wizard</h1>
            </div>
          </div>
          <p className="text-xs text-blue-100/90 font-medium leading-relaxed">
            Configure your store details and online payment receivers to personalize your COD ledger and reports.
          </p>
        </div>

        {/* Wizard Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start space-x-2.5">
              <span className="font-bold shrink-0">⚠️ Error:</span>
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Field 1: Store Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Store / Hub Name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Store className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Express Delivery Hub - Delhi"
                className="w-full pl-10 pr-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              This name will appear on all COD receipts, Excel exports, and daily closing reports.
            </p>
          </div>

          {/* Section: Online Payment Receivers */}
          <div className="space-y-3 pt-2 border-t border-slate-700/60">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Online Payment Receivers <span className="text-rose-400">*</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  Accounts or persons receiving online UPI / QR collections for your store.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {receivers.map((rec, index) => {
                const isRequired = index === 0;
                return (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={rec}
                        onChange={(e) => handleReceiverChange(index, e.target.value)}
                        placeholder={
                          isRequired
                            ? 'Receiver 1 (Required, e.g. Shashank / HDFC UPI)'
                            : `Receiver ${index + 1} (Optional, e.g. Akshay / Store QR)`
                        }
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm font-medium text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>

                    {/* Delete button if receivers count > 1 and not the mandatory first receiver */}
                    {receivers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveReceiver(index)}
                        className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 rounded-xl transition-colors border border-slate-700"
                        title="Remove Receiver"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add Receiver Button */}
            <button
              type="button"
              onClick={handleAddReceiver}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-700/60 hover:bg-slate-700 text-blue-300 text-xs font-bold rounded-xl border border-slate-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Receiver</span>
            </button>
          </div>

          {/* Security & Info Notice */}
          <div className="p-3.5 bg-slate-900/60 border border-slate-700/80 rounded-xl text-[11px] text-slate-400 flex items-start space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              You can modify your store settings or add additional receivers anytime from your account settings.
            </span>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span>Saving Store Setup...</span>
                </>
              ) : (
                <>
                  <span>Complete Setup & Open Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
