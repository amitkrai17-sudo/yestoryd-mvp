'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import ParentLayout from '@/components/parent/ParentLayout';
import {
  MessageCircle,
  Mail,
  Phone,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  User,
  BookOpen,
  Clock,
  Calendar,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Coach {
  name: string;
  email: string;
  bio: string;
  phone: string;
}

const faqs = [
  {
    question: 'How do I join a session?',
    answer: 'Go to the Sessions page, find your upcoming session, and click the "Join" button. The button becomes active 10 minutes before the scheduled time. You\'ll be connected via Google Meet.'
  },
  {
    question: 'Can I reschedule a session?',
    answer: 'Yes! Contact your coach via WhatsApp at least 24 hours before the session to reschedule. They will coordinate a new time that works for both of you.'
  },
  {
    question: 'What if I miss a session?',
    answer: 'If you miss a session, contact your coach immediately. Depending on availability, they may be able to reschedule. Missed sessions without prior notice may not be rescheduled.'
  },
  {
    question: 'How is my child\'s progress measured?',
    answer: 'Progress is measured through reading assessments, session observations, and milestone achievements. You can view detailed progress reports in the Progress section.'
  },
  {
    question: 'What happens after the 3-month program?',
    answer: 'After completing the program, you\'ll receive a final assessment and recommendations. You can choose to continue with advanced coaching or transition to self-guided practice.'
  },
  {
    question: 'How do I contact Yestoryd support?',
    answer: 'You can reach us via email at hello@yestoryd.com or WhatsApp at +91 8976287997. We typically respond within 24 hours on business days.'
  },
];

export default function ParentSupportPage() {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [childName, setChildName] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/parent/login');
        return;
      }

      // Find parent record
      const { data: parentData } = await supabase
        .from('parents')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();

      let enrolledChild = null;

      // Find enrolled child by parent_id first
      if (parentData?.id) {
        const { data: childByParentId } = await supabase
          .from('children')
          .select('id, name')
          .eq('parent_id', parentData.id)
          .eq('lead_status', 'enrolled')
          .order('enrolled_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (childByParentId) {
          enrolledChild = childByParentId;
        }
      }

      // Fallback: try by parent_email
      if (!enrolledChild) {
        const { data: childByEmail } = await supabase
          .from('children')
          .select('id, name')
          .eq('parent_email', user.email)
          .eq('lead_status', 'enrolled')
          .order('enrolled_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (childByEmail) {
          enrolledChild = childByEmail;
        }
      }

      if (enrolledChild) {
        setChildName(enrolledChild.name || 'Your Child');

        // Get coach from enrollment
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select(`
            coaches (
              name,
              email,
              bio,
              phone
            )
          `)
          .eq('child_id', enrolledChild.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (enrollment?.coaches) {
          setCoach(enrollment.coaches);
        } else {
          // Default coach info
          setCoach({
            name: 'Rucha',
            email: 'rucha@yestoryd.com',
            bio: 'Certified reading coach with 5+ years of experience helping children improve their reading skills.',
            phone: '918976287997'
          });
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching support data:', error);
      setLoading(false);
    }
  }

  const coachPhone = coach?.phone || '918976287997';
  const coachName = coach?.name || 'Rucha';

  if (loading) {
    return (
      <ParentLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[#7b008b] border-t-transparent rounded-full animate-spin" />
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Support</h1>
          <p className="text-gray-500">Get help and contact us</p>
        </div>

        {/* Contact Cards */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Coach Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-[#7b008b]/5">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <User className="w-5 h-5 text-[#7b008b]" />
                Your Coach
              </h2>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-2xl text-white font-bold">
                    {coachName.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-800">{coachName}</p>
                  <p className="text-[#7b008b]">Reading Coach</p>
                </div>
              </div>
              {coach?.bio && (
                <p className="text-sm text-gray-500 mb-4">{coach.bio}</p>
              )}
              <div className="space-y-3">
                <a
                  href={`https://wa.me/${coachPhone}?text=Hi ${coachName}, I'm ${childName}'s parent. I have a question about the coaching sessions.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  WhatsApp Coach
                  <ExternalLink className="w-4 h-4" />
                </a>
                {coach?.email && (
                  <a
                    href={`mailto:${coach.email}?subject=Question about ${childName}'s sessions`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    <Mail className="w-5 h-5" />
                    Email Coach
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Yestoryd Support Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-[#7b008b]/5">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#7b008b]" />
                Yestoryd Support
              </h2>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <Image 
                  src="/images/logo.png" 
                  alt="Yestoryd" 
                  width={64} 
                  height={64}
                  className="w-16 h-16 object-contain"
                />
                <div>
                  <p className="text-lg font-semibold text-gray-800">Yestoryd Team</p>
                  <p className="text-[#7b008b]">We're here to help!</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <Clock className="w-4 h-4" />
                <span>Response time: Within 24 hours</span>
              </div>
              <div className="space-y-3">
                <a
                  href={`https://wa.me/918976287997?text=Hi Yestoryd team, I'm ${childName}'s parent. I need help with...`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  WhatsApp Support
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href="mailto:hello@yestoryd.com?subject=Support Request"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  hello@yestoryd.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
          <h2 className="font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Link
              href="/parent/sessions"
              className="flex items-center gap-3 p-4 bg-[#7b008b]/5 border border-[#7b008b]/10 rounded-xl hover:bg-[#7b008b]/10 transition-colors"
            >
              <Calendar className="w-6 h-6 text-[#7b008b]" />
              <div>
                <p className="font-medium text-gray-800">View Sessions</p>
                <p className="text-sm text-gray-500">Check your schedule</p>
              </div>
            </Link>
            <Link
              href="/parent/progress"
              className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl hover:bg-green-100 transition-colors"
            >
              <User className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-gray-800">View Progress</p>
                <p className="text-sm text-gray-500">Track improvements</p>
              </div>
            </Link>
            <Link
              href="/parent/dashboard"
              className="flex items-center gap-3 p-4 bg-[#ff0099]/5 border border-[#ff0099]/10 rounded-xl hover:bg-[#ff0099]/10 transition-colors"
            >
              <BookOpen className="w-6 h-6 text-[#ff0099]" />
              <div>
                <p className="font-medium text-gray-800">Dashboard</p>
                <p className="text-sm text-gray-500">Overview & stats</p>
              </div>
            </Link>
          </div>
        </div>

        {/* FAQs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#7b008b]" />
              Frequently Asked Questions
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {faqs.map((faq, index) => (
              <div key={index}>
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full p-5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-800 pr-4">{faq.question}</span>
                  {expandedFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-[#7b008b] flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === index && (
                  <div className="px-5 pb-5">
                    <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Urgent Help */}
        <div className="mt-6 p-5 bg-red-50 border border-red-200 rounded-2xl">
          <h3 className="font-semibold text-red-800 mb-2">Need Urgent Help?</h3>
          <p className="text-red-700 text-sm mb-3">
            For urgent matters related to scheduled sessions happening today:
          </p>
          <a
            href="tel:+918976287997"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            <Phone className="w-4 h-4" />
            Call +91 8976287997
          </a>
        </div>
      </div>
    </ParentLayout>
  );
}