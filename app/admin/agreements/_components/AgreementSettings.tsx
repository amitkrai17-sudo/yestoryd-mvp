'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  Settings,
  Save,
  IndianRupee,
  Percent,
  Clock,
  FileSignature,
  Building2,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { supabase } from '@/lib/supabase/client';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

interface ConfigVariable {
  key: string;
  value: string;
  description: string | null;
  category: string | null;
}

const DEFAULT_VARIABLES: ConfigVariable[] = [
  // Company Details
  { key: 'company_name', value: 'Yestoryd', description: 'Company/Brand name', category: 'company' },
  { key: 'company_address', value: 'A 703, Mahavir Dham CHS, Plot No 27 & 28, Sector 40, Seawoods, Navi Mumbai, Maharashtra - 400706', description: 'Registered address', category: 'company' },
  { key: 'company_email', value: COMPANY_CONFIG.supportEmail, description: 'Company email', category: 'company' },
  { key: 'company_phone', value: COMPANY_CONFIG.leadBotWhatsApp, description: 'Company phone', category: 'company' },
  { key: 'company_website', value: 'https://yestoryd.com', description: 'Company website', category: 'company' },
  { key: 'company_gstin', value: '27AOQPD7421L1ZL', description: 'GST Number', category: 'company' },
  { key: 'company_udyam', value: 'UDYAM-MH-19-0208177', description: 'UDYAM Registration', category: 'company' },
  { key: 'company_pan', value: 'AOQPD7421L', description: 'PAN Number', category: 'company' },
  { key: 'proprietor_name', value: 'Rucha Amitkumar Rai', description: 'Proprietor legal name', category: 'company' },
  { key: 'entity_type', value: 'Sole Proprietorship', description: 'Business entity type', category: 'company' },

  // Revenue Split
  { key: 'lead_cost_percent', value: '20', description: 'Lead cost percentage', category: 'revenue' },
  { key: 'coach_cost_percent', value: '50', description: 'Coach cost percentage', category: 'revenue' },
  { key: 'platform_fee_percent', value: '30', description: 'Platform fee percentage', category: 'revenue' },

  // TDS
  { key: 'tds_rate_standard', value: '10', description: 'Standard TDS rate with PAN (%)', category: 'tds' },
  { key: 'tds_rate_no_pan', value: '20', description: 'TDS rate without PAN (%)', category: 'tds' },
  { key: 'tds_threshold', value: '30,000', description: 'TDS threshold per year (₹)', category: 'tds' },
  { key: 'tds_section', value: '194J', description: 'TDS section', category: 'tds' },

  // Operational Terms
  { key: 'payout_day', value: '7', description: 'Day of month for payouts', category: 'operations' },
  { key: 'cancellation_notice_hours', value: '24', description: 'Hours notice for cancellation', category: 'operations' },
  { key: 'termination_notice_days', value: '30', description: 'Days notice for termination', category: 'operations' },
  { key: 'non_solicitation_months', value: '12', description: 'Non-solicitation period (months)', category: 'operations' },
  { key: 'liquidated_damages', value: '50,000', description: 'Liquidated damages amount (₹)', category: 'operations' },
  { key: 'liquidated_damages_multiplier', value: '5', description: 'LTV multiplier for damages', category: 'operations' },
  { key: 'no_show_wait_minutes', value: '15', description: 'Minutes to wait for no-show', category: 'operations' },
  { key: 'amendment_notice_days', value: '30', description: 'Days notice for amendments', category: 'operations' },

  // Program Details
  { key: 'program_fee', value: '', description: 'Program fee (₹) — loaded from pricing_plans', category: 'program' },
  { key: 'program_duration', value: '12 weeks', description: 'Program duration', category: 'program' },
  { key: 'sessions_per_month', value: '3', description: 'Sessions per month', category: 'program' },
  { key: 'session_duration', value: '', description: 'Session duration — derived from age_band_config (leave blank for auto)', category: 'program' },

  // Agreement
  { key: 'agreement_version', value: '2.1', description: 'Current agreement version', category: 'agreement' },
];

const CATEGORY_INFO: { [key: string]: { label: string; icon: React.ComponentType<{ className?: string }>; color: string } } = {
  company: { label: 'Company Details', icon: Building2, color: 'blue' },
  revenue: { label: 'Revenue Split', icon: Percent, color: 'green' },
  tds: { label: 'TDS & Tax', icon: IndianRupee, color: 'purple' },
  operations: { label: 'Operational Terms', icon: Clock, color: 'orange' },
  program: { label: 'Program Details', icon: FileSignature, color: 'pink' },
  agreement: { label: 'Agreement', icon: FileText, color: 'gray' },
};

interface AgreementSettingsProps {
  setError: (error: string | null) => void;
  setSuccess: (msg: string | null) => void;
  hasChanges: boolean;
  setHasChanges: (v: boolean) => void;
}

