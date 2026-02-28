'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';

interface PaymentGuardProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (data: PaymentData) => void;
  prefillData?: Partial<PaymentData>;
  amount?: number;
}

interface PaymentData {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childName: string;
  childAge: string;
}

const AGE_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 3);

export default function PaymentGuard({
  isOpen,
  onClose,
  onProceed,
  prefillData = {},
  amount = 5999, // V1 fallback – getPricingConfig().tiers[x].discountedPrice is authoritative
}: PaymentGuardProps) {
  const [form, setForm] = useState<PaymentData>({
    parentName: prefillData.parentName || '',
    parentEmail: prefillData.parentEmail || '',
    parentPhone: prefillData.parentPhone || '',
    childName: prefillData.childName || '',
    childAge: prefillData.childAge || '',
  });
  const [error, setError] = useState('');

  // Update form when prefillData changes
  useEffect(() => {
    setForm(f => ({
      ...f,
      ...prefillData,
    }));
  }, [prefillData]);

  if (!isOpen) return null;

  const validateForm = () => {
    if (!form.parentName.trim()) return 'Parent name is required';
    if (!form.parentEmail.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.parentEmail)) return 'Invalid email format';
    if (!form.parentPhone.trim()) return 'Phone number is required';
    if (!form.childName.trim()) return 'Child name is required';
    if (!form.childAge) return 'Child age is required';
    return null;
  };

  const handleSubmit = () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    onProceed(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-pink-500 to-purple-600">
          <div>
            <h2 className="font-bold text-white text-lg">Complete Your Details</h2>
            <p className="text-pink-100 text-sm">Required before payment</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Parent Section */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-2 text-sm">Parent Details</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={form.parentName}
                onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 text-gray-900 text-sm"
                placeholder="Your Name *"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="email"
                  value={form.parentEmail}
                  onChange={(e) => setForm({ ...form, parentEmail: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2.5 text-gray-900 text-sm"
                  placeholder="Email *"
                />
                <input
                  type="tel"
                  value={form.parentPhone}
                  onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2.5 text-gray-900 text-sm"
                  placeholder="Phone *"
                />
              </div>
            </div>
          </div>

          {/* Child Section */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-2 text-sm">Child Details</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={form.childName}
                onChange={(e) => setForm({ ...form, childName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 text-gray-900 text-sm"
                placeholder="Child's Name *"
              />
              <select
                value={form.childAge}
                onChange={(e) => setForm({ ...form, childAge: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 text-gray-900 bg-white text-sm"
              >
                <option value="">Age *</option>
                {AGE_OPTIONS.map(age => (
                  <option key={age} value={age}>{age} years</option>
                ))}
              </select>
            </div>
          </div>

          {/* Price Summary */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm">3-Month Program</span>
              <span className="font-bold text-pink-600">₹{amount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={handleSubmit}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition"
          >
            Proceed to Payment
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook to use PaymentGuard
export function usePaymentGuard() {
  const [isOpen, setIsOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<Partial<PaymentData>>({});
  const [onProceedCallback, setOnProceedCallback] = useState<((data: PaymentData) => void) | null>(null);

  const openGuard = (prefill: Partial<PaymentData> = {}, onProceed: (data: PaymentData) => void) => {
    setPrefillData(prefill);
    setOnProceedCallback(() => onProceed);
    setIsOpen(true);
  };

  const closeGuard = () => {
    setIsOpen(false);
  };

  const GuardModal = () => (
    <PaymentGuard
      isOpen={isOpen}
      onClose={closeGuard}
      onProceed={(data) => {
        closeGuard();
        onProceedCallback?.(data);
      }}
      prefillData={prefillData}
    />
  );

  return { openGuard, closeGuard, GuardModal };
}
