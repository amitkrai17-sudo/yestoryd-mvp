'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, 
  MessageSquare, 
  Users, 
  ToggleLeft,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Star,
  Phone,
  Mail,
  Instagram,
  Globe,
  BookOpen,
  Calendar,
  Loader2,
  Plus,
  Trash2,
  Edit3,
  X,
  IndianRupee,
  Clock,
  Hash,
  Percent,
  Link,
  HelpCircle,
  ChevronRight,
  Search,
  BarChart3
} from 'lucide-react';

// ==================== TYPES ====================
interface SiteSetting {
  id: string;
  category: string;
  key: string;
  value: string;
  description: string;
  updated_at: string;
}

interface Testimonial {
  id: string;
  parent_name: string;
  parent_location: string;
  child_name: string;
  child_age: number;
  testimonial_text: string;
  rating: number;
  image_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
}

interface PricingPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  original_price: number;
  discounted_price: number;
  discount_label: string;
  duration_months: number;
  sessions_included: number;
  features: string[];
  is_active: boolean;
  is_featured: boolean;
  offer_valid_until: string;
}

interface FeatureFlag {
  id: string;
  flag_key: string;
  flag_value: boolean;
  description: string;
}

type TabType = 'general' | 'pricing' | 'testimonials' | 'features';

// ==================== FIELD METADATA ====================
// Descriptions, units, required status, and default values for each setting key
// required: true = Used in code, must have value
// required: false = Optional, for display only
const FIELD_META: Record<string, { 
  label: string; 
  description: string; 
  unit?: string; 
  type?: string;
  required: boolean;
  defaultValue?: string;
}> = {
  // Pricing - REQUIRED (used in checkout/book pages)
  free_assessment_worth: {
    label: 'Free Assessment Value',
    description: 'Displayed value of the free assessment on marketing pages',
    unit: '₹',
    required: true,
    defaultValue: '999',
  },
  default_discount_percent: {
    label: 'Default Discount',
    description: 'Standard discount percentage shown on pricing',
    unit: '%',
    required: false,
    defaultValue: '40',
  },
  
  // Contact - REQUIRED (used in WhatsApp links, emails)
  whatsapp_number: {
    label: 'WhatsApp Number',
    description: 'Primary WhatsApp number for parent inquiries. Include country code (+91).',
    type: 'tel',
    required: true,
    defaultValue: '+918976287997',
  },
  support_email: {
    label: 'Support Email',
    description: 'Email address for customer support queries',
    type: 'email',
    required: true,
    defaultValue: 'engage@yestoryd.com',
  },
  support_phone: {
    label: 'Support Phone',
    description: 'Phone number displayed on website for calls',
    type: 'tel',
    required: false,
    defaultValue: '+918976287997',
  },
  
  // Social - OPTIONAL (for footer/about page)
  instagram_url: {
    label: 'Instagram URL',
    description: 'Full URL to your Instagram profile page',
    type: 'url',
    required: false,
    defaultValue: 'https://instagram.com/yestoryd',
  },
  facebook_url: {
    label: 'Facebook URL',
    description: 'Full URL to your Facebook business page',
    type: 'url',
    required: false,
    defaultValue: '',
  },
  youtube_url: {
    label: 'YouTube URL',
    description: 'Full URL to your YouTube channel',
    type: 'url',
    required: false,
    defaultValue: '',
  },
  
  // Content/Stats - OPTIONAL (homepage social proof)
  total_assessments: {
    label: 'Total Assessments',
    description: 'Number of assessments completed (shown on homepage hero)',
    required: false,
    defaultValue: '1000+',
  },
  happy_parents: {
    label: 'Happy Parents',
    description: 'Count of satisfied parents (shown on homepage)',
    required: false,
    defaultValue: '500+',
  },
  success_rate: {
    label: 'Success Rate',
    description: 'Percentage of children showing improvement',
    unit: '%',
    required: false,
    defaultValue: '95',
  },
  average_improvement: {
    label: 'Average Improvement',
    description: 'Average reading improvement multiplier (e.g., "2x")',
    required: false,
    defaultValue: '2x',
  },
  
  // Coach - REQUIRED (used in book page, emails, calendar)
  default_coach_name: {
    label: 'Coach Name',
    description: 'Name displayed on book page and emails',
    required: true,
    defaultValue: 'Rucha',
  },
  default_coach_title: {
    label: 'Coach Title',
    description: 'Professional title (e.g., "Founder & Lead Reading Coach")',
    required: false,
    defaultValue: 'Founder & Lead Reading Coach',
  },
  default_coach_experience: {
    label: 'Experience',
    description: 'Years of experience (e.g., "10+ years")',
    required: false,
    defaultValue: '10+ years',
  },
  default_coach_rating: {
    label: 'Rating',
    description: 'Average rating out of 5 stars',
    required: false,
    defaultValue: '4.9',
  },
  default_coach_students: {
    label: 'Students Taught',
    description: 'Number of students coached (e.g., "500+")',
    required: false,
    defaultValue: '500+',
  },
  default_coach_phone: {
    label: 'Coach Phone',
    description: 'Direct phone number for the coach',
    type: 'tel',
    required: true,
    defaultValue: '+918976287997',
  },
  default_coach_email: {
    label: 'Coach Email',
    description: 'Coach email for calendar invites and communication',
    type: 'email',
    required: true,
    defaultValue: 'rucha.rai@yestoryd.com',
  },
  default_coach_bio: {
    label: 'Coach Bio',
    description: 'Short biography displayed on book page',
    type: 'textarea',
    required: false,
    defaultValue: 'Passionate about helping children discover the joy of reading through personalized coaching.',
  },
  
  // Program - REQUIRED (used in scheduling, session creation)
  program_duration_months: {
    label: 'Program Duration',
    description: 'Total length of the coaching program',
    unit: 'months',
    required: true,
    defaultValue: '3',
  },
  total_sessions: {
    label: 'Total Sessions',
    description: 'Total number of sessions in the program (coaching + parent meetings)',
    unit: 'sessions',
    required: true,
    defaultValue: '9',
  },
  coaching_sessions: {
    label: 'Coaching Sessions',
    description: 'Number of one-on-one coaching sessions with child',
    unit: 'sessions',
    required: true,
    defaultValue: '6',
  },
  parent_meetings: {
    label: 'Parent Meetings',
    description: 'Number of parent check-in meetings',
    unit: 'meetings',
    required: true,
    defaultValue: '3',
  },
  coaching_duration_minutes: {
    label: 'Coaching Duration',
    description: 'Length of each coaching session',
    unit: 'minutes',
    required: true,
    defaultValue: '45',
  },
  parent_meeting_duration_minutes: {
    label: 'Parent Meeting Duration',
    description: 'Length of each parent check-in',
    unit: 'minutes',
    required: true,
    defaultValue: '15',
  },
  
  // Booking - REQUIRED for discovery call feature
  cal_username: {
    label: 'Cal.com Username',
    description: 'Your Cal.com account username (appears in booking URLs like cal.com/USERNAME)',
    required: true,
    defaultValue: 'yestoryd',
  },
  cal_discovery_slug: {
    label: 'Discovery Call Slug',
    description: 'URL slug for free discovery call booking. Full URL becomes: cal.com/yestoryd/SLUG',
    required: true,
    defaultValue: 'discovery',
  },
};

