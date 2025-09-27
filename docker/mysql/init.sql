-- Initialize the database with proper settings
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS `projectplanning` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE `projectplanning`;

-- Grant all privileges to the project user
GRANT ALL PRIVILEGES ON `projectplanning`.* TO 'projectuser'@'%';
FLUSH PRIVILEGES;

-- Set timezone
SET time_zone = '-03:00';

-- Create a simple test table to verify connection
CREATE TABLE IF NOT EXISTS `connection_test` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `message` varchar(255) DEFAULT 'Database connection successful!',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert test data
INSERT INTO `connection_test` (`message`) VALUES ('MySQL container initialized successfully');

SET FOREIGN_KEY_CHECKS = 1;