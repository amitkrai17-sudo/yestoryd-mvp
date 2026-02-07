'use client';

import { useState } from 'react';
import { BookOpen, Play, GraduationCap, Award } from 'lucide-react';

interface StorySectionProps {
  badge: string;
  quote: string;
  paragraphs: string[];
  credentials: string[];
  videoUrl: string;
}

// ==================== VIDEO FACADE (Performance Optimization) ====================
function VideoFacade({ videoUrl }: { videoUrl: string }) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (isPlaying) {
    return (
      <iframe
        src={`${videoUrl}${videoUrl.includes('?') ? '&' : '?'}autoplay=1&rel=0&modestbranding=1`}
        title="Rucha's Story - Yestoryd"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    );
  }

  return (
    <button
      onClick={() => setIsPlaying(true)}
      className="absolute inset-0 w-full h-full group cursor-pointer bg-gradient-to-br from-[#1a1a2e] to-[#2d2d44] flex items-center justify-center"
      aria-label="Play video"
    >
      {/* Thumbnail placeholder with gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#ff0099]/20 to-[#00ABFF]/20"></div>

      {/* Yestoryd branding on thumbnail */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-[#ff0099]" />
        </div>
        <span className="text-white font-bold text-lg">Yestoryd Story</span>
      </div>

      {/* Video title - hidden on mobile to prevent overlap */}
      <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 z-20 hidden sm:block">
        <p className="text-white/80 text-xs sm:text-sm mb-1">Watch</p>
        <p className="text-white font-bold text-sm sm:text-lg">How Rucha Started Yestoryd</p>
      </div>

      {/* Play button */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/95 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:bg-white transition-all duration-300">
          <Play className="w-6 h-6 sm:w-8 sm:h-8 text-[#ff0099] ml-1" fill="#ff0099" />
        </div>
        <p className="text-white text-xs sm:text-sm mt-3 sm:mt-4 group-hover:text-white transition-colors font-medium">
          <span className="sm:hidden">Play Video</span>
          <span className="hidden sm:inline">Click to play</span>
        </p>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-[#ff0099]/10 rounded-full blur-2xl"></div>
      <div className="absolute bottom-1/4 left-1/4 w-24 h-24 bg-[#00ABFF]/10 rounded-full blur-2xl"></div>
    </button>
  );
}

export function StorySection({
  badge,
  quote,
  paragraphs,
  credentials,
  videoUrl,
}: StorySectionProps) {
  const credentialIcons = [GraduationCap, Award];

  return (
    <section id="rucha-story" className="py-16 lg:py-24 bg-[#1a1a2e] text-white relative overflow-x-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-[#ff0099] blur-[100px] opacity-20"></div>
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#00abff] blur-[100px] opacity-20"></div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Video Side - Using Facade for Performance */}
          <div className="order-2 lg:order-1">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl">
              <VideoFacade videoUrl={videoUrl} />
            </div>
          </div>

          {/* Story Content */}
          <div className="order-1 lg:order-2">
            <div className="inline-block bg-[#ff0099] text-white text-xs font-bold px-3 py-1 rounded-full mb-6">
              {badge}
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold mb-6 leading-tight">
              {quote.includes('love for stories') ? (
                <>
                  "I realized that <span className="text-[#ffde00]">love for stories</span> wasn't enough. Kids needed the <span className="text-[#00abff]">science of reading</span>."
                </>
              ) : `"${quote}"`}
            </h2>

            <div className="space-y-5 text-gray-300 leading-relaxed">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>
                  {paragraph.includes('reading is not natural') ? (
                    <>
                      They struggled with sounds, blending, and word composition. I realized that
                      <strong className="text-white"> reading is not natural — it's an acquired skill</strong>.
                    </>
                  ) : paragraph.includes('Jolly Phonics') ? (
                    <>
                      I spent 7 years mastering <strong className="text-white">Jolly Phonics</strong> and
                      <strong className="text-white"> Jolly Grammar</strong>. Now, with AI technology, we can
                      diagnose reading gaps instantly — so coaches can focus purely on the child.
                    </>
                  ) : paragraph}
                </p>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {credentials.map((credential, index) => {
                const Icon = credentialIcons[index] || GraduationCap;
                const iconColor = index === 0 ? '#00abff' : '#ffde00';
                return (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 bg-white/10 text-white/90 px-4 py-2 rounded-full text-sm font-medium border border-gray-700"
                  >
                    <Icon className="w-4 h-4" style={{ color: iconColor }} />
                    {credential}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
