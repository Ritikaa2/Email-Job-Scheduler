import React, { useEffect, useRef, useState } from 'react';
import { Bold, CalendarDays, Italic, Link, List, Loader2, Send, Underline, X } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { CsvUploadZone } from './CsvUploadZone';

const toLocalDateTimeInput = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const escapeAttribute = (value: string) => escapeHtml(value).replace(/`/g, '&#096;');

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
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    unorderedList: false,
  });
  const [manualRecipients, setManualRecipients] = useState('');
  const [parsedRecipients, setParsedRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 2);
    return toLocalDateTimeInput(now);
  });
  const [delayValue, setDelayValue] = useState(2);
  const [delayUnit, setDelayUnit] = useState<'seconds' | 'minutes'>('seconds');
  const [maxEmailsPerHour, setMaxEmailsPerHour] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== body) {
      editorRef.current.innerHTML = body;
    }
  }, [body, isOpen]);

  if (!isOpen) return null;

  const getFinalRecipients = (): string[] => {
    if (parsedRecipients.length > 0) return parsedRecipients;

    return manualRecipients
      .split(/[\n,]+/)
      .map((email) => email.trim())
      .filter((email) => email.length > 0 && email.includes('@'));
  };

  const resetForm = () => {
    setSubject('');
    setBody('');
    setManualRecipients('');
    setParsedRecipients([]);
    setDelayValue(2);
    setDelayUnit('seconds');
    setMaxEmailsPerHour(100);
  };

  const getBodyText = () => editorRef.current?.innerText.trim() || body.replace(/<[^>]*>/g, '').trim();

  const syncBodyFromEditor = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText.trim();
    setBody(text ? editorRef.current.innerHTML : '');
  };

  const updateToolbarState = () => {
    if (typeof document === 'undefined') return;

    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      unorderedList: document.queryCommandState('insertUnorderedList'),
    });
  };

  const runFormatCommand = (command: 'bold' | 'italic' | 'underline' | 'insertUnorderedList') => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    syncBodyFromEditor();
    updateToolbarState();
  };

  const insertLink = () => {
    editorRef.current?.focus();
    const rawUrl = window.prompt('Enter link URL');
    if (!rawUrl?.trim()) return;

    const normalizedUrl = /^(https?:\/\/|mailto:)/i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${escapeAttribute(normalizedUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(normalizedUrl)}</a>`
      );
    } else {
      document.execCommand('createLink', false, normalizedUrl);
    }

    syncBodyFromEditor();
    updateToolbarState();
  };

  const handleBodyPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    syncBodyFromEditor();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalRecipients = getFinalRecipients();

    if (!subject.trim()) {
      onError('Subject is required.');
      return;
    }

    if (!getBodyText()) {
      onError('Email body is required.');
      return;
    }

    if (finalRecipients.length === 0) {
      onError('Please provide at least one valid recipient email.');
      return;
    }

    const selectedStart = new Date(startTime);
    if (Number.isNaN(selectedStart.getTime())) {
      onError('Please choose a valid schedule date and time.');
      return;
    }

    const delayMs = delayUnit === 'minutes' ? delayValue * 60 * 1000 : delayValue * 1000;
    setSubmitting(true);

    try {
      const response = await apiClient.post('/emails/schedule', {
        subject,
        body: body.trim(),
        recipients: finalRecipients,
        startTime: selectedStart.toISOString(),
        delayBetweenEmailsMs: delayMs,
        maxEmailsPerHour,
      });

      onSuccess(response.data.message || 'Emails scheduled successfully.');
      resetForm();
      onClose();
    } catch (err: any) {
      onError(err.response?.data?.error || 'Failed to schedule emails.');
    } finally {
      setSubmitting(false);
    }
  };

  const finalRecipients = getFinalRecipients();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-5xl overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-950">Compose New Email</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close compose modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_340px]">
          <section className="space-y-5">
            <label className="block text-xs font-bold text-slate-900">
              Subject
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject"
                className="mt-2 h-11 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
            </label>

            <label className="block text-xs font-bold text-slate-900">
              Email Body
              <div className="mt-2 overflow-hidden rounded-[8px] border border-slate-200">
                <div className="flex h-10 items-center gap-1 border-b border-slate-100 bg-slate-50 px-3 text-slate-500">
                  {[
                    { icon: Bold, label: 'Bold', action: () => runFormatCommand('bold'), active: activeFormats.bold },
                    { icon: Italic, label: 'Italic', action: () => runFormatCommand('italic'), active: activeFormats.italic },
                    { icon: Underline, label: 'Underline', action: () => runFormatCommand('underline'), active: activeFormats.underline },
                    { icon: List, label: 'Bulleted list', action: () => runFormatCommand('insertUnorderedList'), active: activeFormats.unorderedList },
                    { icon: Link, label: 'Insert link', action: insertLink, active: false },
                  ].map(({ icon: Icon, label, action, active }) => (
                    <button
                      key={label}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={action}
                      className={`flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-white hover:text-violet-600 ${
                        active ? 'bg-white text-violet-600 shadow-sm' : ''
                      }`}
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
                <div className="relative">
                  {!getBodyText() && (
                    <span className="pointer-events-none absolute left-3 top-3 text-sm font-normal text-slate-400">
                      Type your email body here...
                    </span>
                  )}
                  <div
                    ref={editorRef}
                    contentEditable
                    role="textbox"
                    aria-label="Email body"
                    aria-multiline="true"
                    onInput={syncBodyFromEditor}
                    onKeyUp={updateToolbarState}
                    onMouseUp={updateToolbarState}
                    onPaste={handleBodyPaste}
                    className="min-h-[260px] w-full overflow-y-auto px-3 py-3 text-sm font-normal text-slate-900 outline-none [&_a]:text-violet-600 [&_a]:underline [&_li]:ml-5 [&_ul]:list-disc"
                  />
                </div>
              </div>
            </label>

            {parsedRecipients.length === 0 && (
              <label className="block text-xs font-bold text-slate-900">
                Paste Recipients
                <textarea
                  rows={3}
                  value={manualRecipients}
                  onChange={(e) => setManualRecipients(e.target.value)}
                  placeholder="alice@example.com, bob@example.com"
                  className="mt-2 block w-full resize-none rounded-[8px] border border-slate-200 px-3 py-2 text-xs font-normal text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                />
              </label>
            )}
          </section>

          <section className="space-y-5">
            <div>
              <p className="text-xs font-bold text-slate-900">Upload Recipients (CSV/TXT)</p>
              <div className="mt-2">
                <CsvUploadZone
                  onEmailsParsed={(emails) => setParsedRecipients(emails)}
                  onClear={() => setParsedRecipients([])}
                />
              </div>
              <p className="mt-3 text-sm font-semibold text-emerald-600">
                {finalRecipients.length.toLocaleString()} email{finalRecipients.length === 1 ? '' : 's'} found
              </p>
            </div>
          </section>
        </div>

        <div className="grid gap-4 border-t border-slate-100 bg-slate-50/70 px-6 py-5 md:grid-cols-[1.3fr_1fr_1fr_auto] md:items-end">
          <label className="block text-xs font-bold text-slate-900">
            Start Time
            <div className="relative mt-2">
              <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="datetime-local"
                value={startTime}
                min={toLocalDateTimeInput(new Date())}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-11 w-full rounded-[8px] border border-slate-200 bg-white px-3 pr-10 text-sm font-normal text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
            </div>
          </label>

          <label className="block text-xs font-bold text-slate-900">
            Delay Between Emails
            <div className="mt-2 grid grid-cols-[1fr_1.2fr] gap-2">
              <input
                type="number"
                min="0"
                value={delayValue}
                onChange={(e) => setDelayValue(Number(e.target.value))}
                className="h-11 rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
              <select
                value={delayUnit}
                onChange={(e) => setDelayUnit(e.target.value as 'seconds' | 'minutes')}
                className="h-11 rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              >
                <option value="seconds">seconds</option>
                <option value="minutes">minutes</option>
              </select>
            </div>
          </label>

          <label className="block text-xs font-bold text-slate-900">
            Hourly Limit
            <input
              type="number"
              min="1"
              value={maxEmailsPerHour}
              onChange={(e) => setMaxEmailsPerHour(Number(e.target.value))}
              className="mt-2 h-11 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
          </label>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-11 rounded-[8px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Schedule Email
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
