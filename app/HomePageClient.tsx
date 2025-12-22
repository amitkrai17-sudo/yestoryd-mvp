'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  Users,
  Menu,
  X,
  CheckCircle,
  ArrowRight,
  Zap,
  LogIn,
  Award,
  BookOpen,
  Heart,
  Lightbulb,
  Microscope,
  MessageCircle,
  Play,
  Star,
  Clock,
  Shield,
  TrendingUp,
  Target,
  GraduationCap,
  Brain,
  Mic,
  BarChart3,
  Eye,
  Cpu,
  UserCheck,
  FileText,
  Bell,
  LineChart,
  Smile,
  Headphones,
  ClipboardCheck,
  XCircle,
} from 'lucide-react';

// ==================== TYPES ====================
interface StatsData {
  totalAssessments: string;
  happyParents: string;
  successRate: string;
  avgImprovement: string;
}

interface PricingData {
  originalPrice: number;
  discountedPrice: number;
  discountLabel: string;
  freeAssessmentWorth: string;
}

interface ContactData {
  whatsappNumber: string;
}

interface TestimonialData {
  id: string;
  testimonial_text: string;
  parent_name: string;
  parent_location?: string;
  child_name: string;
  child_age: number;
  rating: number;
}

interface HomePageClientProps {
  stats: StatsData;
  pricing: PricingData;
  contact: ContactData;
  testimonials: TestimonialData[];
  showTestimonials: boolean;
}

// ==================== TRIANGLE NODE DATA ====================
const triangleNodes = {
  rai: {
    id: 'rai',
    title: 'rAI',
    subtitle: 'The Brain',
    icon: Brain,
    color: '#00ABFF',
    bgColor: 'bg-[#00ABFF]',
    description: 'Our AI engine that powers personalized learning',
    features: [
      { icon: Mic, text: 'Analyzes reading in real-time' },
      { icon: Target, text: 'Identifies exact gaps & struggles' },
      { icon: FileText, text: 'Builds personalized curriculum' },
      { icon: LineChart, text: 'Tracks progress every session' },
      { icon: Cpu, text: 'Never misses a detail' },
    ],
  },
  coach: {
    id: 'coach',
    title: 'Coach',
    subtitle: 'The Heart',
    icon: Heart,
    color: '#FF0099',
    bgColor: 'bg-[#FF0099]',
    description: 'Certified experts who deliver with warmth',
    features: [
      { icon: UserCheck, text: '1-on-1 personalized sessions' },
      { icon: GraduationCap, text: 'Jolly Phonics certified' },
      { icon: Smile, text: 'Patient, encouraging, warm' },
      { icon: Headphones, text: 'Adapts to your child in real-time' },
      { icon: Award, text: 'Celebrates every small win' },
    ],
  },
  parent: {
    id: 'parent',
    title: 'Parent',
    subtitle: 'The Eyes',
    icon: Eye,
    color: '#7B008B',
    bgColor: 'bg-[#7B008B]',
    description: 'Full transparency — you see everything',
    features: [
      { icon: ClipboardCheck, text: 'Progress reports after every session' },
      { icon: Bell, text: 'Real-time updates on WhatsApp' },
      { icon: BarChart3, text: 'Visual dashboard of improvement' },
      { icon: MessageCircle, text: 'Direct chat with coach' },
      { icon: Eye, text: 'Never left in the dark' },
    ],
  },
};

