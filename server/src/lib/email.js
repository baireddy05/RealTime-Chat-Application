import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  // Refresh environment variables in case .env was edited while server was running
  dotenv.config();

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (user && pass) {
    try {
      cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === "production",
        },
      });
      console.log(`[Email Service] Configured SMTP transport for ${user}`);
      return cachedTransporter;
    } catch (err) {
      console.warn("[Email Service] SMTP setup error:", err.message);
      return null;
    }
  }

  return null;
};

/**
 * Send Password Reset OTP Email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.username - Recipient username
 * @param {string} options.otp - 6-digit OTP code
 */
export const sendOtpEmail = async ({ to, username, otp }) => {
  const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || "Pulse Messenger <no-reply@pulsemessenger.com>";
  const transporter = getTransporter();

  if (!transporter) {
    // Only in development when NO SMTP is configured in .env, show dev fallback in console
    console.warn(`\n⚠️  [Email Service] No SMTP credentials detected in server/.env.`);
    console.warn(`🔐 [DEV FALLBACK OTP]: ${otp} for ${to} (${username || "User"})\n`);
    return { success: true, simulated: true };
  }

  console.log(`[Email Service] Sending password reset email to ${to}...`);

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Pulse Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background: linear-gradient(180deg, #131b2e 0%, #0d121f 100%); border: 1px solid #1e293b; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5);" cellspacing="0" cellpadding="0">
          
          <!-- Header / Brand -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <div style="display: inline-block; padding: 10px 18px; border-radius: 9999px; background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.2); margin-bottom: 12px;">
                <span style="font-size: 13px; font-weight: 700; color: #00f0ff; letter-spacing: 1.5px; text-transform: uppercase;">Pulse Messenger</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Password Reset Code</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 36px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #94a3b8; line-height: 1.6;">
                Hello <strong style="color: #ffffff;">${username || "there"}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #94a3b8; line-height: 1.6;">
                We received a request to reset the password for your Pulse Messenger account. Use the verification code below to proceed:
              </p>

              <!-- OTP Code Display Card (Optimized for 1-Tap Mobile & Desktop Copy) -->
              <div style="background: rgba(0, 240, 255, 0.04); border: 1px dashed rgba(0, 240, 255, 0.35); border-radius: 16px; padding: 26px 20px; text-align: center; margin: 24px 0;">
                <span style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; font-weight: 700; margin-bottom: 12px;">Your 6-Digit Verification Code</span>
                
                <!-- Native 1-Tap Selectable Code Display -->
                <div style="display: inline-block; background: #070c18; padding: 14px 28px; border-radius: 14px; border: 1px solid rgba(0, 240, 255, 0.35); margin: 4px 0;">
                  <span style="display: inline-block; font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #00f0ff; text-shadow: 0 0 16px rgba(0,240,255,0.45); user-select: all; -webkit-user-select: all; -moz-user-select: all; cursor: pointer;" title="Tap and hold to copy">${otp}</span>
                </div>

                <div style="margin-top: 14px;">
                  <span style="display: inline-block; background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.2); color: #00f0ff; font-size: 12px; font-weight: 600; padding: 5px 14px; border-radius: 9999px;">
                    📲 Tap &amp; hold (or double-tap) code to copy
                  </span>
                </div>

                <span style="display: block; font-size: 11.5px; color: #64748b; margin-top: 12px;">
                  Expires in <strong>10 minutes</strong>
                </span>
              </div>

              <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                ⚠️ <strong>Never share this code with anyone.</strong> Pulse support will never ask for your verification code.
              </p>
              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                If you did not request a password reset, you can safely ignore this email. Your current password remains unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px 30px 36px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.2);">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #475569;">
                Pulse Messenger • RealTime Synchronous Chat
              </p>
              <p style="margin: 0; font-size: 11px; color: #334155;">
                This is an automated security transmission. Please do not reply directly.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: fromEmail,
      to,
      subject: `${otp} is your Pulse Messenger password reset code`,
      text: `Hello ${username || "there"},\n\nYour Pulse Messenger password reset code is: ${otp}\nThis code will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
      html: htmlContent,
    });
    console.log(`[Email Service] ✅ Password reset email successfully delivered to ${to}`);
    return { success: true };
  } catch (err) {
    console.error("[Email Service] ❌ Delivery error:", err.message);
    return { success: false, error: err.message };
  }
};
