'use client';

import Link from 'next/link';
import { BookOpen, Zap, TrendingUp, MessageSquare, Sparkles, ArrowRight } from 'lucide-react';

const mockSkills = [
  { label: 'Decoding', score: 7, icon: BookOpen, color: '#FF0099' },
  { label: 'Sight Words', score: 5, icon: Zap, color: '#00ABFF' },
  { label: 'Blending', score: 4, icon: TrendingUp, color: '#c847f4' },
  { label: 'Expression', score: 8, icon: MessageSquare, color: '#ffde00' },
];

export default function AssessmentPreview() {
  return (
    <section className="py-12 sm:py-16 bg-surface-1">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <span className="inline-block bg-[#00ABFF]/10 text-[#00ABFF] text-xs font-semibold uppercase tracking-wider px-4 py-1.5 rounded-full mb-4">
            See What You Get
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            A Sample Assessment Report
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto">
            In 5 minutes, rAI creates a detailed reading profile — here&apos;s what it looks like.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Mock Report Card */}
          <div className="bg-surface-0 rounded-2xl border border-border p-5 sm:p-6 shadow-xl shadow-black/20">
            {/* Mock Header */}
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
              <div className="p-[2px] rounded-full bg-gradient-to-br from-[#FF0099] to-[#00ABFF]">
                <div className="w-12 h-12 rounded-full bg-surface-1 flex items-center justify-center">
                  <span className="text-xl font-black text-white">7</span>
                </div>
              </div>
              <div>
                <p className="text-white font-semibold">Sample Score: 7/10</p>
                <p className="text-text-tertiary text-xs">Age 7 · 42 WPM</p>
              </div>
              <div className="ml-auto">
                <Sparkles className="w-5 h-5 text-[#FF0099]" />
              </div>
            </div>

            {/* Skill Bars */}
            <div className="space-y-3">
              {mockSkills.map((skill) => (
                <div key={skill.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <skill.icon className="w-3.5 h-3.5" style={{ color: skill.color }} />
                      <span className="text-text-secondary text-xs font-medium">{skill.label}</span>
                    </div>
                    <span className="text-white text-xs font-bold">{skill.score}/10</span>
                  </div>
                  <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(skill.score / 10) * 100}%`,
                        backgroundColor: skill.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Mock rAI Analysis */}
            <div className="mt-5 bg-surface-2 rounded-xl p-3 border-l-4 border-[#FF0099]">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-[#FF0099]" />
                <span className="text-[#FF0099] text-xs font-bold">rAI Analysis</span>
              </div>
              <p className="text-text-secondary text-xs leading-relaxed">
                Strong expression and decoding. Blending needs focused practice — specifically CVC and CCVC patterns. Recommend 4-6 weeks of targeted phonics coaching.
              </p>
            </div>

            {/* Blur overlay hint */}
            <div className="mt-4 text-center">
              <p className="text-text-tertiary text-[10px] uppercase tracking-wider">
                Sample report — your child&apos;s will be personalized
              </p>
            </div>
          </div>

          {/* Right side — What you get */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">
              Your free report includes:
            </h3>
            {[
              { text: 'Overall reading score with clarity, fluency & speed breakdown', color: '#FF0099' },
              { text: 'Skill-by-skill analysis: decoding, sight words, blending, expression', color: '#00ABFF' },
              { text: 'Specific error classification — substitutions, omissions, mispronunciations', color: '#c847f4' },
              { text: 'rAI analysis with personalized coaching recommendations', color: '#ffde00' },
              { text: 'Practice-at-home tips you can start today', color: '#00ABFF' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `${item.color}15` }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                </div>
                <p className="text-text-secondary text-sm">{item.text}</p>
              </div>
            ))}

            <Link
              href="/assessment"
              className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-gradient-to-r from-[#FF0099] to-[#ff6b6b] text-white font-semibold rounded-full hover:opacity-90 transition-opacity min-h-[44px]"
            >
              Get Your Free Report
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-text-tertiary text-xs">
              Takes 5 minutes · No payment required · Instant results
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
