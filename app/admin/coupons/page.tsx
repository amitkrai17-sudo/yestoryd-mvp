// =============================================================================
// FILE: app/admin/coupons/page.tsx
// PURPOSE: Admin dashboard for managing coupons
// UI/UX: AIDA + LIFT framework, mobile-first, brand colors
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { 
  Ticket, Plus, Search, Filter, Copy, CheckCircle, 
  XCircle, Clock, Users, TrendingUp, Percent, 
  Gift, Calendar, MoreVertical, Edit2, Trash2,
  ChevronDown, RefreshCw
} from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  coupon_type: string;
  title: string;
  description: string;
  discount_type: 'fixed' | 'percentage' | null;
  discount_value: number | null;
  max_discount: number | null;
  referrer_type: string | null;
  coach?: { name: string; email: string };
  parent?: { name: string; email: string };
  max_uses: number | null;
  current_uses: number;
  per_user_limit: number;
  first_enrollment_only: boolean;
  valid_from: string;
  valid_until: string | null;
  applicable_to: string[];
  min_order_value: number;
  is_active: boolean;
  total_discount_given: number;
  total_referrals: number;
  successful_conversions: number;
  created_at: string;
}

interface Stats {
  total: number;
  active: number;
  referrals: number;
  promos: number;
  totalUsage: number;
  totalDiscountGiven: number;
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'referral' | 'promo'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchCoupons();
  }, [filterType, filterStatus]);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.set('type', filterType);
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const response = await fetch(`/api/admin/coupons?${params}`);
      const data = await response.json();
      
      setCoupons(data.coupons || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Failed to fetch coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const toggleCouponStatus = async (couponId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/coupons/${couponId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (response.ok) {
        fetchCoupons();
      }
    } catch (error) {
      console.error('Failed to toggle coupon:', error);
    }
  };

  const getCouponTypeLabel = (type: string) => {
    const labels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      coach_referral: { label: 'Coach Referral', color: 'bg-white/[0.08] text-gray-400 border border-white/[0.08]', icon: <Users className="w-3 h-3" /> },
      parent_referral: { label: 'Parent Referral', color: 'bg-white/[0.08] text-gray-400 border border-white/[0.08]', icon: <Gift className="w-3 h-3" /> },
      fixed_discount: { label: 'Fixed Discount', color: 'bg-white/[0.08] text-gray-400 border border-white/[0.08]', icon: <Ticket className="w-3 h-3" /> },
      percent_discount: { label: '% Discount', color: 'bg-white/[0.08] text-gray-400 border border-white/[0.08]', icon: <Percent className="w-3 h-3" /> },
      first_time: { label: 'First-Time', color: 'bg-white/[0.08] text-gray-400 border border-white/[0.08]', icon: <Gift className="w-3 h-3" /> },
      event: { label: 'Event', color: 'bg-white/[0.08] text-gray-400 border border-white/[0.08]', icon: <Calendar className="w-3 h-3" /> },
    };
    return labels[type] || { label: type, color: 'bg-surface-2 text-text-secondary', icon: <Ticket className="w-3 h-3" /> };
  };

  const getDiscountDisplay = (coupon: Coupon) => {
    if (coupon.coupon_type === 'coach_referral') {
      return '70-30 Split';
    }
    if (!coupon.discount_type || !coupon.discount_value) {
      return '—';
    }
    if (coupon.discount_type === 'fixed') {
      return `₹${coupon.discount_value}`;
    }
    return `${coupon.discount_value}%${coupon.max_discount ? ` (max ₹${coupon.max_discount})` : ''}`;
  };

  const filteredCoupons = coupons.filter(coupon => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      coupon.code.toLowerCase().includes(query) ||
      coupon.title?.toLowerCase().includes(query) ||
      coupon.coach?.name?.toLowerCase().includes(query) ||
      coupon.parent?.name?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="bg-surface-0">
      {/* Header */}
      <div className="bg-surface-1 border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
                <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300 flex-shrink-0" />
                <span className="truncate">Coupons</span>
              </h1>
              <p className="text-xs sm:text-sm text-text-tertiary mt-0.5">
                Manage coupons & referrals
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-white text-[#0a0a0f] text-xs sm:text-sm font-semibold rounded-full hover:bg-gray-200 transition-all flex-shrink-0"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Create</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4 lg:space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            {[
              { icon: Ticket, color: 'purple', value: stats.total, label: 'Total' },
              { icon: CheckCircle, color: 'green', value: stats.active, label: 'Active' },
              { icon: TrendingUp, color: 'pink', value: stats.totalUsage, label: 'Uses' },
              { icon: Gift, color: 'yellow', value: `₹${(stats.totalDiscountGiven || 0).toLocaleString()}`, label: 'Discounts' },
            ].map((s) => (
              <div key={s.label} className="bg-surface-1 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 lg:p-4 shadow-sm border border-border/50">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-${s.color}-500/20 flex items-center justify-center flex-shrink-0`}>
                    <s.icon className={`w-4 h-4 sm:w-5 sm:h-5 text-${s.color}-400`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base sm:text-lg lg:text-2xl font-bold text-white truncate">{s.value}</p>
                    <p className="text-[10px] sm:text-xs text-text-tertiary">{s.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-surface-1 rounded-2xl shadow-sm border border-border/50 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search codes, names..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/[0.10] focus:border-white/[0.30] transition-all"
              />
            </div>

            {/* Type Filter */}
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'referral' | 'promo')}
                className="appearance-none pl-4 pr-10 py-3 bg-surface-2 border border-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/[0.10] cursor-pointer min-w-[140px]"
              >
                <option value="all">All Types</option>
                <option value="referral">Referrals</option>
                <option value="promo">Promotions</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary pointer-events-none" />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'expired')}
                className="appearance-none pl-4 pr-10 py-3 bg-surface-2 border border-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/[0.10] cursor-pointer min-w-[140px]"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary pointer-events-none" />
            </div>

            {/* Refresh */}
            <button
              onClick={fetchCoupons}
              className="p-3 bg-surface-2 border border-border rounded-xl hover:bg-surface-3 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-text-secondary ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Coupons List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="bg-surface-1 rounded-2xl shadow-sm border border-border/50 p-12 text-center">
            <Ticket className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No coupons found</h3>
            <p className="text-text-tertiary mb-6">
              {searchQuery ? 'Try a different search term' : 'Create your first promotional coupon'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#0a0a0f] font-semibold rounded-full hover:bg-gray-200 transition-all"
              >
                <Plus className="w-5 h-5" />
                Create Coupon
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCoupons.map((coupon) => {
              const typeInfo = getCouponTypeLabel(coupon.coupon_type);
              const isExpired = coupon.valid_until && new Date(coupon.valid_until) < new Date();
              
              return (
                <div
                  key={coupon.id}
                  className={`bg-surface-1 rounded-2xl shadow-sm border border-border/50 p-4 sm:p-6 transition-all hover:shadow-md ${
                    !coupon.is_active || isExpired ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Code & Type */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <button
                          onClick={() => copyCode(coupon.code)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 rounded-lg font-mono text-sm font-semibold text-white hover:bg-surface-3 transition-colors group"
                        >
                          {coupon.code}
                          {copiedCode === coupon.code ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-text-tertiary group-hover:text-text-secondary" />
                          )}
                        </button>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                          {typeInfo.icon}
                          {typeInfo.label}
                        </span>
                        {!coupon.is_active && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                            <XCircle className="w-3 h-3" />
                            Inactive
                          </span>
                        )}
                        {isExpired && coupon.is_active && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            <Clock className="w-3 h-3" />
                            Expired
                          </span>
                        )}
                      </div>
                      
                      <h3 className="font-semibold text-white truncate">
                        {coupon.title || `${typeInfo.label} - ${coupon.code}`}
                      </h3>

                      {(coupon.coach?.name || coupon.parent?.name) && (
                        <p className="text-sm text-text-tertiary mt-1">
                          Referrer: {coupon.coach?.name || coupon.parent?.name}
                        </p>
                      )}
                    </div>

                    {/* Discount */}
                    <div className="flex items-center gap-6 sm:gap-8">
                      <div className="text-center">
                        <p className="text-lg font-bold text-gray-300">
                          {getDiscountDisplay(coupon)}
                        </p>
                        <p className="text-xs text-text-tertiary">Discount</p>
                      </div>

                      <div className="text-center">
                        <p className="text-lg font-bold text-white">
                          {coupon.current_uses}{coupon.max_uses ? `/${coupon.max_uses}` : ''}
                        </p>
                        <p className="text-xs text-text-tertiary">Uses</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleCouponStatus(coupon.id, coupon.is_active)}
                          className={`p-2 rounded-lg transition-colors ${
                            coupon.is_active
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-surface-2 text-text-tertiary hover:bg-surface-3'
                          }`}
                          title={coupon.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {coupon.is_active ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            <XCircle className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => setSelectedCoupon(coupon)}
                          className="p-2 rounded-lg bg-surface-2 text-text-secondary hover:bg-surface-3 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Validity Info */}
                  {coupon.valid_until && (
                    <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2 text-sm text-text-tertiary">
                      <Calendar className="w-4 h-4" />
                      Valid until: {new Date(coupon.valid_until).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal - Will be a separate component */}
      {showCreateModal && (
        <CreateCouponModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchCoupons();
          }}
        />
      )}

      {/* Edit Modal */}
      {selectedCoupon && (
        <EditCouponModal
          coupon={selectedCoupon}
          onClose={() => setSelectedCoupon(null)}
          onSuccess={() => {
            setSelectedCoupon(null);
            fetchCoupons();
          }}
        />
      )}
    </div>
  );
}

