'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { ScheduledEmailsTable } from '@/components/emails/ScheduledEmailsTable';
import { SentEmailsTable } from '@/components/emails/SentEmailsTable';
import { ComposeEmailModal } from '@/components/emails/ComposeEmailModal';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { ToastContainer, ToastMessage } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useScheduledEmails, useSentEmails, useQueueStatus } from '@/hooks/useEmails';
import { Clock, CheckCircle2, AlertTriangle, Zap, RefreshCw, Search, Sparkles, Database, Activity, CalendarClock, Timer, Wifi, WifiOff, Target, TrendingUp, BellRing, PlayCircle, PauseCircle } from 'lucide-react';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, setUser, loading: authLoading, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Token parameter handling from OAuth callback
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('auth_token', token);
      router.replace('/dashboard');
    }
  }, [searchParams, router]);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  const {
    emails: scheduledEmails,
    loading: scheduledLoading,
    pagination: scheduledPagination,
    refetch: refetchScheduled,
  } = useScheduledEmails();

  const {
    emails: sentEmails,
    loading: sentLoading,
    pagination: sentPagination,
    refetch: refetchSent,
  } = useSentEmails();

  const { status: queueStatus, refetch: refetchQueueStatus } = useQueueStatus(refreshKey);

  const addToast = (type: 'success' | 'error', title: string, message?: string) => {
    const newToast: ToastMessage = {
      id: Date.now().toString(),
      type,
      title,
      message,
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleComposeSuccess = (msg: string) => {
    addToast('success', 'Batch Scheduled Successfully', msg);
    refetchScheduled();
    setActiveTab('scheduled');
  };

  const handleComposeError = (err: string) => {
    addToast('error', 'Scheduling Failed', err);
  };

  const handleProfileUpdated = (updatedUser: any) => {
    setUser(updatedUser);
    addToast('success', 'Profile Updated', 'Your profile settings have been updated.');
  };

  const refreshDashboard = () => {
    if (activeTab === 'scheduled') refetchScheduled();
    else refetchSent();
    refetchQueueStatus();
    setRefreshKey((key) => key + 1);
  };

  useEffect(() => {
    if (!autoRefresh || authLoading || !user) return;

    const interval = window.setInterval(() => {
      refetchScheduled();
      refetchSent();
      refetchQueueStatus();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [autoRefresh, authLoading, user, refetchScheduled, refetchSent, refetchQueueStatus]);

  const dashboardMetrics = useMemo(() => {
    const failedCount = sentEmails.filter((e) => e.status === 'failed').length;
    const sentCount = sentEmails.filter((e) => e.status === 'sent').length;
    const processedCount = sentCount + failedCount;
    const deliveryRate = processedCount > 0 ? Math.round((sentCount / processedCount) * 100) : 100;
    const nextEmail = [...scheduledEmails].sort(
      (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
    )[0];
    const nextDelayMs = nextEmail ? Math.max(0, new Date(nextEmail.scheduledFor).getTime() - Date.now()) : 0;
    const nextDelayMinutes = Math.ceil(nextDelayMs / 60000);
    const queueWaiting = queueStatus?.counts?.waiting || 0;
    const queueDelayed = queueStatus?.counts?.delayed || 0;
    const queueActive = queueStatus?.counts?.active || 0;

    return {
      failedCount,
      sentCount,
      processedCount,
      deliveryRate,
      nextEmail,
      nextDelayMinutes,
      queueWaiting,
      queueDelayed,
      queueActive,
      queueLoad: queueWaiting + queueDelayed + queueActive,
    };
  }, [scheduledEmails, sentEmails, queueStatus]);

  // Search Filtering
  const filteredScheduled = scheduledEmails.filter(
    (e) =>
      e.recipientEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSent = sentEmails.filter(
    (e) =>
      e.recipientEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Sticky Header */}
      <Header
        user={user}
        onLogout={logout}
        onComposeClick={() => setIsComposeOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {/* --- COMMAND CENTER --- */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
                <Activity className="w-3.5 h-3.5" />
                Live Dispatch Command Center
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-white">Welcome back, {user?.name || 'Operator'}</h2>
                <p className="text-sm text-slate-400">Monitor queue health, upcoming sends, delivery quality and batch activity from one cockpit.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:min-w-[560px]">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Queue</span>
                  {queueStatus?.healthy ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-rose-400" />}
                </div>
                <p className={`mt-2 text-lg font-bold ${queueStatus?.healthy ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {queueStatus?.healthy ? 'Online' : 'Check Redis'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{queueStatus?.error || 'Worker signal ready'}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Next Send</span>
                  <CalendarClock className="w-4 h-4 text-sky-300" />
                </div>
                <p className="mt-2 text-lg font-bold text-white">
                  {dashboardMetrics.nextEmail ? `${dashboardMetrics.nextDelayMinutes}m` : 'None'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{dashboardMetrics.nextEmail?.recipientEmail || 'No pending recipient'}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Delivery</span>
                  <Target className="w-4 h-4 text-emerald-300" />
                </div>
                <p className="mt-2 text-lg font-bold text-white">{dashboardMetrics.deliveryRate}%</p>
                <p className="text-[11px] text-slate-500">{dashboardMetrics.sentCount} sent, {dashboardMetrics.failedCount} failed</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Queue Load</span>
                  <Timer className="w-4 h-4 text-violet-300" />
                </div>
                <p className="mt-2 text-lg font-bold text-white">{dashboardMetrics.queueLoad}</p>
                <p className="text-[11px] text-slate-500">{dashboardMetrics.queueActive} active now</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1.5 border border-slate-800">
                <BellRing className="w-3.5 h-3.5 text-indigo-300" /> {dashboardMetrics.queueDelayed} delayed
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1.5 border border-slate-800">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-300" /> {dashboardMetrics.processedCount} processed
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1.5 border border-slate-800">
                <Database className="w-3.5 h-3.5 text-sky-300" /> MySQL synced
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefresh((value) => !value)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  autoRefresh
                    ? 'border-emerald-700 bg-emerald-950/50 text-emerald-300'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                {autoRefresh ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                Auto Refresh
              </button>
              <button
                onClick={() => setIsComposeOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-950 hover:bg-indigo-50 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" /> New Batch
              </button>
            </div>
          </div>
        </section>

        {/* --- STATS OVERVIEW CARDS --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Scheduled Jobs */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-indigo-500/50 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400">Scheduled Queue</p>
                <h3 className="text-2xl font-extrabold text-white mt-1">
                  {scheduledPagination.total}
                </h3>
              </div>
              <div className="p-3 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800 group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Pending worker dispatches
            </p>
          </div>

          {/* Card 2: Sent History */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400">Delivered & Sent</p>
                <h3 className="text-2xl font-extrabold text-white mt-1">
                  {sentPagination.total}
                </h3>
              </div>
              <div className="p-3 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Processed via SMTP Ethereal
            </p>
          </div>

          {/* Card 3: Failed Dispatches */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-rose-950/40 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-rose-500/50 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400">Failed / Retried</p>
                <h3 className="text-2xl font-extrabold text-white mt-1">
                  {sentEmails.filter((e) => e.status === 'failed').length}
                </h3>
              </div>
              <div className="p-3 rounded-xl bg-rose-950 text-rose-400 border border-rose-800 group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3">With error stack traces</p>
          </div>

          {/* Card 4: Sender Rate Window */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-violet-950/40 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-violet-500/50 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400">Hourly Rate Limit</p>
                <h3 className="text-2xl font-extrabold text-white mt-1">100 / hr</h3>
              </div>
              <div className="p-3 rounded-xl bg-violet-950 text-violet-400 border border-violet-800 group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3">1,000ms min delay per sender</p>
          </div>
        </div>

        {/* --- NAVIGATION & SEARCH TOOLBAR --- */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          {/* Tabs */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                activeTab === 'scheduled'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Clock className="w-4 h-4" />
              Scheduled Emails
              {scheduledPagination.total > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold">
                  {scheduledPagination.total}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                activeTab === 'sent'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Sent & Failed History
              {sentPagination.total > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold">
                  {sentPagination.total}
                </span>
              )}
            </button>
          </div>

          {/* Right Toolbar: Search & Actions */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search email or subject..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <button
              onClick={refreshDashboard}
              className="p-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
              title="Refresh dashboard"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* --- TAB CONTENT TABLES --- */}
        {activeTab === 'scheduled' ? (
          <ScheduledEmailsTable
            emails={filteredScheduled}
            loading={scheduledLoading}
            pagination={scheduledPagination}
            onPageChange={(page) => refetchScheduled(page)}
            onComposeClick={() => setIsComposeOpen(true)}
          />
        ) : (
          <SentEmailsTable
            emails={filteredSent}
            loading={sentLoading}
            pagination={sentPagination}
            onPageChange={(page) => refetchSent(page)}
            onComposeClick={() => setIsComposeOpen(true)}
          />
        )}
      </main>

      {/* Compose Slide-over Modal */}
      <ComposeEmailModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={handleComposeSuccess}
        onError={handleComposeError}
      />

      {/* Profile Settings Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onProfileUpdated={handleProfileUpdated}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}


