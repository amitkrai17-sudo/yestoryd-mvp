'use client';

import {
  IndianRupee,
  TrendingUp,
  Users,
  Award,
  Calculator,
  ChevronRight,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useEarningsCalculator } from '@/hooks/useEarningsCalculator';

interface EarningsOverviewProps {
  variant?: 'full' | 'compact';
  showScenarios?: boolean;
  className?: string;
}

export default function EarningsOverview({
  variant = 'full',
  showScenarios = true,
  className = ''
}: EarningsOverviewProps) {
  const { data, isLoading, error } = useEarningsCalculator();

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-gray-900 rounded-2xl p-8 ${className}`}>
        <div className="flex items-center justify-center gap-3 py-12">
          <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
          <span className="text-gray-400">Loading earnings data...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className={`bg-gray-900 rounded-2xl p-8 ${className}`}>
        <div className="flex items-center justify-center gap-3 py-12 text-amber-400">
          <AlertCircle className="w-6 h-6" />
          <span>Unable to load earnings data. Please try again later.</span>
        </div>
      </div>
    );
  }

  const { products, split_config, scenarios } = data;
  const fullProgram = products.find(p => p.slug === 'full');

  if (variant === 'compact') {
    return (
      <div className={`bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700/50 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <IndianRupee className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Earnings Potential</h3>
            <p className="text-sm text-gray-400">Per student enrolled</p>
          </div>
        </div>

        {fullProgram && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Your Lead</p>
              <p className="text-2xl font-bold text-emerald-400">
                {fullProgram.coach_earnings_own_lead.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">{split_config.own_lead_total_percent}% of program fee</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Platform Lead</p>
              <p className="text-2xl font-bold text-blue-400">
                {fullProgram.coach_earnings_platform_lead.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">{split_config.coach_cost_percent}% of program fee</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header Section */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
          <Calculator className="w-4 h-4" />
          Earnings Calculator
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Transparent Revenue Sharing
        </h2>
        <p className="text-gray-400 text-lg">
          Our fair split ensures you earn well while we handle marketing, technology, and operations.
        </p>
      </div>

      {/* Split Configuration */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center">
            <Award className="w-6 h-6 text-pink-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Revenue Split Structure</h3>
            <p className="text-gray-400">How earnings are distributed per enrollment</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Own Lead */}
          <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 rounded-xl p-6 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-emerald-400" />
              <h4 className="font-semibold text-white">Your Own Lead</h4>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              When you bring the student through your network or referral
            </p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Lead Bonus</span>
                <span className="font-semibold text-emerald-400">{split_config.lead_cost_percent}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Coaching Fee</span>
                <span className="font-semibold text-emerald-400">{split_config.coach_cost_percent}%</span>
              </div>
              <div className="h-px bg-gray-700 my-2" />
              <div className="flex justify-between items-center">
                <span className="font-medium text-white">Total You Earn</span>
                <span className="text-xl font-bold text-emerald-400">{split_config.own_lead_total_percent}%</span>
              </div>
            </div>
          </div>

          {/* Platform Lead */}
          <div className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 rounded-xl p-6 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h4 className="font-semibold text-white">Yestoryd Lead</h4>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              When Yestoryd brings the student through marketing
            </p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Lead Bonus</span>
                <span className="text-gray-500">-</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Coaching Fee</span>
                <span className="font-semibold text-blue-400">{split_config.coach_cost_percent}%</span>
              </div>
              <div className="h-px bg-gray-700 my-2" />
              <div className="flex justify-between items-center">
                <span className="font-medium text-white">Total You Earn</span>
                <span className="text-xl font-bold text-blue-400">{split_config.coach_cost_percent}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Earnings Breakdown */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <IndianRupee className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Earnings by Program</h3>
            <p className="text-gray-400">What you earn for each program type</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-4 px-4 text-gray-400 font-medium text-sm">Program</th>
                <th className="text-right py-4 px-4 text-gray-400 font-medium text-sm">Price</th>
                <th className="text-right py-4 px-4 text-gray-400 font-medium text-sm">Sessions</th>
                <th className="text-right py-4 px-4 text-emerald-400 font-medium text-sm">Your Lead</th>
                <th className="text-right py-4 px-4 text-blue-400 font-medium text-sm">Platform Lead</th>
                <th className="text-right py-4 px-4 text-gray-400 font-medium text-sm">Per Session</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                <tr
                  key={product.slug}
                  className={`border-b border-gray-800 ${product.slug === 'full' ? 'bg-pink-500/5' : ''}`}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{product.name}</span>
                      {product.slug === 'full' && (
                        <span className="text-xs bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full">
                          Popular
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right text-gray-300">
                    {product.price.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-4 px-4 text-right text-gray-400">
                    {product.sessions}
                  </td>
                  <td className="py-4 px-4 text-right font-semibold text-emerald-400">
                    {product.coach_earnings_own_lead.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-4 px-4 text-right font-semibold text-blue-400">
                    {product.coach_earnings_platform_lead.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-4 px-4 text-right text-gray-400">
                    {product.per_session_own_lead.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}/session
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Scenarios */}
      {showScenarios && scenarios && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Monthly Income Potential</h3>
              <p className="text-gray-400">Based on Full Program with own leads</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {scenarios.students_per_month.map((students, index) => (
              <div
                key={students}
                className={`rounded-xl p-5 text-center transition-all ${
                  students === 10
                    ? 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-2 border-pink-500/30 scale-105'
                    : 'bg-gray-800/50 border border-gray-700/50'
                }`}
              >
                <p className="text-sm text-gray-400 mb-1">{students} students/mo</p>
                <p className={`text-2xl font-bold ${students === 10 ? 'text-pink-400' : 'text-white'}`}>
                  {scenarios.earnings[index].toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                </p>
                {students === 10 && (
                  <p className="text-xs text-pink-400 mt-2 font-medium">Recommended Target</p>
                )}
              </div>
            ))}
          </div>

          <p className="text-center text-gray-500 text-sm mt-6">
            These calculations assume Full Program enrollments with your own leads at {split_config.own_lead_total_percent}% revenue share.
          </p>
        </div>
      )}

      {/* CTA Section */}
      <div className="text-center">
        <a
          href="/coach/apply"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-pink-600 hover:to-pink-700 transition-all shadow-lg shadow-pink-500/25"
        >
          Start Your Coach Journey
          <ChevronRight className="w-5 h-5" />
        </a>
      </div>
    </div>
  );
}
