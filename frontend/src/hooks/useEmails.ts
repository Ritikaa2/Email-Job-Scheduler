import { useState, useEffect, useCallback } from 'react';
import { EmailRecord, PaginatedResponse, Pagination, QueueStatus } from '@/types';
import { apiClient } from '@/lib/apiClient';

export function useScheduledEmails(initialPage = 1, limit = 10) {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: initialPage, limit, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = useCallback(async (page = initialPage) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<PaginatedResponse<EmailRecord>>(`/emails/scheduled?page=${page}&limit=${limit}`);
      setEmails(response.data.data);
      setPagination(response.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch scheduled emails');
    } finally {
      setLoading(false);
    }
  }, [initialPage, limit]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  return { emails, loading, error, pagination, refetch: fetchEmails };
}

export function useSentEmails(initialPage = 1, limit = 10) {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: initialPage, limit, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = useCallback(async (page = initialPage) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<PaginatedResponse<EmailRecord>>(`/emails/sent?page=${page}&limit=${limit}`);
      setEmails(response.data.data);
      setPagination(response.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch sent emails');
    } finally {
      setLoading(false);
    }
  }, [initialPage, limit]);

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

