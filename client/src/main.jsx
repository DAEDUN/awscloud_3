import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BadgeCheck,
  Building2,
  CalendarCheck,
  DoorOpen,
  History,
  Plus,
  RefreshCw,
  Search,
  UserRound
} from 'lucide-react';
import './styles.css';

const today = new Date().toISOString().slice(0, 10);

const statusLabels = {
  CONFIRMED: '예약확정',
  COMPLETED: '사용완료',
  STUDENT_CANCELLED: '학생취소',
  ADMIN_CANCELLED: '관리자취소',
  NO_SHOW: '노쇼',
  AVAILABLE: '사용가능',
  DISABLED: '사용중지'
};

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    throw new Error(data?.message || '요청을 처리하지 못했습니다.');
  }
  if (!contentType.includes('application/json')) {
    throw new Error('API 서버가 연결되지 않았습니다. MySQL 설정 후 npm start로 실행하거나, 백엔드 서버를 함께 실행해주세요.');
  }
  return data;
}

function App() {
  const [role, setRole] = useState('STUDENT');

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Study Room Access</p>
          <h1>스터디룸 예약 및 출입 확인</h1>
        </div>
        <div className="role-tabs" aria-label="역할 선택">
          <button className={role === 'STUDENT' ? 'active' : ''} onClick={() => setRole('STUDENT')}><UserRound size={18} /> 학생</button>
          <button className={role === 'MANAGER' ? 'active' : ''} onClick={() => setRole('MANAGER')}><Building2 size={18} /> 관리자</button>
          <button className={role === 'ACCESS' ? 'active' : ''} onClick={() => setRole('ACCESS')}><DoorOpen size={18} /> 출입 확인</button>
        </div>
      </section>

      {role === 'STUDENT' && <StudentView />}
      {role === 'MANAGER' && <ManagerView />}
      {role === 'ACCESS' && <AccessView />}
    </main>
  );
}

