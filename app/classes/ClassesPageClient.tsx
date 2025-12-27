// =============================================================================
// FILE: app/classes/ClassesPageClient.tsx
// PURPOSE: Client component for /classes page
// DESIGN: Yestoryd color scheme, AIDA + LIFT CRO principles
// CONTENT: All dynamic from site_settings (admin-manageable)
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Calendar, Users, Star, BookOpen, Sparkles, Trophy, Shield, 
  ChevronDown, Clock, MapPin, CheckCircle, ArrowRight, Play,
  Award, Heart, Zap
} from 'lucide-react';

// =============================================================================
// BRAND COLORS (Yestoryd Scheme)
// =============================================================================
const COLORS = {
  pink: '#ff0099',      // Primary CTA, highlights
  blue: '#00abff',      // Secondary accent
  yellow: '#ffde00',    // Highlights, badges
  purple: '#7b008b',    // Gradients, accents
  whatsapp: '#25D366',  // WhatsApp button
};

// =============================================================================
// TYPES
// =============================================================================
interface PageSettings {
  hero_badge: string;
  hero_title: string;
  hero_title_highlight: string;
  hero_subtitle: string;
  stats: Array<{ value: string; label: string; icon: string }>;
  benefits: Array<{ icon: string; title: string; description: string }>;
  faqs: Array<{ question: string; answer: string }>;
  cta_title: string;
  cta_subtitle: string;
  cta_primary: { text: string; link: string };
  cta_secondary: { text: string; link: string };
  trust_badges: Array<{ text: string; icon: string }>;
}

interface ClassType {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  price_inr: number;
  duration_minutes: number;
  age_min: number;
  age_max: number;
  icon_emoji: string;
  color_hex: string;
  is_featured: boolean;
  features: string[];
}

