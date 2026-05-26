import { describe, expect, it } from 'vitest';
import {
  isBeforeReservationStart,
  isValidDate,
  isValidTimeRange,
  isWithinOperatingHours,
  isWithinReservationWindow,
  normalizeTime,
  timeToMinutes
} from './time.js';

describe('time utilities', () => {
  it('validates date and HH:mm time ranges', () => {
    expect(isValidDate('2026-05-25')).toBe(true);
    expect(isValidDate('2026-5-25')).toBe(false);
    expect(isValidTimeRange('09:00', '10:00')).toBe(true);
    expect(isValidTimeRange('10:00', '10:00')).toBe(false);
    expect(isValidTimeRange('24:00', '25:00')).toBe(false);
  });

  it('compares operating hours by minutes', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(isWithinOperatingHours('10:00', '12:00', '09:00', '22:00')).toBe(true);
    expect(isWithinOperatingHours('08:30', '12:00', '09:00', '22:00')).toBe(false);
    expect(isWithinOperatingHours('10:00', '22:30', '09:00', '22:00')).toBe(false);
  });

  it('checks reservation start and entry windows', () => {
    const before = new Date('2026-05-25T09:59:00');
    const during = new Date('2026-05-25T10:30:00');
    const after = new Date('2026-05-25T12:01:00');

    expect(isBeforeReservationStart('2026-05-25', '10:00', before)).toBe(true);
    expect(isBeforeReservationStart('2026-05-25', '10:00', during)).toBe(false);
    expect(isWithinReservationWindow('2026-05-25', '10:00', '12:00', during)).toBe(true);
    expect(isWithinReservationWindow('2026-05-25', '10:00', '12:00', after)).toBe(false);
  });

  it('normalizes SQL TIME strings for UI and comparisons', () => {
    expect(normalizeTime('09:00:00')).toBe('09:00');
    expect(normalizeTime('18:45')).toBe('18:45');
  });
});
