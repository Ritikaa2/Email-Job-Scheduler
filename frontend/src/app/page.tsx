'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarDays, CheckCircle2, Clock, Database, FileSpreadsheet, LogOut, Mail, Play, Send, ShieldCheck, Users } from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/hooks/useAuth';

export default function ReachInboxLanding() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');

  const openAuth = (mode: 'login' | 'register' | 'forgot') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const primaryAction = () => {
    if (user) router.push('/dashboard');
    else openAuth('login');
  };

  return (
    <div className="min-h-screen bg-[#f7f8ff] text-slate-950">
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
            <Mail className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">ReachInbox.ai</span>
        </div>

        <nav className="hidden items-center gap-9 text-sm font-semibold text-slate-700 md:flex">
          <a href="#features" className="transition hover:text-violet-600">Features</a>
          <a href="#workflow" className="transition hover:text-violet-600">How it Works</a>
          <a href="#pricing" className="transition hover:text-violet-600">Pricing</a>
          <a href="#about" className="transition hover:text-violet-600">About Us</a>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <button onClick={() => router.push('/dashboard')} className="rounded-[8px] bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/20">
                Dashboard
              </button>
              <button onClick={logout} className="rounded-[8px] border border-slate-200 bg-white p-2 text-red-600">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => openAuth('login')} className="rounded-[8px] border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm">
                Login
              </button>
              <button onClick={() => openAuth('login')} className="rounded-[8px] bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/25">
                Get Started
              </button>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-8 lg:grid-cols-[1fr_520px] lg:items-center">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-700">
              <Send className="h-4 w-4" />
              AI-Powered Email Outreach
            </div>

            <h1 className="max-w-2xl text-5xl font-extrabold leading-tight tracking-tight md:text-6xl">
              Schedule Emails. Engage at the <span className="text-violet-600">Right Time.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
              ReachInbox.ai helps you schedule and send personalized emails at scale with reliability. The smart way to reach more people and get more replies.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button onClick={primaryAction} className="inline-flex h-12 items-center gap-2 rounded-[8px] bg-gradient-to-r from-violet-600 to-indigo-600 px-6 text-sm font-bold text-white shadow-lg shadow-violet-500/25">
                Get Started for Free
                <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => router.push('/dashboard')} className="inline-flex h-12 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-6 text-sm font-bold text-slate-800 shadow-sm">
                <Play className="h-4 w-4" />
                View Demo
              </button>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              {['AI-Powered Workflow', 'Reliable Scheduling', 'Built for Scale'].map((label) => (
                <span key={label} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative min-h-[440px]">
            <div className="absolute right-0 top-4 h-[410px] w-[410px] rounded-full bg-violet-100" />
            <div className="absolute right-12 top-3 rotate-12 text-violet-600">
              <Send className="h-20 w-20 fill-violet-200" />
            </div>
            <div className="absolute left-2 top-16 rounded-full border border-violet-100 bg-white p-2 shadow-xl">
              <img src="https://ui-avatars.com/api/?name=Mitranjit+Yadav&background=60a5fa&color=fff" alt="User avatar" className="h-14 w-14 rounded-full" />
            </div>
            <div className="absolute bottom-16 left-20 rounded-full border border-violet-100 bg-white p-2 shadow-xl">
              <img src="https://ui-avatars.com/api/?name=Lead+Owner&background=f59e0b&color=fff" alt="User avatar" className="h-14 w-14 rounded-full" />
            </div>
            <div className="absolute right-8 top-28 w-[340px] rounded-[8px] border border-slate-200 bg-white p-6 shadow-2xl shadow-violet-200/70">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm font-bold">Schedule Email</p>
                <span className="text-xs font-semibold text-slate-400">500 Leads</span>
              </div>
              <label className="block text-xs font-bold text-slate-700">
                Start Time
                <div className="mt-2 rounded-[8px] border border-slate-200 px-3 py-3 text-sm text-slate-600">May 24, 2024 08:00 PM</div>
              </label>
              <label className="mt-4 block text-xs font-bold text-slate-700">
                Delay Between Emails
                <div className="mt-2 rounded-[8px] border border-slate-200 px-3 py-3 text-sm text-slate-600">2 seconds</div>
              </label>
              <button className="mt-5 h-11 w-full rounded-[8px] bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-bold text-white">
                Schedule Now
              </button>
            </div>
            <div className="absolute bottom-14 right-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl">
              <CheckCircle2 className="h-8 w-8" />
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 py-14">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold">Powerful features for smarter outreach</h2>
            <p className="mt-3 text-sm text-slate-500">Everything you need to schedule, send and track your emails in one place.</p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {[
              { icon: CalendarDays, title: 'Smart Scheduling', text: 'Schedule emails for the future with custom start time, delay and hourly limits.' },
              { icon: Users, title: 'Bulk Email Support', text: 'Upload CSV or TXT leads and schedule hundreds of emails in a few clicks.' },
              { icon: ShieldCheck, title: 'Reliable & Persistent', text: 'Built with BullMQ and Redis to ensure jobs are not lost after restarts.' },
              { icon: Database, title: 'Track Everything', text: 'Monitor scheduled and sent emails with detailed status and logs.' },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[8px] bg-violet-50 text-violet-600">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{feature.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-5 py-14">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold">Simple pricing for every outreach team</h2>
            <p className="mt-3 text-sm text-slate-500">Start small, then scale your scheduled campaigns with higher queue limits.</p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {[
              {
                name: 'Starter',
                price: '$0',
                caption: 'For testing the scheduler',
                cta: 'Start Free',
                highlighted: false,
                features: ['100 scheduled emails', 'CSV/TXT upload', 'Ethereal previews', 'Basic dashboard'],
              },
              {
                name: 'Growth',
                price: '$29',
                caption: 'For growing outbound teams',
                cta: 'Choose Growth',
                highlighted: true,
                features: ['10,000 scheduled emails', 'Configurable hourly limits', 'Persistent BullMQ jobs', 'Sent and failed logs'],
              },
              {
                name: 'Scale',
                price: '$99',
                caption: 'For high-volume operations',
                cta: 'Contact Sales',
                highlighted: false,
                features: ['100,000 scheduled emails', 'Multiple senders', 'Priority queue workers', 'Advanced rate controls'],
              },
            ].map((plan) => (
              <article
                key={plan.name}
                className={`rounded-[8px] border p-6 shadow-sm ${
                  plan.highlighted
                    ? 'border-violet-500 bg-white shadow-xl shadow-violet-200/70'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {plan.highlighted && (
                  <span className="mb-4 inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-extrabold">{plan.name}</h3>
                <p className="mt-2 text-sm text-slate-500">{plan.caption}</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  <span className="pb-1 text-sm font-semibold text-slate-500">/month</span>
                </div>
                <button
                  onClick={primaryAction}
                  className={`mt-6 h-11 w-full rounded-[8px] text-sm font-bold ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25'
                      : 'border border-slate-200 bg-white text-slate-800 shadow-sm'
                  }`}
                >
                  {plan.cta}
                </button>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-slate-600">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-7xl px-5 pb-14">
          <div className="overflow-hidden rounded-[8px] bg-slate-950 text-white shadow-xl">
            <div className="grid gap-8 px-7 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[8px] bg-violet-600">
                    <FileSpreadsheet className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold">Ready to supercharge your outreach?</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Join ReachInbox.ai and schedule reliable email campaigns with persistent queues, rate limits, and clean delivery tracking.
                    </p>
                  </div>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Queue Safety', value: 'BullMQ + Redis' },
                    { label: 'Delivery Control', value: 'Delay + hourly caps' },
                    { label: 'Audit Trail', value: 'MySQL status logs' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[8px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-400">{item.label}</p>
                      <p className="mt-2 text-sm font-bold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[8px] border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-bold">What happens after signup?</p>
                <ul className="mt-4 space-y-3 text-sm text-slate-300">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    Upload CSV/TXT leads and preview detected recipients.
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    Pick start time, per-email delay, and hourly send limit.
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    Track scheduled, sent, failed, and rescheduled emails.
                  </li>
                </ul>
                <button onClick={primaryAction} className="mt-6 h-11 w-full rounded-[8px] bg-gradient-to-r from-violet-600 to-indigo-600 px-6 text-sm font-bold">
                  Get Started Now
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer id="about" className="bg-slate-950 px-5 py-10 text-sm text-slate-400">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.3fr_0.7fr_0.7fr_0.9fr]">
          <div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-violet-400" />
              <span className="font-bold text-white">ReachInbox.ai</span>
            </div>
            <p className="mt-4 max-w-sm leading-6">
              Reliable email scheduling for teams that need durable queues, controlled throughput, and visibility into every recipient.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {['No cron jobs', 'Restart safe', 'Rate limited'].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold text-white">Product</h4>
            <ul className="mt-4 space-y-3">
              <li><a href="#features" className="transition hover:text-white">Features</a></li>
              <li><a href="#workflow" className="transition hover:text-white">How it Works</a></li>
              <li><a href="#pricing" className="transition hover:text-white">Pricing</a></li>
              <li><button onClick={primaryAction} className="transition hover:text-white">Dashboard</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white">Platform</h4>
            <ul className="mt-4 space-y-3">
              <li>BullMQ scheduling</li>
              <li>Redis persistence</li>
              <li>MySQL audit logs</li>
              <li>Ethereal SMTP</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white">Demo Access</h4>
            <div className="mt-4 rounded-[8px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Email</p>
              <p className="mt-1 font-mono text-xs text-slate-200">demo@reachinbox.ai</p>
              <p className="mt-3 text-xs font-semibold uppercase text-slate-500">Password</p>
              <p className="mt-1 font-mono text-xs text-slate-200">Demo@1234</p>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-4 border-t border-white/10 pt-6 md:flex-row md:items-center md:justify-between">
          <p>Built with TypeScript, Express, BullMQ, Redis, MySQL, Docker and Tailwind CSS.</p>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="h-4 w-4" />
            Persistent delayed jobs, no cron jobs
          </div>
        </div>
      </footer>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} initialMode={authMode} />
    </div>
  );
}
