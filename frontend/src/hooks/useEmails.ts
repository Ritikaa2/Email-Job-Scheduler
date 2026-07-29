import { useState, useEffect, useCallback } from 'react';
import { EmailRecord, EmailStatusFilter, PaginatedResponse, Pagination, QueueStatus, RecentActivity } from '@/types';
import { apiClient } from '@/lib/apiClient';

interface EmailListFilters {
  search?: string;
  status?: EmailStatusFilter;
}

function buildEmailQuery(page: number, limit: number, filters: EmailListFilters) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);

  return params.toString();
}

export function useScheduledEmails(initialPage = 1, limit = 10, filters: EmailListFilters = {}) {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: initialPage, limit, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = useCallback(async (page = initialPage) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<PaginatedResponse<EmailRecord>>(`/emails/scheduled?${buildEmailQuery(page, limit, filters)}`);
      setEmails(response.data.data);
      setPagination(response.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch scheduled emails');
    } finally {
      setLoading(false);
    }
  }, [initialPage, limit, filters.search, filters.status]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const cancelScheduledEmail = useCallback(async (emailId: string) => {
    const previousEmails = emails;
    const previousPagination = pagination;

    setEmails((currentEmails) => currentEmails.filter((email) => email.id !== emailId));
    setPagination((currentPagination) => {
      const total = Math.max(0, currentPagination.total - 1);

      return {
        ...currentPagination,
        total,
        totalPages: Math.ceil(total / currentPagination.limit),
      };
    });

    try {
      const response = await apiClient.post<{ message: string }>(`/emails/${emailId}/cancel`);
      return response.data.message || 'Scheduled email cancelled successfully.';
    } catch (err: any) {
      setEmails(previousEmails);
      setPagination(previousPagination);
      throw new Error(err.response?.data?.error || 'Failed to cancel scheduled email.');
    }
  }, [emails, pagination]);

  return { emails, loading, error, pagination, refetch: fetchEmails, cancelScheduledEmail };
}

export function useSentEmails(initialPage = 1, limit = 10, filters: EmailListFilters = {}) {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: initialPage, limit, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = useCallback(async (page = initialPage) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<PaginatedResponse<EmailRecord>>(`/emails/sent?${buildEmailQuery(page, limit, filters)}`);
      setEmails(response.data.data);
      setPagination(response.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch sent emails');
    } finally {
      setLoading(false);
    }
  }, [initialPage, limit, filters.search, filters.status]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  return { emails, loading, error, pagination, refetch: fetchEmails };
}

export function useQueueStatus(refreshKey = 0) {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<QueueStatus>('/emails/queue-status');
      setStatus(response.data);
    } catch (err: any) {
      setStatus({
        healthy: false,
        error: err.response?.data?.error || 'Queue status unavailable',
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus, refreshKey]);

  return { status, loading, refetch: fetchStatus };
}

export function useRecentActivity(refreshKey = 0) {
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ data: RecentActivity[] }>('/emails/recent-activity');
      setActivities(response.data.data);
    } catch (err) {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities, refreshKey]);

  return { activities, loading, refetch: fetchActivities };
}

