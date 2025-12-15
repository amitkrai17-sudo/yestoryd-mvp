'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ParentLayout from '@/components/parent/ParentLayout';
import {
  MessageCircle,
  Phone,
  Mail,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Calendar,
  CreditCard,
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
    question: 'How do I reschedule a session?',
    answer: 'You can reschedule a session by contacting your coach directly on WhatsApp at least 24 hours before the scheduled time. They will help you find a new slot that works for both of you.',
  },
  {
    question: 'What happens if we miss a session?',
    answer: 'If you miss a session without prior notice, it will be marked as completed. We recommend informing your coach at least 24 hours in advance if you need to reschedule.',
  },
  {
    question: 'How can I track my child\'s progress?',
    answer: 'You can view your child\'s progress in the Progress section of this dashboard. It shows assessment scores, completed sessions, and learning milestones.',
  },
  {
    question: 'What is included in the 3-month program?',
    answer: 'The program includes 6 one-on-one coaching sessions, 3 parent check-in calls, access to e-learning materials, and personalized reading recommendations from Vedant AI.',
  },
  {
    question: 'How do I contact support?',
    answer: 'You can reach our support team via WhatsApp at +91 89762 87997 or email at support@yestoryd.com. We typically respond within 24 hours.',
  },
];

export default function ParentSupportPage() {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [parentEmail, setParentEmail] = useState('');
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

      setParentEmail(user.email || '');

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
          .select('id')
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
          .select('id')
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
        // Fetch enrollment with coach details
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

        // Handle coaches - it might be an array or single object
        if (enrollment?.coaches) {
          const coachData = Array.isArray(enrollment.coaches) 
            ? enrollment.coaches[0] 
            : enrollment.coaches;
          
          if (coachData) {
            setCoach({
              name: coachData.name || 'Rucha',
              email: coachData.email || 'rucha@yestoryd.com',
              bio: coachData.bio || 'Certified reading coach with expertise in phonics and early literacy development.',
              phone: coachData.phone || '918976287997',
            });
          }
        } else {
          // Default coach info
          setCoach({
            name: 'Rucha',
            email: 'rucha@yestoryd.com',
            bio: 'Certified reading coach with expertise in phonics and early literacy development.',
            phone: '918976287997',
          });
        }
      } else {
        // No enrolled child - set default coach
        setCoach({
          name: 'Rucha',
          email: 'rucha@yestoryd.com',
          bio: 'Certified reading coach with expertise in phonics and early literacy development.',
          phone: '918976287997',
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  }

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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Support & Help</h1>
          <p className="text-gray-500 mt-1">Get help with your child's reading journey</p>
        </div>

        {/* Contact Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Coach Card */}
          {coach && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-[#7b008b]/5 to-[#ff0099]/5">
                <h2 className="font-semibold text-gray-800">Your Coach</h2>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-2xl text-white font-bold">
                      {coach.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{coach.name}</p>
                    <p className="text-sm text-[#7b008b]">Reading Coach</p>
                  </div>
                </div>
                {coach.bio && (
                  <p className="text-sm text-gray-500 mb-4">{coach.bio}</p>
                )}
                <div className="space-y-2">
                  <a
                    href={`https://wa.me/${coach.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    WhatsApp Coach
                  </a>
                  <a
                    href={`mailto:${coach.email}`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    <Mail className="w-5 h-5" />
                    Email Coach
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Yestoryd Support Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-[#00abff]/5 to-[#0066cc]/5">
              <h2 className="font-semibold text-gray-800">Yestoryd Support</h2>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow border border-gray-100">
                  <Image 
                    src="/images/logo.png" 
                    alt="Yestoryd" 
                    width={40} 
                    height={40}
                    className="w-10 h-auto"
                  />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Support Team</p>
                  <p className="text-sm text-[#00abff]">We're here to help</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Have questions about billing, technical issues, or general inquiries? Our support team is ready to assist.
              </p>
              <div className="space-y-2">
                <a
                  href="https://wa.me/918976287997?text=Hi, I need help with my Yestoryd account."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  WhatsApp Support
                </a>
                <a
                  href="mailto:support@yestoryd.com"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  support@yestoryd.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <a
            href="/parent/sessions"
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-[#7b008b]/30 hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-[#7b008b]/10 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-[#7b008b]" />
            </div>
            <div>
              <p className="font-medium text-gray-800">View Sessions</p>
              <p className="text-sm text-gray-500">Check schedule</p>
            </div>
          </a>
          <a
            href="/parent/progress"
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-green-300 hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">View Progress</p>
              <p className="text-sm text-gray-500">Track learning</p>
            </div>
          </a>
          <a
            href="https://wa.me/918976287997?text=Hi, I have a billing question."
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-[#ff0099]/30 hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-[#ff0099]/10 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-[#ff0099]" />
            </div>
            <div>
              <p className="font-medium text-gray-800">Billing Help</p>
              <p className="text-sm text-gray-500">Payment queries</p>
            </div>
          </a>
        </div>

        {/* FAQs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#7b008b]" />
              Frequently Asked Questions
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {faqs.map((faq, index) => (
              <div key={index} className="p-5">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="font-medium text-gray-800 pr-4">{faq.question}</span>
                  {expandedFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-[#7b008b] flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === index && (
                  <p className="mt-3 text-gray-600 text-sm leading-relaxed">
                    {faq.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Phone className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-800">Need Urgent Help?</h3>
              <p className="text-sm text-red-700 mt-1">
                For urgent matters, call us directly at{' '}
                <a href="tel:+918976287997" className="font-semibold underline">
                  +91 89762 87997
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </ParentLayout>
  );
}