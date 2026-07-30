# ReachInbox.ai Email Scheduler

Production-grade email scheduler and dashboard built with TypeScript, Express, BullMQ, Redis, MySQL, Docker, React/Next.js, and Tailwind CSS.

## What It Does

- Accepts email scheduling requests through authenticated APIs.
- Stores every email in MySQL as the source of truth.
- Schedules delivery with BullMQ delayed jobs backed by Redis. There are no cron jobs.
- Sends test emails through Ethereal SMTP and stores preview URLs.
- Survives backend restarts without losing scheduled jobs.
- Enforces idempotency so an email row that is already `sent` is skipped if a duplicate queue job appears.
- Provides a ReachInbox-style dashboard for Google login, composing batches, scheduled emails, and sent/failed emails.

## Stack

- Backend: TypeScript, Express.js, BullMQ, ioredis, MySQL, Nodemailer, Google OAuth
- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Infra: Docker Compose for MySQL, Redis, and phpMyAdmin

## Quick Start

1. Start infrastructure:

```bash
docker-compose up -d
```

2. Configure backend:

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

3. Configure frontend:

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

4. Open `http://localhost:3000`.

## Demo Login

The backend seeds a demo user on startup after MySQL tables are ready:

```text
Email: demo@reachinbox.ai
Password: Demo@1234
```

You can change these with `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD` in `backend/.env`. The login modal also includes a "Use" button to autofill the demo account.

## Required Google OAuth Setup

Create OAuth credentials in Google Cloud Console and set these in `backend/.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
FRONTEND_URL=http://localhost:3000
```

Add `http://localhost:5000/api/auth/google/callback` as an authorized redirect URI. The backend does not mock Google OAuth; missing Google config returns a setup error.

## Ethereal SMTP

Set `SMTP_USER` and `SMTP_PASS` to an Ethereal account if you have one. If they are blank, the backend creates an Ethereal test account on startup and stores it as the default sender.

## EmailJS Setup (Recommended for Render Deployments)

Cloud hosting platforms like Render block outbound SMTP ports (587/465) or get blocked by Gmail SMTP. To send emails reliably on Render:

1. Sign up on [EmailJS.com](https://www.emailjs.com/) and create an Email Service (e.g. connected to Gmail).
2. Create an Email Template with variables `{{to_email}}`, `{{subject}}`, `{{message}}`, and `{{from_name}}`.
3. Set the following environment variables in your Render backend service:

```env
EMAILJS_SERVICE_ID=your_service_id
EMAILJS_TEMPLATE_ID=your_template_id
EMAILJS_PUBLIC_KEY=your_public_key
EMAILJS_PRIVATE_KEY=your_private_key_optional
```

When EmailJS environment variables are set, the scheduler automatically uses EmailJS REST API to deliver emails.

## Scheduler Design

Scheduling uses BullMQ delayed jobs only:

1. `POST /api/emails/schedule` validates the batch.
2. The API creates one `scheduled_emails` row per recipient.
3. It adds one BullMQ delayed job per row using the DB row ID as the idempotency key.
4. The worker checks MySQL before sending. If the row is already `sent`, it exits without sending again.
5. On success, the row is updated to `sent`, `sentAt` and `previewUrl` are stored, and a `sent_emails` history row is written.

Redis is configured in `docker-compose.yml` with AOF and RDB persistence:

```text
redis-server --appendonly yes --save 60 1
```

On backend startup, `reconcileOrphanedJobs()` scans MySQL for `scheduled` and `rescheduled` rows and re-enqueues any missing BullMQ jobs. This protects against Redis data loss or interrupted enqueue operations.

## Concurrency and Rate Limits

Worker concurrency is configurable:

```env
WORKER_CONCURRENCY=5
```

Minimum delay between individual email sends is configurable:

```env
MIN_DELAY_BETWEEN_EMAILS_MS=1000
```

The compose UI defaults to a 2 second delay between emails, and each batch can override it. The backend fallback is 1000 ms. Enforcement is Redis-backed and atomic per sender, so multiple workers or backend instances cannot reserve the same send slot.

Hourly rate limit is configurable per sender:

```env
MAX_EMAILS_PER_HOUR_PER_SENDER=100
```

The worker uses Redis keys like `rate:{senderId}:{YYYY-MM-DDTHH}` with an atomic Lua script. If the current sender has reached the limit, the job is not dropped and is not permanently failed. It is marked `rescheduled` in MySQL and re-enqueued into the next hour window.

## Behavior Under Load

If 1000+ emails are scheduled for the same start time:

- BullMQ stores them as persistent delayed jobs.
- Worker concurrency controls how many jobs are processed in parallel.
- The per-sender Redis send-slot limiter spaces actual SMTP sends.
- The hourly Redis counter allows only the configured number per sender per hour.
- Overflow jobs are delayed into the next available hour and remain visible as `rescheduled`.

This keeps the queue durable and back-pressured instead of dropping emails or relying on in-memory counters.

## API Overview

- `GET /api/auth/google` starts Google OAuth.
- `GET /api/auth/google/callback` completes Google OAuth.
- `GET /api/auth/me` returns the logged-in user.
- `POST /api/auth/logout` clears the session.
- `POST /api/emails/upload-recipients` parses CSV/TXT leads.
- `POST /api/emails/schedule` schedules a batch.
- `GET /api/emails/scheduled` lists pending emails.
- `GET /api/emails/sent` lists sent and failed emails.
- `GET /api/emails/queue-status` reports Redis/BullMQ health.

## Verification

```bash
cd backend && npm run build
cd frontend && npm run build
```

Both builds should pass. The frontend build may warn if Google Fonts cannot be downloaded in a restricted network, but the app still builds.
