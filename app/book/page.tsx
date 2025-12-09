'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

declare global {
  interface Window {
    Cal?: any;
  }
}

// Cal.com Configuration
const CAL_CONFIG = {
  username: 'yestoryd',
  namespace: 'yestoryd-booking',
  brandColor: '#E91E63',
};

const CAL_EVENTS = {
  discovery: {
    name: 'Free Discovery Call',
    duration: 30,
    link: 'yestoryd/discovery',
    description: 'A free 30-minute call to discuss your child\'s reading journey and create a personalized plan.',
    icon: '🎯',
    color: 'from-green-400 to-emerald-500',
    tag: 'FREE',
  },
  coaching: {
    name: 'Coaching Session',
    duration: 60,
    link: 'yestoryd/coaching',
    description: 'One-on-one personalized reading coaching session with expert guidance.',
    icon: '📚',
    color: 'from-blue-400 to-indigo-500',
    tag: null,
  },
  checkin: {
    name: 'Parent Check-in',
    duration: 15,
    link: 'yestoryd/parent-checkin',
    description: 'Quick check-in to discuss your child\'s progress and next steps.',
    icon: '💬',
    color: 'from-purple-400 to-pink-500',
    tag: null,
  },
};

type CalEventType = 'discovery' | 'coaching' | 'checkin';

export default function BookPage() {
  const [calLoaded, setCalLoaded] = useState(false);

  // Load Cal.com script
  useEffect(() => {
    if (window.Cal) {
      setCalLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://app.cal.com/embed/embed.js';
    script.async = true;

    script.onload = () => {
      if (window.Cal) {
        window.Cal('init', CAL_CONFIG.namespace, {
          origin: 'https://app.cal.com',
        });
        window.Cal.ns[CAL_CONFIG.namespace]('ui', {
          theme: 'light',
          styles: {
            branding: {
              brandColor: CAL_CONFIG.brandColor,
            },
          },
        });
        setCalLoaded(true);
      }
    };

    document.head.appendChild(script);
  }, []);

  const openCalPopup = (eventType: CalEventType) => {
    const event = CAL_EVENTS[eventType];

    if (window.Cal && window.Cal.ns && window.Cal.ns[CAL_CONFIG.namespace]) {
      window.Cal.ns[CAL_CONFIG.namespace]('modal', {
        calLink: event.link,
        config: {
          layout: 'month_view',
        },
      });
    } else {
      window.open(`https://cal.com/${event.link}`, '_blank');
    }
  };

  const eventTypes: CalEventType[] = ['discovery', 'coaching', 'checkin'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-pink-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-pink-600 transition-colors">
              <span>←</span>
              <span className="font-medium">Back to Home</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <span className="font-bold text-gray-900">Yestoryd</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
            Book Your Session 📅
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose a session type below. All sessions are conducted via Google Meet.
          </p>
        </div>

        {/* Session Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
          {eventTypes.map((eventType) => {
            const event = CAL_EVENTS[eventType];

            return (
              <div
                key={eventType}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Card Header */}
                <div className={`bg-gradient-to-r ${event.color} p-6 text-white`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-4xl">{event.icon}</span>
                    {event.tag && (
                      <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold">
                        {event.tag}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold">{event.name}</h3>
                  <p className="text-white/90 text-sm mt-1">⏱️ {event.duration} minutes</p>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  <p className="text-gray-600 mb-6 min-h-[60px]">
                    {event.description}
                  </p>
                  <button
                    onClick={() => openCalPopup(eventType)}
                    disabled={!calLoaded}
                    className={`w-full bg-gradient-to-r ${event.color} text-white font-semibold py-3 px-6 rounded-xl hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50`}
                  >
                    {calLoaded ? 'Book Now →' : 'Loading...'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Section */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
            <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
              🎥 How It Works
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold flex-shrink-0">1</span>
                <p className="text-blue-800">Choose a session type and pick your preferred time</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold flex-shrink-0">2</span>
                <p className="text-blue-800">Receive a Google Meet link via email confirmation</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold flex-shrink-0">3</span>
                <p className="text-blue-800">Join the video call at your scheduled time</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 text-center">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Instant Confirmation
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Free Rescheduling
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              IST Timezone
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
