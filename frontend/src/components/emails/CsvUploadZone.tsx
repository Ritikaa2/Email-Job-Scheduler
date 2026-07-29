import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { UploadRecipientsResponse } from '@/types';

interface CsvUploadZoneProps {
  onEmailsParsed: (emails: string[]) => void;
  onClear: () => void;
}

export const CsvUploadZone: React.FC<CsvUploadZoneProps> = ({ onEmailsParsed, onClear }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<UploadRecipientsResponse | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post<UploadRecipientsResponse>('/emails/upload-recipients', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setParsedData(response.data);
      onEmailsParsed(response.data.allEmails);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process file.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    setParsedData(null);
    setShowPreview(false);
    setError(null);
    onClear();
  };

  return (
    <div className="space-y-3">
      {!parsedData ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
              : 'border-slate-300 dark:border-slate-800 hover:border-indigo-400 bg-slate-50/40 dark:bg-slate-900/40'
          }`}
        >
          <input
            type="file"
            accept=".csv, .txt"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {loading ? 'Parsing file...' : 'Click to upload or drag & drop CSV / TXT'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Supports comma-separated or line-by-line recipient email lists
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/30 rounded-2xl p-4 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-600 text-white">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {parsedData.count} recipient{parsedData.count === 1 ? '' : 's'} detected
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/40 transition-colors"
              >
                {showPreview ? 'Hide preview' : 'View preview'}
                {showPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showPreview && (
            <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-900/50">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Preview (First {Math.min(10, parsedData.previewEmails.length)})
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2">
                {parsedData.previewEmails.map((email, idx) => (
                  <div
                    key={idx}
                    className="text-xs px-2.5 py-1 bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-950 rounded-lg text-slate-700 dark:text-slate-300 font-mono"
                  >
                    {email}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
};
