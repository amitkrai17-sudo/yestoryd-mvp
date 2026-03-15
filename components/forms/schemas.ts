// ============================================================
// FILE: components/forms/schemas.ts
// PURPOSE: Zod validation schemas for reusable form components.
//   Importable from both client components and server routes.
// ============================================================

import { z } from 'zod';

export const parentDetailsSchema = z.object({
  parentName: z.string().min(1, 'Name is required').max(100),
  parentEmail: z.string().email('Invalid email').transform(v => v.toLowerCase().trim()),
  parentPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number'),
});

export type ParentDetailsValues = z.input<typeof parentDetailsSchema>;

export const childDetailsSchema = z.object({
  childFullName: z.string().min(1, 'Child name is required').max(100),
  childDob: z.string().min(1, 'Date of birth is required'),
  childGrade: z.string().min(1, 'Grade is required').max(20),
  childSchool: z.string().min(1, 'School is required').max(100),
});

export type ChildDetailsValues = z.input<typeof childDetailsSchema>;

export const addressSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Must be 6-digit pincode'),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(50),
  country: z.string().min(1).max(50).default('India'),
});

export type AddressValues = z.input<typeof addressSchema>;
