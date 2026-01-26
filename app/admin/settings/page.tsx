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
  ChevronDown,
  Search,
  BarChart3,
  Video,
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
const FIELD_META: Record<string, { 
  label: string; 
  description: string; 
  unit?: string; 
  type?: string;
  required: boolean;
  defaultValue?: string;
}> = {
  // Pricing - REQUIRED
  free_assessment_worth: {
    label: 'Free Assessment Value',
    description: 'Displayed value of the free assessment',
    unit: '₹',
    required: true,
    defaultValue: '999',
  },
  default_discount_percent: {
    label: 'Default Discount',
    description: 'Standard discount percentage',
    unit: '%',
    required: false,
    defaultValue: '40',
  },
  
  // Contact - REQUIRED
  whatsapp_number: {
    label: 'WhatsApp Number',
    description: 'Include country code (+91)',
    type: 'tel',
    required: true,
    defaultValue: '+918976287997',
  },
  support_email: {
    label: 'Support Email',
    description: 'Customer support email',
    type: 'email',
    required: true,
    defaultValue: 'engage@yestoryd.com',
  },
  support_phone: {
    label: 'Support Phone',
    description: 'Phone for calls',
    type: 'tel',
    required: false,
    defaultValue: '+918976287997',
  },
  
  // Social - OPTIONAL
  instagram_url: {
    label: 'Instagram URL',
    description: 'Instagram profile URL',
    type: 'url',
    required: false,
    defaultValue: 'https://instagram.com/yestoryd',
  },
  facebook_url: {
    label: 'Facebook URL',
    description: 'Facebook page URL',
    type: 'url',
    required: false,
    defaultValue: '',
  },
  youtube_url: {
    label: 'YouTube URL',
    description: 'YouTube channel URL',
    type: 'url',
    required: false,
    defaultValue: '',
  },
  
  // Content/Stats - OPTIONAL
  total_assessments: {
    label: 'Total Assessments',
    description: 'Homepage hero stat',
    required: false,
    defaultValue: '1000+',
  },
  happy_parents: {
    label: 'Happy Parents',
    description: 'Homepage stat',
    required: false,
    defaultValue: '500+',
  },
  success_rate: {
    label: 'Success Rate',
    description: 'Improvement percentage',
    unit: '%',
    required: false,
    defaultValue: '95',
  },
  average_improvement: {
    label: 'Avg Improvement',
    description: 'e.g., "2x"',
    required: false,
    defaultValue: '2x',
  },
  
  // Coach - REQUIRED
  default_coach_name: {
    label: 'Coach Name',
    description: 'Displayed on book page',
    required: true,
    defaultValue: 'Rucha',
  },
  default_coach_title: {
    label: 'Coach Title',
    description: 'Professional title',
    required: false,
    defaultValue: 'Founder & Lead Reading Coach',
  },
  default_coach_experience: {
    label: 'Experience',
    description: 'e.g., "10+ years"',
    required: false,
    defaultValue: '10+ years',
  },
  default_coach_rating: {
    label: 'Rating',
    description: 'Out of 5 stars',
    required: false,
    defaultValue: '4.9',
  },
  default_coach_students: {
    label: 'Students Taught',
    description: 'e.g., "500+"',
    required: false,
    defaultValue: '500+',
  },
  default_coach_phone: {
    label: 'Coach Phone',
    description: 'Direct phone',
    type: 'tel',
    required: true,
    defaultValue: '+918976287997',
  },
  default_coach_email: {
    label: 'Coach Email',
    description: 'For calendar invites',
    type: 'email',
    required: true,
    defaultValue: 'rucha.rai@yestoryd.com',
  },
  default_coach_bio: {
    label: 'Coach Bio',
    description: 'Short biography',
    type: 'textarea',
    required: false,
    defaultValue: 'Passionate about helping children discover the joy of reading.',
  },
  
  // Program - REQUIRED
  program_duration_months: {
    label: 'Program Duration',
    description: 'Total program length',
    unit: 'months',
    required: true,
    defaultValue: '3',
  },
  total_sessions: {
    label: 'Total Sessions',
    description: 'All sessions included',
    unit: 'sessions',
    required: true,
    defaultValue: '9',
  },
  coaching_sessions: {
    label: 'Coaching Sessions',
    description: '1-on-1 with child',
    unit: 'sessions',
    required: true,
    defaultValue: '6',
  },
  parent_meetings: {
    label: 'Parent Meetings',
    description: 'Parent check-ins',
    unit: 'meetings',
    required: true,
    defaultValue: '3',
  },
  coaching_duration_minutes: {
    label: 'Coaching Duration',
    description: 'Per session',
    unit: 'minutes',
    required: true,
    defaultValue: '45',
  },
  parent_meeting_duration_minutes: {
    label: 'Parent Meeting',
    description: 'Per check-in',
    unit: 'minutes',
    required: true,
    defaultValue: '15',
  },
  
  // Booking - REQUIRED
  cal_username: {
    label: 'Cal.com Username',
    description: 'Account username',
    required: true,
    defaultValue: 'yestoryd',
  },
  cal_discovery_slug: {
    label: 'Discovery Slug',
    description: 'Booking URL slug',
    required: true,
    defaultValue: 'discovery',
  },

  // Videos - Only the 4 we actually use
  homepage_story_video_url: {
    label: 'Homepage Video',
    description: 'Rucha\'s Story section. YouTube embed URL.',
    type: 'url',
    required: true,
    defaultValue: 'https://www.youtube.com/embed/Dz94bVuWH_A',
  },
  yestoryd_academy_video_url: {
    label: 'Academy Video',
    description: 'Coach recruitment page.',
    type: 'url',
    required: false,
    defaultValue: '',
  },
  parent_login_video_url: {
    label: 'Parent Login Video',
    description: 'Parent login page.',
    type: 'url',
    required: false,
    defaultValue: '',
  },
  coach_login_video_url: {
    label: 'Coach Login Video',
    description: 'Coach login page.',
    type: 'url',
    required: false,
    defaultValue: '',
  },
};

