import nodemailer from 'nodemailer';
import { config } from '../config/env';
import { createTransporter } from '../utils/ethereal';

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  fromEmail?: string;
  smtpUser?: string;
  smtpPass?: string;
}

export interface SendEmailResult {
  messageId: string;
  provider: 'emailjs' | 'smtp';
  previewUrl?: string;
}

/**
 * Helper to send HTTP POST JSON request compatible with Node 18+ (fetch) and older Node versions (https module fallback).
 */
async function postJson(url: string, data: Record<string, any>): Promise<{ ok: boolean; status: number; text: string }> {
  if (typeof fetch === 'function') {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EmailJobScheduler/1.0',
      },
      body: JSON.stringify(data),
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  }

  const https = await import('https');
  const payload = JSON.stringify(data);

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          const status = res.statusCode || 500;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            text: body,
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Send email using EmailJS REST API
 */
async function sendViaEmailJS(options: SendEmailOptions): Promise<SendEmailResult> {
  const serviceId = config.emailjsServiceId;
  const templateId = config.emailjsTemplateId;
  const publicKey = config.emailjsPublicKey;
  const privateKey = config.emailjsPrivateKey;

  console.log('[EmailJS] Initiating send request...');
  console.log('[EmailJS] Service ID:', serviceId);
  console.log('[EmailJS] Template ID:', templateId);
  console.log('[EmailJS] Public Key:', publicKey ? `${publicKey.substring(0, 6)}...` : 'Missing');

  if (!serviceId || !templateId || !publicKey) {
    throw new Error('EmailJS credentials missing! Please configure EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, and EMAILJS_PUBLIC_KEY.');
  }

  const fromEmail = options.fromEmail || config.emailFrom || 'no-reply@reachinbox.ai';
  const fromName = options.fromName || 'ReachInbox.ai';

  const payload: Record<string, any> = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      to_email: options.to,
      to_name: options.to.split('@')[0],
      recipient_email: options.to,
      email: options.to,
      from_name: fromName,
      from_email: fromEmail,
      subject: options.subject,
      message: options.body,
      body: options.body,
      html: options.body,
      plain_text: htmlToPlainText(options.body),
      reply_to: fromEmail,
    },
  };

  if (privateKey) {
    payload.accessToken = privateKey;
  }

  const result = await postJson('https://api.emailjs.com/api/v1.0/email/send', payload);

  if (!result.ok) {
    console.error(`[EmailJS Error] HTTP ${result.status}: ${result.text}`);
    throw new Error(`EmailJS send failed (${result.status}): ${result.text || 'Unknown EmailJS error'}`);
  }

  console.log('[EmailJS] Email delivered successfully via EmailJS REST API');
  const generatedId = `emailjs-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  return {
    messageId: generatedId,
    provider: 'emailjs',
  };
}

/**
 * Send email using Nodemailer (SMTP / Ethereal fallback)
 */
async function sendViaSMTP(options: SendEmailOptions): Promise<SendEmailResult> {
  console.log('[SMTP] Creating Nodemailer transporter...');
  const smtpUser = options.smtpUser || config.smtpUser;
  const smtpPass = options.smtpPass || config.smtpPass;

  const transporter = createTransporter(smtpUser, smtpPass);

  const fromName = options.fromName || 'ReachInbox.ai';
  const fromEmail = options.fromEmail || config.emailFrom || smtpUser;

  console.log(`[SMTP] Sending email via ${config.smtpHost}:${config.smtpPort}...`);

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: options.to,
    subject: options.subject,
    html: options.body,
    text: htmlToPlainText(options.body),
  });

  console.log('[SMTP] Email sent via SMTP. Message ID:', info.messageId);
  const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;

  return {
    messageId: info.messageId,
    provider: 'smtp',
    previewUrl,
  };
}

/**
 * Unified email sending service.
 * Automatically chooses EmailJS if configured, otherwise falls back to Nodemailer SMTP.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const isEmailJSConfigured = Boolean(
    config.emailjsServiceId && config.emailjsTemplateId && config.emailjsPublicKey
  );

  if (isEmailJSConfigured) {
    return await sendViaEmailJS(options);
  } else {
    return await sendViaSMTP(options);
  }
}
