import React from 'react';
import { EmailRecord, Pagination as PaginationType } from '@/types';
import { StatusPill } from '../ui/StatusPill';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { Pagination } from '../ui/Pagination';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { CalendarClock, Mail, Timer, Hash } from 'lucide-react';

interface ScheduledEmailsTableProps {
  emails: EmailRecord[];
  loading: boolean;
  pagination: PaginationType;
  onPageChange: (page: number) => void;
  onComposeClick: () => void;
}

export const ScheduledEmailsTable: React.FC<ScheduledEmailsTableProps> = ({
  emails,
  loading,
  pagination,
  onPageChange,
  onComposeClick,
}) => {
  if (loading) {
    return <TableSkeleton rows={5} />;
  }

  if (emails.length === 0) {
    return (
      <EmptyState
        title="No scheduled emails yet"
        description="Queue up your email dispatches with specific delays and rate limits."
        actionLabel="Compose New Email"
        onAction={onComposeClick}
      />
    );
  }

  return (
    <div className="border border-slate-800 rounded-3xl shadow-2xl overflow-hidden bg-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-950/60">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-indigo-300" /> Scheduled Queue
          </h3>
          <p className="text-xs text-slate-500">Upcoming dispatches ordered by send time</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
            <p className="font-bold text-white">{pagination.total}</p>
            <p className="text-[10px] text-slate-500">Total</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
            <p className="font-bold text-indigo-300">{emails.filter((e) => e.status === 'scheduled').length}</p>
            <p className="text-[10px] text-slate-500">Ready</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
            <p className="font-bold text-amber-300">{emails.filter((e) => e.status === 'rescheduled').length}</p>
            <p className="text-[10px] text-slate-500">Delayed</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3.5">Recipient</th>
              <th className="px-6 py-3.5">Subject</th>
              <th className="px-6 py-3.5">Scheduled For</th>
              <th className="px-6 py-3.5">Wait</th>
              <th className="px-6 py-3.5">Attempts</th>
              <th className="px-6 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {emails.map((email) => {
              const scheduledDate = new Date(email.scheduledFor);
              const waitLabel = scheduledDate.getTime() > Date.now()
                ? formatDistanceToNowStrict(scheduledDate, { addSuffix: true })
                : 'Due now';

              return (
                <tr key={email.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-indigo-950 border border-indigo-800 text-indigo-300 flex items-center justify-center">
                        <Mail className="w-4 h-4" />
                      </div>
                      <span className="font-mono text-xs font-medium text-slate-100">{email.recipientEmail}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300 font-medium max-w-xs truncate">{email.subject}</td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-400">{format(scheduledDate, 'PPpp')}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-300">
                      <Timer className="w-3.5 h-3.5 text-sky-300" /> {waitLabel}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-300">
                      <Hash className="w-3.5 h-3.5 text-slate-500" /> {email.attempts || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4"><StatusPill status={email.status} errorMessage={email.errorMessage} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pagination} onPageChange={onPageChange} />
    </div>
  );
};
