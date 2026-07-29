import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/mysql';
import { config } from '../config/env';

export async function getOrCreateSender(senderId?: string) {
  if (senderId) {
    const sender = await queryOne<any>('SELECT * FROM senders WHERE id = ?', [senderId]);
    if (sender) return sender;
  }

  // Check if a default sender exists
  let defaultSender = await queryOne<any>('SELECT * FROM senders LIMIT 1');
  if (defaultSender) return defaultSender;

  // Create a new default sender programmatically via Raw SQL
  const newSenderId = uuidv4();
  await query(
    `INSERT INTO senders (id, name, email, smtpUser, smtpPass, createdAt) VALUES (?, ?, ?, ?, ?, NOW())`,
    [newSenderId, 'Default Sender', config.smtpUser, config.smtpUser, config.smtpPass]
  );

  return {
    id: newSenderId,
    name: 'Default Sender',
    email: config.smtpUser,
    smtpUser: config.smtpUser,
    smtpPass: config.smtpPass,
  };
}

export function createTransporter(smtpUser: string, smtpPass: string) {
  return nodemailer.createTransport({
    host: config.etherealHost,
    port: config.etherealPort,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}
