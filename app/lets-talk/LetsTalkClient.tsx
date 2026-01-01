'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  MessageCircle, 
  CheckCircle, 
  Clock, 
  Heart, 
  Sparkles,
  ArrowRight,
  User,
  Calendar,
  Phone
} from 'lucide-react';

interface SiteSettings {
  [key: string]: string;
}

interface LetsTalkClientProps {
  settings: SiteSettings;
}

export default function LetsTalkClient({ settings }: LetsTalkClientProps) {
  const whatsappNumber = settings.whatsapp_number?.replace(/[^0-9]/g, '') || '918976287997';
  const whatsappMessage = encodeURIComponent("Hi Rucha! I'd like to schedule a conversation about my child's reading.");
  const calUsername = settings.cal_username || 'yestoryd';
  const calSlug = settings.cal_discovery_slug || 'discovery';

  // Consultative messaging
  const pageTitle = settings.lets_talk_title || "Let's Talk About Your Child";
  const pageIntro = settings.lets_talk_intro || "This isn't a sales call. It's a conversation to:";
  const benefits = [
    settings.lets_talk_benefit_1 || "Understand your child's unique learning style",
    settings.lets_talk_benefit_2 || "Discuss the assessment findings in depth",
    settings.lets_talk_benefit_3 || "Explore what success looks like for your family",
    settings.lets_talk_benefit_4 || "See if our approach is the right fit"
  ];
  const coachPromise = settings.coach_promise || '"If we\'re not the right fit, I\'ll recommend other resources that might help."';
  const coachName = settings.default_coach_name || 'Rucha';
  const coachTitle = settings.default_coach_title || 'Founder & Lead Reading Coach';
  const coachExperience = settings.default_coach_experience || '10+ years';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center">
              <Image 
                src="/images/logo.png" 
                alt="Yestoryd" 
                width={140} 
                height={40}
                className="h-8 lg:h-10 w-auto"
              />
            </Link>
            <Link 
              href="/assessment" 
              className="text-[#ff0099] font-medium hover:underline"
            >
              Take Free Assessment First →
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-12 md:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          
          {/* Left Content */}
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              {pageTitle}
            </h1>
            
            <p className="text-xl text-gray-300 mb-8">
              {pageIntro}
            </p>

            {/* Benefits */}
            <ul className="space-y-4 mb-10">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-[#ff0099]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-5 h-5 text-[#ff0099]" />
                  </div>
                  <span className="text-lg text-gray-200">{benefit}</span>
                </li>
              ))}
            </ul>

            {/* Conversation Details */}
            <div className="bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-700 mb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center">
                  <span className="text-xl text-white font-bold">{coachName.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg">{coachName}</h3>
                  <p className="text-gray-400">{coachTitle}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock className="w-4 h-4 text-[#00abff]" />
                  <span>20 minutes</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Phone className="w-4 h-4 text-[#00abff]" />
                  <span>Video or phone</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Heart className="w-4 h-4 text-[#ff0099]" />
                  <span>No obligation</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Sparkles className="w-4 h-4 text-[#7b008b]" />
                  <span>{coachExperience} experience</span>
                </div>
              </div>
            </div>

            {/* Coach Promise */}
            <div className="bg-gradient-to-r from-[#ff0099]/10 to-[#00abff]/10 rounded-xl p-6 border border-gray-700">
              <blockquote className="text-gray-200 italic">
                {coachPromise}
              </blockquote>
              <p className="text-gray-400 mt-2 text-sm">— {coachName}, Founder</p>
            </div>
          </div>

          {/* Right Content - Booking */}
          <div className="bg-gray-800 rounded-3xl shadow-xl p-8 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-2">
              Choose a Time That Works
            </h2>
            <p className="text-gray-400 mb-6">
              Select a slot that's convenient for you. I'll send a confirmation with meeting details.
            </p>

            {/* Cal.com Embed Placeholder */}
            <div className="bg-gray-700 rounded-xl p-8 mb-6 min-h-[400px] flex items-center justify-center">
              <div className="text-center">
                <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">Calendar loading...</p>
                {/* Actual Cal.com embed would go here */}
                <a 
                  href={`https://cal.com/${calUsername}/${calSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#ff0099] text-white px-6 py-3 rounded-full font-medium hover:bg-[#e0087f] transition-all"
                >
                  Open Calendar
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Alternative Contact */}
            <div className="border-t border-gray-700 pt-6">
              <p className="text-gray-400 text-center mb-4">
                Prefer to message directly?
              </p>
              <a
                href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-[#25d366] text-white py-3 rounded-full font-medium hover:bg-[#20bd5a] transition-all"
              >
                <MessageCircle className="w-5 h-5" />
                Message on WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Note */}
        <div className="text-center mt-16">
          <p className="text-gray-400">
            Haven't taken the assessment yet?{' '}
            <Link href="/assessment" className="text-[#ff0099] font-medium hover:underline">
              Start with the free 5-minute assessment
            </Link>
            {' '}to get personalized insights before we talk.
          </p>
        </div>
      </div>
    </div>
  );
}
