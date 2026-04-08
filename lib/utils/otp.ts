import crypto from 'crypto';

export function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function generateOTP(): string {
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0);
  const otp = (num % 900000) + 100000;
  return otp.toString();
}
