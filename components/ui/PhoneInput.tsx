// ============================================================
// FILE: components/ui/PhoneInput.tsx
// ============================================================
// Reusable phone input - type country code + number
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { Phone } from 'lucide-react';
import { normalizePhone } from '@/lib/utils/phone';

interface PhoneInputProps {
  value?: string;
  onChange: (e164Phone: string) => void;
  defaultCountry?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  label?: string;
  showLabel?: boolean;
  error?: string;
}

export function PhoneInput({
  value = '',
  onChange,
  defaultCountry = '+91',
  disabled = false,
  required = false,
  placeholder = '98765 43210',
  className = '',
  label = 'Phone Number',
  showLabel = true,
  error,
}: PhoneInputProps) {
  
  const parseValue = (phone: string) => {
    if (!phone) return { code: defaultCountry, number: '' };
    const normalized = normalizePhone(phone);
    // Extract country code (1-4 digits after +)
    const match = normalized.match(/^\+(\d{1,4})(\d+)$/);
    if (match) {
      return { code: '+' + match[1], number: match[2] };
    }
    return { code: defaultCountry, number: phone.replace(/\D/g, '') };
  };

  const initial = parseValue(value);
  const [countryCode, setCountryCode] = useState(initial.code);
  const [nationalNumber, setNationalNumber] = useState(initial.number);

  useEffect(() => {
    const e164 = nationalNumber ? `${countryCode}${nationalNumber}` : '';
    onChange(e164);
  }, [countryCode, nationalNumber]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    // Ensure starts with +
    if (!val.startsWith('+')) val = '+' + val.replace(/\D/g, '');
    else val = '+' + val.slice(1).replace(/\D/g, '');
    // Max 4 digits after +
    if (val.length > 5) val = val.slice(0, 5);
    setCountryCode(val || '+');
  };

  return (
    <div className={className}>
      {showLabel && label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Phone className="w-4 h-4 inline mr-2" />
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className="flex gap-1">
        <input
          type="text"
          value={countryCode}
          onChange={handleCodeChange}
          disabled={disabled}
          className="w-[70px] flex-shrink-0 bg-gray-50 border border-gray-300 rounded-xl px-2 py-3 text-gray-900 text-center text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:opacity-60"
          placeholder="+91"
        />
        <input
          type="tel"
          inputMode="numeric"
          value={nationalNumber}
          onChange={(e) => setNationalNumber(e.target.value.replace(/\D/g, ''))}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 min-w-0 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:opacity-60"
        />
      </div>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default PhoneInput;
