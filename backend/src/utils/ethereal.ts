import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/mysql';
import { config } from '../config/env';

async function getEtherealCredentials() {
  if (config.smtpUser && config.smtpPass) {
    return {
      user: config.smtpUser,
      pass: config.smtpPass,
      email: config.emailFrom || config.smtpUser,
    };
  }

  const testAccount = await nodemailer.createTestAccount();
  return {
    user: testAccount.user,
    pass: testAccount.pass,
    email: testAccount.user,
  };
}

export async function getOrCreateSender(senderId?: string) {
  if (senderId) {
    const sender = await queryOne<any>('SELECT * FROM senders WHERE id = ?', [senderId]);
    if (sender) return sender;
  }

  // Check if a default sender exists
  let defaultSender = await queryOne<any>('SELECT * FROM senders LIMIT 1');
  if (defaultSender) {
    if (
      defaultSender.name === 'Default Sender' &&
      config.smtpUser &&
      config.smtpPass &&
      (defaultSender.smtpUser !== config.smtpUser ||
        defaultSender.smtpPass !== config.smtpPass ||
        defaultSender.email !== (config.emailFrom || config.smtpUser))
    ) {
      await query(
        'UPDATE senders SET email = ?, smtpUser = ?, smtpPass = ? WHERE id = ?',
        [config.emailFrom || config.smtpUser, config.smtpUser, config.smtpPass, defaultSender.id]
      );

      defaultSender = {
        ...defaultSender,
        email: config.emailFrom || config.smtpUser,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
      };
    }

    return defaultSender;
  }

  // Create a new default sender programmatically via Raw SQL
  const newSenderId = uuidv4();
  const credentials = await getEtherealCredentials();
  await query(
    `INSERT INTO senders (id, name, email, smtpUser, smtpPass, createdAt) VALUES (?, ?, ?, ?, ?, NOW())`,
    [newSenderId, 'Default Sender', credentials.email, credentials.user, credentials.pass]
  );

  return {
    id: newSenderId,
    name: 'Default Sender',
    email: credentials.email,
    smtpUser: credentials.user,
    smtpPass: credentials.pass,
  };
}

export function createTransporter(smtpUser: string, smtpPass: string) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}
