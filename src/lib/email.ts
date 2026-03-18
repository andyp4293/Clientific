import { Resend } from 'resend';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { APP_NAME } from '@/lib/brand';

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

export async function sendNewBookingEmail(businessEmail: string, details: NewBookingDetails): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
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

export async function sendPasswordResetEmail(email: string, token: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);
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
  const resend = new Resend(process.env.RESEND_API_KEY);
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
        <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
          Hi ${details.customerName} — thanks for your purchase! Your redemption code was also sent by text message.
        </p>
      </div>
    `,
  });
}

export async function sendEmailVerificationEmail(email: string, code: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);
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
