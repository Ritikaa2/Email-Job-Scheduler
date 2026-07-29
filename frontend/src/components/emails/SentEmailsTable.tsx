import React from 'react';
import { format } from 'date-fns';
import { CalendarDays, ExternalLink, Mail, UserRound, X } from 'lucide-react';
import { EmailRecord, Pagination as PaginationType } from '@/types';
import { EmptyState } from '../ui/EmptyState';
import { Pagination } from '../ui/Pagination';
import { TableSkeleton } from '../ui/Skeleton';
import { StatusPill } from '../ui/StatusPill';

interface SentEmailsTableProps {
  emails: EmailRecord[];
  loading: boolean;
  pagination: PaginationType;
  onPageChange: (page: number) => void;
  onComposeClick: () => void;
}

const buildBodyPreview = (body: string) => `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          margin: 0;
          padding: 16px;
          color: #1f2937;
          font-family: Inter, Arial, sans-serif;
          font-size: 14px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        a {
          color: #6d28d9;
          text-decoration: underline;
        }

        ul {
          margin: 0 0 12px 22px;
          padding: 0;
        }
      </style>
    </head>
    <body>${body.replace(/\n/g, '<br/>')}</body>
  </html>
`;

export const SentEmailsTable: React.FC<SentEmailsTableProps> = ({
  emails,
  loading,
  pagination,
  onPageChange,
  onComposeClick,
}) => {
  const [previewEmail, setPreviewEmail] = React.useState<EmailRecord | null>(null);

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
          title="No sent emails yet"
          description="Processed emails will appear here with delivery status and Ethereal previews."
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
              <th className="px-6 py-4">Sent Time</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {emails.map((email) => (
              <tr key={email.id} className="transition hover:bg-slate-50/70">
                <td className="px-6 py-4 text-sm font-medium text-slate-700">{email.recipientEmail}</td>
                <td className="max-w-xs truncate px-6 py-4 text-sm font-medium text-slate-700">{email.subject}</td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  {email.sentAt ? format(new Date(email.sentAt), 'MMM d, yyyy hh:mm a') : '-'}
                </td>
                <td className="px-6 py-4">
                  <StatusPill status={email.status} errorMessage={email.errorMessage} />
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => setPreviewEmail(email)}
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-100 hover:text-violet-800"
                    aria-label={`View sent email to ${email.recipientEmail}`}
                  >
                    View
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pagination} onPageChange={onPageChange} />
      {previewEmail && (
        <EmailPreviewModal email={previewEmail} onClose={() => setPreviewEmail(null)} />
      )}
    </>
  );
};

const EmailPreviewModal: React.FC<{ email: EmailRecord; onClose: () => void }> = ({ email, onClose }) => {
  const sentTime = email.sentAt ? format(new Date(email.sentAt), 'MMM d, yyyy hh:mm a') : 'Not available';
  const openLocalPreview = () => {
    const previewWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!previewWindow) return;

    previewWindow.document.write(buildBodyPreview(email.body || '<p>No email body available.</p>'));
    previewWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-violet-600">Email Preview</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">{email.subject}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close email preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-6">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[8px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <UserRound className="h-4 w-4" />
                Recipient
              </div>
              <p className="mt-2 break-all text-sm font-semibold text-slate-900">{email.recipientEmail}</p>
            </div>

            <div className="rounded-[8px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <CalendarDays className="h-4 w-4" />
                Sent Time
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{sentTime}</p>
            </div>
          </div>

          <div className="rounded-[8px] border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Mail className="h-4 w-4" />
              Subject
            </div>
            <p className="mt-2 text-base font-bold text-slate-950">{email.subject}</p>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              Email Body
            </div>
            <iframe
              title={`Email body preview for ${email.recipientEmail}`}
              sandbox=""
              srcDoc={buildBodyPreview(email.body || '<p>No email body available.</p>')}
              className="h-72 w-full bg-white p-4"
            />
          </div>

          <div className="rounded-[8px] border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Preview URL</p>
            {email.previewUrl ? (
              <a
                href={email.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-[8px] border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700 shadow-sm transition hover:bg-violet-50"
              >
                <span className="truncate">{email.previewUrl}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : (
              <button
                type="button"
                onClick={openLocalPreview}
                className="mt-2 inline-flex items-center gap-1.5 rounded-[8px] border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700 shadow-sm transition hover:bg-violet-50"
              >
                Open Local Preview
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
