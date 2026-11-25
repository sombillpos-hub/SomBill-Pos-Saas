/**
 * Transactional e-mail port. No provider (SMTP, SES, SendGrid, ...) is integrated yet; add an implementation here and
 * inject it into the modules that send mail (invitations, password reset, receipts).
 */
export interface EmailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
