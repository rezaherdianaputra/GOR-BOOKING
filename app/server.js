const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('./config/db');
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

// Start Server after a short delay to allow db connectivity checks
const startServer = async () => {
  try {
    // Attempt database query to ensure MySQL is ready
    await db.query('SELECT 1');
    console.log('Database verified active.');
    
    // Seed Admin account
    await seedAdmin();
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Error starting server: Database connection not ready. Retrying in 3 seconds...');
    setTimeout(startServer, 3000);
  }
};

startServer();
