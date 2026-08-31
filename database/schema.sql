-- Users table to store credentials and roles
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role ENUM('admin', 'vendor', 'customer') NOT NULL,
  status ENUM('active', 'blocked') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Vendors table to store shop details and verification documentation
CREATE TABLE vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  shop_name VARCHAR(150) NOT NULL,
  verification_docs VARCHAR(255),
  shop_photo_url VARCHAR(255) DEFAULT NULL,
  cnic_photo_url VARCHAR(255) DEFAULT NULL,
  city VARCHAR(100) NOT NULL,
  address VARCHAR(255) NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  verification_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  security_deposit_status ENUM('unpaid', 'pending_verification', 'paid', 'rejected') DEFAULT 'unpaid',
  security_deposit_proof VARCHAR(255) DEFAULT NULL,
  security_deposit_amount DECIMAL(10,2) DEFAULT 500.00,
  cancellation_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Customers table to store profile info for buying clients
CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  city VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Brands table to store mobile device manufacturers
CREATE TABLE brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- Part Types table to store category names of mobile parts
CREATE TABLE part_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- Parts table to store inventory listings of vendor items
CREATE TABLE parts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  brand_id INT NOT NULL,
  part_type_id INT NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  condition_type ENUM('new', 'used') NOT NULL,
  stock_quantity INT DEFAULT 1,
  image_url VARCHAR(255),
  barcode_number VARCHAR(100),
  original_photo_url VARCHAR(255),
  barcode_photo_url VARCHAR(255),
  status ENUM('available', 'out_of_stock') DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE RESTRICT,
  FOREIGN KEY (part_type_id) REFERENCES part_types(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Requests table to map customer queries to specific parts and vendors
CREATE TABLE requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  vendor_id INT NOT NULL,
  part_id INT NOT NULL,
  sequence_number INT NOT NULL,
  is_locked BOOLEAN DEFAULT FALSE,
  status ENUM('requested', 'responded', 'available', 'not_available', 'cancelled') DEFAULT 'requested',
  delivery_type ENUM('shop_pickup', 'home_delivery') DEFAULT 'shop_pickup',
  delivery_address VARCHAR(255) DEFAULT NULL,
  delivery_city VARCHAR(100) DEFAULT NULL,
  delivery_phone VARCHAR(20) DEFAULT NULL,
  delivery_notes TEXT DEFAULT NULL,
  delivery_fee DECIMAL(10,2) DEFAULT 0.00,
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  verified_barcode VARCHAR(100) DEFAULT NULL,
  verified_at TIMESTAMP NULL DEFAULT NULL,
  cancellation_reason TEXT DEFAULT NULL,
  cancelled_by ENUM('customer', 'vendor', 'admin') DEFAULT NULL,
  cancelled_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
  FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Commissions table to track payments from completed transactions
CREATE TABLE commissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL UNIQUE,
  vendor_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_proof_url VARCHAR(255),
  status ENUM('pending', 'paid', 'rejected') DEFAULT 'pending',
  paid_at TIMESTAMP NULL DEFAULT NULL,
  verified_by INT NULL DEFAULT NULL,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE RESTRICT,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Chat Rooms table for customer-vendor messaging
CREATE TABLE chat_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  vendor_id INT NOT NULL,
  part_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Reviews table to store customer feedback on vendor service
CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  vendor_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE RESTRICT,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Reports table for logging user complaints and administrative review
CREATE TABLE reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reporter_user_id INT NOT NULL,
  reported_user_id INT NOT NULL,
  request_id INT NULL DEFAULT NULL,
  reason VARCHAR(150) NOT NULL,
  description TEXT,
  status ENUM('pending', 'resolved', 'dismissed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Notifications table to hold user-directed alert messages
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  type ENUM('request', 'commission', 'response', 'system') NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
