import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

let cachedTransporter = null;
let transporterInitialized = false;

const getTransporter = () => {
  if (transporterInitialized) return cachedTransporter;

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
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 5000,
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === "production",
        },
      });
      console.log(`[Email Service] Configured SMTP transport for ${user}`);
    } catch (err) {
      console.warn("[Email Service] SMTP setup error:", err.message);
    }
  }

  transporterInitialized = true;
  return cachedTransporter;
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
  const port = process.env.PORT || "5000";
  const baseUrl = process.env.API_URL || (process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/:5173\/?$/, `:${port}`) : `http://localhost:${port}`);
  const copyUrl = `${baseUrl.replace(/\/api\/?$/, "")}/api/auth/copy-code?code=${encodeURIComponent(otp)}`;

  // Prominently print OTP in server logs immediately so developers / testers are NEVER blocked
  console.log("\n============================================================");
  console.log(`🔐 [PULSE PASSWORD RESET OTP]`);
  console.log(`👤 User:       ${username || "User"}`);
  console.log(`📧 Recipient:  ${to}`);
  console.log(`🔢 OTP Code:   ${otp}`);
  console.log(`⏳ Validity:   10 minutes`);
  console.log("============================================================\n");

  const transporter = getTransporter();
  if (!transporter) {
    // In local development without SMTP, the console log above is the instant delivery mechanism
    return { success: true, simulated: true };
  }

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

              <!-- OTP Code Display Card with Copy & Auto-Fill Action -->
              <div style="background: rgba(0, 240, 255, 0.04); border: 1px dashed rgba(0, 240, 255, 0.35); border-radius: 16px; padding: 26px 20px; text-align: center; margin: 24px 0;">
                <span style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; font-weight: 700; margin-bottom: 10px;">Your 6-Digit Verification Code</span>
                
                <!-- Selectable Code Display -->
                <div style="display: inline-block; background: #070c18; padding: 12px 28px; border-radius: 14px; border: 1px solid rgba(0, 240, 255, 0.3); margin: 4px 0 12px 0;">
                  <span style="display: inline-block; font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #00f0ff; text-shadow: 0 0 16px rgba(0,240,255,0.45); user-select: all; -webkit-user-select: all; -moz-user-select: all; cursor: pointer;" title="Double-click or tap to select code">${otp}</span>
                </div>

                <!-- Dedicated Copy Code Button (Does NOT open the app) -->
                <div style="margin-top: 16px;">
                  <a href="${copyUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #00f0ff 0%, #00ff9d 100%); color: #070c18; font-size: 14px; font-weight: 800; text-decoration: none; padding: 12px 28px; border-radius: 12px; box-shadow: 0 4px 18px rgba(0, 240, 255, 0.35); letter-spacing: 0.3px;">
                    📋 Copy Code
                  </a>
                </div>

                <span style="display: block; font-size: 11.5px; color: #64748b; margin-top: 14px;">
                  Click <strong>Copy Code</strong> or double-click code above to copy • Expires in <strong>10 minutes</strong>
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
    return { success: true };
  } catch (err) {
    console.error("[Email Service] Delivery notice:", err.message);
    return { success: false, error: err.message };
  }
};
