export function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '');
}

export function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');
}

export function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isValidTimeRange(startTime, endTime) {
  return isValidTime(startTime) && isValidTime(endTime) && timeToMinutes(startTime) < timeToMinutes(endTime);
}

export function isWithinOperatingHours(startTime, endTime, availableStartTime, availableEndTime) {
  return timeToMinutes(startTime) >= timeToMinutes(availableStartTime)
    && timeToMinutes(endTime) <= timeToMinutes(availableEndTime);
}

export function isBeforeReservationStart(date, startTime, now = new Date()) {
  return now.getTime() < new Date(`${date}T${startTime}:00`).getTime();
}

export function isWithinReservationWindow(date, startTime, endTime, now = new Date()) {
  const start = new Date(`${date}T${startTime}:00`).getTime();
  const end = new Date(`${date}T${endTime}:00`).getTime();
  const current = now.getTime();
  return current >= start && current <= end;
}

export function normalizeTime(value) {
  return String(value || '').slice(0, 5);
}
