'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  Hourglass,
  ListFilter,
  LogOut,
  Mail,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  AlertTriangle,
  Users,
  XCircle,
} from 'lucide-react';
import { ComposeEmailModal } from '@/components/emails/ComposeEmailModal';
import { ScheduledEmailsTable } from '@/components/emails/ScheduledEmailsTable';
import { SentEmailsTable } from '@/components/emails/SentEmailsTable';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { ToastContainer, ToastMessage } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useQueueStatus, useRecentActivity, useScheduledEmails, useSentEmails } from '@/hooks/useEmails';
import { EmailRecord, EmailStatusFilter } from '@/types';

type DashboardView = 'dashboard' | 'scheduled' | 'sent';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Mail },
  { id: 'scheduled', label: 'Scheduled Emails', icon: CalendarDays },
  { id: 'sent', label: 'Sent Emails', icon: Send },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

const statusFilterOptions: { value: EmailStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const csvEscape = (value: string | number | null | undefined) => {
  const normalizedValue = value == null ? '' : String(value);
  return `"${normalizedValue.replace(/"/g, '""')}"`;
};

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, setUser, loading: authLoading, logout } = useAuth();
  const [activeView, setActiveView] = useState<DashboardView>('dashboard');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmailStatusFilter>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('auth_token', token);
      router.replace('/dashboard');
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, user, router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 250);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const emailFilters = useMemo(
    () => ({
      search: debouncedSearchQuery,
      status: statusFilter,
    }),
    [debouncedSearchQuery, statusFilter]
  );

  const {
    emails: scheduledEmails,
    loading: scheduledLoading,
    pagination: scheduledPagination,
    refetch: refetchScheduled,
    cancelScheduledEmail,
  } = useScheduledEmails(1, 10, emailFilters);

  const {
    emails: sentEmails,
    loading: sentLoading,
    pagination: sentPagination,
    refetch: refetchSent,
  } = useSentEmails(1, 10, emailFilters);

  const { status: queueStatus, refetch: refetchQueueStatus } = useQueueStatus(refreshKey);
  const { activities: recentActivities, loading: activitiesLoading, refetch: refetchActivities } = useRecentActivity(refreshKey);

  useEffect(() => {
    if (authLoading || !user) return;

    const interval = window.setInterval(() => {
      refetchScheduled();
      refetchSent();
      refetchQueueStatus();
      refetchActivities();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [authLoading, user, refetchScheduled, refetchSent, refetchQueueStatus, refetchActivities]);

  const addToast = (type: 'success' | 'error', title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), type, title, message }]);
  };

  const changeView = (view: DashboardView) => {
    setActiveView(view);
    setSearchQuery('');
    setStatusFilter('all');
  };

  const refreshDashboard = () => {
    refetchScheduled();
    refetchSent();
    refetchQueueStatus();
    refetchActivities();
    setRefreshKey((key) => key + 1);
  };

  const exportVisibleSentEmails = () => {
    if (sentEmails.length === 0) {
      addToast('error', 'Nothing to Export', 'There are no visible sent emails to download.');
      return;
    }

    const rows = [
      ['Email', 'Subject', 'Sent Time', 'Status'],
      ...sentEmails.map((email: EmailRecord) => [
        email.recipientEmail,
        email.subject,
        email.sentAt ? format(new Date(email.sentAt), 'yyyy-MM-dd HH:mm:ss') : '',
        email.status,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `sent-emails-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCancelScheduledEmail = async (emailId: string) => {
    try {
      const message = await cancelScheduledEmail(emailId);
      addToast('success', 'Email Cancelled', message);
      refetchQueueStatus();
      setRefreshKey((key) => key + 1);
      refetchActivities();
    } catch (error: any) {
      addToast('error', 'Cancellation Failed', error.message || 'Failed to cancel scheduled email.');
    }
  };

  const stats = useMemo(() => {
    const failedCount = sentEmails.filter((email) => email.status === 'failed').length;
    const sentCount = sentEmails.filter((email) => email.status === 'sent').length;
    const totalRecipients = scheduledPagination.total + sentPagination.total;

    return [
      {
        label: 'Scheduled Emails',
        value: scheduledPagination.total,
        caption: 'Upcoming emails',
        icon: CalendarDays,
        tone: 'violet',
      },
      {
        label: 'Sent Emails',
        value: sentCount || sentPagination.total,
        caption: 'Successfully sent',
        icon: CheckCircle2,
        tone: 'emerald',
      },
      {
        label: 'Failed Emails',
        value: failedCount,
        caption: 'Delivery failed',
        icon: AlertTriangle,
        tone: 'amber',
      },
      {
        label: 'Total Recipients',
        value: totalRecipients,
        caption: 'Across all campaigns',
        icon: Users,
        tone: 'sky',
      },
    ];
  }, [scheduledPagination.total, sentEmails, sentPagination.total]);

  const queueCards = [
    { label: 'Waiting Jobs', value: queueStatus?.counts?.waiting || 0, icon: Hourglass, tone: 'bg-sky-50 text-sky-700 border-sky-100' },
    { label: 'Delayed Jobs', value: queueStatus?.counts?.delayed || 0, icon: CalendarDays, tone: 'bg-amber-50 text-amber-700 border-amber-100' },
    { label: 'Active Jobs', value: queueStatus?.counts?.active || 0, icon: PlayCircle, tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { label: 'Completed Jobs', value: queueStatus?.counts?.completed || 0, icon: CheckCircle, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { label: 'Failed Jobs', value: queueStatus?.counts?.failed || 0, icon: XCircle, tone: 'bg-rose-50 text-rose-700 border-rose-100' },
  ];

  const pageTitle = activeView === 'scheduled' ? 'Scheduled Emails' : activeView === 'sent' ? 'Sent Emails' : 'Dashboard';
  const pageSubtitle = activeView === 'scheduled'
    ? 'Manage upcoming emails and cancel scheduled jobs.'
    : activeView === 'sent'
      ? 'Review processed emails and export the visible results.'
      : 'Welcome back! Here is what is happening with your emails.';

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7ff]">
        <RefreshCw className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6ff] p-3 text-slate-950">
      <div className="flex min-h-[calc(100vh-24px)] overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
        <aside className="hidden w-[250px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="flex h-20 items-center gap-3 px-7">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
              <Mail className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">ReachInbox.ai</span>
          </div>

          <nav className="flex-1 space-y-3 px-5 py-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeView;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'dashboard') changeView('dashboard');
                    if (item.id === 'scheduled') changeView('scheduled');
                    if (item.id === 'sent') changeView('sent');
                    if (item.id === 'settings') setIsProfileOpen(true);
                  }}
                  className={`flex h-12 w-full items-center gap-3 rounded-[8px] px-4 text-sm font-semibold transition ${
                    active
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="p-5">
            <button
              onClick={logout}
              className="flex h-11 w-full items-center gap-3 rounded-[8px] px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-white">
          <header className="flex h-20 items-center justify-between border-b border-slate-100 px-5 md:px-10">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
              <p className="mt-1 text-sm text-slate-500">{pageSubtitle}</p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={refreshDashboard}
                className="hidden h-10 w-10 items-center justify-center rounded-[8px] text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 sm:flex"
                aria-label="Refresh dashboard"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              <button
                className="hidden h-10 w-10 items-center justify-center rounded-[8px] text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 sm:flex"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </button>
              {user && (
                <button
                  onClick={() => setIsProfileOpen(true)}
                  className="flex items-center gap-3 border-l border-slate-200 pl-4 text-left"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="h-10 w-10 rounded-full object-cover ring-2 ring-sky-100" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:block">
                    <span className="block text-sm font-bold">{user.name}</span>
                    <span className="block max-w-[190px] truncate text-xs text-slate-500">{user.email}</span>
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:block" />
                </button>
              )}
            </div>
          </header>

          <div className="space-y-6 px-5 py-7 md:px-10">
            {activeView !== 'dashboard' && (
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="grid flex-1 gap-3 md:max-w-2xl md:grid-cols-[minmax(0,1fr)_190px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search email or subject..."
                    className="h-11 w-full rounded-[8px] border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  />
                </div>

                <div className="relative">
                  <ListFilter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as EmailStatusFilter)}
                    className="h-11 w-full appearance-none rounded-[8px] border border-slate-200 bg-white pl-10 pr-9 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    aria-label="Filter emails by status"
                  >
                    {statusFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <button
                onClick={() => setIsComposeOpen(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-500 hover:to-indigo-500"
              >
                <Plus className="h-5 w-5" />
                Compose New Email
              </button>
            </div>
            )}

            {activeView === 'dashboard' && (
            <>
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                const toneClass = {
                  violet: 'bg-violet-100 text-violet-600',
                  emerald: 'bg-emerald-100 text-emerald-600',
                  amber: 'bg-amber-100 text-amber-600',
                  sky: 'bg-sky-100 text-sky-600',
                }[stat.tone];

                return (
                  <div key={stat.label} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-5">
                      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[8px] ${toneClass}`}>
                        <Icon className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                        <p className="mt-1 text-3xl font-extrabold tracking-tight">{stat.value.toLocaleString()}</p>
                        <p className="mt-1 text-sm font-semibold text-violet-600">{stat.caption}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {queueCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div key={card.label} className={`rounded-[8px] border p-4 ${card.tone}`}>
                    <div className="flex items-center justify-between gap-3">
                      <Icon className="h-5 w-5" />
                      <span className="text-2xl font-extrabold tracking-tight">{card.value.toLocaleString()}</span>
                    </div>
                    <p className="mt-3 text-sm font-bold">{card.label}</p>
                  </div>
                );
              })}
            </section>

            <section className="rounded-[8px] border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-violet-600" />
                  <h2 className="text-sm font-bold text-slate-950">Recent Activity</h2>
                </div>
                <span className="text-xs font-semibold text-slate-500">Latest 10</span>
              </div>
              <div className="divide-y divide-slate-100">
                {activitiesLoading ? (
                  <div className="px-6 py-5 text-sm font-medium text-slate-500">Loading activity...</div>
                ) : recentActivities.length === 0 ? (
                  <div className="px-6 py-5 text-sm font-medium text-slate-500">No recent activity yet.</div>
                ) : (
                  recentActivities.map((activity) => (
                    <div key={`${activity.id}-${activity.action}`} className="flex items-center justify-between gap-4 px-6 py-4">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{activity.action}</p>
                        <p className="mt-1 truncate text-xs font-medium text-slate-500">
                          {activity.recipientEmail} · {activity.subject}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs font-semibold text-slate-500">
                        {format(new Date(activity.occurredAt), 'MMM d, hh:mm a')}
                      </time>
                    </div>
                  ))
                )}
              </div>
            </section>
            </>
            )}

            {activeView !== 'dashboard' && (
            <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-6">
                <div className="flex items-center gap-8">
                  <button
                    onClick={() => changeView('scheduled')}
                    className={`h-14 border-b-2 px-1 text-sm font-bold transition ${
                      activeView === 'scheduled' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Scheduled Emails
                  </button>
                  <button
                    onClick={() => changeView('sent')}
                    className={`h-14 border-b-2 px-1 text-sm font-bold transition ${
                      activeView === 'sent' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Sent Emails
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {activeView === 'sent' && (
                    <button
                      type="button"
                      onClick={exportVisibleSentEmails}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </button>
                  )}
                  <span className={`hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex ${queueStatus?.healthy ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {queueStatus?.healthy ? 'Redis online' : 'Queue unavailable'}
                  </span>
                </div>
              </div>

              {activeView === 'scheduled' ? (
                <ScheduledEmailsTable
                  emails={scheduledEmails}
                  loading={scheduledLoading}
                  pagination={scheduledPagination}
                  onPageChange={(page) => refetchScheduled(page)}
                  onComposeClick={() => setIsComposeOpen(true)}
                  onCancelEmail={handleCancelScheduledEmail}
                />
              ) : (
                <SentEmailsTable
                  emails={sentEmails}
                  loading={sentLoading}
                  pagination={sentPagination}
                  onPageChange={(page) => refetchSent(page)}
                  onComposeClick={() => setIsComposeOpen(true)}
                />
              )}
            </section>
            )}
          </div>
        </main>
      </div>

      <ComposeEmailModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={(message) => {
          addToast('success', 'Batch Scheduled Successfully', message);
          refetchScheduled();
          refetchQueueStatus();
          refetchActivities();
          setActiveView('scheduled');
        }}
        onError={(message) => addToast('error', 'Scheduling Failed', message)}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onProfileUpdated={(updatedUser) => {
          setUser(updatedUser);
          addToast('success', 'Profile Updated', 'Your profile settings have been updated.');
        }}
      />

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f6f7ff]">
          <RefreshCw className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
