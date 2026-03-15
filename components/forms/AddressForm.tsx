// ============================================================
// FILE: components/forms/AddressForm.tsx
// PURPOSE: Reusable address form with pincode auto-fill.
//   Uses India Post API to auto-fill city/state/country from
//   6-digit pincode. Fields remain editable after auto-fill.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { MapPin, Globe } from 'lucide-react';
import type { AddressValues } from './schemas';
export type { AddressValues } from './schemas';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
];

const COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'United Arab Emirates',
  'Singapore', 'Australia', 'Canada',
];

interface Props {
  values: AddressValues;
  onChange: (values: AddressValues) => void;
  errors?: Record<string, string[]>;
  disabled?: boolean;
}

const INPUT_CLASS =
  'w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm';

export function AddressForm({ values, onChange, errors, disabled }: Props) {
  const [autoFilled, setAutoFilled] = useState(false);

  function update(field: keyof AddressValues, value: string) {
    onChange({ ...values, [field]: value });
    if (field !== 'pincode') setAutoFilled(false);
  }

  // Pincode auto-fill via India Post API
  useEffect(() => {
    if (values.pincode.length !== 6) {
      setAutoFilled(false);
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(
          `https://api.postalpincode.in/pincode/${values.pincode}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
          const po = data[0].PostOffice[0];
          onChange({
            ...values,
            city: po.District || values.city,
            state: po.State || values.state,
            country: po.Country || 'India',
          });
          setAutoFilled(true);
        }
      } catch {
        // Silent fail — user can fill manually
      }
    })();

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.pincode]);

  return (
    <div className="space-y-4">
      {/* Pincode */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Pincode <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={values.pincode}
            onChange={e => update('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit pincode"
            required
            disabled={disabled}
            inputMode="numeric"
            className={INPUT_CLASS}
          />
        </div>
        {autoFilled && (
          <p className="text-green-600 text-xs mt-1">Auto-filled from pincode</p>
        )}
        {errors?.pincode && <p className="text-red-500 text-xs mt-1">{errors.pincode[0]}</p>}
      </div>

      {/* City */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          City <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={values.city}
            onChange={e => update('city', e.target.value)}
            placeholder="City"
            required
            disabled={disabled}
            className={INPUT_CLASS}
          />
        </div>
        {errors?.city && <p className="text-red-500 text-xs mt-1">{errors.city[0]}</p>}
      </div>

      {/* State */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          State <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={values.state}
            onChange={e => update('state', e.target.value)}
            required
            disabled={disabled}
            className={`${INPUT_CLASS} appearance-none`}
          >
            <option value="">Select state</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {errors?.state && <p className="text-red-500 text-xs mt-1">{errors.state[0]}</p>}
      </div>

      {/* Country */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Country <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={values.country}
            onChange={e => update('country', e.target.value)}
            required
            disabled={disabled}
            className={`${INPUT_CLASS} appearance-none`}
          >
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {errors?.country && <p className="text-red-500 text-xs mt-1">{errors.country[0]}</p>}
      </div>
    </div>
  );
}
