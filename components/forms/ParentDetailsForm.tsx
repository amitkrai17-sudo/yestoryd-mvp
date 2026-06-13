// ============================================================
// FILE: components/forms/ParentDetailsForm.tsx
// PURPOSE: Reusable parent details form fields.
//   Used in: tuition onboarding, coaching enrollment, group
//   class registration, parent profile edit.
// ============================================================

'use client';

import { User, Mail, Phone } from 'lucide-react';
import type { ParentDetailsValues } from './schemas';
export type { ParentDetailsValues } from './schemas';

interface Props {
  values: ParentDetailsValues;
  onChange: (values: ParentDetailsValues) => void;
  errors?: Record<string, string[]>;
  disabled?: boolean;
  /** Lock the phone field (read-only) — used when it was prefilled by an
   *  admin/coach-issued onboarding so the parent can't swap the identity number. */
  lockPhone?: boolean;
}

const INPUT_CLASS =
  'w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm';

export function ParentDetailsForm({ values, onChange, errors, disabled, lockPhone }: Props) {
  function update(field: keyof ParentDetailsValues, value: string) {
    onChange({ ...values, [field]: value });
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Your Name <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={values.parentName}
            onChange={e => update('parentName', e.target.value)}
            placeholder="Full name"
            required
            disabled={disabled}
            className={INPUT_CLASS}
          />
        </div>
        {errors?.parentName && <p className="text-red-500 text-xs mt-1">{errors.parentName[0]}</p>}
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email"
            value={values.parentEmail}
            onChange={e => update('parentEmail', e.target.value)}
            placeholder="your@email.com"
            required
            disabled={disabled}
            className={INPUT_CLASS}
          />
        </div>
        {errors?.parentEmail && <p className="text-red-500 text-xs mt-1">{errors.parentEmail[0]}</p>}
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="tel"
            value={values.parentPhone}
            onChange={e => update('parentPhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit mobile number"
            required
            disabled={disabled || lockPhone}
            readOnly={lockPhone}
            inputMode="numeric"
            className={`${INPUT_CLASS}${lockPhone ? ' bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
          />
        </div>
        {lockPhone && <p className="text-gray-400 text-xs mt-1">This is the number your coach registered. Contact us if it needs to change.</p>}
        {errors?.parentPhone && <p className="text-red-500 text-xs mt-1">{errors.parentPhone[0]}</p>}
      </div>
    </div>
  );
}
