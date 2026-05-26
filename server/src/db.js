import fs from 'node:fs';
import mysql from 'mysql2/promise';

let pool;

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function createSslOptions() {
  if (!parseBoolean(process.env.DB_SSL)) {
    return undefined;
  }

  const ssl = {
    rejectUnauthorized: !parseBoolean(process.env.DB_SSL_ALLOW_UNAUTHORIZED)
  };

  if (process.env.DB_SSL_CA_PATH) {
    ssl.ca = fs.readFileSync(process.env.DB_SSL_CA_PATH, 'utf8');
  }

  return ssl;
}

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'studyroom_db',
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
      dateStrings: true,
      ssl: createSslOptions()
    });
  }
  return pool;
}

export async function query(sql, params = {}) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

export async function transaction(work) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
