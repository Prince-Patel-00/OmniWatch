import React, { useState } from 'react';
import { X, Download, Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { importCatalogBackup } from '../services/api.js';

export default function BackupModal({ isOpen, onClose, onRefreshData, onShowToast }) {
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const handleDownloadBackup = () => {
    window.open('/api/catalog/backup/export', '_blank');
    onShowToast?.('Exporting catalog backup...', 'info');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await importCatalogBackup(json);
      if (res.success) {
        onShowToast?.(res.message || 'Backup restored successfully!', 'success');
        onRefreshData?.();
        onClose();
      } else {
        throw new Error(res.error || 'Failed to import backup');
      }
    } catch (err) {
      console.error('Import error:', err);
      onShowToast?.(`Import failed: ${err.message}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-zinc-950 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-600/10 text-red-500">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">
                Catalog Backup & Restore
              </h3>
              <p className="text-xs text-zinc-400">
                Safeguard your personal watch collection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Export Action */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-white">
                Export Catalog Snapshot
              </h4>
              <p className="text-[11px] text-zinc-400">
                Downloads a JSON file containing all tracked titles, episode progress, ratings, and notes.
              </p>
            </div>
            <button
              onClick={handleDownloadBackup}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shrink-0 transition-colors shadow-md shadow-red-950/40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>

          {/* Import Action */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-white">
                Restore from Backup
              </h4>
              <p className="text-[11px] text-zinc-400">
                Upload a previously exported JSON backup file to restore or merge your watchlist.
              </p>
            </div>

            <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-zinc-700 hover:border-red-500/50 bg-zinc-950 text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-red-500" />
              <span>{importing ? 'Restoring...' : 'Select Backup JSON File'}</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                disabled={importing}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
