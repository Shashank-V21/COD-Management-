import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Store, CreditCard, Plus, Trash2, CheckCircle2, Loader2, Save } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { storeSettings, updateStoreSettings } = useAuth();

  const [storeName, setStoreName] = useState('');
  const [receivers, setReceivers] = useState<string[]>(['']);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStoreName(storeSettings.storeName || 'COD Hub');
      setReceivers(
        Array.isArray(storeSettings.onlineReceivers) && storeSettings.onlineReceivers.length > 0
          ? [...storeSettings.onlineReceivers]
          : ['Shashank', 'Akshay']
      );
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, storeSettings]);

  if (!isOpen) return null;

  const handleReceiverChange = (index: number, val: string) => {
    const updated = [...receivers];
    updated[index] = val;
    setReceivers(updated);
  };

  const handleAddReceiver = () => {
    setReceivers([...receivers, '']);
  };

  const handleRemoveReceiver = (index: number) => {
    if (receivers.length <= 1) return;
    setReceivers(receivers.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedStoreName = storeName.trim();
    if (!trimmedStoreName) {
      setErrorMsg('Store Name is required.');
      return;
    }

    const cleanedReceivers = receivers
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    if (cleanedReceivers.length === 0) {
      setErrorMsg('At least one Online Payment Receiver is required.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateStoreSettings({
        storeName: trimmedStoreName,
        onlineReceivers: cleanedReceivers,
        setupCompleted: true,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg('Store settings updated successfully.');
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update store settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Store Settings</h2>
              <p className="text-xs text-slate-500 font-medium">Update Store Name & Payment Receivers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Store Name Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Store Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g. COD Hub Express"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Online Payment Receivers Inputs */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Online Payment Receivers <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {receivers.map((rec, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={rec}
                      onChange={(e) => handleReceiverChange(idx, e.target.value)}
                      placeholder={`Receiver ${idx + 1} Name`}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  {receivers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveReceiver(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddReceiver}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Receiver</span>
            </button>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
