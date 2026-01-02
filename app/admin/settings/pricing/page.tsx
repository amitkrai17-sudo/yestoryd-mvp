// =============================================================================
// FILE: app/admin/settings/pricing/page.tsx
// PURPOSE: Admin page for managing pricing and discount settings
// UI/UX: Simple, clear controls with immediate save
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, Save, RefreshCw, IndianRupee, Percent, 
  Gift, Users, Clock, Award, AlertCircle, CheckCircle
} from 'lucide-react';

interface SettingItem {
  key: string;
  value: string;
  label: string;
  description: string;
  type: 'number' | 'boolean';
  suffix?: string;
  category: string;
}

const SETTINGS_CONFIG: SettingItem[] = [
  // Pricing (Note: Coaching price is managed in Site Settings → Pricing tab)
  {
    key: 'elearning_quarterly_price',
    value: '999',
    label: 'E-Learning Quarterly',
    description: '3-month e-learning subscription',
    type: 'number',
    suffix: '₹',
    category: 'pricing',
  },
  {
    key: 'elearning_annual_price',
    value: '2999',
    label: 'E-Learning Annual',
    description: '12-month e-learning subscription (future)',
    type: 'number',
    suffix: '₹',
    category: 'pricing',
  },
  {
    key: 'loyalty_discount_percent',
    value: '10',
    label: 'Loyalty Discount',
    description: 'Re-enrollment discount for returning families',
    type: 'number',
    suffix: '%',
    category: 'pricing',
  },
  {
    key: 'loyalty_discount_days',
    value: '7',
    label: 'Loyalty Window',
    description: 'Days after completion to claim loyalty discount',
    type: 'number',
    suffix: 'days',
    category: 'pricing',
  },
  // Referral
  {
    key: 'parent_referral_discount_percent',
    value: '10',
    label: 'Referral Discount',
    description: 'Discount for new parents using a referral code',
    type: 'number',
    suffix: '%',
    category: 'referral',
  },
  {
    key: 'parent_referral_credit_percent',
    value: '10',
    label: 'Referral Credit',
    description: 'Credit awarded to referring parent (% of program price)',
    type: 'number',
    suffix: '%',
    category: 'referral',
  },
  {
    key: 'referral_credit_expiry_days',
    value: '30',
    label: 'Credit Expiry',
    description: 'Days after coaching ends when credit expires',
    type: 'number',
    suffix: 'days',
    category: 'referral',
  },
  // Discount Rules
  {
    key: 'max_discount_percent',
    value: '20',
    label: 'Maximum Discount',
    description: 'Cap on total discount (coupon + credit combined)',
    type: 'number',
    suffix: '%',
    category: 'discount',
  },
  {
    key: 'allow_coupon_credit_stacking',
    value: 'true',
    label: 'Allow Stacking',
    description: 'Allow using coupon + credit together',
    type: 'boolean',
    category: 'discount',
  },
  // Completion
  {
    key: 'completion_certificate_prefix',
    value: 'YC',
    label: 'Certificate Prefix',
    description: 'Prefix for certificate numbers (e.g., YC-2026-00001)',
    type: 'number', // Actually string but using number input
    category: 'completion',
  },
];

