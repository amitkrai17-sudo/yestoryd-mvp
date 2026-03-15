// ============================================================
// FILE: components/forms/ChildDetailsForm.tsx
// PURPOSE: Reusable child details form fields.
//   Used in: tuition onboarding, coaching enrollment, group
//   class registration, admin CRM.
// ============================================================

'use client';

import { User, Calendar, GraduationCap, School } from 'lucide-react';
import type { ChildDetailsValues } from './schemas';
export type { ChildDetailsValues } from './schemas';

interface Props {
  values: ChildDetailsValues;
  onChange: (values: ChildDetailsValues) => void;
  errors?: Record<string, string[]>;
  disabled?: boolean;
  childNameLabel?: string;
}

const INPUT_CLASS =
  'w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm';

export function ChildDetailsForm({ values, onChange, errors, disabled, childNameLabel }: Props) {
  function update(field: keyof ChildDetailsValues, value: string) {
    onChange({ ...values, [field]: value });
  }

  return (
    <div className="space-y-4">
      {/* Child Full Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {childNameLabel || "Child's Full Name"} <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={values.childFullName}
            onChange={e => update('childFullName', e.target.value)}
            placeholder="Child's full name"
            required
            disabled={disabled}
            className={INPUT_CLASS}
          />
        </div>
        {errors?.childFullName && <p className="text-red-500 text-xs mt-1">{errors.childFullName[0]}</p>}
      </div>

      {/* DOB */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Date of Birth <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={values.childDob}
            onChange={e => update('childDob', e.target.value)}
            required
            disabled={disabled}
            className={INPUT_CLASS}
          />
        </div>
        {errors?.childDob && <p className="text-red-500 text-xs mt-1">{errors.childDob[0]}</p>}
      </div>

      {/* Grade */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Grade / Class <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={values.childGrade}
            onChange={e => update('childGrade', e.target.value)}
            placeholder="e.g., Class 3"
            required
            disabled={disabled}
            className={INPUT_CLASS}
          />
        </div>
        {errors?.childGrade && <p className="text-red-500 text-xs mt-1">{errors.childGrade[0]}</p>}
      </div>

      {/* School */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          School <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={values.childSchool}
            onChange={e => update('childSchool', e.target.value)}
            placeholder="School name"
            required
            disabled={disabled}
            className={INPUT_CLASS}
          />
        </div>
        {errors?.childSchool && <p className="text-red-500 text-xs mt-1">{errors.childSchool[0]}</p>}
      </div>
    </div>
  );
}
