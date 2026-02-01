'use client';

import { useState } from 'react';
import { X, Bell, Loader2, CheckCircle } from 'lucide-react';

interface NotifyMeModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productSlug: string;
}

export default function NotifyMeModal({
  isOpen,
  onClose,
  productName,
  productSlug,
}: NotifyMeModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    childName: '',
    childAge: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          productSlug,
          childAge: formData.childAge ? parseInt(formData.childAge) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join waitlist');
      }

      setSuccess(true);

      // Auto-close after 3 seconds
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset form after animation
    setTimeout(() => {
      setSuccess(false);
      setError('');
      setFormData({ name: '', email: '', phone: '', childName: '', childAge: '' });
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface-1 border border-border rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-text-tertiary hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          /* Success State */
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">You're on the list!</h3>
            <p className="text-text-secondary">
              We'll notify you when <span className="text-white font-medium">{productName}</span> launches in March 2026.
            </p>
          </div>
        ) : (
          /* Form State */
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-[#FF0099]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="w-6 h-6 text-[#FF0099]" />
              </div>
              <h3 className="text-xl font-bold text-white">Get Notified</h3>
              <p className="text-text-secondary text-sm mt-1">
                Be the first to know when{' '}
                <span className="text-white font-medium">{productName}</span> launches
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Your Name <span className="text-[#FF0099]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full min-h-[44px] px-4 py-3 rounded-xl bg-surface-2 border border-border text-white placeholder:text-text-tertiary focus:border-[#FF0099] focus:ring-1 focus:ring-[#FF0099]/50 outline-none transition-all"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Email <span className="text-[#FF0099]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full min-h-[44px] px-4 py-3 rounded-xl bg-surface-2 border border-border text-white placeholder:text-text-tertiary focus:border-[#FF0099] focus:ring-1 focus:ring-[#FF0099]/50 outline-none transition-all"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  WhatsApp Number <span className="text-[#FF0099]">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full min-h-[44px] px-4 py-3 rounded-xl bg-surface-2 border border-border text-white placeholder:text-text-tertiary focus:border-[#FF0099] focus:ring-1 focus:ring-[#FF0099]/50 outline-none transition-all"
                  placeholder="10-digit mobile number"
                  maxLength={10}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Child's Name
                  </label>
                  <input
                    type="text"
                    value={formData.childName}
                    onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                    className="w-full min-h-[44px] px-4 py-3 rounded-xl bg-surface-2 border border-border text-white placeholder:text-text-tertiary focus:border-[#FF0099] focus:ring-1 focus:ring-[#FF0099]/50 outline-none transition-all"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Child's Age
                  </label>
                  <input
                    type="number"
                    min="4"
                    max="12"
                    value={formData.childAge}
                    onChange={(e) => setFormData({ ...formData, childAge: e.target.value })}
                    className="w-full min-h-[44px] px-4 py-3 rounded-xl bg-surface-2 border border-border text-white placeholder:text-text-tertiary focus:border-[#FF0099] focus:ring-1 focus:ring-[#FF0099]/50 outline-none transition-all"
                    placeholder="4-12"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#FF0099] hover:bg-[#e6008a] disabled:bg-surface-2 disabled:text-text-tertiary text-white font-semibold transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Bell className="w-5 h-5" />
                    Notify Me at Launch
                  </>
                )}
              </button>

              <p className="text-text-tertiary text-xs text-center">
                We'll send you a WhatsApp message when we launch. No spam, ever.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
