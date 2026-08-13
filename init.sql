CREATE DATABASE IF NOT EXISTS `gor_booking`;
USE `gor_booking`;

-- Table Users
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nama` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `nomor_hp` VARCHAR(20) NOT NULL,
  `role` ENUM('admin', 'customer') DEFAULT 'customer',
  `is_karyawan` TINYINT(1) DEFAULT 0,
  `nik_karyawan` VARCHAR(50) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table Bookings
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` VARCHAR(50) PRIMARY KEY,
  `user_id` INT NOT NULL,
  `sport` VARCHAR(50) NOT NULL,
  `booking_date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `duration` INT NOT NULL,
  `total_price` DECIMAL(10,2) NOT NULL,
  `status` ENUM('pending', 'approved', 'cancelled', 'completed') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
