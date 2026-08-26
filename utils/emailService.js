const nodemailer = require('nodemailer');

// Real Gmail SMTP Transport Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'finderteamphone@gmail.com',
    pass: 'njzj nogx sfoi qeyl'
  }
});

/**
 * Sends a 6-digit Email Verification OTP via Gmail
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit OTP code
 */
async function sendOtpEmail(toEmail, otp) {
  const mailOptions = {
    from: '"Phone Part Finder" <finderteamphone@gmail.com>',
    to: toEmail,
    subject: "🔑 Your Email Verification OTP Code - Phone Part Finder",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
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
          If you did not request this email, please ignore this message.
        </p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ OTP Email sent via Gmail! MessageId: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Gmail Email Error:", error.message);
    throw error;
  }
}

module.exports = {
  transporter,
  sendOtpEmail
};