function StudentView() {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [availableRooms, setAvailableRooms] = useState([]);
  const [searchForm, setSearchForm] = useState({ date: today, startTime: '10:00', endTime: '12:00', people: 2 });
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [reservationForm, setReservationForm] = useState({ purpose: '팀 프로젝트 회의', contact: '010-0000-0000' });
  const [reservations, setReservations] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadStudents().catch((error) => setMessage(error.message));
    loadAvailableRooms().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (studentId) loadReservations(studentId).catch((error) => setMessage(error.message));
  }, [studentId]);

  async function loadStudents() {
    const rows = await api('/users?role=STUDENT');
    setStudents(rows);
    setStudentId(String(rows[0]?.id || ''));
  }

  async function loadAvailableRooms() {
    setAvailableRooms(await api('/rooms/available'));
  }

  async function loadReservations(id = studentId) {
    if (!id) return;
    setReservations(await api(`/students/${id}/reservations`));
  }

  async function searchRooms(event) {
    event.preventDefault();
    setMessage('');
    try {
      const params = new URLSearchParams(searchForm);
      const rows = await api(`/rooms/search?${params.toString()}`);
      setRooms(rows);
      setSelectedRoom(rows[0] || null);
      if (rows.length === 0) setMessage('예약 가능한 스터디룸이 없습니다.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createReservation(event) {
    event.preventDefault();
    if (!selectedRoom) return;
    setMessage('');
    try {
      const created = await api('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          roomId: selectedRoom.id,
          studentId,
          date: searchForm.date,
          startTime: searchForm.startTime,
          endTime: searchForm.endTime,
          peopleCount: Number(searchForm.people),
          purpose: reservationForm.purpose,
          contact: reservationForm.contact
        })
      });
      const params = new URLSearchParams(searchForm);
      const nextRooms = await api(`/rooms/search?${params.toString()}`);
      setRooms(nextRooms);
      setSelectedRoom(nextRooms[0] || null);
      await loadReservations();
      setMessage(`예약 완료: 입실 코드 ${created.entryCode}`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function cancelReservation(id) {
    setMessage('');
    try {
      await api(`/reservations/${id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ studentId })
      });
      setMessage('예약이 취소되었습니다.');
      await loadReservations();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="workspace">
      <section className="panel">
        <PanelTitle icon={<Search />} title="예약 가능한 스터디룸 검색" />
        <label>학생</label>
        <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
          {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
        </select>

        <form className="grid-form" onSubmit={searchRooms}>
          <Field label="날짜" type="date" value={searchForm.date} onChange={(value) => setSearchForm({ ...searchForm, date: value })} />
          <Field label="시작" type="time" value={searchForm.startTime} onChange={(value) => setSearchForm({ ...searchForm, startTime: value })} />
          <Field label="종료" type="time" value={searchForm.endTime} onChange={(value) => setSearchForm({ ...searchForm, endTime: value })} />
          <Field label="인원" type="number" min="1" value={searchForm.people} onChange={(value) => setSearchForm({ ...searchForm, people: value })} />
          <button className="primary" type="submit"><Search size={17} /> 조회</button>
        </form>

        <div className="room-list">
          {rooms.map((room) => (
            <button key={room.id} className={`room-row ${selectedRoom?.id === room.id ? 'selected' : ''}`} onClick={() => setSelectedRoom(room)}>
              <strong>{room.name}</strong>
              <span>{room.location} · {room.capacity}명 · {room.availableStartTime}-{room.availableEndTime}</span>
            </button>
          ))}
        </div>

        <form className="stack" onSubmit={createReservation}>
          <Field label="이용 목적" value={reservationForm.purpose} onChange={(value) => setReservationForm({ ...reservationForm, purpose: value })} />
          <Field label="연락처" value={reservationForm.contact} onChange={(value) => setReservationForm({ ...reservationForm, contact: value })} />
          <button className="primary" disabled={!selectedRoom} type="submit"><CalendarCheck size={17} /> 예약 신청</button>
        </form>
        <Notice text={message} />
      </section>

      <section className="panel">
        <PanelTitle icon={<Building2 />} title="사용가능 스터디룸" action={<IconButton onClick={loadAvailableRooms} label="새로고침" icon={<RefreshCw />} />} />
        <DataList rows={availableRooms.map((room) => ({
          title: room.name,
          meta: `${room.location} · ${room.capacity}명 · ${room.availableStartTime}-${room.availableEndTime}`,
          badge: statusLabels[room.status]
        }))} />
      </section>

      <section className="panel wide">
        <PanelTitle icon={<History />} title="내 예약 목록" action={<IconButton onClick={() => loadReservations()} label="새로고침" icon={<RefreshCw />} />} />
        <ReservationTable reservations={reservations} onCancel={cancelReservation} studentMode />
      </section>
    </div>
  );
}

function ManagerView() {
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [students, setStudents] = useState([]);
  const [history, setHistory] = useState([]);
  const [roomForm, setRoomForm] = useState({ name: '', location: '', capacity: 4, availableStartTime: '09:00', availableEndTime: '22:00' });
  const [filter, setFilter] = useState({ date: today, roomId: '' });
  const [historyStudentId, setHistoryStudentId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadRooms().catch((error) => setMessage(error.message));
    loadReservations().catch((error) => setMessage(error.message));
    loadStudents().catch((error) => setMessage(error.message));
  }, []);

  async function loadRooms() {
    setRooms(await api('/admin/rooms'));
  }

  async function loadStudents() {
    const rows = await api('/users?role=STUDENT');
    setStudents(rows);
    setHistoryStudentId(String(rows[0]?.id || ''));
  }

  async function loadReservations(event) {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (filter.date) params.set('date', filter.date);
    if (filter.roomId) params.set('roomId', filter.roomId);
    setReservations(await api(`/admin/reservations?${params.toString()}`));
  }

  async function createRoom(event) {
    event.preventDefault();
    setMessage('');
    try {
      await api('/admin/rooms', { method: 'POST', body: JSON.stringify(roomForm) });
      setRoomForm({ name: '', location: '', capacity: 4, availableStartTime: '09:00', availableEndTime: '22:00' });
      setMessage('스터디룸이 등록되었습니다.');
      await loadRooms();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function setRoomStatus(roomId, status) {
    setMessage('');
    try {
      await api(`/admin/rooms/${roomId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await loadRooms();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateReservation(id, action) {
    setMessage('');
    try {
      await api(`/admin/reservations/${id}/${action}`, { method: 'PATCH' });
      setMessage('예약 상태가 변경되었습니다.');
      await loadReservations();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadHistory(event) {
    event.preventDefault();
    try {
      setHistory(await api(`/admin/students/${historyStudentId}/history`));
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="workspace">
      <section className="panel">
        <PanelTitle icon={<Plus />} title="스터디룸 등록" />
        <form className="stack" onSubmit={createRoom}>
          <Field label="이름" value={roomForm.name} onChange={(value) => setRoomForm({ ...roomForm, name: value })} />
          <Field label="위치" value={roomForm.location} onChange={(value) => setRoomForm({ ...roomForm, location: value })} />
          <Field label="수용 인원" type="number" min="1" value={roomForm.capacity} onChange={(value) => setRoomForm({ ...roomForm, capacity: Number(value) })} />
          <div className="inline-fields">
            <Field label="시작" type="time" value={roomForm.availableStartTime} onChange={(value) => setRoomForm({ ...roomForm, availableStartTime: value })} />
            <Field label="종료" type="time" value={roomForm.availableEndTime} onChange={(value) => setRoomForm({ ...roomForm, availableEndTime: value })} />
          </div>
          <button className="primary" type="submit"><Plus size={17} /> 등록</button>
        </form>
        <Notice text={message} />
      </section>

      <section className="panel">
        <PanelTitle icon={<Building2 />} title="스터디룸 상태" />
        <DataList rows={rooms.map((room) => ({
          title: room.name,
          meta: `${room.location} · ${room.capacity}명 · ${room.availableStartTime}-${room.availableEndTime}`,
          badge: statusLabels[room.status],
          action: (
            <button className="ghost" onClick={() => setRoomStatus(room.id, room.status === 'AVAILABLE' ? 'DISABLED' : 'AVAILABLE')}>
              {room.status === 'AVAILABLE' ? '사용중지' : '사용가능'}
            </button>
          )
        }))} />
      </section>

      <section className="panel wide">
        <PanelTitle icon={<CalendarCheck />} title="예약 현황" />
        <form className="toolbar" onSubmit={loadReservations}>
          <input type="date" value={filter.date} onChange={(event) => setFilter({ ...filter, date: event.target.value })} />
          <select value={filter.roomId} onChange={(event) => setFilter({ ...filter, roomId: event.target.value })}>
            <option value="">전체 스터디룸</option>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
          <button className="primary" type="submit"><Search size={17} /> 조회</button>
        </form>
        <ReservationTable reservations={reservations} onAdminCancel={(id) => updateReservation(id, 'cancel')} onNoShow={(id) => updateReservation(id, 'no-show')} />
      </section>

      <section className="panel wide">
        <PanelTitle icon={<History />} title="학생 예약 이력" />
        <form className="toolbar" onSubmit={loadHistory}>
          <select value={historyStudentId} onChange={(event) => setHistoryStudentId(event.target.value)}>
            {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
          </select>
          <button className="primary" type="submit"><Search size={17} /> 조회</button>
        </form>
        <ReservationTable reservations={history} />
      </section>
    </div>
  );
}

function AccessView() {
  const [code, setCode] = useState('');
  const [reservation, setReservation] = useState(null);
  const [message, setMessage] = useState('');

  async function lookup(event) {
    event.preventDefault();
    setMessage('');
    setReservation(null);
    try {
      setReservation(await api(`/access/${code.trim()}`));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function confirmEntry() {
    setMessage('');
    try {
      const row = await api(`/access/${code.trim()}/confirm`, { method: 'POST' });
      setReservation(row);
      setMessage('입실 확인이 기록되었습니다.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="workspace single">
      <section className="panel access-panel">
        <PanelTitle icon={<DoorOpen />} title="입실 코드 확인" />
        <form className="toolbar" onSubmit={lookup}>
          <input className="code-input" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="입실 코드" />
          <button className="primary" type="submit"><Search size={17} /> 조회</button>
        </form>
        <Notice text={message} />
        {reservation && (
          <div className="access-result">
            <div>
              <strong>{reservation.roomName}</strong>
              <span>{reservation.roomLocation}</span>
            </div>
            <dl>
              <dt>예약자</dt><dd>{reservation.studentName}</dd>
              <dt>일시</dt><dd>{reservation.reservationDate} {reservation.startTime}-{reservation.endTime}</dd>
              <dt>상태</dt><dd>{statusLabels[reservation.status]}</dd>
              <dt>입실 확인</dt><dd>{reservation.entryConfirmedAt ? new Date(reservation.entryConfirmedAt).toLocaleString() : '미확인'}</dd>
            </dl>
            <button className="primary" onClick={confirmEntry}><BadgeCheck size={17} /> 입실 확인</button>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, onChange, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function PanelTitle({ icon, title, action }) {
  return (
    <div className="panel-title">
      <h2>{React.cloneElement(icon, { size: 20 })}{title}</h2>
      {action}
    </div>
  );
}

function IconButton({ icon, label, onClick }) {
  return <button className="icon-button" title={label} aria-label={label} onClick={onClick}>{React.cloneElement(icon, { size: 17 })}</button>;
}

function Notice({ text }) {
  return text ? <p className="notice">{text}</p> : null;
}

function DataList({ rows }) {
  if (rows.length === 0) return <p className="empty">표시할 항목이 없습니다.</p>;
  return (
    <div className="data-list">
      {rows.map((row, index) => (
        <div className="data-row" key={`${row.title}-${index}`}>
          <div>
            <strong>{row.title}</strong>
            <span>{row.meta}</span>
          </div>
          <div className="row-actions">
            {row.badge && <span className="badge">{row.badge}</span>}
            {row.action}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReservationTable({ reservations, onCancel, onAdminCancel, onNoShow, studentMode = false }) {
  if (reservations.length === 0) return <p className="empty">예약 내역이 없습니다.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>일자</th>
            <th>시간</th>
            <th>스터디룸</th>
            <th>예약자</th>
            <th>인원</th>
            <th>상태</th>
            <th>입실 코드</th>
            <th>처리</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((reservation) => (
            <tr key={reservation.id}>
              <td>{reservation.reservationDate}</td>
              <td>{reservation.startTime}-{reservation.endTime}</td>
              <td>{reservation.roomName}</td>
              <td>{reservation.studentName}</td>
              <td>{reservation.peopleCount}</td>
              <td><span className="badge">{statusLabels[reservation.status]}</span></td>
              <td><code>{reservation.entryCode}</code></td>
              <td className="actions-cell">
                {studentMode && reservation.status === 'CONFIRMED' && <button className="ghost" onClick={() => onCancel(reservation.id)}>취소</button>}
                {onAdminCancel && reservation.status === 'CONFIRMED' && <button className="ghost" onClick={() => onAdminCancel(reservation.id)}>관리자취소</button>}
                {onNoShow && reservation.status === 'CONFIRMED' && <button className="ghost" onClick={() => onNoShow(reservation.id)}>노쇼</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
