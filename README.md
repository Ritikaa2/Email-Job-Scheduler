# 🚀 FlowSend Pro — Distributed Email Job Scheduler

FlowSend Pro is a production-grade, rate-limited email scheduling service built as a TypeScript monorepo with an **Express.js** backend and a **Next.js** frontend. It uses **BullMQ** and **Redis** for persistent delayed job queues, **MySQL (XAMPP / Docker)** via **Prisma** as the source of truth, and **Nodemailer with Ethereal Email** for test SMTP delivery.

---

## 📁 Repository Architecture

```text
email-job-scheduler/
├── docker-compose.yml        # MySQL (3306) + phpMyAdmin (8080) + Redis (6379)
├── backend/
│   ├── prisma/
│   │   └── schema.prisma     # User, Sender, ScheduledEmail models (MySQL provider)
│   ├── src/
│   │   ├── config/           # Envs and app configurations
│   │   ├── db/               # Prisma client initialization
│   │   ├── queues/           # BullMQ queue & worker definitions
│   │   ├── jobs/             # Email processor with idempotency & rate limits
│   │   ├── services/         # RateLimiter & Startup Reconciliation logic
│   │   ├── routes/           # Auth and Email REST API routes
│   │   ├── controllers/      # Handlers for scheduling, pagination, CSV upload
│   │   ├── middlewares/      # Auth JWT, Zod validation, Error handling
│   │   ├── utils/            # Ethereal SMTP test account generator
│   │   ├── app.ts            # Express application setup
│   │   └── server.ts         # Bootstrapper with worker setup & startup reconciliation
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── app/              # Next.js App Router (Login & Dashboard views)
    │   ├── components/       # Header, Compose Slide-over Modal, CSV Upload, Tables, Toast
    │   ├── hooks/            # useAuth, useScheduledEmails, useSentEmails
    │   ├── lib/              # Axios apiClient with credentials
    │   ├── types/            # TypeScript interfaces for API responses & component props
    │   └── styles/           # Tailwind CSS config with modern linear/resend design tokens
    ├── .env.example
    └── package.json
```

---

## ⚡ Quick Start Guide

### Prerequisites
- Node.js >= 18
- XAMPP (MySQL started on port 3306) OR Docker & Docker Compose

### 1. Start Infrastructure
**Option A: XAMPP MySQL**
- Open XAMPP Control Panel and click **Start** next to **MySQL**.

**Option B: Docker Compose (MySQL + phpMyAdmin + Redis)**
```bash
docker-compose up -d
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run prisma:generate
npx prisma db push
npm run dev
```
The backend server runs on `http://localhost:5000`.

### 3. Frontend Setup
In a separate terminal window:
```bash
cd frontend
npm install
npm run dev
```
The frontend application runs on `http://localhost:3000`.

---

## ⚙️ Core Technical Concepts

### 1. Delayed Job Scheduling (BullMQ + Redis)
- Emails scheduled for a future time trigger a creation of a MySQL `ScheduledEmail` row (`status = "scheduled"`).
- A BullMQ delayed job is created with `delay = scheduledTime - now`.
- Each job carries a unique idempotency key (`emailJobId` = DB row UUID).

### 2. Rate Limiting & Concurrency Architecture Choice
We chose a **Redis Token Check in Processor** approach over BullMQ's queue-level `limiter` option:
- **Reasoning:** BullMQ's native queue `limiter` pauses the *entire queue/worker* when triggered. If multiple senders share a queue, one sender hitting their limit would delay emails for all other senders.
- **Hourly Rate Limit:** Implemented using Redis keys formatted as `rate:{senderId}:{YYYY-MM-DDTHH}` using `INCR` + `EXPIRE(3600)`. If a sender exceeds `MAX_EMAILS_PER_HOUR_PER_SENDER`, the job is **not marked failed**; instead, it is re-enqueued to the next hourly window (`rescheduled`).
- **Minimum Delay Between Emails:** Implemented using a Redis key `last_sent:{senderId}` storing the timestamp of the last dispatched email. The worker enforces the `MIN_DELAY_BETWEEN_EMAILS_MS` before sending.

### 3. Restart-Safety & Reconciliation
- **Redis Persistence:** Redis is configured with `--appendonly yes` and `--save 60 1` (AOF + RDB snapshots), so queued jobs survive Redis container restarts.
- **Startup Reconciliation:** On boot, `reconcileOrphanedJobs()` scans the DB for any records with `status IN ('scheduled', 'rescheduled')`. It compares them against active/delayed jobs in BullMQ. Any orphaned rows (e.g. after a Redis flush) are automatically re-enqueued with their calculated remaining delay.

---

## 📋 Features & Requirement Checklist

| Requirement | Implementation Status | Location |
| :--- | :---: | :--- |
| **Monorepo setup (/backend, /frontend)** | ✅ Completed | `/backend`, `/frontend` |
| **Express + TypeScript Backend** | ✅ Completed | `backend/src/server.ts` |
| **BullMQ + Redis (Delayed Jobs)** | ✅ Completed | `backend/src/queues/emailQueue.ts` |
| **MySQL (XAMPP / Docker) + Prisma ORM** | ✅ Completed | `backend/prisma/schema.prisma` |
| **Nodemailer + Ethereal SMTP** | ✅ Completed | `backend/src/utils/ethereal.ts` |
| **Zod Request Validation** | ✅ Completed | `backend/src/middlewares/validation.ts` |
| **Idempotency Check** | ✅ Completed | `backend/src/jobs/emailProcessor.ts` |
| **Configurable Worker Concurrency** | ✅ Completed | `backend/src/queues/emailWorker.ts` |
| **Hourly Rate Limit per Sender** | ✅ Completed | `backend/src/services/rateLimiter.ts` |
| **Min Delay per Sender** | ✅ Completed | `backend/src/services/rateLimiter.ts` |
| **Startup Reconciliation Function** | ✅ Completed | `backend/src/services/reconciliation.ts` |
| **CSV / TXT Recipient Upload API** | ✅ Completed | `backend/src/controllers/emailController.ts` |
| **Google OAuth2 Authentication** | ✅ Completed | `backend/src/controllers/authController.ts` |
| **Linear/Resend Aesthetic Dashboard** | ✅ Completed | `frontend/src/app/dashboard/page.tsx` |
| **Compose Slide-Over Modal** | ✅ Completed | `frontend/src/components/emails/ComposeEmailModal.tsx` |
| **CSV Upload Zone with Pill & Preview** | ✅ Completed | `frontend/src/components/emails/CsvUploadZone.tsx` |
| **Scheduled & Sent Paginated Tables** | ✅ Completed | `frontend/src/components/emails/*Table.tsx` |
| **Toast Feedback Notifications** | ✅ Completed | `frontend/src/components/ui/Toast.tsx` |
