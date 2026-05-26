import express from 'express';
import { query, transaction } from './db.js';
import { asyncHandler, HttpError } from './errors.js';
import { createEntryCode } from './utils/codes.js';
import {
  isBeforeReservationStart,
  isValidDate,
  isValidTimeRange,
  isWithinOperatingHours,
  isWithinReservationWindow,
  normalizeTime
} from './utils/time.js';

export const apiRouter = express.Router();

apiRouter.get('/health', (req, res) => {
  res.json({ ok: true });
});

apiRouter.get('/users', asyncHandler(async (req, res) => {
  const role = req.query.role;
  const rows = await query(
    role ? 'SELECT id, name, role, contact FROM users WHERE role = :role ORDER BY id' : 'SELECT id, name, role, contact FROM users ORDER BY id',
    role ? { role } : {}
  );
  res.json(rows);
}));

apiRouter.get('/rooms/available', asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT id, name, location, capacity,
           TIME_FORMAT(available_start_time, '%H:%i') AS availableStartTime,
           TIME_FORMAT(available_end_time, '%H:%i') AS availableEndTime,
           status
    FROM study_rooms
    WHERE status = 'AVAILABLE'
    ORDER BY name
  `);
  res.json(rows);
}));

apiRouter.get('/admin/rooms', asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT id, name, location, capacity,
           TIME_FORMAT(available_start_time, '%H:%i') AS availableStartTime,
           TIME_FORMAT(available_end_time, '%H:%i') AS availableEndTime,
           status
    FROM study_rooms
    ORDER BY name
  `);
  res.json(rows);
}));

apiRouter.get('/rooms/search', asyncHandler(async (req, res) => {
  const { date, startTime, endTime } = req.query;
  const people = Number(req.query.people || 1);
  ensureSearchInput(date, startTime, endTime, people);

  const rows = await query(`
    SELECT r.id, r.name, r.location, r.capacity,
           TIME_FORMAT(r.available_start_time, '%H:%i') AS availableStartTime,
           TIME_FORMAT(r.available_end_time, '%H:%i') AS availableEndTime,
           r.status
    FROM study_rooms r
    WHERE r.status = 'AVAILABLE'
      AND r.capacity >= :people
      AND r.available_start_time <= :startTime
      AND r.available_end_time >= :endTime
      AND NOT EXISTS (
        SELECT 1
        FROM reservations rv
        WHERE rv.room_id = r.id
          AND rv.reservation_date = :date
          AND rv.status = 'CONFIRMED'
          AND rv.start_time < :endTime
          AND rv.end_time > :startTime
      )
    ORDER BY r.name
  `, { date, startTime, endTime, people });

  res.json(rows);
}));

apiRouter.post('/reservations', asyncHandler(async (req, res) => {
  const { roomId, studentId, date, startTime, endTime, peopleCount, purpose, contact } = req.body;
  const people = Number(peopleCount);
  ensureReservationInput({ roomId, studentId, date, startTime, endTime, people, purpose, contact });

  const reservation = await transaction(async (connection) => {
    const [[room]] = await connection.execute('SELECT * FROM study_rooms WHERE id = :roomId FOR UPDATE', { roomId });
    if (!room) throw new HttpError(404, '스터디룸을 찾을 수 없습니다.');
    if (room.status !== 'AVAILABLE') throw new HttpError(409, '사용중지 상태의 스터디룸은 예약할 수 없습니다.');
    if (people > room.capacity) throw new HttpError(400, '이용 인원이 수용 인원을 초과했습니다.');
    if (!isWithinOperatingHours(startTime, endTime, normalizeTime(room.available_start_time), normalizeTime(room.available_end_time))) {
      throw new HttpError(400, '스터디룸 사용 가능 시간 밖의 예약입니다.');
    }

    const [[student]] = await connection.execute('SELECT id FROM users WHERE id = :studentId AND role = "STUDENT"', { studentId });
    if (!student) throw new HttpError(404, '학생 사용자를 찾을 수 없습니다.');

    const [conflicts] = await connection.execute(`
      SELECT id
      FROM reservations
      WHERE room_id = :roomId
        AND reservation_date = :date
        AND status = 'CONFIRMED'
        AND start_time < :endTime
        AND end_time > :startTime
      FOR UPDATE
    `, { roomId, date, startTime, endTime });
    if (conflicts.length > 0) throw new HttpError(409, '이미 예약된 시간대입니다.');

    const entryCode = createEntryCode();
    const [result] = await connection.execute(`
      INSERT INTO reservations
        (room_id, student_id, reservation_date, start_time, end_time, people_count, purpose, contact, status, entry_code)
      VALUES
        (:roomId, :studentId, :date, :startTime, :endTime, :people, :purpose, :contact, 'CONFIRMED', :entryCode)
    `, { roomId, studentId, date, startTime, endTime, people, purpose, contact, entryCode });

    const [[created]] = await connection.execute(reservationSelectSql('WHERE rv.id = :id'), { id: result.insertId });
    return created;
  });

  res.status(201).json(reservation);
}));

