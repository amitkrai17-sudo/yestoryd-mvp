// file: app/admin/settings/revenue/page.tsx
// Revenue Split Configuration Page with Live Preview
// Access: /admin/settings/revenue

'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, 
  Percent, 
  IndianRupee, 
  Calendar, 
  Save, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Users,
  Building2,
  ArrowRight,
  Info,
} from 'lucide-react';

interface RevenueConfig {
  id?: string;
  lead_cost_percent: number;
  coach_cost_percent: number;
  platform_fee_percent: number;
  tds_rate_percent: number;
  tds_threshold_annual: number;
  payout_frequency: string;
  payout_day_of_month: number;
  is_active: boolean;
}

export default function RevenueSettingsPage() {
  const [config, setConfig] = useState<RevenueConfig>({
    lead_cost_percent: 20,
    coach_cost_percent: 50,
    platform_fee_percent: 30,
    tds_rate_percent: 10,
    tds_threshold_annual: 30000,
    payout_frequency: 'monthly',
    payout_day_of_month: 7,
    is_active: true,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Preview amount
  const previewAmount = 5999;

  // Calculate preview splits
  const leadCostAmount = Math.round(previewAmount * config.lead_cost_percent / 100);
  const coachCostAmount = Math.round(previewAmount * config.coach_cost_percent / 100);
  const platformFeeAmount = previewAmount - leadCostAmount - coachCostAmount;
  const tdsAmount = Math.round(coachCostAmount * config.tds_rate_percent / 100);
  const netToCoach = coachCostAmount - tdsAmount;

  // Fetch current config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/admin/revenue-config');
        const data = await res.json();
        if (data.success && data.config) {
          setConfig(data.config);
        }
      } catch (error) {
        console.error('Failed to fetch config:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  // Update platform fee when lead or coach changes
  const handlePercentChange = (field: 'lead_cost_percent' | 'coach_cost_percent', value: number) => {
    const newConfig = { ...config, [field]: value };
    newConfig.platform_fee_percent = 100 - newConfig.lead_cost_percent - newConfig.coach_cost_percent;
    if (newConfig.platform_fee_percent < 0) {
      setMessage({ type: 'error', text: 'Lead + Coach cannot exceed 100%' });
      return;
    }
    setMessage(null);
    setConfig(newConfig);
  };

  // Save configuration
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/revenue-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Configuration saved successfully!' });
        setConfig(data.config);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Revenue Split Configuration</h1>
              <p className="text-text-tertiary">Configure how enrollment fees are distributed</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || config.platform_fee_percent < 0}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Changes
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Configuration Panel */}
          <div className="space-y-6">
            {/* Component Percentages */}
            <div className="bg-surface-1 rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border bg-surface-2">
                <div className="flex items-center gap-3">
                  <Percent className="w-5 h-5 text-violet-500" />
                  <h2 className="text-lg font-semibold text-white">Component Percentages</h2>
                </div>
                <p className="text-sm text-text-tertiary mt-1">Must total 100%. Platform Fee adjusts automatically.</p>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Lead Cost */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                      Lead Cost
                    </label>
                    <span className="text-2xl font-bold text-blue-600">{config.lead_cost_percent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={config.lead_cost_percent}
                    onChange={(e) => handlePercentChange('lead_cost_percent', parseFloat(e.target.value))}
                    className="w-full h-2 bg-blue-100 rounded-full appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-xs text-text-muted mt-2">Goes to whoever sourced the lead</p>
                </div>

                {/* Coach Cost */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                      <Users className="w-4 h-4 text-pink-500" />
                      Coach Cost
                    </label>
                    <span className="text-2xl font-bold text-pink-600">{config.coach_cost_percent}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="70"
                    value={config.coach_cost_percent}
                    onChange={(e) => handlePercentChange('coach_cost_percent', parseFloat(e.target.value))}
                    className="w-full h-2 bg-pink-100 rounded-full appearance-none cursor-pointer accent-pink-500"
                  />
                  <p className="text-xs text-text-muted mt-2">Goes to the coach delivering sessions</p>
                </div>

                {/* Platform Fee (Auto) */}
                <div className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-violet-500" />
                      <span className="text-sm font-medium text-violet-700">Platform Fee</span>
                      <span className="text-xs px-2 py-0.5 bg-violet-200 text-violet-700 rounded-full">Auto</span>
                    </div>
                    <span className={`text-2xl font-bold ${config.platform_fee_percent < 0 ? 'text-red-600' : 'text-violet-600'}`}>
                      {config.platform_fee_percent}%
                    </span>
                  </div>
                  <p className="text-xs text-violet-500 mt-2">Retained by Yestoryd LLP</p>
                </div>
              </div>
            </div>

            {/* TDS Configuration */}
            <div className="bg-surface-1 rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border bg-surface-2">
                <div className="flex items-center gap-3">
                  <IndianRupee className="w-5 h-5 text-amber-500" />
                  <h2 className="text-lg font-semibold text-white">TDS Configuration</h2>
                </div>
                <p className="text-sm text-text-tertiary mt-1">Section 194J - Professional Fees</p>
              </div>

              <div className="p-6 grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">TDS Rate</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="30"
                      step="0.5"
                      value={config.tds_rate_percent}
                      onChange={(e) => setConfig({ ...config, tds_rate_percent: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 pr-10 border border-border rounded-xl text-white font-medium focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-surface-2"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Annual Threshold</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={config.tds_threshold_annual}
                      onChange={(e) => setConfig({ ...config, tds_threshold_annual: parseInt(e.target.value) || 0 })}
                      className="w-full pl-8 pr-4 py-3 border border-border rounded-xl text-white font-medium focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-surface-2"
                    />
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6">
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">TDS deducted only when coach's cumulative earnings exceed threshold in a financial year.</p>
                </div>
              </div>
            </div>

            {/* Payout Schedule */}
            <div className="bg-surface-1 rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border bg-surface-2">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-lg font-semibold text-white">Payout Schedule</h2>
                </div>
              </div>

              <div className="p-6 grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Frequency</label>
                  <select
                    value={config.payout_frequency}
                    onChange={(e) => setConfig({ ...config, payout_frequency: e.target.value })}
                    className="w-full px-4 py-3 border border-border rounded-xl text-white font-medium focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-surface-2"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="per_session">Per Session</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Payout Day</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="28"
                      value={config.payout_day_of_month}
                      onChange={(e) => setConfig({ ...config, payout_day_of_month: parseInt(e.target.value) || 7 })}
                      className="w-full px-4 py-3 pr-16 border border-border rounded-xl text-white font-medium focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-surface-2"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm">of month</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="space-y-6">
            {/* Live Preview Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white">Live Preview @ ₹{previewAmount.toLocaleString()}</h2>
                <p className="text-sm text-slate-400">See how the split works in real-time</p>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Visual Split Bar */}
                <div className="h-8 rounded-full overflow-hidden flex shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-blue-400 to-blue-500 flex items-center justify-center text-xs font-bold text-white transition-all duration-300"
                    style={{ width: `${config.lead_cost_percent}%` }}
                  >
                    {config.lead_cost_percent >= 15 && `${config.lead_cost_percent}%`}
                  </div>
                  <div 
                    className="bg-gradient-to-r from-pink-400 to-pink-500 flex items-center justify-center text-xs font-bold text-white transition-all duration-300"
                    style={{ width: `${config.coach_cost_percent}%` }}
                  >
                    {config.coach_cost_percent >= 15 && `${config.coach_cost_percent}%`}
                  </div>
                  <div 
                    className="bg-gradient-to-r from-violet-400 to-violet-500 flex items-center justify-center text-xs font-bold text-white transition-all duration-300"
                    style={{ width: `${config.platform_fee_percent}%` }}
                  >
                    {config.platform_fee_percent >= 15 && `${config.platform_fee_percent}%`}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs text-slate-400">Lead Cost</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-pink-500" />
                    <span className="text-xs text-slate-400">Coach Cost</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-violet-500" />
                    <span className="text-xs text-slate-400">Platform</span>
                  </div>
                </div>

                {/* Amount Breakdown */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <p className="text-xs text-blue-400 mb-1">Lead Cost</p>
                    <p className="text-xl font-bold text-white">₹{leadCostAmount.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <p className="text-xs text-pink-400 mb-1">Coach Cost</p>
                    <p className="text-xl font-bold text-white">₹{coachCostAmount.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <p className="text-xs text-violet-400 mb-1">Platform Fee</p>
                    <p className="text-xl font-bold text-white">₹{platformFeeAmount.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Scenario Comparison */}
            <div className="bg-surface-1 rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border">
                <h2 className="text-lg font-semibold text-white">Scenario Comparison</h2>
                <p className="text-sm text-text-tertiary">Net amounts after TDS (if applicable)</p>
              </div>

              <div className="divide-y divide-border">
                {/* Yestoryd Lead */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-text-secondary">Yestoryd Lead + External Coach</span>
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">50-50 Split</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 p-3 bg-surface-2 rounded-lg">
                      <p className="text-xs text-text-tertiary mb-1">Coach Gets</p>
                      <p className="text-lg font-bold text-white">₹{netToCoach.toLocaleString()}</p>
                      <p className="text-xs text-text-muted">After TDS</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-text-muted" />
                    <div className="flex-1 p-3 bg-violet-50 rounded-lg">
                      <p className="text-xs text-violet-600 mb-1">Yestoryd Gets</p>
                      <p className="text-lg font-bold text-violet-700">₹{(leadCostAmount + platformFeeAmount + tdsAmount).toLocaleString()}</p>
                      <p className="text-xs text-violet-500">Inc. TDS collected</p>
                    </div>
                  </div>
                </div>

                {/* Coach Lead */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-text-secondary">Coach Lead + External Coach</span>
                    <span className="px-3 py-1 bg-pink-50 text-pink-700 text-xs font-medium rounded-full">70-30 Split</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 p-3 bg-pink-50 rounded-lg">
                      <p className="text-xs text-pink-600 mb-1">Coach Gets</p>
                      <p className="text-lg font-bold text-pink-700">₹{(netToCoach + leadCostAmount - Math.round(leadCostAmount * config.tds_rate_percent / 100)).toLocaleString()}</p>
                      <p className="text-xs text-pink-500">Coach + Lead Bonus</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-text-muted" />
                    <div className="flex-1 p-3 bg-violet-50 rounded-lg">
                      <p className="text-xs text-violet-600 mb-1">Yestoryd Gets</p>
                      <p className="text-lg font-bold text-violet-700">₹{(platformFeeAmount + tdsAmount + Math.round(leadCostAmount * config.tds_rate_percent / 100)).toLocaleString()}</p>
                      <p className="text-xs text-violet-500">Platform + TDS</p>
                    </div>
                  </div>
                </div>

                {/* Rucha Coaching */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-text-secondary">Yestoryd Lead + Rucha Coaching</span>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">100% Retained</span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <p className="text-xs text-emerald-600 mb-1">Yestoryd Retains</p>
                    <p className="text-2xl font-bold text-emerald-700">₹{previewAmount.toLocaleString()}</p>
                    <p className="text-xs text-emerald-500">Full amount (Rucha's earnings handled separately)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Staggered Payout Preview */}
            <div className="bg-surface-1 rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border">
                <h2 className="text-lg font-semibold text-white">3-Month Payout Schedule</h2>
                <p className="text-sm text-text-tertiary">Coach payments split across 3 months</p>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  {[1, 2, 3].map((month) => {
                    const monthlyAmount = Math.round(netToCoach / 3);
                    const isLast = month === 3;
                    const amount = isLast ? netToCoach - (monthlyAmount * 2) : monthlyAmount;

                    return (
                      <div key={month} className="flex-1 text-center">
                        <div className="w-12 h-12 mx-auto bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center text-white font-bold mb-2">
                          M{month}
                        </div>
                        <p className="text-lg font-bold text-white">₹{amount.toLocaleString()}</p>
                        <p className="text-xs text-text-muted">{config.payout_day_of_month}th of month</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
