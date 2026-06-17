const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Get path for configuration files, prioritizing userData directory over local root
function getMailConfigPath() {
  if (app) {
    const userDataPath = path.join(app.getPath('userData'), 'mail_config.json');
    if (fs.existsSync(userDataPath)) {
      return userDataPath;
    }
  }
  return path.join(__dirname, 'mail_config.json');
}

let transporter = null;
let etherealAccount = null;

// Load configuration
function loadMailConfig() {
  const configPath = getMailConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      // Check if it's default placeholder
      if (data.user && !data.user.includes('YOUR_EMAIL_HERE') && data.pass && !data.pass.includes('YOUR_APP_PASSWORD_HERE')) {
        return data;
      } else {
        console.warn('[Mail] mail_config.json contains placeholder values.');
      }
    } catch (e) {
      console.error('[Mail] Error reading mail_config.json:', e);
    }
  } else {
    console.warn(`[Mail] Config file not found at: ${configPath}`);
  }
  return null;
}

// Initialize transporter
async function initTransporter() {
  const config = loadMailConfig();
  if (config) {
    console.log('[Mail] Using configured SMTP settings...');
    
    const transportOpts = {
      auth: {
        user: config.user,
        pass: config.pass
      },
      tls: {
        rejectUnauthorized: false // Avoid self-signed cert validation issues on local networks
      }
    };

    // Use built-in 'gmail' service settings if host is smtp.gmail.com
    if (config.host && config.host.toLowerCase().includes('gmail.com')) {
      transportOpts.service = 'gmail';
      console.log('[Mail] Detected Gmail host. Using Nodemailer optimized "gmail" service setup.');
    } else {
      transportOpts.host = config.host;
      transportOpts.port = parseInt(config.port) || 587;
      transportOpts.secure = config.secure === true || config.secure === 'true';
      console.log(`[Mail] Custom SMTP: ${config.host}:${config.port} (secure: ${transportOpts.secure})`);
    }

    transporter = nodemailer.createTransport(transportOpts);
    return { type: 'smtp', from: config.from || config.user };
  } else {
    // Fallback to Ethereal
    console.log('[Mail] SMTP settings not configured or using placeholders. Initializing Ethereal test account...');
    if (!etherealAccount) {
      try {
        etherealAccount = await nodemailer.createTestAccount();
        console.log(`[Mail] Created Ethereal test account: ${etherealAccount.user}`);
      } catch (err) {
        console.error('[Mail] Failed to create Ethereal test account:', err.message);
        throw new Error('Could not initialize any mail service (Ethereal creation failed).');
      }
    }
    
    transporter = nodemailer.createTransport({
      host: etherealAccount.smtp.host,
      port: etherealAccount.smtp.port,
      secure: etherealAccount.smtp.secure,
      auth: {
        user: etherealAccount.user,
        pass: etherealAccount.pass
      }
    });
    return { type: 'ethereal', from: `"Electron Support" <${etherealAccount.user}>` };
  }
}

async function sendOtp(email, otpCode) {
  try {
    const { type, from } = await initTransporter();
    
    const mailOptions = {
      from: from,
      to: email,
      subject: '🔑 Electron Registration Verification Code',
      text: `Your Electron verification code is: ${otpCode}. This code is valid for 5 minutes and is valid only for this email.`,
      html: `
        <div style="font-family: sans-serif; background-color: #0b0f17; color: #f3f4f6; padding: 40px 20px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #1e293b;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3b82f6; font-size: 24px; margin: 0; letter-spacing: 2px;">ELECTRON</h1>
            <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;">Premium Script Executor Registration</p>
          </div>
          <div style="background-color: #070a0f; border: 1px solid #1e293b; border-radius: 8px; padding: 25px; text-align: center;">
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #d1d5db;">Use the following verification code to complete your registration:</p>
            <div style="font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 6px; color: #10b981; padding: 10px; background-color: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.15); border-radius: 6px; display: inline-block; margin: 10px 0;">
              ${otpCode}
            </div>
            <p style="margin: 15px 0 0 0; font-size: 11px; color: #9ca3af;">This code is valid for <b>5 minutes</b> and can only be used once.</p>
          </div>
          <div style="text-align: center; margin-top: 30px; font-size: 11px; color: #6b7280; line-height: 1.5;">
            This email was sent for a registration request to <b>${email}</b>.<br>
            If you did not request this, you can safely ignore this email.
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (type === 'ethereal') {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`\n======================================================`);
      console.log(`[Mail - Ethereal Preview] OTP sent to: ${email}`);
      console.log(`OTP Code: ${otpCode}`);
      console.log(`Message Preview URL: ${previewUrl}`);
      console.log(`======================================================\n`);
      return { success: true, type: 'ethereal', previewUrl };
    } else {
      console.log(`[Mail - SMTP] OTP sent successfully to: ${email}`);
      return { success: true, type: 'smtp' };
    }
  } catch (err) {
    console.error('[Mail Error] Failed to send email:', err);
    throw err;
  }
}

module.exports = { sendOtp };
