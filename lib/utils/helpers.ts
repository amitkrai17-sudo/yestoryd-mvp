import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Re-export from single source of truth
export { formatDate, formatDateTime } from '@/lib/utils/date-format';

export function generateId(prefix: string = 'id'): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}${randomStr}`;
}

export function getScoreCategory(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 8) return 'excellent';
  if (score >= 6) return 'good';
  if (score >= 4) return 'fair';
  return 'poor';
}

export function getScoreMessage(score: number): string {
  if (score >= 8) return 'Excellent! Outstanding reading performance!';
  if (score >= 6) return 'Good job! Keep practicing to improve further.';
  if (score >= 4) return 'Fair progress. Consistent practice will help.';
  return 'Needs improvement. Don\'t worry, we\'re here to help!';
}
