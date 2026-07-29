import React from 'react';
import { format } from 'date-fns';
import { Eye, Loader2, XCircle } from 'lucide-react';
import { EmailRecord, Pagination as PaginationType } from '@/types';
import { EmptyState } from '../ui/EmptyState';
import { Pagination } from '../ui/Pagination';
import { TableSkeleton } from '../ui/Skeleton';
import { StatusPill } from '../ui/StatusPill';

interface ScheduledEmailsTableProps {
  emails: EmailRecord[];
  loading: boolean;
  pagination: PaginationType;
  onPageChange: (page: number) => void;
  onComposeClick: () => void;
  onCancelEmail: (emailId: string) => Promise<void>;
}

export const ScheduledEmailsTable: React.FC<ScheduledEmailsTableProps> = ({
  emails,
  loading,
  pagination,
  onPageChange,
  onComposeClick,
  onCancelEmail,
}) => {
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

  const handleCancel = async (email: EmailRecord) => {
    setCancellingId(email.id);

    try {
      await onCancelEmail(email.id);
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No scheduled emails yet"
          description="Queue up your email dispatches with specific delays and rate limits."
          actionLabel="Compose New Email"
          onAction={onComposeClick}
        />
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-900">
            <tr>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Subject</th>
              <th className="px-6 py-4">Scheduled Time</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {emails.map((email) => (
              <tr key={email.id} className="transition hover:bg-slate-50/70">
                <td className="px-6 py-4 text-sm font-medium text-slate-700">{email.recipientEmail}</td>
                <td className="max-w-xs truncate px-6 py-4 text-sm font-medium text-slate-700">{email.subject}</td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  {format(new Date(email.scheduledFor), 'MMM d, yyyy hh:mm a')}
                </td>
                <td className="px-6 py-4">
                  <StatusPill status={email.status} errorMessage={email.errorMessage} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-violet-50 hover:text-violet-600"
                      aria-label={`View ${email.recipientEmail}`}
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {email.status === 'scheduled' && (
                      <button
                        type="button"
                        onClick={() => handleCancel(email)}
                        disabled={cancellingId === email.id}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                        aria-label={`Cancel scheduled email to ${email.recipientEmail}`}
                      >
                        {cancellingId === email.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pagination} onPageChange={onPageChange} />
    </>
  );
};