// Feature flag descriptions
const FLAG_META: Record<string, { label: string; description: string }> = {
  show_free_trial: {
    label: 'Free Trial Option',
    description: 'Show discovery call option',
  },
  enable_razorpay: {
    label: 'Enable Payments',
    description: 'Allow Razorpay payments',
  },
  enable_whatsapp_notifications: {
    label: 'WhatsApp Notifications',
    description: 'Send WhatsApp messages',
  },
  enable_email_notifications: {
    label: 'Email Notifications',
    description: 'Send automated emails',
  },
  enable_session_recordings: {
    label: 'Session Recordings',
    description: 'Record via tl;dv',
  },
  maintenance_mode: {
    label: 'Maintenance Mode',
    description: 'Show maintenance page',
  },
  show_testimonials: {
    label: 'Show Testimonials',
    description: 'Display on homepage',
  },
  enable_google_signin: {
    label: 'Google Sign-In',
    description: 'Allow Google auth',
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    contact: true,
    videos: true,
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);
    try {
      const [settingsRes, testimonialsRes, pricingRes, flagsRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/testimonials'),
        fetch('/api/admin/pricing'),
        fetch('/api/admin/feature-flags'),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings || []);
      }
      if (testimonialsRes.ok) {
        const data = await testimonialsRes.json();
        setTestimonials(data.testimonials || []);
      }
      if (pricingRes.ok) {
        const data = await pricingRes.json();
        setPricingPlans(data.plans || []);
      }
      if (flagsRes.ok) {
        const data = await flagsRes.json();
        setFeatureFlags(data.flags || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Group settings by category
  const settingsByCategory = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) acc[setting.category] = [];
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, SiteSetting[]>);

  // Filter settings based on search
  const filterSettings = (categorySettings: SiteSetting[]) => {
    if (!searchQuery) return categorySettings;
    return categorySettings.filter(s => {
      const meta = FIELD_META[s.key];
      const label = meta?.label || s.key;
      return label.toLowerCase().includes(searchQuery.toLowerCase()) ||
             s.key.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  function updateSetting(key: string, value: string) {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
  }

  async function saveSetting(key: string, value: string) {
    setSaving(true);
    setSaveStatus('idle');
    try {
      // Send raw value - API will handle JSONB encoding
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
  }

  async function updatePricing(plan: PricingPlan) {
    setSaving(true);
    try {
      await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }

  async function saveTestimonial(testimonial: Testimonial) {
    setSaving(true);
    try {
      const method = testimonial.id ? 'PUT' : 'POST';
      await fetch('/api/admin/testimonials', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testimonial),
      });
      await fetchAllData();
      setEditingTestimonial(null);
    } catch (error) {
      console.error('Failed to save testimonial:', error);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTestimonial(id: string) {
    if (!confirm('Delete this testimonial?')) return;
    try {
      await fetch(`/api/admin/testimonials?id=${id}`, { method: 'DELETE' });
      await fetchAllData();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }

  async function toggleFlag(flagKey: string, currentValue: boolean) {
    try {
      await fetch('/api/admin/feature-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag_key: flagKey, flag_value: !currentValue }),
      });
      setFeatureFlags(prev => prev.map(f => 
        f.flag_key === flagKey ? { ...f, flag_value: !currentValue } : f
      ));
    } catch (error) {
      console.error('Failed to toggle flag:', error);
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-text-secondary">Loading settings...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'pricing', label: 'Pricing', icon: IndianRupee },
    { id: 'testimonials', label: 'Reviews', icon: Star },
    { id: 'features', label: 'Features', icon: ToggleLeft },
  ];

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Header */}
      <div className="bg-surface-1 border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-500 rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Site Settings</h1>
                <p className="text-xs text-text-tertiary hidden sm:block">Manage content without code</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {saveStatus === 'success' && (
                <span className="flex items-center gap-1 text-emerald-600 text-sm">
                  <CheckCircle className="w-4 h-4" /> Saved
                </span>
              )}
              <button
                onClick={fetchAllData}
                className="p-2 hover:bg-surface-3 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-text-tertiary" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-surface-1 border-b border-border sticky top-[73px] z-30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-text-secondary hover:bg-surface-2'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Search - Only on General tab */}
        {activeTab === 'general' && (
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search settings..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface-2 border border-border text-white placeholder:text-text-muted rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* ==================== GENERAL SETTINGS TAB ==================== */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            <CollapsibleSection
              title="Contact Info"
              icon={Phone}
              iconColor="blue"
              expanded={expandedSections['contact']}
              onToggle={() => toggleSection('contact')}
              count={filterSettings(settingsByCategory['contact'] || []).length}
            >
              <SettingsGrid
                settings={filterSettings(settingsByCategory['contact'] || [])}
                onUpdate={updateSetting}
                onSave={saveSetting}
                saving={saving}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Video URLs"
              icon={Video}
              iconColor="rose"
              expanded={expandedSections['videos']}
              onToggle={() => toggleSection('videos')}
              count={filterSettings(settingsByCategory['videos'] || []).length}
            >
              <div className="mb-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-400">
                  <strong>Important:</strong> Use YouTube <strong>embed</strong> URL format:
                </p>
                <p className="text-xs text-amber-400/80 mt-1 font-mono">
                  https://www.youtube.com/embed/VIDEO_ID
                </p>
                <p className="text-xs text-amber-400/60 mt-1 font-mono">
                  Not: https://www.youtube.com/watch?v=VIDEO_ID
                </p>
              </div>
              <SettingsGrid
                settings={filterSettings(settingsByCategory['videos'] || [])}
                onUpdate={updateSetting}
                onSave={saveSetting}
                saving={saving}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Social Media"
              icon={Instagram}
              iconColor="pink"
              expanded={expandedSections['social']}
              onToggle={() => toggleSection('social')}
              count={filterSettings(settingsByCategory['social'] || []).length}
            >
              <SettingsGrid
                settings={filterSettings(settingsByCategory['social'] || [])}
                onUpdate={updateSetting}
                onSave={saveSetting}
                saving={saving}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Homepage Stats"
              icon={BarChart3}
              iconColor="emerald"
              expanded={expandedSections['content']}
              onToggle={() => toggleSection('content')}
              count={filterSettings(settingsByCategory['content'] || []).length}
            >
              <SettingsGrid
                settings={filterSettings(settingsByCategory['content'] || [])}
                onUpdate={updateSetting}
                onSave={saveSetting}
                saving={saving}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Coach Profile"
              icon={Users}
              iconColor="violet"
              expanded={expandedSections['coach']}
              onToggle={() => toggleSection('coach')}
              count={filterSettings(settingsByCategory['coach'] || []).length}
            >
              <SettingsGrid
                settings={filterSettings(settingsByCategory['coach'] || [])}
                onUpdate={updateSetting}
                onSave={saveSetting}
                saving={saving}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Program Config"
              icon={BookOpen}
              iconColor="amber"
              expanded={expandedSections['program']}
              onToggle={() => toggleSection('program')}
              count={filterSettings(settingsByCategory['program'] || []).length}
            >
              <SettingsGrid
                settings={filterSettings(settingsByCategory['program'] || [])}
                onUpdate={updateSetting}
                onSave={saveSetting}
                saving={saving}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Booking (Cal.com)"
              icon={Calendar}
              iconColor="cyan"
              expanded={expandedSections['booking']}
              onToggle={() => toggleSection('booking')}
              count={filterSettings(settingsByCategory['booking'] || []).length}
            >
              <SettingsGrid
                settings={filterSettings(settingsByCategory['booking'] || [])}
                onUpdate={updateSetting}
                onSave={saveSetting}
                saving={saving}
              />
            </CollapsibleSection>

            
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Testimonials</h2>
                <p className="text-sm text-text-tertiary">{testimonials.length} reviews</p>
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add</span>
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

        {/* ==================== FEATURES TAB ==================== */}
        {activeTab === 'features' && (
          <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <h2 className="font-semibold text-white">Feature Flags</h2>
              <p className="text-sm text-text-tertiary">Toggle features on/off</p>
            </div>
            <div className="divide-y divide-border">
              {featureFlags.map((flag) => {
                const meta = FLAG_META[flag.flag_key] || { label: flag.flag_key, description: '' };
                return (
                  <div key={flag.id} className="flex items-center justify-between p-4 hover:bg-surface-2">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="font-medium text-white text-sm">{meta.label}</p>
                      <p className="text-xs text-text-tertiary truncate">{meta.description}</p>
                    </div>
                    <button
                      onClick={() => toggleFlag(flag.flag_key, flag.flag_value)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                        flag.flag_value ? 'bg-blue-600' : 'bg-surface-3'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                          flag.flag_value ? 'translate-x-6' : 'translate-x-1'
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

// ==================== COLLAPSIBLE SECTION ====================
function CollapsibleSection({
  title,
  icon: Icon,
  iconColor,
  expanded,
  onToggle,
  count,
  children,
}: {
  title: string;
  icon: any;
  iconColor: string;
  expanded: boolean;
  onToggle: () => void;
  count: number;
  children: React.ReactNode;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-400',
    pink: 'bg-pink-500/20 text-pink-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    violet: 'bg-violet-500/20 text-violet-400',
    amber: 'bg-amber-500/20 text-amber-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    rose: 'bg-rose-500/20 text-rose-400',
  };

  return (
    <div className="bg-surface-1 rounded-xl border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorClasses[iconColor]}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-white text-sm">{title}</h3>
            <p className="text-xs text-text-tertiary">{count} items</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-text-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="border-t border-border/50 p-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ==================== SETTINGS GRID ====================
function SettingsGrid({
  settings,
  onUpdate,
  onSave,
  saving,
}: {
  settings: SiteSetting[];
  onUpdate: (key: string, value: string) => void;
  onSave: (key: string, value: string) => void;
  saving: boolean;
}) {
  if (settings.length === 0) {
    return <p className="text-sm text-text-tertiary text-center py-4">No settings found</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {settings.map((setting) => {
        const meta = FIELD_META[setting.key] || {
          label: formatKey(setting.key),
          description: ''
        };
        const value = parseValue(setting.value);

        return (
          <div key={setting.key} className="group">
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-sm font-medium text-text-secondary">{meta.label}</label>
              {meta.unit && (
                <span className="text-[10px] font-bold text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">
                  {meta.unit}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {meta.type === 'textarea' ? (
                <textarea
                  value={value}
                  onChange={(e) => onUpdate(setting.key, e.target.value)}
                  rows={2}
                  placeholder={meta.defaultValue || ''}
                  className="flex-1 px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-white placeholder:text-text-muted focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none resize-none"
                />
              ) : (
                <input
                  type={meta.type || 'text'}
                  value={value}
                  onChange={(e) => onUpdate(setting.key, e.target.value)}
                  placeholder={meta.defaultValue || ''}
                  className="flex-1 px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-white placeholder:text-text-muted focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none"
                />
              )}
              <button
                onClick={() => onSave(setting.key, value)}
                disabled={saving}
                className="px-3 py-2 bg-surface-2 text-text-tertiary rounded-lg hover:bg-blue-600 hover:text-white disabled:opacity-50 transition-all"
                title="Save"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==================== PRICING CARD ====================
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
    <div className="bg-surface-1 rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
            <IndianRupee className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{plan.name}</h3>
            <p className="text-xs text-text-tertiary">Slug: {plan.slug}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          plan.is_active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-surface-2 text-text-secondary'
        }`}>
          {plan.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-text-tertiary mb-1 block">Original</label>
            <input
              type="number"
              value={plan.original_price}
              onChange={(e) => onUpdate({ ...plan, original_price: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-white placeholder:text-text-muted"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-tertiary mb-1 block">Discounted</label>
            <input
              type="number"
              value={plan.discounted_price}
              onChange={(e) => onUpdate({ ...plan, discounted_price: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-white placeholder:text-text-muted"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-tertiary mb-1 block">Label</label>
            <input
              type="text"
              value={plan.discount_label}
              onChange={(e) => onUpdate({ ...plan, discount_label: e.target.value })}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-white placeholder:text-text-muted"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-tertiary mb-1 block">Sessions</label>
            <input
              type="number"
              value={plan.sessions_included}
              onChange={(e) => onUpdate({ ...plan, sessions_included: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-white placeholder:text-text-muted"
            />
          </div>
        </div>

        <button
          onClick={() => onSave(plan)}
          disabled={saving}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>
    </div>
  );
}

// ==================== TESTIMONIAL CARD ====================
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
    <div className="bg-surface-1 rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="font-semibold text-white text-sm">{testimonial.parent_name}</span>
            <span className="text-border">-</span>
            <span className="text-text-tertiary text-xs">{testimonial.parent_location}</span>
            {testimonial.is_featured && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium rounded-full">
                Featured
              </span>
            )}
          </div>
          <p className="text-text-secondary text-sm line-clamp-2">{testimonial.testimonial_text}</p>
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="text-amber-400">{'★'.repeat(testimonial.rating)}</span>
            <span className={`px-2 py-0.5 rounded-full ${
              testimonial.is_active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-surface-2 text-text-tertiary'
            }`}>
              {testimonial.is_active ? 'Active' : 'Hidden'}
            </span>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-2 text-text-tertiary hover:text-blue-400 hover:bg-blue-500/20 rounded-lg">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 text-text-tertiary hover:text-red-400 hover:bg-red-500/20 rounded-lg">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== TESTIMONIAL MODAL ====================
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
    <div className="fixed inset-0 bg-surface-0/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-white">
            {testimonial.id ? 'Edit' : 'Add'} Testimonial
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-2 rounded-lg">
            <X className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">Parent Name</label>
              <input
                type="text"
                value={form.parent_name}
                onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">Location</label>
              <input
                type="text"
                value={form.parent_location}
                onChange={(e) => setForm({ ...form, parent_location: e.target.value })}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">Child Name</label>
              <input
                type="text"
                value={form.child_name}
                onChange={(e) => setForm({ ...form, child_name: e.target.value })}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">Child Age</label>
              <input
                type="number"
                value={form.child_age}
                onChange={(e) => setForm({ ...form, child_age: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Testimonial</label>
            <textarea
              value={form.testimonial_text}
              onChange={(e) => setForm({ ...form, testimonial_text: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-white resize-none"
            />
          </div>

          <div className="flex items-center gap-4">
            <select
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
              className="px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-white"
            >
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>{'★'.repeat(r)}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              Active
            </label>
          </div>
        </div>

        <div className="p-4 bg-surface-2/50 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== HELPERS ====================
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

