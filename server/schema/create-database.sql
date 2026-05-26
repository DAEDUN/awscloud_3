CREATE DATABASE IF NOT EXISTS studyroom_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'studyroom'@'%' IDENTIFIED BY 'studyroom_password';
CREATE USER IF NOT EXISTS 'studyroom'@'localhost' IDENTIFIED BY 'studyroom_password';
GRANT ALL PRIVILEGES ON studyroom_db.* TO 'studyroom'@'%';
GRANT ALL PRIVILEGES ON studyroom_db.* TO 'studyroom'@'localhost';
FLUSH PRIVILEGES;
