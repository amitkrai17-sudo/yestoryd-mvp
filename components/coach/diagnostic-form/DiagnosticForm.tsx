'use client';

import { useState, useCallback } from 'react';
import { Loader2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { getDiagnosticFields, getFieldSections, type DiagnosticField } from './schemas';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface DiagnosticFormProps {
  ageBand: string;
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  saving?: boolean;
  fields?: DiagnosticField[]; // Custom fields (e.g., exit assessment)
}

export default function DiagnosticForm({
  ageBand,
  initialData,
  onSubmit,
  saving = false,
  fields: customFields,
}: DiagnosticFormProps) {
  const fields = customFields || getDiagnosticFields(ageBand);
  const sections = getFieldSections(fields);

  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const defaults: Record<string, any> = {};
    fields.forEach(f => {
      if (f.type === 'multi-select' || f.type === 'letter-picker') defaults[f.key] = [];
      else if (f.type === 'number') defaults[f.key] = '';
      else defaults[f.key] = '';
    });
    return { ...defaults, ...(initialData || {}) };
  });

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const updateField = useCallback((key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleMultiSelect = useCallback((key: string, value: string) => {
    setFormData(prev => {
      const current: string[] = prev[key] || [];
      return {
        ...prev,
        [key]: current.includes(value)
          ? current.filter((v: string) => v !== value)
          : [...current, value],
      };
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const renderField = (field: DiagnosticField) => {
    const value = formData[field.key];

    switch (field.type) {
      case 'select':
        return (
          <select
            value={value || ''}
            onChange={e => updateField(field.key, e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="">Select...</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case 'multi-select':
        return (
          <div className="flex flex-wrap gap-2">
            {field.options?.map(opt => {
              const selected = (value || []).includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleMultiSelect(field.key, opt.value)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    selected
                      ? 'bg-[#FF0099]/20 text-[#FF0099] border-[#FF0099]/30'
                      : 'bg-surface-2 text-text-tertiary border-border'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        );

      case 'letter-picker':
        return (
          <div className="grid grid-cols-9 sm:grid-cols-13 gap-1">
            {ALPHABET.map(letter => {
              const selected = (value || []).includes(letter);
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => toggleMultiSelect(field.key, letter)}
                  className={`w-8 h-8 text-xs font-mono rounded transition-colors ${
                    selected
                      ? 'bg-green-500/30 text-green-400 border border-green-500/50'
                      : 'bg-surface-2 text-text-tertiary border border-border'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={e => updateField(field.key, e.target.value === '' ? '' : parseInt(e.target.value))}
            min={field.min}
            max={field.max}
            placeholder={field.placeholder}
            className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        );

      case 'text':
      default:
        if (field.key === 'coach_observations') {
          return (
            <textarea
              value={value || ''}
              onChange={e => updateField(field.key, e.target.value)}
              rows={4}
              placeholder={field.placeholder}
              className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary resize-none"
            />
          );
        }
        return (
          <input
            type="text"
            value={value || ''}
            onChange={e => updateField(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {sections.map(section => {
        const sectionFields = fields.filter(f => f.section === section);
        const collapsed = collapsedSections.has(section);

        return (
          <div key={section} className="bg-surface-1 border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection(section)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <h3 className="text-white font-medium text-sm">{section}</h3>
              {collapsed ? (
                <ChevronDown className="w-4 h-4 text-text-tertiary" />
              ) : (
                <ChevronUp className="w-4 h-4 text-text-tertiary" />
              )}
            </button>

            {!collapsed && (
              <div className="px-4 pb-4 space-y-4">
                {sectionFields.map(field => (
                  <div key={field.key}>
                    <label className="block text-xs text-text-tertiary mb-1.5">
                      {field.label}
                    </label>
                    {renderField(field)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 bg-[#FF0099] hover:bg-[#FF0099]/90 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save Diagnostic Assessment
          </>
        )}
      </button>
    </form>
  );
}