interface Session {
  id: string;
  title: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  maxParticipants: number;
  currentParticipants: number;
  spotsAvailable: number;
  priceInr: number;
  ageMin: number;
  ageMax: number;
  classType: {
    slug: string;
    name: string;
    icon_emoji: string;
    color_hex: string;
  } | null;
  instructor: {
    name: string;
    photo_url: string | null;
  } | null;
  book: {
    title: string;
    author: string;
    cover_image_url: string | null;
  } | null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

// Icon mapper for dynamic icons
function getIcon(iconName: string, className: string = 'w-5 h-5') {
  const icons: Record<string, any> = {
    calendar: Calendar,
    users: Users,
    star: Star,
    book: BookOpen,
    sparkles: Sparkles,
    trophy: Trophy,
    shield: Shield,
    badge: Award,
    heart: Heart,
    zap: Zap,
  };
  const Icon = icons[iconName] || Star;
  return <Icon className={className} />;
}

// =============================================================================
// COMPONENTS
// =============================================================================

// Trust Badge Component (LIFT: -Anxiety)
function TrustBadge({ text, icon }: { text: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full shadow-sm">
      <span className="text-[#ff0099]">{getIcon(icon, 'w-4 h-4')}</span>
      <span className="text-gray-700 text-sm font-medium">{text}</span>
    </div>
  );
}

// Stats Counter (LIFT: Value Proposition + Social Proof)
function StatCounter({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-2">
        <div className="p-3 bg-gradient-to-br from-[#ff0099]/10 to-[#7b008b]/10 rounded-xl">
          <span className="text-[#ff0099]">{getIcon(icon, 'w-6 h-6')}</span>
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-gray-600 text-sm">{label}</div>
    </div>
  );
}

// Class Type Card (AIDA: Interest)
function ClassTypeCard({ 
  classType, 
  isSelected, 
  onClick 
}: { 
  classType: ClassType; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative p-4 rounded-2xl border-2 transition-all duration-300 text-left w-full group ${
        isSelected 
          ? 'border-[#ff0099] bg-gradient-to-br from-pink-50 to-purple-50 shadow-lg shadow-pink-200/50 scale-[1.02]' 
          : 'border-gray-200 bg-white hover:border-[#ff0099]/50 hover:shadow-md'
      }`}
    >
      {/* Popular Badge */}
      {classType.is_featured && (
        <span className="absolute -top-2 -right-2 bg-gradient-to-r from-[#ffde00] to-[#ff0099] text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
          🔥 Popular
        </span>
      )}
      
      <div className="flex items-start gap-4">
        {/* Emoji Icon */}
        <div 
          className="text-4xl p-3 rounded-xl transition-transform group-hover:scale-110" 
          style={{ backgroundColor: `${classType.color_hex}15` }}
        >
          {classType.icon_emoji}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-lg mb-1">{classType.name}</h3>
          <p className="text-gray-600 text-sm line-clamp-2 mb-3">{classType.tagline}</p>
          
          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-gray-100 rounded-full text-gray-600">
              Ages {classType.age_min}-{classType.age_max}
            </span>
            <span className="px-2 py-1 bg-gray-100 rounded-full text-gray-600">
              {classType.duration_minutes} min
            </span>
            <span 
              className="px-2 py-1 rounded-full font-bold text-white"
              style={{ backgroundColor: classType.color_hex }}
            >
              ₹{classType.price_inr}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// Session Card (AIDA: Desire + Action)
function SessionCard({ session }: { session: Session }) {
  const isFull = session.spotsAvailable <= 0;
  const isAlmostFull = session.spotsAvailable <= 2 && session.spotsAvailable > 0;
  const colorHex = session.classType?.color_hex || COLORS.pink;
  
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group">
      {/* Header */}
      <div 
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${colorHex}, ${COLORS.purple})` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">{session.classType?.icon_emoji || '📚'}</span>
          <span className="text-white font-bold">
            {session.classType?.name || 'Group Class'}
          </span>
        </div>
        
        {/* Urgency Badge (LIFT: Urgency) */}
        {isFull ? (
          <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
            FULL - Join Waitlist
          </span>
        ) : isAlmostFull ? (
          <span className="bg-[#ffde00] text-gray-900 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
            🔥 Only {session.spotsAvailable} left!
          </span>
        ) : (
          <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
            {session.spotsAvailable} spots
          </span>
        )}
      </div>
      
      {/* Body */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-bold text-gray-900 text-xl mb-2">{session.title}</h3>
        
        {/* Date & Time */}
        <div className="flex items-center gap-4 text-gray-600 text-sm mb-4">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#ff0099]" />
            <span>{formatDate(session.scheduledDate)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#00abff]" />
            <span>{formatTime(session.scheduledTime)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#7b008b]" />
            <span>Ages {session.ageMin}-{session.ageMax}</span>
          </div>
        </div>
        
        {/* Book Preview (if applicable) */}
        {session.book && (
          <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3 mb-4 border border-amber-100">
            {session.book.cover_image_url ? (
              <Image 
                src={session.book.cover_image_url} 
                alt={session.book.title}
                width={48}
                height={64}
                className="rounded-lg shadow-md"
              />
            ) : (
              <div className="w-12 h-16 bg-amber-200 rounded-lg flex items-center justify-center text-2xl">
                📖
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-amber-700 text-xs font-semibold uppercase tracking-wide">📖 Featured Book</p>
              <p className="text-gray-900 font-bold truncate">{session.book.title}</p>
              <p className="text-gray-500 text-sm">by {session.book.author}</p>
            </div>
          </div>
        )}
        
        {/* Instructor */}
        {session.instructor && (
          <div className="flex items-center gap-3 mb-4">
            {session.instructor.photo_url ? (
              <Image 
                src={session.instructor.photo_url}
                alt={session.instructor.name}
                width={40}
                height={40}
                className="rounded-full border-2 border-[#ff0099]/20"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center text-white font-bold">
                {session.instructor.name.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-gray-500 text-xs">Led by</p>
              <p className="text-gray-900 font-semibold">{session.instructor.name}</p>
            </div>
          </div>
        )}
        
        {/* Price & CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div>
            <span className="text-3xl font-bold text-gray-900">₹{session.priceInr}</span>
            <span className="text-gray-500 text-sm ml-1">/ session</span>
          </div>
          
          {isFull ? (
            <button className="px-5 py-2.5 bg-gray-100 text-gray-500 rounded-xl font-bold text-sm cursor-not-allowed">
              Join Waitlist
            </button>
          ) : (
            <Link
              href={`/classes/register/${session.id}`}
              className="px-5 py-2.5 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-pink-300/50 transition-all flex items-center gap-2 group"
            >
              Register Now
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// Benefit Card (LIFT: Value Proposition)
function BenefitCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:border-[#ff0099]/20 transition-all group">
      <div className="w-14 h-14 bg-gradient-to-br from-[#ff0099]/10 to-[#7b008b]/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        <span className="text-[#ff0099]">{getIcon(icon, 'w-7 h-7')}</span>
      </div>
      <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// FAQ Item (LIFT: -Anxiety)
function FAQItem({ question, answer, isOpen, onToggle }: { 
  question: string; 
  answer: string; 
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900 pr-4">{question}</span>
        <ChevronDown 
          className={`w-5 h-5 text-[#ff0099] transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-gray-600 border-t border-gray-100 pt-3">
          {answer}
        </div>
      )}
    </div>
  );
}

// Empty State
function EmptyState({ selectedType, onClearFilter }: { selectedType: string | null; onClearFilter: () => void }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="text-7xl mb-6">📅</div>
      <h3 className="text-2xl font-bold text-gray-900 mb-3">No Upcoming Sessions</h3>
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        {selectedType 
          ? "No sessions scheduled for this class type yet. Try another class or check back soon!"
          : "New group classes are coming soon! Meanwhile, take our free assessment to start your child's reading journey."}
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/assessment"
          className="px-8 py-4 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-bold hover:shadow-lg hover:shadow-pink-300/50 transition-all flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5" />
          Take Free Assessment
        </Link>
        {selectedType && (
          <button 
            onClick={onClearFilter}
            className="px-8 py-4 border-2 border-[#ff0099] text-[#ff0099] rounded-xl font-bold hover:bg-pink-50 transition-all"
          >
            View All Classes
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function ClassesPageClient() {
  // State
  const [settings, setSettings] = useState<PageSettings | null>(null);
  const [classTypes, setClassTypes] = useState<ClassType[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedAge, setSelectedAge] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);

  // Fetch page settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/group-classes/page-settings');
        const data = await res.json();
        setSettings(data.settings);
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    }
    fetchSettings();
  }, []);

  // Fetch class types
  useEffect(() => {
    async function fetchClassTypes() {
      try {
        const res = await fetch('/api/group-classes');
        const data = await res.json();
        setClassTypes(data.classTypes || []);
      } catch (err) {
        console.error('Error fetching class types:', err);
      }
    }
    fetchClassTypes();
  }, []);

  // Fetch sessions
  useEffect(() => {
    async function fetchSessions() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedType) params.set('type', selectedType);
        if (selectedAge !== 'all') {
          const [min, max] = selectedAge.split('-');
          params.set('age_min', min);
          params.set('age_max', max);
        }
        
        const res = await fetch(`/api/group-classes/sessions?${params.toString()}`);
        const data = await res.json();
        setSessions(data.sessions || []);
      } catch (err) {
        console.error('Error fetching sessions:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, [selectedType, selectedAge]);

  // Loading state for settings
  if (!settings) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#ff0099] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading classes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ================================================================= */}
      {/* HERO SECTION (AIDA: Attention) */}
      {/* ================================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-br from-pink-50 via-white to-purple-50">
        {/* Background Decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#ff0099]/10 rounded-full blur-3xl" />
          <div className="absolute top-40 -left-40 w-80 h-80 bg-[#00abff]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-60 h-60 bg-[#ffde00]/10 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-6xl mx-auto px-4 pt-8 pb-12 sm:pt-16 sm:pb-20">
          {/* Breadcrumb */}
          <nav className="mb-8 text-sm">
            <Link href="/" className="text-gray-500 hover:text-[#ff0099] transition-colors">Home</Link>
            <span className="mx-2 text-gray-400">/</span>
            <span className="text-gray-900 font-medium">Group Classes</span>
          </nav>
          
          {/* Hero Content */}
          <div className="text-center mb-12">
            {/* Badge (AIDA: Attention grabber) */}
            <span className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#ffde00]/20 to-[#ff0099]/20 text-[#ff0099] rounded-full text-sm font-bold mb-6 border border-[#ff0099]/20">
              {settings.hero_badge}
            </span>
            
            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              {settings.hero_title}
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff0099] to-[#7b008b]">
                {settings.hero_title_highlight}
              </span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto mb-8 leading-relaxed">
              {settings.hero_subtitle}
            </p>
            
            {/* Trust Badges (LIFT: -Anxiety) */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
              {settings.trust_badges.map((badge, i) => (
                <TrustBadge key={i} text={badge.text} icon={badge.icon} />
              ))}
            </div>
          </div>
          
          {/* Stats Section (LIFT: Social Proof) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {settings.stats.map((stat, i) => (
              <StatCounter key={i} value={stat.value} label={stat.label} icon={stat.icon} />
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* CLASS TYPES SECTION (AIDA: Interest) */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Choose a Class Type</h2>
              <p className="text-gray-600 mt-1">Select the perfect class for your child</p>
            </div>
            {selectedType && (
              <button 
                onClick={() => setSelectedType(null)}
                className="text-[#ff0099] font-semibold hover:underline flex items-center gap-1"
              >
                Clear filter <span className="text-lg">×</span>
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {classTypes.map((ct) => (
              <ClassTypeCard
                key={ct.id}
                classType={ct}
                isSelected={selectedType === ct.slug}
                onClick={() => setSelectedType(selectedType === ct.slug ? null : ct.slug)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* SESSIONS SECTION (AIDA: Desire + Action) */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4">
          {/* Section Header with Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Upcoming Sessions
                {sessions.length > 0 && (
                  <span className="text-[#ff0099] ml-2">({sessions.length})</span>
                )}
              </h2>
              <p className="text-gray-600 mt-1">Book your child&apos;s spot now</p>
            </div>
            
            {/* Age Filter */}
            <div className="flex items-center gap-3 bg-gray-100 p-1 rounded-xl">
              <label className="text-sm text-gray-600 pl-3">Age:</label>
              <select
                value={selectedAge}
                onChange={(e) => setSelectedAge(e.target.value)}
                className="px-4 py-2 bg-white border-0 rounded-lg text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#ff0099]"
              >
                <option value="all">All Ages</option>
                <option value="4-6">4-6 years</option>
                <option value="6-8">6-8 years</option>
                <option value="8-10">8-10 years</option>
                <option value="10-12">10-12 years</option>
              </select>
            </div>
          </div>
          
          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
                  <div className="h-14 bg-gradient-to-r from-gray-200 to-gray-300" />
                  <div className="p-4">
                    <div className="h-6 bg-gray-200 rounded-lg mb-3 w-3/4" />
                    <div className="h-4 bg-gray-100 rounded-lg mb-6 w-1/2" />
                    <div className="h-24 bg-gray-100 rounded-xl mb-4" />
                    <div className="h-12 bg-gray-200 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Sessions Grid */}
          {!loading && sessions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
          
          {/* Empty State */}
          {!loading && sessions.length === 0 && (
            <EmptyState selectedType={selectedType} onClearFilter={() => setSelectedType(null)} />
          )}
        </div>
      </section>

      {/* ================================================================= */}
      {/* BENEFITS SECTION (LIFT: Value Proposition) */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16 bg-gradient-to-br from-gray-50 to-pink-50/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              Why Parents Love Our Group Classes
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              More than just reading sessions – we build confident, engaged readers
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {settings.benefits.map((benefit, i) => (
              <BenefitCard 
                key={i} 
                icon={benefit.icon} 
                title={benefit.title} 
                description={benefit.description} 
              />
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* CTA SECTION (AIDA: Action) */}
      {/* ================================================================= */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-[#ff0099] via-[#7b008b] to-[#00abff] relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur rounded-full text-white text-sm font-semibold mb-6">
            ✨ Special Offer for Enrolled Families
          </div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            {settings.cta_title}
          </h2>
          
          <p className="text-lg sm:text-xl text-white/90 mb-10 max-w-2xl mx-auto">
            {settings.cta_subtitle}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={settings.cta_primary.link}
              className="px-8 py-4 bg-white text-[#ff0099] rounded-xl font-bold text-lg hover:bg-gray-100 transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 group"
            >
              <Play className="w-5 h-5" />
              {settings.cta_primary.text}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href={settings.cta_secondary.link}
              className="px-8 py-4 border-2 border-white text-white rounded-xl font-bold text-lg hover:bg-white/10 transition-all"
            >
              {settings.cta_secondary.text}
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* FAQ SECTION (LIFT: -Anxiety) */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-600">
              Everything you need to know about our group classes
            </p>
          </div>
          
          <div className="space-y-3">
            {settings.faqs.map((faq, i) => (
              <FAQItem 
                key={i}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === i}
                onToggle={() => setOpenFAQ(openFAQ === i ? null : i)}
              />
            ))}
          </div>
          
          {/* Additional Help */}
          <div className="mt-10 text-center p-6 bg-gray-50 rounded-2xl">
            <p className="text-gray-600 mb-4">Still have questions?</p>
            <a
              href="https://wa.me/918976287997?text=Hi!%20I%20have%20a%20question%20about%20group%20classes"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-bold hover:bg-[#128C7E] transition-all"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}