apiRouter.get('/students/:studentId/reservations', asyncHandler(async (req, res) => {
  const rows = await query(`${reservationSelectSql('WHERE rv.student_id = :studentId')} ORDER BY rv.reservation_date DESC, rv.start_time DESC`, {
    studentId: req.params.studentId
  });
  res.json(rows);
}));

apiRouter.patch('/reservations/:id/cancel', asyncHandler(async (req, res) => {
  const { studentId } = req.body;
  const updated = await transaction(async (connection) => {
    const [[reservation]] = await connection.execute('SELECT * FROM reservations WHERE id = :id FOR UPDATE', { id: req.params.id });
    if (!reservation) throw new HttpError(404, '예약을 찾을 수 없습니다.');
    if (Number(reservation.student_id) !== Number(studentId)) throw new HttpError(403, '자신의 예약만 취소할 수 있습니다.');
    if (reservation.status !== 'CONFIRMED') throw new HttpError(409, '예약확정 상태만 학생 취소가 가능합니다.');
    if (!isBeforeReservationStart(formatDate(reservation.reservation_date), normalizeTime(reservation.start_time))) {
      throw new HttpError(409, '예약 시작 후에는 취소할 수 없습니다.');
    }
    await connection.execute('UPDATE reservations SET status = "STUDENT_CANCELLED" WHERE id = :id', { id: req.params.id });
    const [[row]] = await connection.execute(reservationSelectSql('WHERE rv.id = :id'), { id: req.params.id });
    return row;
  });
  res.json(updated);
}));

apiRouter.post('/admin/rooms', asyncHandler(async (req, res) => {
  const { name, location, capacity, availableStartTime, availableEndTime } = req.body;
  if (!name || !location || !Number(capacity) || !isValidTimeRange(availableStartTime, availableEndTime)) {
    throw new HttpError(400, '스터디룸 이름, 위치, 수용 인원, 사용 가능 시간을 확인해주세요.');
  }
  const result = await query(`
    INSERT INTO study_rooms (name, location, capacity, available_start_time, available_end_time, status)
    VALUES (:name, :location, :capacity, :availableStartTime, :availableEndTime, 'AVAILABLE')
  `, { name, location, capacity: Number(capacity), availableStartTime, availableEndTime });
  const rows = await query(`
    SELECT id, name, location, capacity,
           TIME_FORMAT(available_start_time, '%H:%i') AS availableStartTime,
           TIME_FORMAT(available_end_time, '%H:%i') AS availableEndTime,
           status
    FROM study_rooms WHERE id = :id
  `, { id: result.insertId });
  res.status(201).json(rows[0]);
}));

apiRouter.patch('/admin/rooms/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['AVAILABLE', 'DISABLED'].includes(status)) throw new HttpError(400, '올바른 스터디룸 상태가 아닙니다.');
  await query('UPDATE study_rooms SET status = :status WHERE id = :id', { status, id: req.params.id });
  const rows = await query(`
    SELECT id, name, location, capacity,
           TIME_FORMAT(available_start_time, '%H:%i') AS availableStartTime,
           TIME_FORMAT(available_end_time, '%H:%i') AS availableEndTime,
           status
    FROM study_rooms WHERE id = :id
  `, { id: req.params.id });
  if (!rows[0]) throw new HttpError(404, '스터디룸을 찾을 수 없습니다.');
  res.json(rows[0]);
}));

