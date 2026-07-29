import React from 'react';
import { EmailRecord, Pagination as PaginationType } from '@/types';
import { StatusPill } from '../ui/StatusPill';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { Pagination } from '../ui/Pagination';
import { format } from 'date-fns';
import { ExternalLink, Inbox, MailCheck, MailX, Hash } from 'lucide-react';

interface SentEmailsTableProps {
  emails: EmailRecord[];
  loading: boolean;
  pagination: PaginationType;
  onPageChange: (page: number) => void;
  onComposeClick: () => void;
}

export const SentEmailsTable: React.FC<SentEmailsTableProps> = ({
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
        title="No sent or failed emails"
        description="Scheduled emails will appear here once processed by the BullMQ worker."
        actionLabel="Compose New Email"
        onAction={onComposeClick}
      />
    );
  }

  const sentCount = emails.filter((email) => email.status === 'sent').length;
  const failedCount = emails.filter((email) => email.status === 'failed').length;

  return (
    <div className="border border-slate-800 rounded-3xl shadow-2xl overflow-hidden bg-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-950/60">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Inbox className="w-4 h-4 text-emerald-300" /> Delivery History
          </h3>
          <p className="text-xs text-slate-500">Processed jobs with delivery previews and failure context</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
            <p className="font-bold text-white">{pagination.total}</p>
            <p className="text-[10px] text-slate-500">Total</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
            <p className="font-bold text-emerald-300">{sentCount}</p>
            <p className="text-[10px] text-slate-500">Sent</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
            <p className="font-bold text-rose-300">{failedCount}</p>
            <p className="text-[10px] text-slate-500">Failed</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3.5">Recipient</th>
              <th className="px-6 py-3.5">Subject</th>
              <th className="px-6 py-3.5">Dispatched At</th>
              <th className="px-6 py-3.5">Attempts</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {emails.map((email) => (
              <tr key={email.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-2xl border flex items-center justify-center ${
                      email.status === 'sent'
                        ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                        : 'bg-rose-950 border-rose-800 text-rose-300'
                    }`}>
                      {email.status === 'sent' ? <MailCheck className="w-4 h-4" /> : <MailX className="w-4 h-4" />}
                    </div>
                    <span className="font-mono text-xs font-medium text-slate-100">{email.recipientEmail}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-300 font-medium max-w-xs truncate">{email.subject}</td>
                <td className="px-6 py-4 text-xs font-mono text-slate-400">
                  {email.sentAt ? format(new Date(email.sentAt), 'PPpp') : format(new Date(email.createdAt), 'PPpp')}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-300">
                    <Hash className="w-3.5 h-3.5 text-slate-500" /> {email.attempts || 0}
                  </span>
                </td>
                <td className="px-6 py-4"><StatusPill status={email.status} errorMessage={email.errorMessage} /></td>
                <td className="px-6 py-4 text-right">
                  {email.previewUrl ? (
                    <a
                      href={email.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-800 bg-indigo-950/60 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/70 transition-colors"
                    >
                      View Mail <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pagination} onPageChange={onPageChange} />
    </div>
  );
};
