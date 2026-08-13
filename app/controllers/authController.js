const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const { sendOTPEmail } = require('../config/nodemailer');
const { generateCaptcha } = require('../utils/captchaHelper');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey12345';
const BCRYPT_SALT_ROUNDS = 10;

// Get Captcha (for Login)
const getCaptcha = async (req, res) => {
  try {
    const captcha = generateCaptcha();
    const id = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save to database
    await db.query(
      'INSERT INTO captchas (id, answer, expires_at) VALUES (?, ?, ?)',
      [id, captcha.text, expiresAt]
    );

    return res.json({
      success: true,
      id: id,
      svg: captcha.svg
    });
  } catch (error) {
    console.error('Get Captcha Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat captcha.'
    });
  }
};

// Register Customer (Step 1: Save details temporarily & Send OTP)
const register = async (req, res) => {
  const { nama, email, nomor_hp, password, is_karyawan, nik_karyawan } = req.body;

  // Input validation
  if (!nama || !email || !nomor_hp || !password) {
    return res.status(400).json({
      success: false,
      message: 'Semua field wajib diisi.'
    });
  }

  // Phone number validation (digits only)
  if (!/^\d+$/.test(nomor_hp)) {
    return res.status(400).json({
      success: false,
      message: 'Nomor handphone hanya boleh berisi angka.'
    });
  }

  // Employee NIK validation
  if (is_karyawan && (!nik_karyawan || nik_karyawan.trim() === '')) {
    return res.status(400).json({
      success: false,
      message: 'NIK karyawan wajib diisi jika mendaftar sebagai karyawan.'
    });
  }

  try {
    // Check if email already exists in main users table
    const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah terdaftar.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Delete old temp registration for this email if any
    await db.query('DELETE FROM temp_registrations WHERE email = ?', [email]);

    // Insert to temp_registrations table
    await db.query(
      'INSERT INTO temp_registrations (nama, email, password, nomor_hp, otp, expires_at, is_karyawan, nik_karyawan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [nama, email, hashedPassword, nomor_hp, otp, expiresAt, is_karyawan ? 1 : 0, is_karyawan ? nik_karyawan : null]
    );

    // Send OTP via email
    await sendOTPEmail(email, nama, otp);

    return res.status(200).json({
      success: true,
      otp_required: true,
      email: email,
      message: 'Kode OTP telah dikirimkan ke email Anda. Silakan verifikasi.'
    });
  } catch (error) {
    console.error('Register Step 1 Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat registrasi.'
    });
  }
};

// Verify Register OTP (Step 2: Save to users table)
const verifyRegisterOTP = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: 'Email dan kode OTP wajib diisi.'
    });
  }

  try {
    // Check if registration temp data exists and not expired
    const [temps] = await db.query(
      'SELECT * FROM temp_registrations WHERE email = ? AND otp = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, otp]
    );

    if (temps.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Kode OTP salah atau telah kedaluwarsa.'
      });
    }

    const temp = temps[0];

    // Double check email in users table
    const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      await db.query('DELETE FROM temp_registrations WHERE email = ?', [email]);
      return res.status(400).json({
        success: false,
        message: 'Email sudah terdaftar.'
      });
    }

    // Insert user into main users table
    await db.query(
      'INSERT INTO users (nama, email, password, nomor_hp, role, is_karyawan, nik_karyawan) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [temp.nama, temp.email, temp.password, temp.nomor_hp, 'customer', temp.is_karyawan, temp.nik_karyawan]
    );

    // Delete temp registration
    await db.query('DELETE FROM temp_registrations WHERE email = ?', [email]);

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil dan email terverifikasi. Silakan login.'
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memproses verifikasi OTP.'
    });
  }
};

// Resend Register OTP
const resendRegisterOTP = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email wajib diisi.'
    });
  }

  try {
    // Check if there is an existing temp registration
    const [temps] = await db.query('SELECT * FROM temp_registrations WHERE email = ?', [email]);
    if (temps.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data registrasi tidak ditemukan atau telah kedaluwarsa. Silakan lakukan registrasi ulang.'
      });
    }

    const temp = temps[0];

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Update OTP and expiration in database
    await db.query(
      'UPDATE temp_registrations SET otp = ?, expires_at = ? WHERE email = ?',
      [otp, expiresAt, email]
    );

    // Send new OTP via email
    await sendOTPEmail(email, temp.nama, otp);

    return res.json({
      success: true,
      message: 'Kode OTP baru berhasil dikirim ke email Anda.'
    });
  } catch (error) {
    console.error('Resend OTP Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat mengirim ulang OTP.'
    });
  }
};

// Login User (Admin & Customer) with Captcha Verification
const login = async (req, res) => {
  const { email, password, captcha_id, captcha_answer } = req.body;

  if (!email || !password || !captcha_id || !captcha_answer) {
    return res.status(400).json({
      success: false,
      message: 'Email, password, dan captcha wajib diisi.'
    });
  }

  try {
    // 1. Verify Captcha
    const [captchas] = await db.query(
      'SELECT * FROM captchas WHERE id = ? AND expires_at > NOW()',
      [captcha_id]
    );

    if (captchas.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Captcha telah kedaluwarsa atau tidak valid.'
      });
    }

    const captcha = captchas[0];

    // Delete captcha to prevent reuse/replay attacks
    await db.query('DELETE FROM captchas WHERE id = ?', [captcha_id]);

    if (captcha.answer.toLowerCase() !== captcha_answer.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Kode captcha salah.'
      });
    }

    // 2. Get user
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah.'
      });
    }

    const user = users[0];

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah.'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      message: 'Login berhasil.',
      token,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        nomor_hp: user.nomor_hp,
        role: user.role,
        is_karyawan: user.is_karyawan,
        nik_karyawan: user.nik_karyawan
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat login.'
    });
  }
};

// Get profile
const getProfile = async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, nama, email, nomor_hp, role, is_karyawan, nik_karyawan FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan.'
      });
    }

    return res.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat mengambil data profil.'
    });
  }
};

// Update profile
const updateProfile = async (req, res) => {
  const { nama, nomor_hp, password } = req.body;

  if (!nama || !nomor_hp) {
    return res.status(400).json({
      success: false,
      message: 'Nama dan nomor HP wajib diisi.'
    });
  }

  // Phone number validation (digits only)
  if (!/^\d+$/.test(nomor_hp)) {
    return res.status(400).json({
      success: false,
      message: 'Nomor HP hanya boleh berisi angka.'
    });
  }

  try {
    if (password && password.trim() !== '') {
      // Hash new password
      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      await db.query(
        'UPDATE users SET nama = ?, nomor_hp = ?, password = ? WHERE id = ?',
        [nama, nomor_hp, hashedPassword, req.user.id]
      );
    } else {
      await db.query(
        'UPDATE users SET nama = ?, nomor_hp = ? WHERE id = ?',
        [nama, nomor_hp, req.user.id]
      );
    }

    return res.json({
      success: true,
      message: 'Profil berhasil diperbarui.'
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memperbarui profil.'
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, nama, email, nomor_hp, role, is_karyawan, nik_karyawan, created_at FROM users ORDER BY created_at DESC'
    );
    return res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get All Users Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat mengambil data semua pengguna.'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  getAllUsers,
  getCaptcha,
  verifyRegisterOTP,
  resendRegisterOTP
};
