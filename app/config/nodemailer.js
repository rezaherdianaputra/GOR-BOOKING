const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter using environment variables or a mock for development
const createTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    // Development/Fallback: Log to console transporter
    return {
      sendMail: async (mailOptions) => {
        console.log('=== [DEVELOPMENT EMAIL MOCK] ===');
        console.log(`To: ${mailOptions.to}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log('Body (HTML):\n', mailOptions.html);
        console.log('=================================');
        return { messageId: 'mock-id-' + Date.now() };
      }
    };
  }
};

const transporter = createTransporter();

/**
 * Sends email for booking updates.
 * @param {Object} booking Booking details
 * @param {Object} user User/Customer details
 * @param {string} type Notification type ('created', 'confirmed', 'rejected', 'expired')
 */
const sendBookingEmail = async (booking, user, type) => {
  // Only send email for confirmed payments (E-Receipt)
  if (type !== 'confirmed') {
    return;
  }

  const gorName = process.env.GOR_NAME || 'GOR Perum Jasa Tirta II';
  const subject = `[${gorName}] E-Receipt Pembayaran GOR - Booking #${booking.id}`;
  const statusText = 'LUNAS / VERIFIED';
  const greetingText = 'Pembayaran Anda telah sukses diverifikasi oleh Admin. Berikut adalah bukti pembayaran digital Anda (E-Receipt) untuk pemesanan lapangan.';

  // Formatting date and currency
  const formatRupiah = (num) => 'Rp' + parseFloat(num).toLocaleString('id-ID');
  const formatDateIndo = (dateStr) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('id-ID', options);
  };

  const htmlContent = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e0e6ed; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div style="text-align: center; border-bottom: 2px dashed #e0e6ed; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #0047a1; margin: 0 0 5px 0; font-size: 22px; font-weight: bold;">${gorName}</h2>
        <span style="font-size: 12px; color: #718096; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">E-Receipt Pembayaran</span>
      </div>
      
      <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">Halo, <strong>${user.nama}</strong>,</p>
      <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">${greetingText}</p>
      
      <!-- Highlighted Info Alert Box -->
      <div style="background-color: #ebf8ff; border-left: 4px solid #3182ce; padding: 15px; border-radius: 6px; margin: 20px 0; color: #2b6cb0; font-size: 14px; line-height: 1.5;">
        <strong>PENTING:</strong> Silakan tunjukkan <strong>Booking ID (#${booking.id})</strong> ini kepada petugas di loket GOR saat kedatangan untuk verifikasi masuk.
      </div>
      
      <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; border: 1px solid #edf2f7; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2d3748; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; font-size: 16px;">Detail Transaksi</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #718096; width: 40%;"><strong>Booking ID:</strong></td>
            <td style="padding: 8px 0; color: #1a202c; font-weight: bold; font-size: 15px;">#${booking.id}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #718096;"><strong>Nama Customer:</strong></td>
            <td style="padding: 8px 0; color: #1a202c;">${user.nama}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #718096;"><strong>Cabang Olahraga:</strong></td>
            <td style="padding: 8px 0; color: #1a202c;">${booking.sport}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #718096;"><strong>Tanggal Main:</strong></td>
            <td style="padding: 8px 0; color: #1a202c; font-weight: 600;">${formatDateIndo(booking.booking_date)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #718096;"><strong>Jam Main:</strong></td>
            <td style="padding: 8px 0; color: #1a202c;">${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)} (${booking.duration} Jam)</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #718096;"><strong>Total Pembayaran:</strong></td>
            <td style="padding: 8px 0; color: #0047a1; font-weight: bold; font-size: 16px;">${formatRupiah(booking.total_price)}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0 8px 0; color: #718096;"><strong>Status Pembayaran:</strong></td>
            <td style="padding: 12px 0 8px 0;">
              <span style="background-color: #c6f6d5; color: #22543d; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
                ${statusText}
              </span>
            </td>
          </tr>
        </table>
      </div>
      
      <p style="font-size: 12px; color: #a0aec0; text-align: center; margin-top: 30px; border-top: 1px solid #edf2f7; padding-top: 15px; line-height: 1.5;">
        E-Receipt ini diterbitkan secara sah oleh sistem manajemen GOR.<br>
        Harap tidak membalas email otomatis ini.<br>
        &copy; ${new Date().getFullYear()} ${gorName}. All rights reserved.
      </p>
    </div>
  `;

  const mailOptions = {
    from: process.env.SMTP_FROM || `"${gorName}" <no-reply@gorbooking.com>`,
    to: user.email,
    subject: subject,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`E-Receipt successfully sent to ${user.email} (Booking #${booking.id}). Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Failed to send E-Receipt to ${user.email} (Booking #${booking.id}):`, error.message);
    return false;
  }
};

/**
 * Sends email for registration OTP code.
 * @param {string} email Target email address
 * @param {string} name Target user name
 * @param {string} otp 6-digit OTP code
 */
const sendOTPEmail = async (email, name, otp) => {
  const gorName = process.env.GOR_NAME || 'GOR Perum Jasa Tirta II';
  const subject = `[${gorName}] Kode OTP Registrasi Anda`;
  
  const htmlContent = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; border: 1px solid #e0e6ed; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 15px rgba(0,49,117,0.05);">
      <div style="text-align: center; border-bottom: 2px solid #f0f3ff; padding-bottom: 20px; margin-bottom: 25px;">
        <h2 style="color: #003175; margin: 0 0 5px 0; font-size: 24px; font-weight: bold;">${gorName}</h2>
        <span style="font-size: 12px; color: #737783; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Verifikasi Alamat Email</span>
      </div>
      
      <p style="color: #434752; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Halo, <strong>${name}</strong>,</p>
      <p style="color: #434752; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">Masukkan kode OTP berikut untuk melanjutkan proses registrasi akun Anda:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <div style="display: inline-block; background-color: #f0f3ff; color: #003175; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 15px 30px; border-radius: 12px; border: 1px solid #d9e2ff; font-family: monospace;">
          ${otp}
        </div>
        <p style="color: #ba1a1a; font-size: 13px; margin-top: 15px; font-weight: 500;">Kode ini hanya berlaku selama 5 menit.</p>
      </div>
      
      <div style="background-color: #f9f9ff; border-left: 4px solid #006876; padding: 15px; border-radius: 6px; margin: 25px 0; color: #006573; font-size: 14px; line-height: 1.5;">
        <strong>Perhatian:</strong> Jika Anda tidak merasa melakukan pendaftaran akun ini, silakan abaikan email ini.
      </div>
      
      <p style="font-size: 11px; color: #737783; text-align: center; margin-top: 35px; border-top: 1px solid #e7eeff; padding-top: 20px; line-height: 1.5;">
        Email ini dikirimkan secara otomatis oleh sistem keamanan GOR.<br>
        &copy; ${new Date().getFullYear()} ${gorName}. All rights reserved.
      </p>
    </div>
  `;

  const mailOptions = {
    from: process.env.SMTP_FROM || `"${gorName}" <no-reply@gorbooking.com>`,
    to: email,
    subject: subject,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`OTP successfully sent to ${email}. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Failed to send OTP to ${email}:`, error.message);
    return false;
  }
};

module.exports = {
  sendBookingEmail,
  sendOTPEmail
};
