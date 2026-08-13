const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./config/db');
const { checkExpiredBookings } = require('./utils/expiryChecker');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// For all other routes, serve index.html (SPA fallback, although we are using multiple files, this is good to have)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Database Initialization and Admin Seeding
const seedAdmin = async () => {
  try {
    // Check if table users exists (could be created dynamically or via init.sql)
    const [tables] = await db.query("SHOW TABLES LIKE 'users'");
    if (tables.length === 0) {
      console.log('Tables do not exist yet. Waiting for Docker MySQL initial scripts to finish...');
      return;
    }

    // Check if admin already exists
    const [admins] = await db.query("SELECT id FROM users WHERE role = 'admin'");
    if (admins.length === 0) {
      console.log('Seeding default administrator...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.query(
        `INSERT INTO users (nama, email, password, nomor_hp, role)
         VALUES (?, ?, ?, ?, ?)`,
        ['Administrator', 'admin@gor.com', hashedPassword, '08123456789', 'admin']
      );
      console.log('Administrator seeded successfully! Email: admin@gor.com, Password: admin123');
    } else {
      console.log('Administrator account already exists. Skipping seed.');
    }
  } catch (error) {
    console.error('Error seeding administrator:', error.message);
  }
};

const initializeTables = async () => {
  try {
    console.log('Verifying table structure for OTP & Captcha...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS captchas (
        id VARCHAR(100) PRIMARY KEY,
        answer VARCHAR(50) NOT NULL,
        expires_at TIMESTAMP NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS temp_registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        nomor_hp VARCHAR(20) NOT NULL,
        otp VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_karyawan TINYINT(1) DEFAULT 0,
        nik_karyawan VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('OTP & Captcha tables verified/created successfully.');

    // Dynamic schema migrations for existing databases
    // 1. Add is_karyawan & nik_karyawan to users if not present
    const [userColumns] = await db.query("SHOW COLUMNS FROM users LIKE 'is_karyawan'");
    if (userColumns.length === 0) {
      console.log('Adding is_karyawan and nik_karyawan columns to users table...');
      await db.query("ALTER TABLE users ADD COLUMN is_karyawan TINYINT(1) DEFAULT 0");
      await db.query("ALTER TABLE users ADD COLUMN nik_karyawan VARCHAR(50) DEFAULT NULL");
    }

    // 2. Add is_karyawan & nik_karyawan to temp_registrations if not present
    const [tempColumns] = await db.query("SHOW COLUMNS FROM temp_registrations LIKE 'is_karyawan'");
    if (tempColumns.length === 0) {
      console.log('Adding is_karyawan and nik_karyawan columns to temp_registrations table...');
      await db.query("ALTER TABLE temp_registrations ADD COLUMN is_karyawan TINYINT(1) DEFAULT 0");
      await db.query("ALTER TABLE temp_registrations ADD COLUMN nik_karyawan VARCHAR(50) DEFAULT NULL");
    }

    // Migration logic for bookings.id from INT to VARCHAR(50)
    const [bookingsColumns] = await db.query("SHOW COLUMNS FROM bookings LIKE 'id'");
    if (bookingsColumns.length > 0 && bookingsColumns[0].Type.toLowerCase().startsWith('int')) {
      console.log('Migrating bookings.id and references from INT to VARCHAR(50)...');
      
      // Drop foreign keys
      try {
        await db.query("ALTER TABLE payments DROP FOREIGN KEY payments_ibfk_1");
      } catch (err) {
        console.log('payments_ibfk_1 foreign key not found or already dropped.');
      }
      try {
        await db.query("ALTER TABLE notifications DROP FOREIGN KEY notifications_ibfk_2");
      } catch (err) {
        console.log('notifications_ibfk_2 foreign key not found or already dropped.');
      }
      
      // Modify columns
      await db.query("ALTER TABLE bookings MODIFY COLUMN id VARCHAR(50) NOT NULL");
      await db.query("ALTER TABLE payments MODIFY COLUMN booking_id VARCHAR(50) NOT NULL");
      await db.query("ALTER TABLE notifications MODIFY COLUMN booking_id VARCHAR(50) NULL");
      
      // Re-add foreign keys
      await db.query("ALTER TABLE payments ADD CONSTRAINT payments_ibfk_1 FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE");
      await db.query("ALTER TABLE notifications ADD CONSTRAINT notifications_ibfk_2 FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL");
      
      console.log('bookings.id migration completed successfully.');
    }
  } catch (error) {
    console.error('Error during database initialization/migration:', error.message);
  }
};

// Start Server after a short delay to allow db connectivity checks
const startServer = async () => {
  try {
    // Attempt database query to ensure MySQL is ready
    await db.query('SELECT 1');
    console.log('Database verified active.');
    
    // Initialize OTP and Captcha tables
    await initializeTables();
    
    // Seed Admin account
    await seedAdmin();
    
    // Start periodic check for expired payments (every 30 seconds)
    setInterval(checkExpiredBookings, 30000);
    checkExpiredBookings(); // initial check
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Error starting server: Database connection not ready. Retrying in 3 seconds...');
    setTimeout(startServer, 3000);
  }
};

startServer();
