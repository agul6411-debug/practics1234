-- ============================================================================
-- Phone Part Finder — Complete XAMPP / phpMyAdmin / MySQL Database Export
-- Compatible with XAMPP MySQL / MariaDB (Import via phpMyAdmin or MySQL CLI)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `phonepartfinder` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `phonepartfinder`;

-- Disable Foreign Key Checks for clean table creation
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- Table structure for `users`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `role` ENUM('admin', 'vendor', 'customer') NOT NULL,
  `status` ENUM('active', 'blocked') DEFAULT 'active',
  `is_email_verified` TINYINT(1) DEFAULT 0,
  `email_otp` VARCHAR(10) DEFAULT NULL,
  `otp_expires_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table structure for `vendors`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `vendors`;
CREATE TABLE `vendors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `shop_name` VARCHAR(150) NOT NULL,
  `verification_docs` VARCHAR(255) DEFAULT NULL,
  `shop_photo_url` VARCHAR(255) DEFAULT NULL,
  `cnic_photo_url` VARCHAR(255) DEFAULT NULL,
  `city` VARCHAR(100) NOT NULL,
  `address` VARCHAR(255) NOT NULL,
  `latitude` DECIMAL(10,8) DEFAULT NULL,
  `longitude` DECIMAL(11,8) DEFAULT NULL,
  `verification_status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  `security_deposit_status` ENUM('unpaid', 'pending_verification', 'paid', 'rejected') DEFAULT 'unpaid',
  `security_deposit_proof` VARCHAR(255) DEFAULT NULL,
  `security_deposit_amount` DECIMAL(10,2) DEFAULT 500.00,
  `cancellation_count` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table structure for `customers`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table structure for `brands`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `brands`;
CREATE TABLE `brands` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table structure for `part_types`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `part_types`;
CREATE TABLE `part_types` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table structure for `parts`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `parts`;
CREATE TABLE `parts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `vendor_id` INT NOT NULL,
  `brand_id` INT NOT NULL,
  `part_type_id` INT NOT NULL,
  `model_name` VARCHAR(100) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `condition_type` ENUM('new', 'used') NOT NULL,
  `stock_quantity` INT DEFAULT 1,
  `image_url` VARCHAR(255) DEFAULT NULL,
  `barcode_number` VARCHAR(100) DEFAULT NULL,
  `original_photo_url` VARCHAR(255) DEFAULT NULL,
  `barcode_photo_url` VARCHAR(255) DEFAULT NULL,
  `status` ENUM('available', 'out_of_stock') DEFAULT 'available',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`part_type_id`) REFERENCES `part_types`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table structure for `requests`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `requests`;
CREATE TABLE `requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `vendor_id` INT NOT NULL,
  `part_id` INT NOT NULL,
  `sequence_number` INT NOT NULL,
  `is_locked` TINYINT(1) DEFAULT 0,
  `status` ENUM('requested', 'responded', 'available', 'not_available', 'cancelled') DEFAULT 'requested',
  `delivery_type` ENUM('shop_pickup', 'home_delivery') DEFAULT 'shop_pickup',
  `delivery_address` VARCHAR(255) DEFAULT NULL,
  `delivery_city` VARCHAR(100) DEFAULT NULL,
  `delivery_phone` VARCHAR(20) DEFAULT NULL,
  `delivery_notes` TEXT DEFAULT NULL,
  `delivery_fee` DECIMAL(10,2) DEFAULT 0.00,
  `total_amount` DECIMAL(10,2) DEFAULT 0.00,
  `verified_barcode` VARCHAR(100) DEFAULT NULL,
  `verified_at` TIMESTAMP NULL DEFAULT NULL,
  `cancellation_reason` TEXT DEFAULT NULL,
  `cancelled_by` ENUM('customer', 'vendor', 'admin') DEFAULT NULL,
  `cancelled_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table structure for `commissions`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `commissions`;
CREATE TABLE `commissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `request_id` INT NOT NULL UNIQUE,
  `vendor_id` INT NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `payment_proof_url` VARCHAR(255) DEFAULT NULL,
  `status` ENUM('pending', 'paid', 'rejected') DEFAULT 'pending',
  `paid_at` TIMESTAMP NULL DEFAULT NULL,
  `verified_by` INT DEFAULT NULL,
  FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table structure for `reviews`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `reviews`;
CREATE TABLE `reviews` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `request_id` INT NOT NULL UNIQUE,
  `customer_id` INT NOT NULL,
  `vendor_id` INT NOT NULL,
  `rating` INT NOT NULL CHECK (`rating` >= 1 AND `rating` <= 5),
  `comment` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table structure for `reports`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `reports`;
CREATE TABLE `reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `reporter_user_id` INT NOT NULL,
  `reported_user_id` INT NOT NULL,
  `request_id` INT DEFAULT NULL,
  `reason` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `status` ENUM('pending', 'resolved', 'dismissed') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`reporter_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`reported_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table structure for `notifications`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `message` TEXT NOT NULL,
  `type` ENUM('request', 'commission', 'response', 'system') NOT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table structure for `system_settings`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `setting_key` VARCHAR(50) PRIMARY KEY,
  `setting_value` VARCHAR(255) NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table structure for `chat_rooms`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `chat_rooms`;
CREATE TABLE `chat_rooms` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `vendor_id` INT NOT NULL,
  `part_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table structure for `chat_messages`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `chat_messages`;
CREATE TABLE `chat_messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `room_id` INT NOT NULL,
  `sender_id` INT NOT NULL,
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Re-enable Foreign Key Checks
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- Seed Data: System Settings
-- ----------------------------------------------------------------------------
INSERT INTO `system_settings` (`setting_key`, `setting_value`) VALUES
('security_deposit_amount', '500'),
('security_deposit_phone', '03080780593'),
('commission_rate_percent', '10'),
('max_vendor_cancellations', '3')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

-- ----------------------------------------------------------------------------
-- Seed Data: Brands
-- ----------------------------------------------------------------------------
INSERT INTO `brands` (`name`) VALUES
('Apple'),
('Samsung'),
('Xiaomi'),
('Vivo'),
('Oppo'),
('Realme'),
('Infinix'),
('Tecno'),
('OnePlus'),
('Huawei')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ----------------------------------------------------------------------------
-- Seed Data: Part Types
-- ----------------------------------------------------------------------------
INSERT INTO `part_types` (`name`) VALUES
('LCD Display Screen'),
('Battery'),
('Charging Port Board'),
('Camera Lens / Module'),
('Back Glass Cover'),
('Loud Speaker'),
('Motherboard / Logic Board')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ----------------------------------------------------------------------------
-- Seed Data: Default Admin User (Email: finderteamphone@gmail.com, Password: admin1234)
-- ----------------------------------------------------------------------------
INSERT INTO `users` (`name`, `email`, `password`, `phone`, `role`, `status`, `is_email_verified`) VALUES
('System Admin', 'finderteamphone@gmail.com', '$2b$10$IlsE4yCKZzNe.er6p28Jv.goGLtCeneHgWtpQFdYkUyFjhFPFga32', '+923000000000', 'admin', 'active', 1)
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`), `password` = VALUES(`password`), `status` = 'active';

-- End of SQL Export Dump
