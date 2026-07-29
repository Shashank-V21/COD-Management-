import React, { useState } from 'react';
import { Rider } from '../types';
import {
  Users,
  UserPlus,
  Upload,
  Search,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Phone,
  Truck,
  Plus,
  X,
} from 'lucide-react';

interface RiderManagementProps {
  riders: Rider[];
  onAddRider: (rider: { name: string; phone?: string; vehicleNumber?: string }) => Promise<void>;
  onDeleteRider: (id: string) => Promise<void>;
  onImportRiders: (file: File) => Promise<{ count: number }>;
}

export const RiderManagement: React.FC<RiderManagementProps> = ({
  riders,
  onAddRider,
  onDeleteRider,
  onImportRiders,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Add Rider Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Delete Confirmation State
  const [riderToDelete, setRiderToDelete] = useState<Rider | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredRiders = riders.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  const handleConfirmDeleteRider = async () => {
    if (!riderToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteRider(riderToDelete.id);
      setSuccessMsg(`Rider "${riderToDelete.name}" removed successfully!`);
      setRiderToDelete(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove rider.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!name.trim()) {
      setErrorMsg('Rider Name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddRider({ name: name.trim(), phone: phone.trim(), vehicleNumber: vehicleNumber.trim() });
      setSuccessMsg(`Rider "${name.trim()}" added successfully!`);
      setName('');
      setPhone('');
      setVehicleNumber('');
      setIsAddModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add rider.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsImporting(true);
    setErrorMsg(null);

    try {
      const res = await onImportRiders(selectedFile);
      setSuccessMsg(`Successfully imported ${res.count} riders from Excel!`);
      setSelectedFile(null);
      setIsImportModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import rider file.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> Rider Directory Management
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Manage authorized delivery riders for COD collection ({riders.length} active riders)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-300"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" /> Import Excel List
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add New Rider
          </button>
        </div>
      </div>

      {/* Success / Error Messages */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="relative max-w-sm w-full">
          <input
            type="text"
            placeholder="Search rider by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
        <span className="text-xs text-slate-500 font-medium">Showing {filteredRiders.length} of {riders.length} riders</span>
      </div>

      {/* Riders Table / List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-4">Rider Name</th>
              <th className="py-3.5 px-4">Contact Phone</th>
              <th className="py-3.5 px-4">Vehicle Number</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredRiders.length > 0 ? (
              filteredRiders.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-xs">
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <span>{r.name}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {r.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" /> {r.phone}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {r.vehicleNumber ? (
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800">
                        <Truck className="w-3 h-3 text-slate-400" /> {r.vehicleNumber}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => setRiderToDelete(r)}
                      className="p-1.5 hover:bg-red-50 text-red-600 rounded-md transition-colors"
                      title="Remove Rider"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-14 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Users className="w-10 h-10 text-slate-300" />
                    <p className="text-sm font-bold text-slate-800">No riders in directory</p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      Start by adding your delivery riders manually or uploading an Excel list.
                    </p>
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="mt-2 px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 hover:bg-blue-700"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add First Rider
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Rider Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Add New Delivery Rider</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rider Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle / ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. DL-01-AB-1234"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                >
                  {isSubmitting ? 'Saving...' : 'Save Rider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Import Riders from Excel
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                Upload an Excel (.xlsx) file containing a list of rider names in the first column.
              </p>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-500 transition-colors bg-slate-50">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  id="rider-file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label htmlFor="rider-file" className="cursor-pointer block">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <span className="text-xs font-bold text-blue-600 block">
                    {selectedFile ? selectedFile.name : 'Click to browse Excel file'}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">Supports .xlsx, .csv</span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || isImporting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isImporting ? 'Importing...' : 'Upload & Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Rider Confirmation Modal */}
      {riderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Remove Rider</h3>
                <p className="text-xs text-slate-500 font-medium">Confirm deletion from directory</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to remove rider <strong className="text-slate-900 font-bold">{riderToDelete.name}</strong> from the rider directory?
            </p>

            <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1 text-slate-600 mb-5 border border-slate-200">
              <p><span className="font-semibold text-slate-700">Rider Name:</span> {riderToDelete.name}</p>
              {riderToDelete.phone && <p><span className="font-semibold text-slate-700">Phone:</span> {riderToDelete.phone}</p>}
              {riderToDelete.vehicleNumber && <p><span className="font-semibold text-slate-700">Vehicle:</span> {riderToDelete.vehicleNumber}</p>}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRiderToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRider}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
              >
                {isDeleting ? 'Removing...' : 'Remove Rider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
