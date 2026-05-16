import { Resend } from 'resend';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { APP_NAME, APP_SUPPORT_EMAIL } from '@/lib/brand';

interface NewBookingDetails {
  businessName: string;
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
  staffName: string | null;
  dateTime: Date;
  duration: number;
  notes: string | null;
  appointmentUrl: string;
  timezone: string;
}

function getResendFromEmail(): string {
  // Some env providers can preserve trailing newlines from copied values.
  const raw = process.env.RESEND_FROM_EMAIL || 'noreply@clientific.app';
  return raw.trim();
}

const getResendApiKey = () => (process.env.RESEND_API_KEY || '').trim();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface SupportContactDetails {
  name: string;
  email: string;
  company?: string | null;
  subject?: string | null;
  message: string;
}

interface StaffTemporaryPasswordDetails {
  to: string;
  staffName: string;
  businessName: string;
  temporaryPassword: string;
  loginUrl?: string;
}

export async function sendNewBookingEmail(businessEmail: string, details: NewBookingDetails): Promise<void> {
  const resend = new Resend(getResendApiKey());
  const FROM = getResendFromEmail();

  const dateStr = details.dateTime.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: details.timezone,
  });
  const timeStr = details.dateTime.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: details.timezone,
  });

  const rows = [
    ['Customer', details.customerName],
    ['Phone', details.customerPhone || '—'],
    ['Service', details.serviceName],
    ['Staff', details.staffName || 'Anyone available'],
    ['Date', dateStr],
    ['Time', timeStr],
    ['Duration', `${details.duration} min`],
    ...(details.notes ? [['Notes', details.notes] as [string, string]] : []),
  ];

  const tableRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding: 8px 12px; color: #6b7280; font-size: 14px; white-space: nowrap;">${label}</td>
      <td style="padding: 8px 12px; color: #111827; font-size: 14px;">${value}</td>
    </tr>`).join('');

  await resend.emails.send({
    from: `${APP_NAME} <${FROM}>`,
    to: businessEmail,
    subject: `New booking request — ${details.customerName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
        <div style="margin-bottom: 24px;">
          <span style="font-size: 22px; font-weight: 700; color: #111827;">${APP_NAME}</span>
        </div>
        <h1 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 8px;">New Appointment Request</h1>
        <p style="color: #6b7280; margin: 0 0 24px;">
          A new appointment has been requested at <strong>${details.businessName}</strong>.
        </p>
        <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
          <tbody>${tableRows}</tbody>
        </table>
        <a href="${details.appointmentUrl}"
           style="display: inline-block; background: #2563eb; color: #fff; font-weight: 600;
                  padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-bottom: 24px;">
          View in Dashboard
        </a>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          You're receiving this because new appointment notifications are enabled for ${details.businessName}.
          You can turn this off in Settings → Notifications.
        </p>
      </div>
    `,
  });
}

export async function sendSupportContactEmail(details: SupportContactDetails): Promise<void> {
  const resend = new Resend(getResendApiKey());
  const FROM = getResendFromEmail();

  const safeName = escapeHtml(details.name);
  const safeEmail = escapeHtml(details.email);
  const safeCompany = details.company ? escapeHtml(details.company) : null;
  const safeSubject = details.subject ? escapeHtml(details.subject) : null;
  const safeMessage = escapeHtml(details.message).replace(/\n/g, '<br />');
  const subjectLine = details.subject?.trim()
    ? `Support request: ${details.subject.trim()}`
    : `New support request from ${details.name}`;

  const text = [
    `New support request for ${APP_NAME}`,
    '',
    `Name: ${details.name}`,
    `Email: ${details.email}`,
    ...(details.company ? [`Company: ${details.company}`] : []),
    ...(details.subject ? [`Subject: ${details.subject}`] : []),
    '',
    details.message,
  ].join('\n');

  await resend.emails.send({
    from: `${APP_NAME} <${FROM}>`,
    to: APP_SUPPORT_EMAIL,
    replyTo: details.email,
    subject: subjectLine,
    text,
    html: `
      <div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
        <div style="margin-bottom: 24px;">
          <span style="font-size: 22px; font-weight: 700; color: #111827;">${APP_NAME}</span>
        </div>
        <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">New support request</h1>
        <p style="color: #4b5563; margin: 0 0 24px;">A new message was submitted from the public support page.</p>

        <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
          <tbody>
            <tr>
              <td style="padding: 10px 14px; color: #6b7280; font-size: 14px; white-space: nowrap;">Name</td>
              <td style="padding: 10px 14px; color: #111827; font-size: 14px;">${safeName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; color: #6b7280; font-size: 14px; white-space: nowrap;">Email</td>
              <td style="padding: 10px 14px; color: #111827; font-size: 14px;">${safeEmail}</td>
            </tr>
            ${
              safeCompany
                ? `<tr>
              <td style="padding: 10px 14px; color: #6b7280; font-size: 14px; white-space: nowrap;">Company</td>
              <td style="padding: 10px 14px; color: #111827; font-size: 14px;">${safeCompany}</td>
            </tr>`
                : ''
            }
            ${
              safeSubject
                ? `<tr>
              <td style="padding: 10px 14px; color: #6b7280; font-size: 14px; white-space: nowrap;">Subject</td>
              <td style="padding: 10px 14px; color: #111827; font-size: 14px;">${safeSubject}</td>
            </tr>`
                : ''
            }
          </tbody>
        </table>

        <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; background: #ffffff;">
          <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6b7280;">Message</p>
          <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #111827;">${safeMessage}</p>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resend = new Resend(getResendApiKey());
  const FROM = getResendFromEmail();
  const APP_URL = getConfiguredAppBaseUrl();
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: `${APP_NAME} <${FROM}>`,
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <div style="margin-bottom: 24px;">
          <span style="font-size: 22px; font-weight: 700; color: #111827;">${APP_NAME}</span>
        </div>
        <h1 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 8px;">Reset your password</h1>
        <p style="color: #6b7280; margin: 0 0 24px;">
          We received a request to reset your password. Click the button below to choose a new one.
          This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${resetUrl}"
           style="display: inline-block; background: #2563eb; color: #fff; font-weight: 600;
                  padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-bottom: 24px;">
          Reset password
        </a>
        <p style="color: #9ca3af; font-size: 13px; margin: 0;">
          If you didn't request this, you can safely ignore this email. Your password won't change.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          If the button above doesn't work, copy and paste this URL into your browser:<br />
          <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
        </p>
      </div>
    `,
  });
}

export async function sendStaffTemporaryPasswordEmail(
  details: StaffTemporaryPasswordDetails,
): Promise<void> {
  const resend = new Resend(getResendApiKey());
  const FROM = getResendFromEmail();
  const loginUrl = details.loginUrl ?? `${getConfiguredAppBaseUrl()}/login`;
  const safeStaffName = escapeHtml(details.staffName);
  const safeBusinessName = escapeHtml(details.businessName);
  const safeTemporaryPassword = escapeHtml(details.temporaryPassword);
  const safeLoginUrl = escapeHtml(loginUrl);

  const text = [
    `${safeBusinessName} invited you to ${APP_NAME}`,
    '',
    `Hi ${details.staffName},`,
    `${details.businessName} created an employee login for you.`,
    '',
    `Sign in email: ${details.to}`,
    `Temporary password: ${details.temporaryPassword}`,
    '',
    'What to do next:',
    `1. Open ${APP_NAME} from the link below or from the Clientific iOS app.`,
    '2. Tap Sign in.',
    '3. Use the sign-in email and temporary password exactly as shown above.',
    '4. When prompted, create your own password. Use that new password from then on.',
    '5. After setup, you will see only the appointments assigned to you.',
    '',
    'For privacy, employee accounts cannot see customer phone numbers, CRM lists, deals, billing, or business settings.',
    `Sign in here: ${loginUrl}`,
  ].join('\n');

  await resend.emails.send({
    from: `${APP_NAME} <${FROM}>`,
    to: details.to,
    subject: `${details.businessName} invited you to ${APP_NAME}`,
    text,
    html: `
      <div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
        <div style="margin-bottom: 24px;">
          <span style="font-size: 22px; font-weight: 700; color: #111827;">${APP_NAME}</span>
        </div>
        <p style="margin: 0 0 10px; font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #059669;">Employee app invite</p>
        <h1 style="font-size: 22px; line-height: 1.25; font-weight: 800; color: #111827; margin: 0 0 12px;">${safeBusinessName} invited you to view your appointments</h1>
        <p style="color: #4b5563; margin: 0 0 24px; line-height: 1.6;">
          Hi ${safeStaffName}, use this temporary password to sign in. You will be asked to create your own password before you can use your employee appointment view.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 18px; margin-bottom: 24px;">
          <p style="margin: 0 0 6px; font-size: 12px; color: #047857; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Sign in email</p>
          <p style="margin: 0 0 16px; color: #111827; font-size: 16px; font-weight: 700;">${escapeHtml(details.to)}</p>
          <p style="margin: 0 0 6px; font-size: 12px; color: #047857; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Temporary password</p>
          <p style="margin: 0; color: #111827; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22px; font-weight: 800; letter-spacing: 0.04em;">${safeTemporaryPassword}</p>
        </div>
        <div style="border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px; margin-bottom: 24px;">
          <p style="margin: 0 0 10px; font-size: 13px; color: #111827; font-weight: 800;">What to do next</p>
          <ol style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.7;">
            <li>Open ${APP_NAME} from this email or from the Clientific iOS app.</li>
            <li>Tap <strong>Sign in</strong>.</li>
            <li>Use the sign-in email and temporary password exactly as shown above.</li>
            <li>Create your own password when prompted. Use that new password from then on.</li>
            <li>After setup, your appointment view will show only appointments assigned to you.</li>
          </ol>
        </div>
        <a href="${safeLoginUrl}"
           style="display: inline-block; background: #059669; color: #fff; font-weight: 700;
                  padding: 12px 24px; border-radius: 10px; text-decoration: none; margin-bottom: 20px;">
          Sign in to ${APP_NAME}
        </a>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0;">
          For privacy, employee accounts only show appointments assigned to the employee. Customer phone numbers, billing, deals, and business settings stay hidden.
        </p>
      </div>
    `,
  });
}

interface DealPurchaseReceiptDetails {
  to: string;
  customerName: string;
  businessName: string;
  dealTitle: string;
  redemptionCode: string;
  receiptUrl: string;
  totalAmount: number;
  items: Array<{ name: string; originalAmount: number; discountedAmount: number }>;
}

export async function sendDealPurchaseReceiptEmail(details: DealPurchaseReceiptDetails): Promise<void> {
  const resend = new Resend(getResendApiKey());
  const FROM = getResendFromEmail();

  function formatCents(amount: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);
  }

  const itemRows = details.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px 12px; color: #374151; font-size: 14px;">${item.name}</td>
      <td style="padding: 8px 12px; color: #6b7280; font-size: 14px; text-decoration: line-through; text-align: right;">${formatCents(item.originalAmount)}</td>
      <td style="padding: 8px 12px; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${formatCents(item.discountedAmount)}</td>
    </tr>`
    )
    .join('');

  await resend.emails.send({
    from: `${APP_NAME} <${FROM}>`,
    to: details.to,
    subject: `Your deal receipt — ${details.dealTitle}`,
    html: `
      <div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
        <div style="margin-bottom: 24px;">
          <span style="font-size: 22px; font-weight: 700; color: #111827;">${APP_NAME}</span>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0 0 4px; font-size: 13px; color: #15803d; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">Purchase confirmed</p>
          <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #111827;">${details.dealTitle}</h1>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">${details.businessName}</p>
        </div>

        <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: #7B22D4;">Your redemption code</p>
          <p style="margin: 0; font-family: monospace; font-size: 28px; font-weight: 700; color: #111827; letter-spacing: 4px;">${details.redemptionCode}</p>
          <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">Show this code when you visit ${details.businessName}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Service</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Original</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">You pay</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr style="border-top: 2px solid #e5e7eb;">
              <td colspan="2" style="padding: 12px 12px 4px; font-size: 14px; font-weight: 700; color: #111827;">Total paid</td>
              <td style="padding: 12px 12px 4px; text-align: right; font-size: 16px; font-weight: 700; color: #7B22D4;">${formatCents(details.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>

        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${details.receiptUrl}"
             style="display: inline-block; background: #7B22D4; color: #fff; font-weight: 600;
                    padding: 12px 28px; border-radius: 10px; text-decoration: none; font-size: 14px;">
            View receipt online
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px; text-align: center;">
          Hi ${details.customerName} — thanks for your purchase! Your redemption code was also sent by text message.
        </p>
        <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center;">
          Your paid value of ${formatCents(details.totalAmount)} never expires and will always be honored by ${details.businessName}, even after the promotional period ends.
        </p>
      </div>
    `,
  });
}

