import { getPool } from './db.js';

export async function initializeDatabase() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      role ENUM('STUDENT', 'MANAGER', 'ACCESS_CHECKER') NOT NULL,
      contact VARCHAR(80),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS study_rooms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      location VARCHAR(160) NOT NULL,
      capacity INT NOT NULL,
      available_start_time TIME NOT NULL,
      available_end_time TIME NOT NULL,
      status ENUM('AVAILABLE', 'DISABLED') NOT NULL DEFAULT 'AVAILABLE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      room_id INT NOT NULL,
      student_id INT NOT NULL,
      reservation_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      people_count INT NOT NULL,
      purpose VARCHAR(255) NOT NULL,
      contact VARCHAR(80) NOT NULL,
      status ENUM('CONFIRMED', 'COMPLETED', 'STUDENT_CANCELLED', 'ADMIN_CANCELLED', 'NO_SHOW') NOT NULL DEFAULT 'CONFIRMED',
      entry_code VARCHAR(16) NOT NULL UNIQUE,
      entry_confirmed_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_reservation_lookup (room_id, reservation_date, start_time, end_time, status),
      INDEX idx_student_history (student_id, reservation_date),
      CONSTRAINT fk_reservations_room FOREIGN KEY (room_id) REFERENCES study_rooms(id),
      CONSTRAINT fk_reservations_student FOREIGN KEY (student_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await seedDemoData(pool);
}

async function seedDemoData(pool) {
  const [[userCount]] = await pool.query('SELECT COUNT(*) AS count FROM users');
  if (userCount.count === 0) {
    await pool.query(`
      INSERT INTO users (name, role, contact) VALUES
      ('김민준', 'STUDENT', '010-1000-1000'),
      ('이지은', 'STUDENT', '010-2000-2000'),
      ('공간관리자', 'MANAGER', 'manager@example.com'),
      ('출입담당자', 'ACCESS_CHECKER', 'access@example.com')
    `);
  }

  const [[roomCount]] = await pool.query('SELECT COUNT(*) AS count FROM study_rooms');
  if (roomCount.count === 0) {
    await pool.query(`
      INSERT INTO study_rooms (name, location, capacity, available_start_time, available_end_time, status) VALUES
      ('스터디룸 A', '도서관 2층', 4, '09:00:00', '22:00:00', 'AVAILABLE'),
      ('스터디룸 B', '학생회관 1층', 6, '10:00:00', '21:00:00', 'AVAILABLE'),
      ('프로젝트룸 C', '공학관 3층', 8, '09:00:00', '20:00:00', 'DISABLED')
    `);
  }
}
