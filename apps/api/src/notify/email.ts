// Sends plain-text email over SMTP. No HTML, no tracking pixels, no tracked links (constitution I).
import nodemailer from 'nodemailer';
import { config } from '../config.ts';
import { log } from '../lib/log.ts';

const transport = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465,
  ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } } : {})
});

export type Email = {
  to: string;
  subject: string;
  text: string;
  /** Notification emails end with a link to change notification settings. */
  settingsFooter?: boolean;
};

/** In automated API tests, emails are collected here instead of being sent. */
export const testOutbox: { to: string; subject: string; text: string }[] = [];

export async function sendEmail({ to, subject, text, settingsFooter = false }: Email) {
  const footer = settingsFooter
    ? `\n\n—\nYou can change which emails wunan sends you here:\n${config.SITE_URL}/settings/notifications\n`
    : '\n';
  if (config.NODE_ENV === 'test') {
    testOutbox.push({ to, subject, text: text + footer });
    return;
  }
  try {
    await transport.sendMail({ from: config.MAIL_FROM, to, subject, text: text + footer });
  } catch (error) {
    // Logged without the address; the caller decides whether failure matters.
    log.error('email_failed', { subject, reason: (error as Error).message });
    throw error;
  }
}