export default function AgreementSettings({
  setError,
  setSuccess,
  hasChanges,
  setHasChanges,
}: AgreementSettingsProps) {
  const [variables, setVariables] = useState<ConfigVariable[]>([]);
  const [variablesLoading, setVariablesLoading] = useState(false);
  const [savingVariables, setSavingVariables] = useState(false);
  const [editedVariables, setEditedVariables] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchVariables();
  }, []);

  const fetchVariables = async () => {
    setVariablesLoading(true);
    try {
      const { data, error } = await supabase
        .from('agreement_config')
        .select('key, value, description, category')
        .order('category');

      if (error) throw error;

      if (data && data.length > 0) {
        const mergedVariables = DEFAULT_VARIABLES.map(defaultVar => {
          const dbVar = data.find(d => d.key === defaultVar.key);
          return dbVar || defaultVar;
        });
        setVariables(mergedVariables);
        const edited: { [key: string]: string } = {};
        mergedVariables.forEach(v => { edited[v.key] = v.value; });
        setEditedVariables(edited);
      } else {
        setVariables(DEFAULT_VARIABLES);
        const edited: { [key: string]: string } = {};
        DEFAULT_VARIABLES.forEach(v => { edited[v.key] = v.value; });
        setEditedVariables(edited);
      }
    } catch {
      setVariables(DEFAULT_VARIABLES);
      const edited: { [key: string]: string } = {};
      DEFAULT_VARIABLES.forEach(v => { edited[v.key] = v.value; });
      setEditedVariables(edited);
    } finally {
      setVariablesLoading(false);
    }
  };

  const handleVariableChange = (key: string, value: string) => {
    setEditedVariables(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveVariables = async () => {
    setSavingVariables(true);
    setError(null);

    try {
      const upsertData = Object.entries(editedVariables).map(([key, value]) => {
        const varInfo = DEFAULT_VARIABLES.find(v => v.key === key);
        return {
          key,
          value,
          description: varInfo?.description || '',
          category: varInfo?.category || 'other',
        };
      });

      const { error: upsertError } = await supabase
        .from('agreement_config')
        .upsert(upsertData, { onConflict: 'key' });

      if (upsertError) throw upsertError;

      setSuccess('All variables saved successfully!');
      setHasChanges(false);
      fetchVariables();
    } catch (err: any) {
      console.error('Error saving variables:', err);
      setError(err.message || 'Failed to save variables');
    } finally {
      setSavingVariables(false);
    }
  };

  // Group variables by category
  const groupedVariables = variables.reduce((acc, variable) => {
    const cat = variable.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(variable);
    return acc;
  }, {} as { [key: string]: ConfigVariable[] });

  return (
    <>
      {/* Save Button */}
      <div className="mb-6 flex justify-between items-center">
        <p className="text-sm text-text-secondary">
          Edit the values below. These will be used to fill <code className="bg-surface-2 px-1 rounded">{'{{variables}}'}</code> in the agreement.
        </p>
        <button
          onClick={saveVariables}
          disabled={savingVariables || !hasChanges}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            hasChanges
              ? 'bg-white text-[#0a0a0f] hover:bg-gray-200'
              : 'bg-surface-3 text-text-tertiary cursor-not-allowed'
          }`}
        >
          {savingVariables ? (
            <><Spinner size="sm" /> Saving...</>
          ) : (
            <><Save className="w-4 h-4" /> Save All Changes</>
          )}
        </button>
      </div>

      {variablesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" color="muted" />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedVariables).map(([category, vars]) => {
            const catInfo = CATEGORY_INFO[category] || { label: category, icon: Settings, color: 'gray' };
            const IconComponent = catInfo.icon;

            return (
              <div key={category} className="bg-surface-1 rounded-xl border border-border overflow-hidden">
                <div className={`px-6 py-4 bg-surface-2 border-b border-border flex items-center gap-3`}>
                  <IconComponent className={`w-5 h-5 text-${catInfo.color}-400`} />
                  <h3 className="font-semibold text-white">{catInfo.label}</h3>
                  <span className="text-xs text-text-tertiary">({vars.length} variables)</span>
                </div>
                <div className="p-6 grid gap-4 sm:grid-cols-2">
                  {vars.map((variable) => (
                    <div key={variable.key}>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        {variable.description}
                        <code className="ml-2 text-xs text-gray-400 bg-white/[0.08] px-1 rounded">
                          {`{{${variable.key}}}`}
                        </code>
                      </label>
                      <input
                        type="text"
                        value={editedVariables[variable.key] || ''}
                        onChange={(e) => handleVariableChange(variable.key, e.target.value)}
                        className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg focus:ring-2 focus:ring-white/[0.10] focus:border-white/[0.30] text-white placeholder:text-text-muted text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-white/[0.06] border border-white/[0.08] rounded-xl p-4">
        <h4 className="font-medium text-gray-300 mb-2">How Variables Work</h4>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>- Variables like <code className="bg-white/[0.08] px-1 rounded">{'{{company_name}}'}</code> in your DOCX will be replaced with values from this page</li>
          <li>- Changes take effect immediately for new coach signups</li>
          <li>- Already signed agreements are NOT affected by changes</li>
          <li>- Use the <strong>Preview</strong> button in Agreements tab to see the final result</li>
        </ul>
      </div>
    </>
  );
}
