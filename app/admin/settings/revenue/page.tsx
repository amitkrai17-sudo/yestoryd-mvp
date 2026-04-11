// app/admin/settings/revenue/page.tsx
// Admin revenue settings — split config + guardrails for all products
'use client';

import { useState, useEffect } from 'react';
import {
  Settings, Save, RefreshCw, CheckCircle, AlertCircle, Shield,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { PageHeader } from '@/components/shared/PageHeader';

// ============================================================
// TYPES
// ============================================================

interface TierSplit { name: string; display?: string; coachPercent: number; leadPercent: number; platformPercent: number; isInternal?: boolean; id?: string }
interface Guardrails { min: number; max: number; warnLow: number; warnHigh: number }
interface RevenueData {
  coaching: { tiers: TierSplit[] };
  tuition: { tiers: TierSplit[]; leadPercent: number; guardrails: { batch: Guardrails; individual: Guardrails } };
  workshop: { defaultCoachPercent: number; leadPercent: number };
  payout: { dayOfMonth: number; tdsRate: number; tdsThreshold: number; reenrollmentBonus: number; reenrollmentBonusEnabled: boolean };
}

type TabId = 'tuition' | 'coaching' | 'workshop' | 'payout';

// ============================================================
// COMPONENT
// ============================================================

export default function RevenueSettingsPage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('tuition');

  // Editable state (mirrors data, mutated on input change)
  const [tuitionTiers, setTuitionTiers] = useState<TierSplit[]>([]);
  const [tuitionLead, setTuitionLead] = useState(10);
  const [batchGuardrails, setBatchGuardrails] = useState<Guardrails>({ min: 150, max: 300, warnLow: 180, warnHigh: 280 });
  const [individualGuardrails, setIndividualGuardrails] = useState<Guardrails>({ min: 300, max: 500, warnLow: 330, warnHigh: 450 });
  const [coachingTiers, setCoachingTiers] = useState<TierSplit[]>([]);
  const [workshopCoach, setWorkshopCoach] = useState(45);
  const [payoutDay, setPayoutDay] = useState(7);
  const [tdsRate, setTdsRate] = useState(10);
  const [tdsThreshold, setTdsThreshold] = useState(30000);
  const [reenrollBonus, setReenrollBonus] = useState(500);

  // Test rate calculator
  const [testRate, setTestRate] = useState(200);
  const [testDuration, setTestDuration] = useState(60);
  const [testType, setTestType] = useState<'batch' | 'individual'>('batch');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await fetch('/api/admin/revenue-settings');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setData(json);
      // Populate editable state
      setTuitionTiers(json.tuition.tiers);
      setTuitionLead(json.tuition.leadPercent);
      setBatchGuardrails(json.tuition.guardrails.batch);
      setIndividualGuardrails(json.tuition.guardrails.individual);
      setCoachingTiers(json.coaching.tiers.filter((t: TierSplit) => !t.isInternal));
      setWorkshopCoach(json.workshop.defaultCoachPercent);
      setPayoutDay(json.payout.dayOfMonth);
      setTdsRate(json.payout.tdsRate);
      setTdsThreshold(json.payout.tdsThreshold);
      setReenrollBonus(json.payout.reenrollmentBonus);
    } catch { setMessage({ type: 'error', text: 'Failed to load settings' }); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {};

      if (activeTab === 'tuition') {
        const tierUpdates: Record<string, { coachPercent: number }> = {};
        for (const t of tuitionTiers) {
          tierUpdates[t.name] = { coachPercent: t.coachPercent };
        }
        body.tuition = {
          ...tierUpdates,
          leadPercent: tuitionLead,
          guardrails: { batch: batchGuardrails, individual: individualGuardrails },
        };
      }
      if (activeTab === 'coaching') {
        const tierUpdates: Record<string, { coachPercent: number; leadPercent: number }> = {};
        for (const t of coachingTiers) {
          tierUpdates[t.name] = { coachPercent: t.coachPercent, leadPercent: t.leadPercent };
        }
        body.coaching = tierUpdates;
      }
      if (activeTab === 'workshop') {
        body.workshop = { defaultCoachPercent: workshopCoach };
      }
      if (activeTab === 'payout') {
        body.payout = { dayOfMonth: payoutDay, tdsRate, tdsThreshold, reenrollmentBonus: reenrollBonus };
      }

      const res = await fetch('/api/admin/revenue-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: json.details?.join(', ') || json.error || 'Save failed' });
        return;
      }

      setMessage({ type: 'success', text: 'Settings saved. Changes take effect on next calculation.' });
      loadData(); // Refresh
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  const updateTuitionTier = (name: string, coachPct: number) => {
    setTuitionTiers(prev => prev.map(t =>
      t.name === name ? { ...t, coachPercent: coachPct, platformPercent: 100 - coachPct - tuitionLead } : t
    ));
  };

  const updateCoachingTier = (name: string, field: 'coachPercent' | 'leadPercent', value: number) => {
    setCoachingTiers(prev => prev.map(t =>
      t.name === name ? {
        ...t,
        [field]: value,
        platformPercent: field === 'coachPercent' ? 100 - value - t.leadPercent : 100 - t.coachPercent - value,
      } : t
    ));
  };

  // Test rate result
  const testHourly = testDuration > 0 ? Math.round((testRate / testDuration) * 60) : 0;
  const testGuardrails = testType === 'batch' ? batchGuardrails : individualGuardrails;
  const testFlag = testHourly < testGuardrails.min ? 'red_low'
    : testHourly < testGuardrails.warnLow ? 'amber_low'
    : testHourly > testGuardrails.max ? 'red_high'
    : testHourly > testGuardrails.warnHigh ? 'amber_high'
    : 'green';

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Spinner size="lg" /></div>;
  }

  const TABS: { id: TabId; label: string }[] = [
    { id: 'tuition', label: 'English Classes' },
    { id: 'coaching', label: 'Coaching' },
    { id: 'workshop', label: 'Workshops' },
    { id: 'payout', label: 'Payout' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Revenue Settings"
        subtitle="Split percentages and guardrails for all products"
        action={
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 rounded-xl text-sm font-medium bg-white text-[#0a0a0f] hover:bg-gray-200 flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Spinner size="sm" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        }
      />

      {message && (
        <div className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl ${
          message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'text-white border-b-2 border-white' : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- TUITION TAB ---- */}
      {activeTab === 'tuition' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Coach split by tier</h3>
            <div className="mb-3 flex items-center gap-3">
              <label className="text-sm text-text-tertiary">Lead cost (all tiers):</label>
              <input
                type="number"
                value={tuitionLead}
                onChange={e => {
                  const v = Number(e.target.value);
                  setTuitionLead(v);
                  setTuitionTiers(prev => prev.map(t => ({ ...t, platformPercent: 100 - t.coachPercent - v })));
                }}
                className="w-16 h-8 px-2 rounded-lg bg-white/[0.08] border border-border text-white text-sm text-center"
                min={0} max={30}
              />
              <span className="text-sm text-text-tertiary">%</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-tertiary border-b border-border">
                    <th className="text-left py-2 font-medium">Tier</th>
                    <th className="text-center py-2 font-medium">Lead %</th>
                    <th className="text-center py-2 font-medium">Coach %</th>
                    <th className="text-center py-2 font-medium">Platform %</th>
                  </tr>
                </thead>
                <tbody>
                  {tuitionTiers.map(tier => (
                    <tr key={tier.name} className="border-b border-border/50">
                      <td className="py-2 text-white capitalize">{tier.name}</td>
                      <td className="py-2 text-center text-text-tertiary">{tuitionLead}%</td>
                      <td className="py-2 text-center">
                        <input
                          type="number"
                          value={tier.coachPercent}
                          onChange={e => updateTuitionTier(tier.name, Number(e.target.value))}
                          className="w-16 h-8 px-2 rounded-lg bg-white/[0.08] border border-border text-white text-sm text-center"
                          min={1} max={90}
                        />
                      </td>
                      <td className={`py-2 text-center ${tier.platformPercent < 0 ? 'text-red-400' : 'text-text-tertiary'}`}>
                        {tier.platformPercent}%
                      </td>
                    </tr>
                  ))}
                  <tr className="text-text-tertiary">
                    <td className="py-2">Internal</td>
                    <td className="py-2 text-center">0%</td>
                    <td className="py-2 text-center">0%</td>
                    <td className="py-2 text-center">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Price guardrails (/hour)</h3>
            {[
              { label: 'Batch', state: batchGuardrails, setter: setBatchGuardrails },
              { label: 'Individual', state: individualGuardrails, setter: setIndividualGuardrails },
            ].map(({ label, state, setter }) => (
              <div key={label} className="mb-4">
                <p className="text-xs text-text-tertiary mb-2">{label}</p>
                <div className="grid grid-cols-4 gap-2">
                  {(['min', 'warnLow', 'warnHigh', 'max'] as const).map(field => (
                    <div key={field}>
                      <label className="text-[11px] text-text-tertiary block mb-1">
                        {field === 'min' ? 'Min' : field === 'warnLow' ? 'Warn low' : field === 'warnHigh' ? 'Warn high' : 'Max'}
                      </label>
                      <input
                        type="number"
                        value={state[field]}
                        onChange={e => setter({ ...state, [field]: Number(e.target.value) })}
                        className="w-full h-8 px-2 rounded-lg bg-white/[0.08] border border-border text-white text-sm text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Test a rate</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <input type="number" value={testRate} onChange={e => setTestRate(Number(e.target.value))} className="w-20 h-8 px-2 rounded-lg bg-white/[0.08] border border-border text-white text-sm text-center" placeholder="Rate" />
              <span className="text-xs text-text-tertiary">/session</span>
              <input type="number" value={testDuration} onChange={e => setTestDuration(Number(e.target.value))} className="w-20 h-8 px-2 rounded-lg bg-white/[0.08] border border-border text-white text-sm text-center" placeholder="Duration" />
              <span className="text-xs text-text-tertiary">min</span>
              <select value={testType} onChange={e => setTestType(e.target.value as 'batch' | 'individual')} className="h-8 px-2 rounded-lg bg-white/[0.08] border border-border text-white text-sm">
                <option value="batch">Batch</option>
                <option value="individual">Individual</option>
              </select>
            </div>
            <div className={`mt-2 text-sm px-3 py-2 rounded-lg ${
              testFlag === 'green' ? 'bg-green-500/10 text-green-400' :
              testFlag.startsWith('amber') ? 'bg-yellow-500/10 text-yellow-400' :
              'bg-red-500/10 text-red-400'
            }`}>
              {testHourly}/hr — {testFlag === 'green' ? 'Normal range' : testFlag.includes('low') ? 'Below range' : 'Above range'}
              {testRate > 0 && ` | Coach: ${Math.round(testRate * (tuitionTiers[0]?.coachPercent ?? 70) / 100)}`}
            </div>
          </div>
        </div>
      )}

      {/* ---- COACHING TAB ---- */}
      {activeTab === 'coaching' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Coach split by tier</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-tertiary border-b border-border">
                    <th className="text-left py-2 font-medium">Tier</th>
                    <th className="text-center py-2 font-medium">Lead %</th>
                    <th className="text-center py-2 font-medium">Coach %</th>
                    <th className="text-center py-2 font-medium">Platform %</th>
                  </tr>
                </thead>
                <tbody>
                  {coachingTiers.map(tier => (
                    <tr key={tier.name} className="border-b border-border/50">
                      <td className="py-2 text-white">{tier.display || tier.name}</td>
                      <td className="py-2 text-center">
                        <input
                          type="number"
                          value={tier.leadPercent}
                          onChange={e => updateCoachingTier(tier.name, 'leadPercent', Number(e.target.value))}
                          className="w-16 h-8 px-2 rounded-lg bg-white/[0.08] border border-border text-white text-sm text-center"
                          min={0} max={30}
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="number"
                          value={tier.coachPercent}
                          onChange={e => updateCoachingTier(tier.name, 'coachPercent', Number(e.target.value))}
                          className="w-16 h-8 px-2 rounded-lg bg-white/[0.08] border border-border text-white text-sm text-center"
                          min={1} max={90}
                        />
                      </td>
                      <td className={`py-2 text-center ${tier.platformPercent < 0 ? 'text-red-400' : 'text-text-tertiary'}`}>
                        {tier.platformPercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Lead cost decay</h3>
            <div className="bg-white/[0.04] rounded-xl p-3 space-y-1 text-sm text-text-tertiary">
              <div className="flex justify-between"><span>Starter enrollment</span><span>100% of lead cost</span></div>
              <div className="flex justify-between"><span>Continuation</span><span>50% of lead cost</span></div>
              <div className="flex justify-between"><span>Re-enrollment</span><span>0% of lead cost</span></div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Extras</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-tertiary">Skill building rate</span>
                <span className="text-text-secondary">50% of coaching rate</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-tertiary">Re-enrollment bonus</span>
                <div className="flex items-center gap-1">
                  <span className="text-text-tertiary">₹</span>
                  <input
                    type="number"
                    value={reenrollBonus}
                    onChange={e => setReenrollBonus(Number(e.target.value))}
                    className="w-20 h-8 px-2 rounded-lg bg-white/[0.08] border border-border text-white text-sm text-center"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- WORKSHOP TAB ---- */}
      {activeTab === 'workshop' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Default coach share</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={workshopCoach}
                onChange={e => setWorkshopCoach(Number(e.target.value))}
                className="w-16 h-8 px-2 rounded-lg bg-white/[0.08] border border-border text-white text-sm text-center"
                min={1} max={90}
              />
              <span className="text-text-tertiary">%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Lead cost</span>
            <span className="text-text-tertiary">0% (workshops have no lead cost)</span>
          </div>
          <p className="text-xs text-text-tertiary">Per-session override available in group session settings.</p>
        </div>
      )}

      {/* ---- PAYOUT TAB ---- */}
      {activeTab === 'payout' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2"><Settings className="w-4 h-4 text-text-tertiary" /><span className="text-text-secondary">Payout day</span></div>
            <div className="flex items-center gap-1">
              <input type="number" value={payoutDay} onChange={e => setPayoutDay(Number(e.target.value))} className="w-16 h-8 px-2 rounded-lg bg-white/[0.08] border border-border text-white text-sm text-center" min={1} max={28} />
              <span className="text-text-tertiary">of month</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-text-tertiary" /><span className="text-text-secondary">TDS rate (Section 194J)</span></div>
            <div className="flex items-center gap-1">
              <input type="number" value={tdsRate} onChange={e => setTdsRate(Number(e.target.value))} className="w-16 h-8 px-2 rounded-lg bg-white/[0.08] border border-border text-white text-sm text-center" min={0} max={30} />
              <span className="text-text-tertiary">%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-text-tertiary" /><span className="text-text-secondary">TDS annual threshold</span></div>
            <div className="flex items-center gap-1">
              <span className="text-text-tertiary">₹</span>
              <input type="number" value={tdsThreshold} onChange={e => setTdsThreshold(Number(e.target.value))} className="w-24 h-8 px-2 rounded-lg bg-white/[0.08] border border-border text-white text-sm text-center" />
            </div>
          </div>
          <p className="text-xs text-text-tertiary">Changes take effect on the next payout calculation.</p>
        </div>
      )}
    </div>
  );
}