apiRouter.get('/admin/reservations', asyncHandler(async (req, res) => {
  const filters = [];
  const params = {};
  if (req.query.date) {
    filters.push('rv.reservation_date = :date');
    params.date = req.query.date;
  }
  if (req.query.roomId) {
    filters.push('rv.room_id = :roomId');
    params.roomId = req.query.roomId;
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = await query(`${reservationSelectSql(where)} ORDER BY rv.reservation_date DESC, rv.start_time`, params);
  res.json(rows);
}));

apiRouter.patch('/admin/reservations/:id/cancel', updateReservationStatus('ADMIN_CANCELLED'));
apiRouter.patch('/admin/reservations/:id/no-show', updateReservationStatus('NO_SHOW'));

apiRouter.get('/admin/students/:studentId/history', asyncHandler(async (req, res) => {
  const rows = await query(`${reservationSelectSql('WHERE rv.student_id = :studentId')} ORDER BY rv.reservation_date DESC, rv.start_time DESC`, {
    studentId: req.params.studentId
  });
  res.json(rows);
}));

apiRouter.get('/access/:code', asyncHandler(async (req, res) => {
  const rows = await query(reservationSelectSql('WHERE rv.entry_code = :code'), { code: req.params.code.toUpperCase() });
  if (!rows[0]) throw new HttpError(404, '입실 코드에 해당하는 예약을 찾을 수 없습니다.');
  res.json({ ...rows[0], canEnterNow: canEnter(rows[0]) });
}));

apiRouter.post('/access/:code/confirm', asyncHandler(async (req, res) => {
  const updated = await transaction(async (connection) => {
    const [[reservation]] = await connection.execute('SELECT * FROM reservations WHERE entry_code = :code FOR UPDATE', {
      code: req.params.code.toUpperCase()
    });
    if (!reservation) throw new HttpError(404, '입실 코드에 해당하는 예약을 찾을 수 없습니다.');
    if (reservation.status !== 'CONFIRMED') throw new HttpError(409, '예약확정 상태의 입실 코드만 사용할 수 있습니다.');
    if (!isWithinReservationWindow(formatDate(reservation.reservation_date), normalizeTime(reservation.start_time), normalizeTime(reservation.end_time))) {
      throw new HttpError(409, '입실 코드는 예약된 시간대에만 유효합니다.');
    }
    if (!reservation.entry_confirmed_at) {
      await connection.execute('UPDATE reservations SET entry_confirmed_at = NOW() WHERE id = :id', { id: reservation.id });
    }
    const [[row]] = await connection.execute(reservationSelectSql('WHERE rv.id = :id'), { id: reservation.id });
    return row;
  });
  res.json(updated);
}));

function updateReservationStatus(status) {
  return asyncHandler(async (req, res) => {
    const updated = await transaction(async (connection) => {
      const [[reservation]] = await connection.execute('SELECT id, status FROM reservations WHERE id = :id FOR UPDATE', { id: req.params.id });
      if (!reservation) throw new HttpError(404, '예약을 찾을 수 없습니다.');
      if (reservation.status !== 'CONFIRMED') throw new HttpError(409, '예약확정 상태만 변경할 수 있습니다.');
      await connection.execute('UPDATE reservations SET status = :status WHERE id = :id', { status, id: req.params.id });
      const [[row]] = await connection.execute(reservationSelectSql('WHERE rv.id = :id'), { id: req.params.id });
      return row;
    });
    res.json(updated);
  });
}

function ensureSearchInput(date, startTime, endTime, people) {
  if (!isValidDate(date) || !isValidTimeRange(startTime, endTime) || !Number.isInteger(people) || people < 1) {
    throw new HttpError(400, '날짜, 시간대, 이용 인원을 확인해주세요.');
  }
}

function ensureReservationInput({ roomId, studentId, date, startTime, endTime, people, purpose, contact }) {
  ensureSearchInput(date, startTime, endTime, people);
  if (!Number(roomId) || !Number(studentId) || !purpose || !contact) {
    throw new HttpError(400, '스터디룸, 학생, 이용 목적, 연락처를 확인해주세요.');
  }
}

function reservationSelectSql(where) {
  return `
    SELECT rv.id,
           rv.room_id AS roomId,
           room.name AS roomName,
           room.location AS roomLocation,
           rv.student_id AS studentId,
           student.name AS studentName,
           DATE_FORMAT(rv.reservation_date, '%Y-%m-%d') AS reservationDate,
           TIME_FORMAT(rv.start_time, '%H:%i') AS startTime,
           TIME_FORMAT(rv.end_time, '%H:%i') AS endTime,
           rv.people_count AS peopleCount,
           rv.purpose,
           rv.contact,
           rv.status,
           rv.entry_code AS entryCode,
           rv.entry_confirmed_at AS entryConfirmedAt,
           rv.created_at AS createdAt
    FROM reservations rv
    JOIN study_rooms room ON room.id = rv.room_id
    JOIN users student ON student.id = rv.student_id
    ${where}
  `;
}

function canEnter(reservation) {
  return reservation.status === 'CONFIRMED'
    && isWithinReservationWindow(reservation.reservationDate, reservation.startTime, reservation.endTime);
}

function formatDate(value) {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}