export default function PricingSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/settings?categories=pricing,referral,discount,completion');
      const data = await response.json();
      
      const settingsMap: Record<string, string> = {};
      data.settings?.forEach((s: { key: string; value: string | number }) => {
        // Convert to string and remove JSON quotes from value
        const strValue = String(s.value ?? '');
        settingsMap[s.key] = strValue.replace(/"/g, '');
      });
      
      setSettings(settingsMap);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save settings');
      }
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const getSettingValue = (key: string, defaultValue: string) => {
    return settings[key] ?? defaultValue;
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      pricing: <IndianRupee className="w-5 h-5" />,
      referral: <Gift className="w-5 h-5" />,
      discount: <Percent className="w-5 h-5" />,
      completion: <Award className="w-5 h-5" />,
    };
    return icons[category] || <Settings className="w-5 h-5" />;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      pricing: 'text-green-600 bg-green-100',
      referral: 'text-pink-600 bg-pink-100',
      discount: 'text-purple-600 bg-purple-100',
      completion: 'text-blue-600 bg-blue-100',
    };
    return colors[category] || 'text-gray-600 bg-gray-100';
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      pricing: 'Pricing',
      referral: 'Referral Program',
      discount: 'Discount Rules',
      completion: 'Completion',
    };
    return labels[category] || category;
  };

  // Group settings by category
  const groupedSettings = SETTINGS_CONFIG.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, SettingItem[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Settings className="w-7 h-7 text-pink-500" />
                Pricing & Discounts
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Configure program pricing, referral rewards, and discount rules
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-full transition-all shadow-lg ${
                saved
                  ? 'bg-green-500 text-white'
                  : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:scale-105'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {saving ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error Message */}
        {error && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Info Banner - Coaching price location */}
        <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700">
          <IndianRupee className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Coaching Program Price</p>
            <p className="text-sm text-blue-600 mt-0.5">
              Managed in <a href="/admin/settings" className="underline hover:text-blue-800 font-semibold">Site Settings → Pricing tab</a>
            </p>
          </div>
        </div>

        {/* Settings Groups */}
        <div className="space-y-6">
          {Object.entries(groupedSettings).map(([category, categorySettings]) => (
            <div key={category} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Category Header */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getCategoryColor(category)}`}>
                    {getCategoryIcon(category)}
                  </div>
                  <h2 className="font-semibold text-gray-900">
                    {getCategoryLabel(category)}
                  </h2>
                </div>
              </div>

              {/* Settings List */}
              <div className="divide-y divide-gray-100">
                {categorySettings.map((setting) => (
                  <div key={setting.key} className="px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <label className="font-medium text-gray-900">
                          {setting.label}
                        </label>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {setting.description}
                        </p>
                      </div>
                      <div className="w-full sm:w-40">
                        {setting.type === 'boolean' ? (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={getSettingValue(setting.key, setting.value) === 'true'}
                              onChange={(e) => handleChange(setting.key, e.target.checked ? 'true' : 'false')}
                              className="sr-only peer"
                            />
                            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-pink-500"></div>
                          </label>
                        ) : (
                          <div className="relative">
                            {setting.suffix === '₹' && (
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                ₹
                              </span>
                            )}
                            <input
                              type={setting.key === 'completion_certificate_prefix' ? 'text' : 'number'}
                              value={getSettingValue(setting.key, setting.value)}
                              onChange={(e) => handleChange(setting.key, e.target.value)}
                              className={`w-full py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all ${
                                setting.suffix === '₹' ? 'pl-8 pr-4' : 'px-4'
                              }`}
                            />
                            {setting.suffix && setting.suffix !== '₹' && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                                {setting.suffix}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Calculated Values Preview */}
        <div className="mt-6 bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl border border-pink-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-pink-500" />
            Calculated Values
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4">
              <div className="text-2xl font-bold text-pink-600">
                ₹{Math.round(
                  parseInt(getSettingValue('coaching_program_price', '5999')) *
                  parseInt(getSettingValue('parent_referral_credit_percent', '10')) / 100
                )}
              </div>
              <div className="text-xs text-gray-500">Referral Credit</div>
            </div>
            <div className="bg-white rounded-xl p-4">
              <div className="text-2xl font-bold text-green-600">
                ₹{Math.round(
                  parseInt(getSettingValue('coaching_program_price', '5999')) *
                  parseInt(getSettingValue('max_discount_percent', '20')) / 100
                )}
              </div>
              <div className="text-xs text-gray-500">Max Discount (₹)</div>
            </div>
            <div className="bg-white rounded-xl p-4">
              <div className="text-2xl font-bold text-purple-600">
                ₹{Math.round(
                  parseInt(getSettingValue('coaching_program_price', '5999')) *
                  (100 - parseInt(getSettingValue('max_discount_percent', '20'))) / 100
                )}
              </div>
              <div className="text-xs text-gray-500">Min Payment</div>
            </div>
            <div className="bg-white rounded-xl p-4">
              <div className="text-2xl font-bold text-blue-600">
                ₹{Math.round(
                  parseInt(getSettingValue('coaching_program_price', '5999')) *
                  (100 - parseInt(getSettingValue('loyalty_discount_percent', '10'))) / 100
                )}
              </div>
              <div className="text-xs text-gray-500">Loyalty Price</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Calculator icon component
function Calculator({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8" y2="10.01" />
      <line x1="12" y1="10" x2="12" y2="10.01" />
      <line x1="16" y1="10" x2="16" y2="10.01" />
      <line x1="8" y1="14" x2="8" y2="14.01" />
      <line x1="12" y1="14" x2="12" y2="14.01" />
      <line x1="16" y1="14" x2="16" y2="14.01" />
      <line x1="8" y1="18" x2="8" y2="18.01" />
      <line x1="12" y1="18" x2="16" y2="18" />
    </svg>
  );
}
