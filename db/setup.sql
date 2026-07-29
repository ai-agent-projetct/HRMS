-- LoomHR — one-time database & app-user setup. Run as MySQL root:
--   mysql -u root -p < db/setup.sql
-- Then:  npm run db:migrate  &&  npm run db:seed

CREATE DATABASE IF NOT EXISTS loomhr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- App user (matches .env.local). Change the password for production.
CREATE USER IF NOT EXISTS 'loomhr'@'localhost' IDENTIFIED BY 'LoomHr#2026';
CREATE USER IF NOT EXISTS 'loomhr'@'127.0.0.1' IDENTIFIED BY 'LoomHr#2026';
ALTER USER 'loomhr'@'localhost' IDENTIFIED BY 'LoomHr#2026';
ALTER USER 'loomhr'@'127.0.0.1' IDENTIFIED BY 'LoomHr#2026';

GRANT ALL PRIVILEGES ON loomhr.* TO 'loomhr'@'localhost';
GRANT ALL PRIVILEGES ON loomhr.* TO 'loomhr'@'127.0.0.1';
FLUSH PRIVILEGES;