// ==================== POPUP COMPONENT ====================
const TrianglePopup = ({ 
  node, 
  onClose 
}: { 
  node: typeof triangleNodes.rai | null; 
  onClose: () => void;
}) => {
  if (!node) return null;

  const IconComponent = node.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Popup */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div 
          className="p-6 text-white"
          style={{ backgroundColor: node.color }}
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <IconComponent className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">{node.title}</h3>
              <p className="text-white/80">{node.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 mb-6">{node.description}</p>
          
          <ul className="space-y-4">
            {node.features.map((feature, index) => {
              const FeatureIcon = feature.icon;
              return (
                <li key={index} className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${node.color}15` }}
                  >
                    <FeatureIcon 
                      className="w-5 h-5" 
                      style={{ color: node.color }}
                    />
                  </div>
                  <span className="text-gray-700 font-medium">{feature.text}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <Link
            href="/assessment"
            className="block w-full text-center py-3 rounded-xl font-bold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: node.color }}
            onClick={onClose}
          >
            Experience It Free →
          </Link>
        </div>
      </div>
    </div>
  );
};

// ==================== INTERACTIVE VENN DIAGRAM ====================
const InteractiveTriangle = ({ onNodeClick }: { onNodeClick: (nodeId: string) => void }) => {
  return (
    <div className="relative w-full max-w-[380px] mx-auto h-[320px] sm:h-[360px]">
      
      {/* SVG Venn Circles */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 380 360">
        {/* rAI circle - Top */}
        <circle 
          cx="190" cy="120" r="85" 
          fill="#00ABFF" 
          fillOpacity="0.15"
          stroke="#00ABFF"
          strokeWidth="3"
          className="cursor-pointer hover:fill-opacity-25 transition-all duration-300"
          onClick={() => onNodeClick('rai')}
        />
        
        {/* Coach circle - Bottom Left */}
        <circle 
          cx="130" cy="225" r="85" 
          fill="#FF0099" 
          fillOpacity="0.15"
          stroke="#FF0099"
          strokeWidth="3"
          className="cursor-pointer hover:fill-opacity-25 transition-all duration-300"
          onClick={() => onNodeClick('coach')}
        />
        
        {/* Parent circle - Bottom Right */}
        <circle 
          cx="250" cy="225" r="85" 
          fill="#7B008B" 
          fillOpacity="0.15"
          stroke="#7B008B"
          strokeWidth="3"
          className="cursor-pointer hover:fill-opacity-25 transition-all duration-300"
          onClick={() => onNodeClick('parent')}
        />
      </svg>

      {/* rAI label - Top */}
      <button
        onClick={() => onNodeClick('rai')}
        className="absolute top-2 left-1/2 -translate-x-1/2 group"
      >
        <div className="flex flex-col items-center">
          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-[#00ABFF] group-hover:scale-110 transition-transform">
            <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-[#00ABFF]" />
          </div>
          <p className="text-[#00ABFF] font-bold text-sm mt-1">rAI</p>
          <p className="text-gray-400 text-[10px]">The Brain</p>
        </div>
      </button>

      {/* Coach label - Bottom Left */}
      <button
        onClick={() => onNodeClick('coach')}
        className="absolute bottom-6 left-2 sm:left-4 group"
      >
        <div className="flex flex-col items-center">
          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-[#FF0099] group-hover:scale-110 transition-transform">
            <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-[#FF0099]" />
          </div>
          <p className="text-[#FF0099] font-bold text-sm mt-1">Coach</p>
          <p className="text-gray-400 text-[10px]">The Heart</p>
        </div>
      </button>

      {/* Parent label - Bottom Right */}
      <button
        onClick={() => onNodeClick('parent')}
        className="absolute bottom-6 right-2 sm:right-4 group"
      >
        <div className="flex flex-col items-center">
          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-[#7B008B] group-hover:scale-110 transition-transform">
            <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-[#7B008B]" />
          </div>
          <p className="text-[#7B008B] font-bold text-sm mt-1">Parent</p>
          <p className="text-gray-400 text-[10px]">The Eyes</p>
        </div>
      </button>

      {/* Center - Smiley (intersection) */}
      <div className="absolute top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-[#00ABFF]">
          <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-[#ff0099]" />
        </div>
        <p className="text-center text-[10px] font-semibold text-gray-600 mt-1">Confident<br/>Reader</p>
      </div>

      {/* Tap hint */}
      <p className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs text-gray-400">
        👆 Tap any circle for details
      </p>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
export default function HomePageClient({
  stats,
  pricing,
  contact,
  testimonials,
  showTestimonials,
}: HomePageClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [activePopup, setActivePopup] = useState<string | null>(null);

  const whatsappNumber = contact.whatsappNumber;
  const whatsappMessage = encodeURIComponent("Hi! I watched Rucha's video and I'm interested in the reading program for my child.");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % 4);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Close popup on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePopup(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when popup is open
  useEffect(() => {
    if (activePopup) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [activePopup]);

  const handleNodeClick = (nodeId: string) => {
    setActivePopup(nodeId);
  };

  // Default testimonials if none provided
  const displayTestimonials = testimonials.length > 0 ? testimonials : [
    { id: '1', testimonial_text: 'Aarav went from struggling with basic words to reading full sentences in 2 months. The phonics approach made all the difference.', parent_name: 'Priya S.', parent_location: 'Mumbai', child_name: 'Aarav', child_age: 6, rating: 5 },
    { id: '2', testimonial_text: 'My daughter now picks up books on her own. She actually ASKS to read before bed. Never thought I\'d see this day.', parent_name: 'Rahul G.', parent_location: 'Delhi', child_name: 'Ananya', child_age: 7, rating: 5 },
    { id: '3', testimonial_text: 'The AI assessment showed us exactly where Arjun was stuck. The coaches knew precisely what to work on. No guesswork.', parent_name: 'Sneha P.', parent_location: 'Bangalore', child_name: 'Arjun', child_age: 5, rating: 5 },
    { id: '4', testimonial_text: 'Ishaan was 2 grades behind in reading. After 3 months, his teacher asked what changed. Worth every rupee.', parent_name: 'Meera K.', parent_location: 'Pune', child_name: 'Ishaan', child_age: 8, rating: 5 },
  ];

  return (
    <div className="min-h-screen bg-white font-sans">
      
      {/* ==================== POPUP ====================  */}
      <TrianglePopup 
        node={activePopup ? triangleNodes[activePopup as keyof typeof triangleNodes] : null}
        onClose={() => setActivePopup(null)}
      />

      {/* ==================== HEADER ==================== */}
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
        {/* Top Bar */}
        <div className="bg-[#1a1a2e] text-white py-2 px-4 text-xs sm:text-sm">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <p className="opacity-90 flex items-center gap-2">
              <GraduationCap className="w-3 h-3 text-[#00abff]" />
              <span className="hidden sm:inline">Jolly Phonics Certified • 7 Years Experience</span>
              <span className="sm:hidden">Certified Phonics Expert</span>
            </p>
            <Link href="/yestoryd-academy" className="flex items-center gap-1 font-bold text-[#ff0099] hover:text-[#ff0099]/80 transition-colors">
              Become a Coach <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Main Nav */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <Link href="/" className="flex items-center">
              <Image src="/images/logo.png" alt="Yestoryd" width={140} height={40} className="h-8 lg:h-10 w-auto" />
            </Link>

            <nav className="hidden lg:flex items-center gap-6">
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">How It Works</a>
              <a href="#rucha-story" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">Our Story</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">Pricing</a>
              
              <div className="h-6 w-px bg-gray-200 mx-2"></div>
              
              <Link href="/parent/login" className="flex items-center gap-2 text-gray-900 font-bold hover:text-[#00abff] text-sm transition-colors">
                <LogIn className="w-4 h-4" /> Login
              </Link>
              <Link
                href="/assessment"
                className="h-11 inline-flex items-center justify-center gap-2 bg-[#ff0099] text-white px-6 rounded-full font-bold hover:bg-[#e6008a] hover:shadow-lg hover:shadow-[#ff0099]/20 hover:-translate-y-0.5 transition-all duration-200 text-sm"
              >
                Free Assessment
              </Link>
            </nav>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-gray-900">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 shadow-xl absolute w-full">
            <div className="px-4 py-6 space-y-4">
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block text-gray-800 font-semibold py-2">How It Works</a>
              <a href="#rucha-story" onClick={() => setMobileMenuOpen(false)} className="block text-gray-800 font-semibold py-2">Our Story</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-gray-800 font-semibold py-2">Pricing</a>
              <hr className="border-gray-100" />
              <Link href="/parent/login" onClick={() => setMobileMenuOpen(false)} className="block text-gray-600 py-2">Parent Login</Link>
              <Link href="/assessment" onClick={() => setMobileMenuOpen(false)} className="h-12 flex items-center justify-center gap-2 bg-[#ff0099] text-white rounded-full font-bold w-full mt-4">
                Take Free Assessment
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ==================== HERO WITH INTERACTIVE TRIANGLE ==================== */}
      <section className="pt-32 lg:pt-44 pb-16 lg:pb-24 bg-gradient-to-b from-[#FFF5F9] to-white relative overflow-hidden">
        {/* Background Blobs */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#00abff]/5 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/4"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#ff0099]/5 rounded-full blur-3xl -z-10 -translate-x-1/3 translate-y-1/4"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            
            {/* Left Content */}
            <div className="text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 mb-6 shadow-sm">
                <Heart className="w-3 h-3 text-[#ff0099] fill-[#ff0099]" />
                <span className="text-xs font-bold text-gray-600 tracking-wide uppercase">AI Brain + Human Heart</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-[1.1] mb-6">
                Reading is an Acquired Skill.{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff0099] to-[#7b008b]">We Make it Natural.</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg sm:text-xl text-gray-600 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
                Most tuition centers just practice "reading more." We use <strong className="text-gray-900">AI Diagnostics</strong> to find the gaps, and <strong className="text-gray-900">Expert Coaches</strong> to fix them with the <strong className="text-[#ff0099]">Science of Reading</strong>.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start mb-8">
                <Link
                  href="/assessment"
                  className="w-full sm:w-auto h-14 inline-flex items-center justify-center gap-2 bg-[#ff0099] text-white font-bold px-8 rounded-full hover:bg-[#e6008a] hover:scale-105 transition-all shadow-xl shadow-[#ff0099]/20 whitespace-nowrap"
                >
                  <Zap className="w-5 h-5" />
                  Free Assessment
                </Link>
                <a 
                  href="#rucha-story" 
                  className="flex items-center gap-2 text-gray-700 font-semibold hover:text-[#ff0099] transition-colors"
                >
                  <Play className="w-5 h-5" />
                  Watch Our Story
                </a>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-green-500" />
                  100% Free
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#00abff]" />
                  5 Minutes
                </span>
                <span className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-[#ffde00] fill-[#ffde00]" />
                  100+ Kids
                </span>
              </div>
            </div>

            {/* Right - Interactive Venn Diagram */}
            <div className="relative">
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-lg min-h-[340px] sm:min-h-[400px] flex items-center justify-center">
                <InteractiveTriangle onNodeClick={handleNodeClick} />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ==================== VALUE PROP STRIP ==================== */}
      <section className="py-6 bg-[#1a1a2e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div 
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleNodeClick('rai')}
            >
              <div className="flex items-center justify-center gap-2 text-[#00ABFF]">
                <Brain className="w-5 h-5" />
                <span className="font-bold text-sm sm:text-base">rAI</span>
              </div>
              <p className="text-white/60 text-xs sm:text-sm mt-1">Diagnoses & Personalizes</p>
            </div>
            <div 
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleNodeClick('coach')}
            >
              <div className="flex items-center justify-center gap-2 text-[#FF0099]">
                <Heart className="w-5 h-5" />
                <span className="font-bold text-sm sm:text-base">Coach</span>
              </div>
              <p className="text-white/60 text-xs sm:text-sm mt-1">Delivers with Warmth</p>
            </div>
            <div 
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleNodeClick('parent')}
            >
              <div className="flex items-center justify-center gap-2 text-[#7B008B]">
                <Eye className="w-5 h-5" />
                <span className="font-bold text-sm sm:text-base">Parent</span>
              </div>
              <p className="text-white/60 text-xs sm:text-sm mt-1">Sees Everything</p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== PROBLEM AWARENESS SECTION ==================== */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why Do So Many Children{' '}
              <span className="text-[#ff0099]">Struggle</span> with Reading?
            </h2>
            <p className="text-lg text-gray-600">
              Here's what most parents don't realize...
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* The Core Insight */}
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100">
              <div className="w-14 h-14 bg-[#ff0099]/10 rounded-2xl flex items-center justify-center mb-6">
                <Lightbulb className="w-7 h-7 text-[#ff0099]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Reading is a Skill — Like Swimming
              </h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                You wouldn't throw a child into a pool and expect them to swim. 
                Yet that's exactly what happens with reading. Schools expect children 
                to read, but rarely teach the <strong className="text-gray-900">science of reading</strong> — 
                how sounds form words, how words form meaning.
              </p>
              
              {/* ASER Stat */}
              <div className="bg-[#ff0099]/5 border border-[#ff0099]/20 rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#ff0099]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-6 h-6 text-[#ff0099]" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-[#ff0099] mb-1">50%</p>
                    <p className="text-sm text-gray-600">
                      of Grade 5 students in India cannot read a Grade 2 level text
                    </p>
                    <p className="text-xs text-gray-400 mt-1">— ASER 2023 Report</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Signs List */}
            <div className="space-y-4">
              <p className="text-sm font-semibold text-[#7b008b] uppercase tracking-wider mb-4">
                Does this sound familiar?
              </p>
              
              {[
                { emoji: '😰', text: 'Reads slowly and hesitantly, word by word' },
                { emoji: '😕', text: 'Struggles to understand what they just read' },
                { emoji: '😤', text: 'Avoids reading and makes excuses' },
                { emoji: '😔', text: 'Falling behind classmates in school' },
                { emoji: '😢', text: 'Losing confidence in themselves' },
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-[#ff0099]/30 hover:shadow-md transition-all"
                >
                  <span className="text-3xl">{item.emoji}</span>
                  <p className="text-gray-700 font-medium">{item.text}</p>
                </div>
              ))}

              <p className="text-gray-600 pt-4 text-center md:text-left">
                <strong className="text-gray-900">You're not alone.</strong> And it's not your child's fault.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== HOW IT WORKS ==================== */}
      <section id="how-it-works" className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-sm font-semibold text-[#ff0099] uppercase tracking-wider mb-4">
              The Yestoryd Method
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              AI Brain + Human Heart = <span className="text-[#00abff]">Confident Reader</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              See how rAI, Coach, and You work together
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 - rAI */}
            <div 
              className="relative cursor-pointer group"
              onClick={() => handleNodeClick('rai')}
            >
              <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-[#00ABFF]/20 hover:border-[#00ABFF] hover:shadow-xl transition-all h-full">
                <div className="absolute -top-4 left-8 w-10 h-10 bg-[#00ABFF] rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  1
                </div>
                <div className="w-16 h-16 bg-[#00ABFF]/10 rounded-2xl flex items-center justify-center mb-6 mt-4 group-hover:scale-110 transition-transform">
                  <Brain className="w-8 h-8 text-[#00ABFF]" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  rAI Diagnoses
                </h3>
                <p className="text-sm text-[#00ABFF] font-semibold mb-3">The Brain</p>
                <p className="text-gray-600 mb-4">
                  Our AI listens to your child read, analyzes 50+ parameters, and identifies exact gaps — fluency, pronunciation, speed.
                </p>
                <p className="text-sm text-[#00ABFF] font-medium group-hover:underline">
                  Tap to see features →
                </p>
              </div>
            </div>

            {/* Step 2 - Coach */}
            <div 
              className="relative cursor-pointer group"
              onClick={() => handleNodeClick('coach')}
            >
              <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-[#FF0099]/20 hover:border-[#FF0099] hover:shadow-xl transition-all h-full">
                <div className="absolute -top-4 left-8 w-10 h-10 bg-[#FF0099] rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  2
                </div>
                <div className="w-16 h-16 bg-[#FF0099]/10 rounded-2xl flex items-center justify-center mb-6 mt-4 group-hover:scale-110 transition-transform">
                  <Heart className="w-8 h-8 text-[#FF0099]" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Coach Delivers
                </h3>
                <p className="text-sm text-[#FF0099] font-semibold mb-3">The Heart</p>
                <p className="text-gray-600 mb-4">
                  Certified phonics experts take rAI's diagnosis and deliver personalized 1-on-1 sessions with patience and warmth.
                </p>
                <p className="text-sm text-[#FF0099] font-medium group-hover:underline">
                  Tap to see features →
                </p>
              </div>
            </div>

            {/* Step 3 - Parent */}
            <div 
              className="relative cursor-pointer group"
              onClick={() => handleNodeClick('parent')}
            >
              <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-[#7B008B]/20 hover:border-[#7B008B] hover:shadow-xl transition-all h-full">
                <div className="absolute -top-4 left-8 w-10 h-10 bg-[#7B008B] rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  3
                </div>
                <div className="w-16 h-16 bg-[#7B008B]/10 rounded-2xl flex items-center justify-center mb-6 mt-4 group-hover:scale-110 transition-transform">
                  <Eye className="w-8 h-8 text-[#7B008B]" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  You See Everything
                </h3>
                <p className="text-sm text-[#7B008B] font-semibold mb-3">The Eyes</p>
                <p className="text-gray-600 mb-4">
                  Full transparency — progress reports after every session, WhatsApp updates, visual dashboard. Never in the dark.
                </p>
                <p className="text-sm text-[#7B008B] font-medium group-hover:underline">
                  Tap to see features →
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <Link
              href="/assessment"
              className="inline-flex items-center gap-2 bg-[#ff0099] hover:bg-[#e6008a] text-white px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105 shadow-xl shadow-[#ff0099]/30 whitespace-nowrap"
            >
              Free Assessment
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="mt-4 text-sm text-gray-500">
              No commitment. See your child's reading level first.
            </p>
          </div>
        </div>
      </section>

      {/* ==================== THE TECH - RAG SECTION ==================== */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-sm font-semibold text-[#00abff] uppercase tracking-wider mb-4">
              The Tech
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why <span className="text-[#ff0099]">Expert Data</span> Matters
            </h2>
          </div>

          {/* Comparison Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
            {/* Generic AI Card */}
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 relative">
              <div className="absolute -top-3 left-6 bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
                ❌ Generic AI
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">ChatGPT, etc.</p>
                    <p className="text-sm text-gray-500">General Purpose AI</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-gray-600 text-sm leading-relaxed">
                    <span className="font-semibold text-gray-700">Guesses</span> based on the internet. 
                    No reading expertise. No understanding of phonics rules. 
                    May give incorrect or generic advice.
                  </p>
                </div>
              </div>
            </div>

            {/* Yestoryd RAG Card */}
            <div className="bg-gradient-to-br from-[#00abff]/5 to-[#ff0099]/5 rounded-2xl p-6 border-2 border-[#00abff] relative">
              <div className="absolute -top-3 left-6 bg-[#00abff] text-white px-3 py-1 rounded-full text-xs font-bold">
                ✓ Yestoryd RAG Engine
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[#00abff]/10 rounded-xl flex items-center justify-center">
                    <Brain className="w-6 h-6 text-[#00abff]" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">rAI Engine</p>
                    <p className="text-sm text-[#00abff]">Expert Knowledge AI</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-[#00abff]/20">
                  <p className="text-gray-600 text-sm leading-relaxed">
                    <span className="font-semibold text-[#00abff]">Consults our Expert Knowledge Base first.</span> 
                    Built on 7+ years of Rucha's phonics expertise. 
                    Never guesses — always references proven methods.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Process Flow */}
          <div className="max-w-3xl mx-auto">
            <p className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">
              The Process
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-8">
              <div className="bg-[#ff0099]/10 text-[#ff0099] px-4 py-2 rounded-full text-sm font-medium">
                Child Error
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300 hidden sm:block" />
              <div className="text-gray-300 sm:hidden">→</div>
              <div className="bg-[#00abff]/10 text-[#00abff] px-4 py-2 rounded-full text-sm font-medium">
                Check Expert DB
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300 hidden sm:block" />
              <div className="text-gray-300 sm:hidden">→</div>
              <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium">
                Perfect Fix ✓
              </div>
            </div>

            {/* Explanation */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-100">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-[#ff0099]/10 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-[#ff0099]" />
                  </div>
                </div>
                <div>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    <strong className="text-gray-900">Most AI makes things up.</strong> We couldn't risk that with your child's education.
                  </p>
                  <p className="text-gray-600 leading-relaxed mb-4">
                    That's why we built our system on <strong className="text-[#00abff]">RAG (Retrieval-Augmented Generation)</strong>. 
                    Imagine Yestoryd's AI as a librarian with a manual written by 
                    <strong className="text-[#ff0099]"> Rucha Rai (7+ years exp)</strong>.
                  </p>
                  <p className="text-gray-600 leading-relaxed">
                    When your child makes a mistake, the AI doesn't guess. It looks up the 
                    <strong className="text-gray-900"> exact page in our "Expert Manual"</strong> and tells the coach 
                    precisely which Phonics rule to practice.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== RUCHA'S STORY ==================== */}
      <section id="rucha-story" className="py-16 lg:py-24 bg-[#1a1a2e] text-white relative overflow-hidden">
        {/* Decorative Blurs */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#ff0099] blur-[100px] opacity-20"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#00abff] blur-[100px] opacity-20"></div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            
            {/* Video Side */}
            <div className="order-2 lg:order-1">
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl">
                {/* Rucha's YouTube Video */}
                <iframe
                  src="https://www.youtube.com/embed/Dz94bVuWH_A?rel=0&modestbranding=1"
                  title="Rucha's Story - Yestoryd"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            </div>

            {/* Story Content */}
            <div className="order-1 lg:order-2">
              <div className="inline-block bg-[#ff0099] text-white text-xs font-bold px-3 py-1 rounded-full mb-6">
                THE YESTORYD STORY
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-6 leading-tight">
                "I realized that <span className="text-[#ffde00]">love for stories</span> wasn't enough. Kids needed the <span className="text-[#00abff]">science of reading</span>."
              </h2>

              <div className="space-y-5 text-gray-300 leading-relaxed">
                <p>
                  Yestoryd started simply — I wanted to share the joy of storytelling with kids. 
                  But in my classes, I noticed a pattern. Kids loved the stories, but many couldn't 
                  <em> read</em> them.
                </p>
                <p>
                  They struggled with sounds, blending, and word composition. I realized that 
                  <strong className="text-white"> reading is not natural — it's an acquired skill</strong>.
                </p>
                <p>
                  I spent 7 years mastering <strong className="text-white">Jolly Phonics</strong> and 
                  <strong className="text-white"> Jolly Grammar</strong>. Now, with AI technology, we can 
                  diagnose reading gaps instantly — so coaches can focus purely on the child.
                </p>
              </div>

              {/* Credentials */}
              <div className="mt-8 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 bg-white/10 text-white/90 px-4 py-2 rounded-full text-sm font-medium border border-white/10">
                  <GraduationCap className="w-4 h-4 text-[#00abff]" />
                  Jolly Phonics Certified
                </span>
                <span className="inline-flex items-center gap-2 bg-white/10 text-white/90 px-4 py-2 rounded-full text-sm font-medium border border-white/10">
                  <Award className="w-4 h-4 text-[#ffde00]" />
                  7 Years Experience
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== TESTIMONIALS ==================== */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-sm font-semibold text-[#ff0099] uppercase tracking-wider mb-4">
              Parent Stories
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Real Results from Real Families
            </h2>
          </div>

          {/* Testimonial Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayTestimonials.slice(0, 4).map((testimonial, index) => (
              <div
                key={testimonial.id || index}
                className={`bg-white rounded-2xl p-6 shadow-lg border-2 transition-all ${
                  activeTestimonial === index
                    ? 'border-[#ff0099] shadow-[#ff0099]/10'
                    : 'border-transparent hover:border-gray-200'
                }`}
              >
                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-[#ffde00] fill-[#ffde00]" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                  "{testimonial.testimonial_text}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center text-white font-bold">
                    {testimonial.parent_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{testimonial.parent_name}</p>
                    <p className="text-xs text-gray-500">
                      {testimonial.parent_location && `${testimonial.parent_location} • `}
                      Parent of {testimonial.child_name}, {testimonial.child_age}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust Stats */}
          <div className="mt-12 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-[#ff0099]">100+</p>
              <p className="text-sm text-gray-500">Children Helped</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-[#00abff]">4.9/5</p>
              <p className="text-sm text-gray-500">Parent Rating</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-[#7b008b]">7 yrs</p>
              <p className="text-sm text-gray-500">Experience</p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== PRICING ==================== */}
      <section id="pricing" className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-sm font-semibold text-[#ff0099] uppercase tracking-wider mb-4">
              Simple Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Invest in Your Child's Reading Future
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Start free. Upgrade only when you're ready.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Assessment */}
            <div className="bg-gray-50 rounded-3xl p-6 sm:p-8 border-2 border-gray-200">
              <div className="mb-6">
                <span className="inline-block bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                  Start Here
                </span>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Free AI Assessment</h3>
                <p className="text-gray-600">See rAI in action — understand your child's reading level</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">₹0</span>
                <span className="text-gray-500 ml-2">forever free</span>
              </div>

              <ul className="space-y-3 mb-8">
                {[
                  'rAI analyzes reading in real-time',
                  'Clarity, Fluency & Speed scores',
                  'Personalized improvement tips',
                  'Instant digital certificate',
                  'No credit card required',
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3 text-gray-600">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href="/assessment"
                className="block w-full text-center bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-xl font-semibold transition-colors"
              >
                Take Free Assessment
              </Link>
            </div>

            {/* Coaching Program */}
            <div className="bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden">
              {/* Popular Badge */}
              <div className="sm:absolute sm:top-4 sm:right-4 bg-[#ffde00] text-gray-900 px-3 py-1 rounded-full text-sm font-bold inline-block mb-3 sm:mb-0">
                Most Popular
              </div>

              <div className="mb-6">
                <span className="inline-block bg-white/20 text-white px-3 py-1 rounded-full text-sm font-medium mb-4">
                  Complete Transformation
                </span>
                <h3 className="text-2xl font-bold mb-2">3-Month Coaching</h3>
                <p className="text-white/80">rAI + Coach + Parent — the complete triangle</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold">₹{pricing.discountedPrice?.toLocaleString() || '5,999'}</span>
                <span className="text-white/60 ml-2 line-through">₹{pricing.originalPrice?.toLocaleString() || '9,999'}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {[
                  'Everything in Free Assessment',
                  '6 expert coaching sessions (1-on-1)',
                  '3 parent progress check-ins',
                  'rAI-powered progress tracking',
                  'WhatsApp updates after each session',
                  'Visual progress dashboard',
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3 text-white/90">
                    <CheckCircle className="w-5 h-5 text-[#ffde00] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href="/lets-talk"
                className="block w-full text-center bg-white text-[#ff0099] py-4 rounded-xl font-bold hover:bg-gray-100 transition-colors"
              >
                Talk to Rucha First
              </Link>
              <p className="text-center text-white/60 text-sm mt-3">
                Free consultation • No pressure
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FINAL CTA ==================== */}
      <section className="py-16 lg:py-24 bg-gradient-to-br from-[#ff0099] to-[#7b008b] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Eye className="w-6 h-6 text-white" />
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            rAI Finds. Coach Fills. You See.<br />
            <span className="text-[#ffde00]">Your Child Reads.</span>
          </h2>

          <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            The complete triangle working together for your child's reading journey. 
            Start with a free assessment.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/assessment"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-[#ff0099] px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-100 transition-colors shadow-xl"
            >
              Free Assessment
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#25d366] text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-[#20bd5a] transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp Us
            </a>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-white/60 text-sm">
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              100% Free Assessment
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              5 Minutes Only
            </span>
            <span className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              Instant Results
            </span>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="bg-[#111111] text-white py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <Image src="/images/logo.png" alt="Yestoryd" width={120} height={36} className="h-8 w-auto mb-4 opacity-90" />
              <p className="text-gray-500 text-sm max-w-sm mb-4">
                AI-powered reading assessment and expert coaching for children aged 4-12. 
                rAI diagnoses. Coach delivers. You see everything.
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <GraduationCap className="w-4 h-4 text-[#00abff]" />
                Jolly Phonics & Grammar Certified
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4 text-gray-300">Quick Links</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/assessment" className="hover:text-[#ff0099] transition-colors">Free Assessment</Link></li>
                <li><a href="#how-it-works" className="hover:text-[#ff0099] transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="hover:text-[#ff0099] transition-colors">Pricing</a></li>
                <li><Link href="/lets-talk" className="hover:text-[#ff0099] transition-colors">Talk to Us</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4 text-gray-300">Access</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/parent/login" className="hover:text-[#ff0099] transition-colors">Parent Login</Link></li>
                <li><Link href="/coach/login" className="hover:text-[#ff0099] transition-colors">Coach Login</Link></li>
                <li><Link href="/yestoryd-academy" className="hover:text-[#ff0099] transition-colors">Become a Coach</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-600 text-sm">
              © {new Date().getFullYear()} Yestoryd. All rights reserved.
            </p>
            <p className="text-gray-600 text-sm">
              Made with ❤️ for young readers in India
            </p>
          </div>
        </div>
      </footer>

      {/* ==================== FLOATING WHATSAPP ==================== */}
      <a
        href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 sm:bottom-6 right-6 z-30 bg-[#25d366] p-3 rounded-full shadow-2xl hover:scale-110 transition-all duration-300 flex items-center gap-2 group"
      >
        <Image src="/images/rai-mascot.png" alt="Chat" width={40} height={40} className="w-8 h-8 rounded-full" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-in-out text-white font-bold whitespace-nowrap text-sm">
          Chat with Us
        </span>
      </a>

      {/* ==================== STICKY MOBILE CTA ==================== */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 sm:hidden z-30">
        <Link
          href="/assessment"
          className="block w-full text-center bg-[#ff0099] text-white py-3.5 rounded-xl font-bold shadow-lg"
        >
          Free Assessment
        </Link>
      </div>
    </div>
  );
}