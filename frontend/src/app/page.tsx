'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Zap,
  ShieldCheck,
  Clock,
  Database,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  Server,
  LogOut,
  ChevronRight,
  BarChart3,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '@/components/auth/AuthModal';

export default function OpeningDashboardLanding() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');

  const openAuth = (mode: 'login' | 'register' | 'forgot') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Dynamic Background Glow Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-tr from-indigo-600/15 via-violet-600/15 to-transparent blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-[450px] h-[450px] bg-indigo-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[350px] h-[350px] bg-violet-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* --- TOP NAVBAR --- */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-indigo-400 flex items-center justify-center text-white shadow-glow">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                FlowSend <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-semibold border border-indigo-800">Pro</span>
              </h1>
              <p className="text-[11px] text-slate-400">XAMPP MySQL Email Job Scheduler</p>
            </div>
          </div>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
            <a href="#database" className="hover:text-white transition-colors">MySQL (XAMPP)</a>
          </nav>

          {/* Right Auth Action Buttons */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs transition-all shadow-md active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  Open Dashboard
                </button>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="p-2 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-rose-400 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAuth('login')}
                  className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-300 font-medium text-xs transition-colors"
                >
                  Log In
                </button>
                <button
                  onClick={() => openAuth('register')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-500/20 active:scale-95"
                >
                  Register Free
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* --- HERO SECTION --- */}
      <section className="relative pt-16 pb-20 px-6 max-w-7xl mx-auto text-center space-y-8">
        {/* Highlight Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-xs font-medium shadow-sm animate-in fade-in">
          <Database className="w-3.5 h-3.5 text-indigo-400" />
          <span>Powered by XAMPP MySQL (Port 3306) & BullMQ Queues</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight">
          High-Performance Distributed <br />
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Email Job Scheduling
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Schedule, queue, and dispatch high-volume emails with rate-limiting per sender,
          restart-safe job reconciliation, CSV recipient import, and detailed delivery logs.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          {user ? (
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 hover:opacity-90 text-white font-semibold text-sm transition-all shadow-glow active:scale-98"
            >
              <span>Go to App Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              <button
                onClick={() => openAuth('register')}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 hover:opacity-90 text-white font-semibold text-sm transition-all shadow-glow active:scale-98"
              >
                <span>Register New Account</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => openAuth('login')}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800/80 text-slate-200 font-semibold text-sm transition-all"
              >
                <Lock className="w-4 h-4 text-indigo-400" />
                <span>Log In with Username / Email</span>
              </button>
            </>
          )}
        </div>

        {/* System Capabilities Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10 text-left max-w-5xl mx-auto">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
            <div className="p-2.5 rounded-xl bg-indigo-950 text-indigo-400 w-fit mb-3 border border-indigo-900">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">XAMPP MySQL DB</h3>
            <p className="text-xs text-slate-400">Stores users, senders, scheduled jobs & audit history in MySQL 3306.</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
            <div className="p-2.5 rounded-xl bg-violet-950 text-violet-400 w-fit mb-3 border border-violet-900">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">BullMQ Queues</h3>
            <p className="text-xs text-slate-400">Persistent Redis delayed queue worker for precise execution times.</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
            <div className="p-2.5 rounded-xl bg-emerald-950 text-emerald-400 w-fit mb-3 border border-emerald-900">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Sender Rate Limiter</h3>
            <p className="text-xs text-slate-400">Max 100 emails/hr & min 1s delay per sender using Redis key windows.</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
            <div className="p-2.5 rounded-xl bg-sky-950 text-sky-400 w-fit mb-3 border border-sky-900">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Restart-Safe</h3>
            <p className="text-xs text-slate-400">Auto-reconciles orphaned database jobs upon server boot.</p>
          </div>
        </div>
      </section>

      {/* --- FEATURE SHOWCASE SECTION --- */}
      <section id="features" className="py-16 px-6 border-t border-slate-800/80 bg-slate-950">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Enterprise Email Dispatcher Features
            </h2>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              Everything required to reliably schedule, monitor, and deliver bulk transactional & marketing emails.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/50 transition-all space-y-4 group">
              <div className="p-3 rounded-2xl bg-indigo-950 border border-indigo-800 text-indigo-400 w-fit group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Bulk CSV Recipient Upload</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Upload CSV or TXT file recipient lists. FlowSend automatically parses emails, removes duplicates, and renders recipient pills.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/50 transition-all space-y-4 group">
              <div className="p-3 rounded-2xl bg-violet-950 border border-violet-800 text-violet-400 w-fit group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Live Paginated Dashboard</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track scheduled vs sent emails with attempt counts, delivery status badges, error logs, and Ethereal preview links.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/50 transition-all space-y-4 group">
              <div className="p-3 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-400 w-fit group-hover:scale-110 transition-transform">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Username & Password Auth</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Secure JWT authentication with bcrypt password hashing, login, user registration, and forgot password recovery.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- DATABASE ARCHITECTURE SECTION --- */}
      <section id="database" className="py-16 px-6 border-t border-slate-800/80 bg-slate-900/40">
        <div className="max-w-5xl mx-auto rounded-3xl p-8 bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 text-xs font-semibold border border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>XAMPP MySQL 3306 Configured</span>
            </div>
            <h2 className="text-2xl font-bold text-white">
              Database Backend: MySQL (XAMPP / MariaDB)
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              The entire application database is powered by XAMPP MySQL. All user accounts, email senders, scheduled jobs, and log records are stored in the <code className="text-indigo-400 font-mono">email_scheduler</code> database on port 3306.
            </p>
          </div>

          <div className="w-full md:w-80 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs text-slate-300">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-400 text-[11px]">
              <span>DB CONFIG</span>
              <span className="text-emerald-400 font-bold">READY</span>
            </div>
            <div>
              <span className="text-slate-500">HOST: </span>
              <span className="text-indigo-300">localhost</span>
            </div>
            <div>
              <span className="text-slate-500">PORT: </span>
              <span className="text-indigo-300">3306 (XAMPP)</span>
            </div>
            <div>
              <span className="text-slate-500">DATABASE: </span>
              <span className="text-indigo-300">email_scheduler</span>
            </div>
            <div>
              <span className="text-slate-500">ORM: </span>
              <span className="text-violet-400">Prisma (MySQL)</span>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-8 border-t border-slate-800/80 bg-slate-950 text-center text-xs text-slate-500 space-y-2">
        <p className="font-medium text-slate-400">FlowSend Pro — Enterprise Email Scheduler</p>
        <p>Built with Express.js, Next.js, BullMQ, Redis & XAMPP MySQL.</p>
      </footer>

      {/* --- AUTH MODAL --- */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
}
