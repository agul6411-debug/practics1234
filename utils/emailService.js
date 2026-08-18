const nodemailer = require('nodemailer');

// Mailtrap SMTP Transport Configuration as requested
const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "19ea0dd760ec8b",
    pass: "d563d6c3660254"
  }
});

/**
 * Sends a 6-digit Email Verification OTP
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit OTP code
 */
async function sendOtpEmail(toEmail, otp) {
  const mailOptions = {
    from: '"Phone Part Finder" <no-reply@phonepartfinder.com>',
    to: toEmail,
    subject: "🔑 Your Email Verification OTP Code - Phone Part Finder",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; borderRadius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #0284c7; margin: 0;">📱 Phone Part Finder</h2>
          <p style="color: #64748b; font-size: 14px;">Marketplace & Part Verification System</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;" />
        <h3 style="color: #1e293b; margin-top: 0;">Verify Your Email Address</h3>
        <p style="color: #334155; font-size: 14px; line-height: 1.5;">
          Thank you for signing up with Phone Part Finder! Please use the 6-digit OTP code below to verify your email address:
        </p>
        <div style="text-align: center; margin: 25px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0284c7; background-color: #f0f9ff; padding: 12px 24px; border-radius: 8px; border: 1px dashed #0284c7; display: inline-block;">
            ${otp}
          </span>
        </div>
        <p style="color: #64748b; font-size: 13px; text-align: center;">
          ⏱️ This OTP code will expire in <strong>10 minutes</strong>.
        </p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          If you did not request this email, please ignore this message or contact support.
        </p>
      </div>
    `
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("❌ Mailtrap Email Error:", error.message);
        return reject(error);
      }
      console.log("✅ OTP Email sent via Mailtrap! MessageId: %s", info.messageId);
      resolve(info);
    });
  });
}

module.exports = {
  transporter,
  sendOtpEmail
};
