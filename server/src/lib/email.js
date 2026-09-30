import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

let cachedTransporter = null;

const createTransporter = async () => {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (user && pass) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    });
    return cachedTransporter;
  }

  // Fallback for development without SMTP credentials: try Ethereal or simulate
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`[Email Service] Using Ethereal test account: ${testAccount.user}`);
    return cachedTransporter;
  } catch (err) {
    console.warn(`[Email Service] Ethereal account creation skipped (${err.message}). Logging to terminal.`);
    return null;
  }
};

/**
 * Send Password Reset OTP Email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.username - Recipient username
 * @param {string} options.otp - 6-digit OTP code
 */
export const sendOtpEmail = async ({ to, username, otp }) => {
  const brandName = "Pulse Messenger";
  const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || "Pulse Messenger <no-reply@pulsemessenger.com>";

  // Prominently log in console for development & fallback visibility
  console.log("\n============================================================");
  console.log(`🔐 [PULSE PASSWORD RESET OTP]`);
  console.log(`👤 User:       ${username || "User"}`);
  console.log(`📧 Recipient:  ${to}`);
  console.log(`🔢 OTP Code:   ${otp}`);
  console.log(`⏳ Validity:   10 minutes`);
  console.log("============================================================\n");

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

              <!-- OTP Code Display Card -->
              <div style="background: rgba(0, 240, 255, 0.04); border: 1px dashed rgba(0, 240, 255, 0.35); border-radius: 16px; padding: 24px; text-align: center; margin: 28px 0;">
                <span style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; font-weight: 700; margin-bottom: 8px;">Your 6-Digit Verification Code</span>
                <span style="display: inline-block; font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #00f0ff; text-shadow: 0 0 15px rgba(0,240,255,0.4);">${otp}</span>
                <span style="display: block; font-size: 12px; color: #64748b; margin-top: 10px;">Expires in <strong>10 minutes</strong></span>
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
    const transporter = await createTransporter();
    if (transporter) {
      const info = await transporter.sendMail({
        from: fromEmail,
        to,
        subject: `${otp} is your Pulse Messenger password reset code`,
        text: `Hello ${username || "there"},\n\nYour Pulse Messenger password reset code is: ${otp}\nThis code will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
        html: htmlContent,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[Email Preview URL]: ${previewUrl}`);
      }
      return { success: true, previewUrl: previewUrl || null };
    }
  } catch (err) {
    console.error("[Email Service] Transporter error:", err.message);
  }

  return { success: true, simulated: true };
};
