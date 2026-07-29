import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  backendUrl: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || '5000'}`,
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  minDelayBetweenEmailsMs: parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '1000', 10),
  maxEmailsPerHourPerSender: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '100', 10),
  etherealHost: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
  etherealPort: parseInt(process.env.ETHEREAL_PORT || '587', 10),
  smtpHost: process.env.SMTP_HOST || process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
  smtpPort: parseInt(process.env.SMTP_PORT || process.env.ETHEREAL_PORT || '587', 10),
  smtpSecure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  emailFrom: process.env.EMAIL_FROM || process.env.SMTP_USER || '',
  demoUserEmail: process.env.DEMO_USER_EMAIL || 'demo@reachinbox.ai',
  demoUserPassword: process.env.DEMO_USER_PASSWORD || 'Demo@1234',
};
