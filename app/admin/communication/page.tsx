'use client';

import { useState, useEffect } from 'react';
import { Radio, Send, FileText, BarChart3, RefreshCw, Bell, Mail, MessageSquare, Smartphone, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'test', label: 'Send Test', icon: Send },
];

const PRIORITY_COLORS: Record<string, string> = {
  emergency: 'bg-red-500/20 text-red-400',
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-amber-500/20 text-amber-400',
  normal: 'bg-white/[0.08] text-gray-400',
  low: 'bg-gray-500/20 text-text-tertiary',
};

export default function CommunicationPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [templates, setTemplates] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [tplRes, analyticsRes] = await Promise.all([
      supabase.from('communication_templates').select('*').order('template_code'),
      supabase.from('communication_analytics').select('*').eq('date', new Date().toISOString().split('T')[0]).single(),
    ]);
    setTemplates(tplRes.data || []);
    setAnalytics(analyticsRes.data);
    setLoading(false);
  };

  return (
    <div className="bg-surface-0 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#121217] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Communication Hub</h1>
            <p className="text-text-tertiary text-xs sm:text-sm">Multi-channel notifications & analytics</p>
          </div>
        </div>
        <button onClick={loadData} disabled={loading} className="p-2 bg-surface-1 hover:bg-surface-2 rounded-xl text-text-tertiary flex-shrink-0">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-1 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-1 sm:flex-none ${
              activeTab === tab.id
                ? 'bg-white text-[#0a0a0f]'
                : 'text-text-secondary hover:text-white hover:bg-surface-2'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden xs:inline sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-gray-400 animate-spin" /></div>
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'In-App', value: analytics?.in_app_created || 0, icon: Bell, color: 'text-emerald-400' },
                  { label: 'Push', value: analytics?.push_sent || 0, icon: Smartphone, color: 'text-gray-300' },
                  { label: 'Email', value: analytics?.email_sent || 0, icon: Mail, color: 'text-gray-300' },
                  { label: 'WhatsApp', value: analytics?.whatsapp_sent || 0, icon: MessageSquare, color: 'text-green-400' },
                ].map((stat, i) => (
                  <div key={i} className="bg-surface-1 border border-border rounded-xl p-3 sm:p-4">
                    <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color} mb-2`} />
                    <div className="text-xl sm:text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-[10px] sm:text-xs text-text-tertiary">{stat.label} Today</div>
                  </div>
                ))}
              </div>
              <div className="bg-surface-1 border border-border rounded-xl p-3 sm:p-4">
                <h3 className="font-semibold text-white text-sm sm:text-base mb-2">Cost Today</h3>
                <div className="text-2xl sm:text-3xl font-bold text-amber-400">₹{Number(analytics?.total_cost || 0).toFixed(2)}</div>
                <p className="text-[10px] sm:text-xs text-text-tertiary mt-1">WhatsApp: ₹{Number(analytics?.whatsapp_cost || 0).toFixed(2)}</p>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-2">
              <div className="text-xs sm:text-sm text-text-tertiary mb-4">{templates.length} templates configured</div>
              {templates.map(t => (
                <div key={t.id} className="bg-surface-1 border border-border rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white text-sm truncate">{t.template_code}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${PRIORITY_COLORS[t.routing_rules?.priority || 'normal']}`}>
                          {(t.routing_rules?.priority || 'normal').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-text-tertiary mt-1">WA: {t.routing_rules?.whatsapp_only_if || 'never'}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {t.channels?.in_app && <Bell className="w-3.5 h-3.5 text-emerald-400" />}
                      {t.channels?.push && <Smartphone className="w-3.5 h-3.5 text-gray-300" />}
                      {t.channels?.email && <Mail className="w-3.5 h-3.5 text-gray-300" />}
                      {t.channels?.whatsapp && <MessageSquare className="w-3.5 h-3.5 text-green-400" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'test' && (
            <div className="bg-surface-1 border border-border rounded-xl p-4">
              <h3 className="font-semibold text-white text-sm sm:text-base mb-3">Quick In-App Test</h3>
              <p className="text-xs sm:text-sm text-text-tertiary mb-3">Run this SQL in Supabase to test:</p>
              <pre className="bg-surface-0 border border-border rounded-lg p-3 text-[10px] sm:text-xs text-emerald-400 overflow-x-auto">
{`INSERT INTO in_app_notifications
(user_type, user_id, title, body,
notification_type, action_url)
VALUES (
  'admin',
  'ff4d57cb-f085-4cd7-8813-f1f2f1a3c708',
  'Test Notification',
  'Communication Hub is working!',
  'success',
  '/admin/communication'
);`}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
