const mysql = require('mysql2/promise');
require('dotenv').config();

const runMigration = async () => {
  console.log('Starting migration to database version 1.1...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gor_booking',
    port: parseInt(process.env.DB_PORT || '3306', 10)
  });

  try {
    // 1. Temporarily expand ENUM to allow old values plus new unique values
    console.log('Expanding bookings status ENUM to allow migration...');
    await connection.query(`
      ALTER TABLE bookings 
      MODIFY COLUMN status ENUM('pending', 'approved', 'cancelled', 'completed', 'WAITING_PAYMENT', 'WAITING_VERIFICATION', 'CONFIRMED', 'EXPIRED') 
      DEFAULT 'pending'
    `);

    // 2. Update existing statuses to new values
    console.log('Migrating existing booking statuses...');
    await connection.query("UPDATE bookings SET status = 'CONFIRMED' WHERE status = 'approved'");
    await connection.query("UPDATE bookings SET status = 'WAITING_PAYMENT' WHERE status = 'pending'");

    // 3. Shrink ENUM to only allow new values in uppercase and set default
    console.log('Restricting bookings status ENUM to version 1.1 definitions...');
    await connection.query(`
      ALTER TABLE bookings 
      MODIFY COLUMN status ENUM('WAITING_PAYMENT', 'WAITING_VERIFICATION', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED') 
      DEFAULT 'WAITING_PAYMENT'
    `);

    // 4. Create settings table
    console.log('Creating settings table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        \`key\` VARCHAR(50) NOT NULL UNIQUE,
        value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Seed settings table
    console.log('Seeding settings data...');
    const settings = {
      price_per_hour: '100000',
      operational_hours_start: '08:00',
      operational_hours_end: '22:00',
      bank_name: 'Bank BCA',
      bank_account: '1234567890',
      bank_recipient: 'GOR PJT II',
      gor_name: 'GOR Perum Jasa Tirta II',
      whatsapp_number: '08123456789'
    };

    for (const [key, value] of Object.entries(settings)) {
      await connection.query(
        'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        [key, value]
      );
    }

    // 5. Create payments table
    console.log('Creating payments table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        proof_image VARCHAR(255) NULL,
        status ENUM('PENDING', 'WAITING_VERIFICATION', 'PAID', 'REJECTED', 'EXPIRED') DEFAULT 'PENDING',
        countdown_end TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 6. Create notifications table
    console.log('Creating notifications table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        booking_id VARCHAR(50) NULL,
        message TEXT NOT NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('Migration successfully completed!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

runMigration();
