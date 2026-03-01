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
    description: '12-week e-learning subscription',
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
      pricing: 'text-green-400 bg-green-500/20 border border-green-500/30',
      referral: 'text-gray-400 bg-white/[0.08] border border-white/[0.08]',
      discount: 'text-gray-400 bg-white/[0.08] border border-white/[0.08]',
      completion: 'text-gray-400 bg-white/[0.08] border border-white/[0.08]',
    };
    return colors[category] || 'text-text-secondary bg-surface-2';
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
      <div className="min-h-[400px] bg-surface-0 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-surface-0 to-surface-1">
      {/* Header */}
      <div className="bg-surface-1 border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Settings className="w-7 h-7 text-gray-300" />
                Pricing & Discounts
              </h1>
              <p className="text-sm text-text-tertiary mt-1">
                Configure program pricing, referral rewards, and discount rules
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-full transition-all shadow-lg ${
                saved
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-[#0a0a0f] hover:bg-gray-200'
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
          <div className="mb-6 flex items-center gap-3 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Info Banner - Coaching price location */}
        <div className="mb-6 flex items-start gap-3 p-4 bg-white/[0.08] border border-white/[0.08] rounded-xl text-gray-300">
          <IndianRupee className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Coaching Program Price</p>
            <p className="text-sm text-gray-400 mt-0.5">
              Managed in <a href="/admin/settings" className="underline hover:text-white font-semibold">Site Settings → Pricing tab</a>
            </p>
          </div>
        </div>

        {/* Settings Groups */}
        <div className="space-y-6">
          {Object.entries(groupedSettings).map(([category, categorySettings]) => (
            <div key={category} className="bg-surface-1 rounded-2xl shadow-sm border border-border/50 overflow-hidden">
              {/* Category Header */}
              <div className="px-6 py-4 border-b border-border/50 bg-surface-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getCategoryColor(category)}`}>
                    {getCategoryIcon(category)}
                  </div>
                  <h2 className="font-semibold text-white">
                    {getCategoryLabel(category)}
                  </h2>
                </div>
              </div>

              {/* Settings List */}
              <div className="divide-y divide-border/50">
                {categorySettings.map((setting) => (
                  <div key={setting.key} className="px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <label className="font-medium text-white">
                          {setting.label}
                        </label>
                        <p className="text-sm text-text-tertiary mt-0.5">
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
                            <div className="w-14 h-7 bg-surface-3 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-white/[0.10] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-border after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gray-400"></div>
                          </label>
                        ) : (
                          <div className="relative">
                            {setting.suffix === '₹' && (
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                                ₹
                              </span>
                            )}
                            <input
                              type={setting.key === 'completion_certificate_prefix' ? 'text' : 'number'}
                              value={getSettingValue(setting.key, setting.value)}
                              onChange={(e) => handleChange(setting.key, e.target.value)}
                              className={`w-full py-2.5 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted text-right focus:outline-none focus:ring-2 focus:ring-white/[0.10] focus:border-white/[0.30] transition-all ${
                                setting.suffix === '₹' ? 'pl-8 pr-4' : 'px-4'
                              }`}
                            />
                            {setting.suffix && setting.suffix !== '₹' && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">
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
        <div className="mt-6 bg-[#121217] rounded-2xl border border-white/[0.08] p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-gray-300" />
            Calculated Values
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* V1 fallback '5999' below – site_settings 'coaching_program_price' is authoritative */}
            <div className="bg-surface-1 rounded-xl p-4">
              <div className="text-2xl font-bold text-gray-300">
                ₹{Math.round(
                  parseInt(getSettingValue('coaching_program_price', '5999')) *
                  parseInt(getSettingValue('parent_referral_credit_percent', '10')) / 100
                )}
              </div>
              <div className="text-xs text-text-tertiary">Referral Credit</div>
            </div>
            <div className="bg-surface-1 rounded-xl p-4">
              <div className="text-2xl font-bold text-green-400">
                ₹{Math.round(
                  parseInt(getSettingValue('coaching_program_price', '5999')) *
                  parseInt(getSettingValue('max_discount_percent', '20')) / 100
                )}
              </div>
              <div className="text-xs text-text-tertiary">Max Discount (₹)</div>
            </div>
            <div className="bg-surface-1 rounded-xl p-4">
              <div className="text-2xl font-bold text-gray-300">
                ₹{Math.round(
                  parseInt(getSettingValue('coaching_program_price', '5999')) *
                  (100 - parseInt(getSettingValue('max_discount_percent', '20'))) / 100
                )}
              </div>
              <div className="text-xs text-text-tertiary">Min Payment</div>
            </div>
            <div className="bg-surface-1 rounded-xl p-4">
              <div className="text-2xl font-bold text-gray-300">
                ₹{Math.round(
                  parseInt(getSettingValue('coaching_program_price', '5999')) *
                  (100 - parseInt(getSettingValue('loyalty_discount_percent', '10'))) / 100
                )}
              </div>
              <div className="text-xs text-text-tertiary">Loyalty Price</div>
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
