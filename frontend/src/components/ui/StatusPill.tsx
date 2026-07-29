import React from 'react';
import { EmailStatus } from '@/types';
import { Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface StatusPillProps {
  status: EmailStatus;
  errorMessage?: string | null;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, errorMessage }) => {
  switch (status) {
    case 'scheduled':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
          <Clock className="w-3.5 h-3.5" />
          Scheduled
        </span>
      );
    case 'rescheduled':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
          <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
          Rate Limited (Rescheduled)
        </span>
      );
    case 'sent':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
          <CheckCircle className="w-3.5 h-3.5" />
          Sent
        </span>
      );
    case 'failed':
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 cursor-pointer group relative"
          title={errorMessage || 'Sending failed'}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Failed
          {errorMessage && (
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 text-[10px] text-white bg-slate-900 rounded shadow-lg z-50 whitespace-normal">
              {errorMessage}
            </span>
          )}
        </span>
      );
    default:
      return null;
  }
};
