const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey12345';
const BCRYPT_SALT_ROUNDS = 10;

// Register Customer
const register = async (req, res) => {
  const { nama, email, nomor_hp, password } = req.body;

  // Input validation
  if (!nama || !email || !nomor_hp || !password) {
    return res.status(400).json({
      success: false,
      message: 'Semua field wajib diisi.'
    });
  }

  try {
    // Check if email already exists
    const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah terdaftar.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Insert user
    await db.query(
      'INSERT INTO users (nama, email, password, nomor_hp, role) VALUES (?, ?, ?, ?, ?)',
      [nama, email, hashedPassword, nomor_hp, 'customer']
    );

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil. Silakan login.'
    });
  } catch (error) {
    console.error('Register Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat registrasi.'
    });
  }
};

// Login User (Admin & Customer)
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email dan password wajib diisi.'
    });
  }

  try {
    // Get user
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
        role: user.role
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
    const [users] = await db.query('SELECT id, nama, email, nomor_hp, role FROM users WHERE id = ?', [req.user.id]);
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
      'SELECT id, nama, email, nomor_hp, role, created_at FROM users ORDER BY created_at DESC'
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
  getAllUsers
};
