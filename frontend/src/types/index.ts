export interface User {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  avatarUrl?: string | null;
}

export type EmailStatus = 'scheduled' | 'sent' | 'failed' | 'rescheduled' | 'cancelled';
export type EmailStatusFilter = 'all' | 'scheduled' | 'sent' | 'failed' | 'cancelled';

export interface EmailRecord {
  id: string;
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledFor: string;
  status: EmailStatus;
  bullJobId?: string | null;
  attempts: number;
  errorMessage?: string | null;
  sentAt?: string | null;
  previewUrl?: string | null;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface UploadRecipientsResponse {
  count: number;
  previewEmails: string[];
  allEmails: string[];
}

export interface ScheduleEmailPayload {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenEmailsMs?: number;
  maxEmailsPerHour?: number;
}
export interface QueueStatus {
  healthy: boolean;
  mode?: 'redis' | 'memory';
  redis?: string;
  counts?: {
    waiting?: number;
    delayed?: number;
    active?: number;
    completed?: number;
    failed?: number;
    paused?: number;
  };
  checkedAt: string;
  error?: string;
}

export interface RecentActivity {
  id: string;
  recipientEmail: string;
  subject: string;
  status: EmailStatus;
  action: 'Email Scheduled' | 'Email Sent' | 'Email Failed' | 'Email Cancelled';
  occurredAt: string;
}

