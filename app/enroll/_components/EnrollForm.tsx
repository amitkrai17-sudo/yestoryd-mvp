'use client';

import { Baby, Mail, Phone, User } from 'lucide-react';

interface FormData {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childName: string;
  childAge: string;
}

interface EnrollFormProps {
  formData: FormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

export function EnrollForm({ formData, onChange }: EnrollFormProps) {
  return (
    <>
      {/* Parent Name */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">Your Name *</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            name="parentName"
            value={formData.parentName}
            onChange={onChange}
            required
            placeholder="Enter your full name"
            className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-white bg-surface-2 placeholder:text-text-tertiary focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm"
          />
        </div>
      </div>

      {/* Email & Phone Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Email *</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="email"
              name="parentEmail"
              value={formData.parentEmail}
              onChange={onChange}
              required
              placeholder="email@example.com"
              className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-white bg-surface-2 placeholder:text-text-tertiary focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Phone *</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="tel"
              name="parentPhone"
              value={formData.parentPhone}
              onChange={onChange}
              required
              placeholder="98765 43210"
              className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-white bg-surface-2 placeholder:text-text-tertiary focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm"
            />
          </div>
        </div>
      </div>

      {/* Child Name & Age Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Child&apos;s Name *</label>
          <div className="relative">
            <Baby className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              name="childName"
              value={formData.childName}
              onChange={onChange}
              required
              placeholder="Child's first name"
              className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-white bg-surface-2 placeholder:text-text-tertiary focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Child&apos;s Age *</label>
          <select
            name="childAge"
            value={formData.childAge}
            onChange={onChange}
            required
            className="w-full px-3 py-2.5 border border-border rounded-lg text-white bg-surface-2 focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] text-sm"
          >
            <option value="">Select age</option>
            {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((age) => (
              <option key={age} value={age}>
                {age} years
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
