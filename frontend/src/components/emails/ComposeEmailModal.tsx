import React, { useState } from 'react';

const toLocalDateTimeInput = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};
import { X, Send, Clock, ShieldAlert, Loader2 } from 'lucide-react';
import { CsvUploadZone } from './CsvUploadZone';
import { apiClient } from '@/lib/apiClient';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

export const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [manualRecipients, setManualRecipients] = useState('');
  const [parsedRecipients, setParsedRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 2);
    return toLocalDateTimeInput(now);
  });
  const [delayValue, setDelayValue] = useState(1);
  const [delayUnit, setDelayUnit] = useState<'seconds' | 'minutes'>('seconds');
  const [maxEmailsPerHour, setMaxEmailsPerHour] = useState(100);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const getFinalRecipients = (): string[] => {
    if (parsedRecipients.length > 0) {
      return parsedRecipients;
    }
    return manualRecipients
      .split(/[\n,]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes('@'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalRecipients = getFinalRecipients();

    if (!subject.trim()) {
      onError('Subject is required.');
      return;
    }
    if (!body.trim()) {
      onError('Email body is required.');
      return;
    }
    if (finalRecipients.length === 0) {
      onError('Please provide at least one valid recipient email.');
      return;
    }

    setSubmitting(true);

    const selectedStart = new Date(startTime);
    if (Number.isNaN(selectedStart.getTime())) {
      onError('Please choose a valid schedule date and time.');
      return;
    }

    const delayMs = delayUnit === 'minutes' ? delayValue * 60 * 1000 : delayValue * 1000;
    const isoStartTime = selectedStart.toISOString();

    try {
      const response = await apiClient.post('/emails/schedule', {
        subject,
        body,
        recipients: finalRecipients,
        startTime: isoStartTime,
        delayBetweenEmailsMs: delayMs,
        maxEmailsPerHour,
      });

      onSuccess(response.data.message || 'Emails scheduled successfully!');
      onClose();
      // Reset form
      setSubject('');
      setBody('');
      setManualRecipients('');
      setParsedRecipients([]);
    } catch (err: any) {
      onError(err.response?.data?.error || 'Failed to schedule emails.');
    } finally {
      setSubmitting(false);
    }
  };

  const finalRecipients = getFinalRecipients();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Compose & Schedule Batch
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Set up staggered email dispatches with rate limits & restart persistence
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Email Subject *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Q3 Product Update & Feature Announcement"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Email Body *
              </label>
              <span className="text-[11px] text-slate-400 font-mono">{body.length} characters</span>
            </div>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email content here... (HTML formatting supported)"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-400 resize-none font-sans"
            />
          </div>

          {/* Recipients Section */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Recipients * ({finalRecipients.length} selected)
            </label>

            <CsvUploadZone
              onEmailsParsed={(emails) => setParsedRecipients(emails)}
              onClear={() => setParsedRecipients([])}
            />

            {parsedRecipients.length === 0 && (
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Or paste email addresses (comma or newline separated):
                </p>
                <textarea
                  rows={3}
                  value={manualRecipients}
                  onChange={(e) => setManualRecipients(e.target.value)}
                  placeholder="alice@example.com, bob@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-400 resize-none"
                />
              </div>
            )}
          </div>

          {/* Scheduling & Rate Limits Grid */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-indigo-500" />
              Schedule & Rate Control
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Start Time */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Start Sending At
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  min={toLocalDateTimeInput(new Date())}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              {/* Delay between emails */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Delay Between Sends
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    value={delayValue}
                    onChange={(e) => setDelayValue(Number(e.target.value))}
                    className="w-1/2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <select
                    value={delayUnit}
                    onChange={(e: any) => setDelayUnit(e.target.value)}
                    className="w-1/2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="seconds">Seconds</option>
                    <option value="minutes">Minutes</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Hourly Rate Limit */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                <span>Max Emails Per Hour</span>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-500" />
                  Auto-reschedules overflow to next hour window
                </span>
              </label>
              <input
                type="number"
                min="1"
                value={maxEmailsPerHour}
                onChange={(e) => setMaxEmailsPerHour(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>
        </form>

        {/* Sticky Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 disabled:opacity-50 transition-all active:scale-95"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Schedule Dispatch
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