// Feature flag descriptions
const FLAG_META: Record<string, { label: string; description: string }> = {
  show_free_trial: {
    label: 'Show Free Trial Option',
    description: 'Display the free trial/discovery call option on the book page',
  },
  enable_razorpay: {
    label: 'Enable Payments',
    description: 'Allow users to complete payments via Razorpay',
  },
  enable_whatsapp_notifications: {
    label: 'WhatsApp Notifications',
    description: 'Send automated WhatsApp messages for reminders and updates',
  },
  enable_email_notifications: {
    label: 'Email Notifications',
    description: 'Send automated emails for confirmations and reminders',
  },
  enable_session_recordings: {
    label: 'Session Recordings',
    description: 'Record coaching sessions via tl;dv integration',
  },
  maintenance_mode: {
    label: 'Maintenance Mode',
    description: 'Show maintenance page to all visitors (use for deployments)',
  },
  show_testimonials: {
    label: 'Show Testimonials',
    description: 'Display testimonial section on homepage',
  },
  enable_google_signin: {
    label: 'Google Sign-In',
    description: 'Allow parents to sign in with Google on assessment page',
  },
};

// ==================== MAIN COMPONENT ====================
export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [settingsRes, testimonialsRes, pricingRes, flagsRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/testimonials'),
        fetch('/api/admin/pricing'),
        fetch('/api/admin/features'),
      ]);

      if (settingsRes.ok) setSettings((await settingsRes.json()).settings || []);
      if (testimonialsRes.ok) setTestimonials((await testimonialsRes.json()).testimonials || []);
      if (pricingRes.ok) setPricingPlans((await pricingRes.json()).plans || []);
      if (flagsRes.ok) setFeatureFlags((await flagsRes.json()).flags || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = (key: string, newValue: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
  };

  const saveSetting = async (key: string, value: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const toggleFeatureFlag = async (flagKey: string, newValue: boolean) => {
    setFeatureFlags(prev => prev.map(f => f.flag_key === flagKey ? { ...f, flag_value: newValue } : f));
    try {
      await fetch('/api/admin/features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag_key: flagKey, flag_value: newValue }),
      });
    } catch (error) {
      console.error('Failed to update flag:', error);
    }
  };

  const updatePricing = async (plan: PricingPlan) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
      });
      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const deleteTestimonial = async (id: string) => {
    if (!confirm('Delete this testimonial?')) return;
    try {
      await fetch(`/api/admin/testimonials?id=${id}`, { method: 'DELETE' });
      setTestimonials(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const saveTestimonial = async (testimonial: Testimonial) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/testimonials', {
        method: testimonial.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testimonial),
      });
      if (res.ok) {
        fetchAllData();
        setEditingTestimonial(null);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  // Group settings by category
  const settingsByCategory = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) acc[setting.category] = [];
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, SiteSetting[]>);

  const tabs = [
    { id: 'general' as TabType, label: 'General', icon: Settings, count: settings.length },
    { id: 'pricing' as TabType, label: 'Pricing', icon: IndianRupee, count: pricingPlans.length },
    { id: 'testimonials' as TabType, label: 'Testimonials', icon: MessageSquare, count: testimonials.length },
    { id: 'features' as TabType, label: 'Features', icon: ToggleLeft, count: featureFlags.length },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ==================== HEADER ==================== */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Title */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Site Settings</h1>
                <p className="text-xs text-slate-500">Manage dynamic content without code changes</p>
              </div>
            </div>

            {/* Status & Actions */}
            <div className="flex items-center gap-4">
              {saveStatus === 'success' && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-right-2">
                  <CheckCircle className="w-4 h-4" />
                  Saved
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Error
                </div>
              )}
              <button
                onClick={fetchAllData}
                className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                title="Refresh data"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* ==================== TABS ==================== */}
        <div className="flex items-center gap-1 p-1 bg-white rounded-2xl border border-slate-200 shadow-sm mb-8 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-blue-500 text-blue-100' : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ==================== GENERAL SETTINGS TAB ==================== */}
        {activeTab === 'general' && (
          <div className="space-y-8">
            <SettingsSection
              title="Contact Information"
              description="How parents can reach you for support"
              icon={Phone}
              iconColor="blue"
              settings={settingsByCategory['contact'] || []}
              onUpdate={updateSetting}
              onSave={saveSetting}
              saving={saving}
            />

            <SettingsSection
              title="Social Media Links"
              description="Your social media profiles for marketing"
              icon={Instagram}
              iconColor="pink"
              settings={settingsByCategory['social'] || []}
              onUpdate={updateSetting}
              onSave={saveSetting}
              saving={saving}
            />

            <SettingsSection
              title="Homepage Statistics"
              description="Social proof numbers displayed on homepage"
              icon={BarChart3}
              iconColor="emerald"
              settings={settingsByCategory['content'] || []}
              onUpdate={updateSetting}
              onSave={saveSetting}
              saving={saving}
            />

            <SettingsSection
              title="Default Coach Profile"
              description="Information about Rucha displayed on book page"
              icon={Users}
              iconColor="violet"
              settings={settingsByCategory['coach'] || []}
              onUpdate={updateSetting}
              onSave={saveSetting}
              saving={saving}
            />

            <SettingsSection
              title="Program Configuration"
              description="Session counts and durations for the coaching program"
              icon={BookOpen}
              iconColor="amber"
              settings={settingsByCategory['program'] || []}
              onUpdate={updateSetting}
              onSave={saveSetting}
              saving={saving}
            />

            <SettingsSection
              title="Booking Configuration"
              description="Cal.com settings for scheduling discovery calls"
              icon={Calendar}
              iconColor="cyan"
              settings={settingsByCategory['booking'] || []}
              onUpdate={updateSetting}
              onSave={saveSetting}
              saving={saving}
            />
          </div>
        )}

        {/* ==================== PRICING TAB ==================== */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            {pricingPlans.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                onUpdate={(updatedPlan) => {
                  setPricingPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
                }}
                onSave={updatePricing}
                saving={saving}
              />
            ))}
          </div>
        )}

        {/* ==================== TESTIMONIALS TAB ==================== */}
        {activeTab === 'testimonials' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Testimonials</h2>
                <p className="text-sm text-slate-500">Manage parent reviews shown on homepage</p>
              </div>
              <button
                onClick={() => setEditingTestimonial({
                  id: '',
                  parent_name: '',
                  parent_location: '',
                  child_name: '',
                  child_age: 6,
                  testimonial_text: '',
                  rating: 5,
                  image_url: null,
                  is_featured: false,
                  is_active: true,
                  display_order: testimonials.length + 1,
                })}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
              >
                <Plus className="w-4 h-4" />
                Add Testimonial
              </button>
            </div>

            <div className="grid gap-4">
              {testimonials.map((testimonial) => (
                <TestimonialCard
                  key={testimonial.id}
                  testimonial={testimonial}
                  onEdit={() => setEditingTestimonial(testimonial)}
                  onDelete={() => deleteTestimonial(testimonial.id)}
                />
              ))}
            </div>

            {editingTestimonial && (
              <TestimonialModal
                testimonial={editingTestimonial}
                onClose={() => setEditingTestimonial(null)}
                onSave={saveTestimonial}
                saving={saving}
              />
            )}
          </div>
        )}

        {/* ==================== FEATURE FLAGS TAB ==================== */}
        {activeTab === 'features' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Feature Flags</h2>
              <p className="text-sm text-slate-500 mt-1">Toggle platform features on/off instantly</p>
            </div>
            <div className="divide-y divide-slate-100">
              {featureFlags.map((flag) => {
                const meta = FLAG_META[flag.flag_key] || { label: flag.flag_key, description: flag.description };
                return (
                  <div key={flag.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex-1 pr-8">
                      <p className="font-medium text-slate-900">{meta.label}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{meta.description}</p>
                    </div>
                    <button
                      onClick={() => toggleFeatureFlag(flag.flag_key, !flag.flag_value)}
                      className={`relative w-14 h-8 rounded-full transition-colors ${
                        flag.flag_value ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${
                          flag.flag_value ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== SETTINGS SECTION COMPONENT ====================
function SettingsSection({
  title,
  description,
  icon: Icon,
  iconColor,
  settings,
  onUpdate,
  onSave,
  saving,
}: {
  title: string;
  description: string;
  icon: any;
  iconColor: string;
  settings: SiteSetting[];
  onUpdate: (key: string, value: string) => void;
  onSave: (key: string, value: string) => void;
  saving: boolean;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    pink: 'bg-pink-100 text-pink-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    violet: 'bg-violet-100 text-violet-600',
    amber: 'bg-amber-100 text-amber-600',
    cyan: 'bg-cyan-100 text-cyan-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colorClasses[iconColor]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="p-6 space-y-5">
        {settings.map((setting) => {
          const meta = FIELD_META[setting.key] || { 
            label: formatKey(setting.key), 
            description: setting.description || '' 
          };
          const value = parseValue(setting.value);

          return (
            <div key={setting.key} className="group">
              {/* Label & Description */}
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium text-slate-700">{meta.label}</label>
                {meta.unit && (
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    {meta.unit}
                  </span>
                )}
                {/* Required/Optional Badge */}
                {meta.required !== undefined && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    meta.required 
                      ? 'bg-red-50 text-red-600' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {meta.required ? 'Required' : 'Optional'}
                  </span>
                )}
              </div>
              {meta.description && (
                <p className="text-xs text-slate-400 mb-2">{meta.description}</p>
              )}

              {/* Input */}
              <div className="flex gap-3">
                {meta.type === 'textarea' ? (
                  <textarea
                    value={value}
                    onChange={(e) => onUpdate(setting.key, JSON.stringify(e.target.value))}
                    rows={3}
                    placeholder={meta.defaultValue || ''}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                  />
                ) : (
                  <div className="flex-1 relative">
                    {meta.unit === '₹' && (
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                    )}
                    <input
                      type={meta.type || 'text'}
                      value={value}
                      onChange={(e) => onUpdate(setting.key, JSON.stringify(e.target.value))}
                      placeholder={meta.defaultValue || ''}
                      className={`w-full py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${
                        meta.unit === '₹' ? 'pl-8 pr-4' : 'px-4'
                      }`}
                    />
                    {meta.unit && meta.unit !== '₹' && meta.unit !== '%' && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                        {meta.unit}
                      </span>
                    )}
                    {meta.unit === '%' && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => onSave(setting.key, setting.value)}
                  disabled={saving}
                  className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-blue-600 hover:text-white disabled:opacity-50 transition-all group-hover:bg-blue-50 group-hover:text-blue-600"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== PRICING CARD COMPONENT ====================
function PricingCard({
  plan,
  onUpdate,
  onSave,
  saving,
}: {
  plan: PricingPlan;
  onUpdate: (plan: PricingPlan) => void;
  onSave: (plan: PricingPlan) => void;
  saving: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <IndianRupee className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{plan.name}</h3>
            <p className="text-sm text-slate-500">Slug: {plan.slug}</p>
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
          plan.is_active 
            ? 'bg-emerald-100 text-emerald-700' 
            : 'bg-slate-100 text-slate-600'
        }`}>
          {plan.is_active ? '● Active' : '○ Inactive'}
        </span>
      </div>

      {/* Fields */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Original Price */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              Original Price
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">₹</span>
            </label>
            <p className="text-xs text-slate-400 mb-2">Price before discount (strikethrough)</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
              <input
                type="number"
                value={plan.original_price}
                onChange={(e) => onUpdate({ ...plan, original_price: Number(e.target.value) })}
                className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
            </div>
          </div>

          {/* Discounted Price */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              Discounted Price
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">₹</span>
            </label>
            <p className="text-xs text-slate-400 mb-2">Final price customer pays</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-medium">₹</span>
              <input
                type="number"
                value={plan.discounted_price}
                onChange={(e) => onUpdate({ ...plan, discounted_price: Number(e.target.value) })}
                className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
            </div>
          </div>

          {/* Discount Label */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Discount Label</label>
            <p className="text-xs text-slate-400 mb-2">Badge text (e.g., "SAVE 40%")</p>
            <input
              type="text"
              value={plan.discount_label}
              onChange={(e) => onUpdate({ ...plan, discount_label: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              Duration
              <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">months</span>
            </label>
            <p className="text-xs text-slate-400 mb-2">Length of the coaching program</p>
            <input
              type="number"
              value={plan.duration_months}
              onChange={(e) => onUpdate({ ...plan, duration_months: Number(e.target.value) })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>

          {/* Sessions */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              Sessions Included
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">sessions</span>
            </label>
            <p className="text-xs text-slate-400 mb-2">Total sessions in package</p>
            <input
              type="number"
              value={plan.sessions_included}
              onChange={(e) => onUpdate({ ...plan, sessions_included: Number(e.target.value) })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>

          {/* Offer Valid Until */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Offer Valid Until</label>
            <p className="text-xs text-slate-400 mb-2">Discount expiration date</p>
            <input
              type="date"
              value={plan.offer_valid_until?.split('T')[0] || ''}
              onChange={(e) => onUpdate({ ...plan, offer_valid_until: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
        <button
          onClick={() => onSave(plan)}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/25"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ==================== TESTIMONIAL CARD COMPONENT ====================
function TestimonialCard({
  testimonial,
  onEdit,
  onDelete,
}: {
  testimonial: Testimonial;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {testimonial.parent_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{testimonial.parent_name}</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 text-sm">{testimonial.parent_location}</span>
                {testimonial.is_featured && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                    ★ Featured
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Parent of {testimonial.child_name}, {testimonial.child_age} years old
              </p>
            </div>
          </div>
          <p className="text-slate-600 leading-relaxed">{testimonial.testimonial_text}</p>
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-1 text-amber-500">
              {[...Array(testimonial.rating)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400" />
              ))}
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              testimonial.is_active 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-slate-100 text-slate-500'
            }`}>
              {testimonial.is_active ? 'Active' : 'Hidden'}
            </span>
            <span className="text-slate-400">Order: {testimonial.display_order}</span>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== TESTIMONIAL MODAL COMPONENT ====================
function TestimonialModal({
  testimonial,
  onClose,
  onSave,
  saving,
}: {
  testimonial: Testimonial;
  onClose: () => void;
  onSave: (testimonial: Testimonial) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(testimonial);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {testimonial.id ? 'Edit Testimonial' : 'Add New Testimonial'}
          </h3>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Parent Name</label>
              <input
                type="text"
                value={form.parent_name}
                onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
                placeholder="e.g., Priya Sharma"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Location</label>
              <input
                type="text"
                value={form.parent_location}
                onChange={(e) => setForm({ ...form, parent_location: e.target.value })}
                placeholder="e.g., Mumbai"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Child Name</label>
              <input
                type="text"
                value={form.child_name}
                onChange={(e) => setForm({ ...form, child_name: e.target.value })}
                placeholder="e.g., Aarav"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                Child Age
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">years</span>
              </label>
              <input
                type="number"
                value={form.child_age}
                onChange={(e) => setForm({ ...form, child_age: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Testimonial Text</label>
            <p className="text-xs text-slate-400 mb-2">The parent's review in their own words</p>
            <textarea
              value={form.testimonial_text}
              onChange={(e) => setForm({ ...form, testimonial_text: e.target.value })}
              rows={4}
              placeholder="Share the parent's experience with Yestoryd..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Rating</label>
              <select
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              >
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>{'★'.repeat(r)} {r} Stars</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Display Order</label>
              <input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Featured</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/25"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Testimonial'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== HELPER FUNCTIONS ====================
function formatKey(key: string): string {
  return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function parseValue(value: string): string {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : value;
  } catch {
    return value;
  }
}