// Create Coupon Modal Component
function CreateCouponModal({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    couponType: 'percent_discount',
    title: '',
    description: '',
    discountType: 'percentage' as 'fixed' | 'percentage',
    discountValue: '',
    maxDiscount: '',
    maxUses: '',
    perUserLimit: '1',
    firstEnrollmentOnly: false,
    validUntil: '',
    applicableTo: ['coaching', 'elearning', 'group_classes'],
    minOrderValue: '0',
  });

  const generateCode = () => {
    const prefix = formData.couponType === 'event' ? 'EVENT' : 
                   formData.couponType === 'first_time' ? 'WELCOME' : 'PROMO';
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    setFormData(prev => ({ ...prev, code: `${prefix}${random}` }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formData.code.toUpperCase(),
          couponType: formData.couponType,
          title: formData.title,
          description: formData.description,
          discountType: formData.discountType,
          discountValue: parseInt(formData.discountValue) || 0,
          maxDiscount: formData.maxDiscount ? parseInt(formData.maxDiscount) : null,
          maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
          perUserLimit: parseInt(formData.perUserLimit) || 1,
          firstEnrollmentOnly: formData.firstEnrollmentOnly,
          validUntil: formData.validUntil || null,
          applicableTo: formData.applicableTo,
          minOrderValue: parseInt(formData.minOrderValue) || 0,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create coupon');
      }
    } catch (error) {
      console.error('Create coupon error:', error);
      alert('Failed to create coupon');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface-1 border-b border-border/50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create Coupon</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-2 rounded-xl">
            <XCircle className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Coupon Type */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Coupon Type
            </label>
            <select
              value={formData.couponType}
              onChange={(e) => setFormData(prev => ({ ...prev, couponType: e.target.value }))}
              className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
            >
              <option value="percent_discount">Percentage Discount</option>
              <option value="fixed_discount">Fixed Discount</option>
              <option value="first_time">First-Time Only</option>
              <option value="event">Event/Campaign</option>
            </select>
          </div>

          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Coupon Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="SAVE20"
                className="flex-1 px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted font-mono uppercase focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
                required
              />
              <button
                type="button"
                onClick={generateCode}
                className="px-4 py-3 bg-surface-2 text-text-secondary rounded-xl hover:bg-surface-3 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Title (Optional)
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="New Year Special - 20% Off"
              className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
            />
          </div>

          {/* Discount Type & Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Discount Type
              </label>
              <select
                value={formData.discountType}
                onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value as 'fixed' | 'percentage' }))}
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Discount Value
              </label>
              <input
                type="number"
                value={formData.discountValue}
                onChange={(e) => setFormData(prev => ({ ...prev, discountValue: e.target.value }))}
                placeholder={formData.discountType === 'percentage' ? '20' : '500'}
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
                required
              />
            </div>
          </div>

          {/* Max Discount (for percentage) */}
          {formData.discountType === 'percentage' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Max Discount (₹) - Optional
              </label>
              <input
                type="number"
                value={formData.maxDiscount}
                onChange={(e) => setFormData(prev => ({ ...prev, maxDiscount: e.target.value }))}
                placeholder="1500"
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
              />
            </div>
          )}

          {/* Usage Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Total Uses
              </label>
              <input
                type="number"
                value={formData.maxUses}
                onChange={(e) => setFormData(prev => ({ ...prev, maxUses: e.target.value }))}
                placeholder="Unlimited"
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Per User
              </label>
              <input
                type="number"
                value={formData.perUserLimit}
                onChange={(e) => setFormData(prev => ({ ...prev, perUserLimit: e.target.value }))}
                placeholder="1"
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
              />
            </div>
          </div>

          {/* Valid Until */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Valid Until (Optional)
            </label>
            <input
              type="date"
              value={formData.validUntil}
              onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
              className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
            />
          </div>

          {/* First Enrollment Only */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.firstEnrollmentOnly}
              onChange={(e) => setFormData(prev => ({ ...prev, firstEnrollmentOnly: e.target.checked }))}
              className="w-5 h-5 rounded border-border text-gray-400 focus:ring-white/[0.10]"
            />
            <span className="text-sm text-text-secondary">First-time enrollments only</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-white text-[#0a0a0f] font-semibold rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                Creating...
              </span>
            ) : (
              'Create Coupon'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// Edit Coupon Modal Component
function EditCouponModal({ 
  coupon,
  onClose, 
  onSuccess 
}: { 
  coupon: Coupon;
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: coupon.title || '',
    description: coupon.description || '',
    discountValue: coupon.discount_value?.toString() || '',
    maxDiscount: coupon.max_discount?.toString() || '',
    maxUses: coupon.max_uses?.toString() || '',
    perUserLimit: coupon.per_user_limit?.toString() || '1',
    validUntil: coupon.valid_until ? coupon.valid_until.split('T')[0] : '',
    isActive: coupon.is_active,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          discount_value: parseInt(formData.discountValue) || null,
          max_discount: formData.maxDiscount ? parseInt(formData.maxDiscount) : null,
          max_uses: formData.maxUses ? parseInt(formData.maxUses) : null,
          per_user_limit: parseInt(formData.perUserLimit) || 1,
          valid_until: formData.validUntil || null,
          is_active: formData.isActive,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update coupon');
      }
    } catch (error) {
      console.error('Update coupon error:', error);
      alert('Failed to update coupon');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface-1 border-b border-border/50 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Edit Coupon</h2>
            <p className="text-sm text-text-tertiary font-mono">{coupon.code}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-2 rounded-xl">
            <XCircle className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
              className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/[0.10] resize-none"
            />
          </div>

          {/* Discount Value & Max */}
          {coupon.discount_type && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Discount Value {coupon.discount_type === 'percentage' ? '(%)' : '(₹)'}
                </label>
                <input
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, discountValue: e.target.value }))}
                  className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
                />
              </div>
              {coupon.discount_type === 'percentage' && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Max Discount (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxDiscount: e.target.value }))}
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
                  />
                </div>
              )}
            </div>
          )}

          {/* Usage Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Total Uses
              </label>
              <input
                type="number"
                value={formData.maxUses}
                onChange={(e) => setFormData(prev => ({ ...prev, maxUses: e.target.value }))}
                placeholder="Unlimited"
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Per User
              </label>
              <input
                type="number"
                value={formData.perUserLimit}
                onChange={(e) => setFormData(prev => ({ ...prev, perUserLimit: e.target.value }))}
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
              />
            </div>
          </div>

          {/* Valid Until */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Valid Until
            </label>
            <input
              type="date"
              value={formData.validUntil}
              onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
              className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/[0.10]"
            />
          </div>

          {/* Active Status */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="w-5 h-5 rounded border-border text-gray-400 focus:ring-white/[0.10]"
            />
            <span className="text-sm text-text-secondary">Active</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-white text-[#0a0a0f] font-semibold rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