export async function sendEmailVerificationEmail(email: string, code: string) {
  const resend = new Resend(getResendApiKey());
  const FROM = getResendFromEmail();
  const APP_URL = getConfiguredAppBaseUrl();
  const verifyUrl = `${APP_URL}/verify-email?email=${encodeURIComponent(email)}`;
  const text = [
    `Verify your email for ${APP_NAME}`,
    '',
    `Thanks for signing up for ${APP_NAME}.`,
    `Your verification code is: ${code}`,
    '',
    'This code expires in 10 minutes and can only be used once.',
    `Enter it here: ${verifyUrl}`,
    '',
    "If you didn't request this, you can ignore this email.",
  ].join('\n');

  await resend.emails.send({
    from: `${APP_NAME} <${FROM}>`,
    to: email,
    subject: `Your ${APP_NAME} verification code`,
    text,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
        <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 12px;">Verify your email</h1>
        <p style="color: #4b5563; margin: 0 0 20px;">
          Thanks for signing up for ${APP_NAME}. Enter this one-time code to verify your email.
        </p>
        <div style="margin: 0 0 20px; padding: 16px; background: #f3f4f6; border-radius: 8px; text-align: center;">
          <span style="font-size: 32px; letter-spacing: 4px; font-weight: 700; color: #111827;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px; margin: 0 0 20px;">
          This code expires in 10 minutes and can only be used once.
        </p>
        <a href="${verifyUrl}"
           style="display: inline-block; background: #2563eb; color: #fff; font-weight: 600;
                  padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-bottom: 20px;">
          Enter code in app
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          If you didn't request this, you can ignore this email.
        </p>
      </div>
    `,
  });
}
