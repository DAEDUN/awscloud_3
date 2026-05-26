import crypto from 'crypto';

export function createEntryCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}
