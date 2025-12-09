'use client';

import { useState, useEffect } from 'react';
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
  },
  coaching: {
    name: 'Coaching Session',
    duration: 60,
    link: 'yestoryd/coaching',
  },
  checkin: {
    name: 'Parent Check-in',
    duration: 15,
    link: 'yestoryd/parent-checkin',
  },
};

type CalEventType = 'discovery' | 'coaching' | 'checkin';

export default function BookPage() {
  const [selectedEvent, setSelectedEvent] = useState<CalEventType>('discovery');
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

  // Load inline calendar when event type changes
  useEffect(() => {
    if (!calLoaded) return;

    const event = CAL_EVENTS[selectedEvent];
    const containerId = 'cal-inline-container';

    // Clear previous content
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }

    // Initialize inline embed
    const initInline = () => {
      if (window.Cal && window.Cal.ns && window.Cal.ns[CAL_CONFIG.namespace]) {
        window.Cal.ns[CAL_CONFIG.namespace]('inline', {
          elementOrSelector: `#${containerId}`,
          calLink: event.link,
          config: {
            layout: 'month_view',
          },
        });
      }
    };

    setTimeout(initInline, 100);
  }, [selectedEvent, calLoaded]);

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

  const icons: Record<CalEventType, string> = {
    discovery: '🎯',
    coaching: '📚',
    checkin: '💬',
  };

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
              <span className="text-pink-500">✨</span>
              <span className="font-bold text-gray-900">Yestoryd</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Book Your Session 📅
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose a session type and pick a time that works best for you. 
            All sessions are conducted via Google Meet.
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              📅 Select Session Type
            </h2>

            {eventTypes.map((eventType) => {
              const event = CAL_EVENTS[eventType];
              const isSelected = selectedEvent === eventType;

              return (
                <button
                  key={eventType}
                  onClick={() => setSelectedEvent(eventType)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-pink-500 bg-pink-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-pink-300 hover:bg-pink-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icons[eventType]}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{event.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>⏱️ {event.duration} min</span>
                        {eventType === 'discovery' && (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                            FREE
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Info Box */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <h4 className="font-semibold text-blue-900 mb-1">🎥 Online Sessions</h4>
              <p className="text-sm text-blue-700">
                All sessions are conducted via Google Meet. You'll receive a meeting link after booking.
              </p>
            </div>

            {/* CTA Button */}
            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-4 border border-orange-100">
              <p className="text-sm text-orange-800 mb-2">
                <strong>Not sure which to choose?</strong>
              </p>
              <p className="text-sm text-orange-700 mb-3">
                Start with a free discovery call to discuss your child's needs.
              </p>
              <button
                onClick={() => openCalPopup('discovery')}
                className="w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold py-2.5 px-4 rounded-xl hover:from-orange-500 hover:to-orange-600 transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
              >
                Book Free Discovery Call
              </button>
            </div>
          </div>

          {/* Right Column - Calendar */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-pink-500 to-orange-400">
                <h2 className="text-white font-semibold">
                  📅 {CAL_EVENTS[selectedEvent].name} - Select Date & Time
                </h2>
              </div>
              <div className="p-4">
                <div 
                  id="cal-inline-container" 
                  className="min-h-[500px] w-full"
                >
                  {!calLoaded && (
                    <div className="flex items-center justify-center h-[500px]">
                      <div className="text-center">
                        <div className="animate-spin w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                        <p className="text-gray-500">Loading calendar...</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 text-center border-t pt-4">
                  <p className="text-sm text-gray-500 mb-2">Or book directly:</p>
                  <button
                    onClick={() => openCalPopup(selectedEvent)}
                    className="bg-gradient-to-r from-pink-500 to-pink-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-pink-600 hover:to-pink-700 transition-all shadow-md hover:shadow-lg"
                  >
                    Open Booking Calendar →
                  </button>
                </div>
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
