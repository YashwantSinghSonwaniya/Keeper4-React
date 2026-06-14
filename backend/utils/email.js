const { Resend } = require("resend");
require("dotenv").config();

// ═══════════════════════════════════════════════════════════════════════
//  RESEND EMAIL CLIENT
//  Sends via HTTPS (api.resend.com, port 443) — works on Render's free
//  tier, where outbound SMTP ports 25/465/587 are blocked.
//  Get your API key at https://resend.com/api-keys
// ═══════════════════════════════════════════════════════════════════════
const resend = new Resend(process.env.RESEND_API_KEY);

// Sender address shown to recipients.
//  - Until you verify a domain in Resend, this MUST stay "onboarding@resend.dev",
//    and Resend will only deliver to the email address on your own Resend account.
//  - After verifying a domain, set EMAIL_FROM in your env to something like
//    'Keeper App <noreply@yourdomain.com>' to send to any user.
const FROM_ADDRESS =
  process.env.EMAIL_FROM || "Keeper App <onboarding@resend.dev>";

if (!process.env.RESEND_API_KEY) {
  console.error("❌ RESEND_API_KEY is not set — email sending will fail.");
} else {
  console.log("✅ Resend email client initialized");
}

/**
 * Send an email via Resend and normalize the result so callers can keep
 * using try/catch. Resend's SDK resolves with { data, error } instead of
 * throwing on API-level failures, so we convert `error` into a thrown Error
 * to preserve the existing try/catch contract in authController.js.
 */
async function sendWithResend({ to, subject, text, html }) {
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    text,
    html,
  });

  if (error) {
    throw new Error(error.message || "Failed to send email via Resend");
  }

  return data;
}

/**
 * Send a password reset email containing a one-time reset link.
 * @param {string} to        - Recipient email address (already normalized).
 * @param {string} resetLink - Full frontend URL with the raw reset token.
 * @param {string} userName  - Recipient name for a friendly greeting.
 */
async function sendPasswordResetEmail(to, resetLink, userName = "there") {
  const text =
    `Hi ${userName},\n\n` +
    `We received a request to reset your Keeper App password.\n\n` +
    `Click the link below to choose a new password. This link expires in 1 hour:\n\n` +
    `${resetLink}\n\n` +
    `If you didn't request this, you can safely ignore this email — your password will not change.\n\n` +
    `— The Keeper App Team`;

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #202124;">
      <h2 style="color: #f5ba13; margin-bottom: 8px;">Keeper App</h2>
      <p style="font-size: 15px;">Hi ${userName},</p>
      <p style="font-size: 15px; line-height: 1.5;">
        We received a request to reset your Keeper App password.
        Click the button below to choose a new password.
      </p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${resetLink}"
           style="background: #f5ba13; color: #fff; text-decoration: none;
                  padding: 12px 28px; border-radius: 6px; font-size: 15px;
                  display: inline-block; font-weight: 600;">
          Reset Password
        </a>
      </p>
      <p style="font-size: 13px; color: #5f6368; line-height: 1.5;">
        This link will expire in <strong>1 hour</strong>.
        If the button doesn't work, copy and paste this URL into your browser:
      </p>
      <p style="font-size: 12px; color: #1a73e8; word-break: break-all;">
        ${resetLink}
      </p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #5f6368; line-height: 1.5;">
        If you didn't request a password reset, you can safely ignore this
        email — your password will not be changed.
      </p>
      <p style="font-size: 12px; color: #5f6368;">— The Keeper App Team</p>
    </div>
  `;

  return sendWithResend({
    to,
    subject: "Reset your Keeper App password",
    text,
    html,
  });
}

/**
 * Send an account verification email containing a one-time verification link.
 * The account is NOT created until this link is clicked.
 * @param {string} to          - Recipient email address (already normalized).
 * @param {string} verifyLink  - Full frontend URL with the raw verification token.
 * @param {string} userName    - Recipient name for a friendly greeting.
 */
async function sendVerificationEmail(to, verifyLink, userName = "there") {
  const text =
    `Hi ${userName},\n\n` +
    `Thanks for signing up for Keeper App!\n\n` +
    `Please confirm your email address by clicking the link below. ` +
    `Your account will only be created after you verify. This link expires in 24 hours:\n\n` +
    `${verifyLink}\n\n` +
    `If you didn't sign up, you can safely ignore this email — no account will be created.\n\n` +
    `— The Keeper App Team`;

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #202124;">
      <h2 style="color: #f5ba13; margin-bottom: 8px;">Keeper App</h2>
      <p style="font-size: 15px;">Hi ${userName},</p>
      <p style="font-size: 15px; line-height: 1.5;">
        Thanks for signing up! Please confirm your email address to finish
        creating your Keeper App account.
      </p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${verifyLink}"
           style="background: #f5ba13; color: #fff; text-decoration: none;
                  padding: 12px 28px; border-radius: 6px; font-size: 15px;
                  display: inline-block; font-weight: 600;">
          Verify Email
        </a>
      </p>
      <p style="font-size: 13px; color: #5f6368; line-height: 1.5;">
        This link will expire in <strong>24 hours</strong>.
        If the button doesn't work, copy and paste this URL into your browser:
      </p>
      <p style="font-size: 12px; color: #1a73e8; word-break: break-all;">
        ${verifyLink}
      </p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #5f6368; line-height: 1.5;">
        If you didn't sign up for Keeper App, you can safely ignore this
        email — no account will be created.
      </p>
      <p style="font-size: 12px; color: #5f6368;">— The Keeper App Team</p>
    </div>
  `;

  return sendWithResend({
    to,
    subject: "Verify your Keeper App account",
    text,
    html,
  });
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail };