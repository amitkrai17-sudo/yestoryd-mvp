// ============================================================
// COACH PROFILE SETTINGS PAGE
// File: app/coach/profile/page.tsx
// Coach can manage their profile, skills, and availability
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CoachLayout from '@/components/layouts/CoachLayout';
import {
  Save, Loader2, User, BookOpen, Calendar,
  Award, CheckCircle, AlertCircle, Camera
} from 'lucide-react';
import SkillTagSelector from '@/components/shared/SkillTagSelector';
import AvailabilityCalendar from '@/components/shared/AvailabilityCalendar';
import CoachAvailabilityCard from '@/components/coach/CoachAvailabilityCard';

interface CoachProfile {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  photo_url: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  city: string | null;
  skill_tags: string[];
  certifications: string[];
  years_experience: number;
  timezone: string;
  is_available: boolean;
  is_accepting_new: boolean;
  max_children: number;
  current_children: number;
  avg_rating: number;
  total_sessions_completed: number;
  verified_at: string | null;
  skill_tags_details: any[];
  stats: {
    total_sessions: number;
    completed_sessions: number;
    upcoming_sessions: number;
    current_students: number;
  };
}

export default function CoachProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'skills' | 'availability'>('profile');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    whatsapp_number: '',
    city: '',
    skill_tags: [] as string[],
    certifications: [] as string[],
    years_experience: 0,
    is_available: true,
    is_accepting_new: true,
  });

  // Fetch profile on mount
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/coach/profile');
      
      if (!response.ok) {
        throw new Error('Failed to load profile');
      }
      
      const data = await response.json();
      setProfile(data.coach);
      
      // Initialize form with existing data
      setFormData({
        name: data.coach.name || '',
        bio: data.coach.bio || '',
        whatsapp_number: data.coach.whatsapp_number || '',
        city: data.coach.city || '',
        skill_tags: data.coach.skill_tags || [],
        certifications: data.coach.certifications || [],
        years_experience: data.coach.years_experience || 0,
        is_available: data.coach.is_available ?? true,
        is_accepting_new: data.coach.is_accepting_new ?? true,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Save profile
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/coach/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save profile');
      }

      setSuccess('Profile updated successfully!');
      fetchProfile(); // Refresh data
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Update form field
  const updateField = <K extends keyof typeof formData>(
    field: K,
    value: typeof formData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSuccess(null); // Clear success message on change
  };

  // Add certification
  const addCertification = () => {
    const cert = prompt('Enter certification name:');
    if (cert && !formData.certifications.includes(cert)) {
      updateField('certifications', [...formData.certifications, cert]);
    }
  };

  // Remove certification
  const removeCertification = (cert: string) => {
    updateField('certifications', formData.certifications.filter(c => c !== cert));
  };

  if (isLoading) {
    return (
      <CoachLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#00ABFF] mx-auto mb-4" />
            <p className="text-gray-400">Loading profile...</p>
          </div>
        </div>
      </CoachLayout>
    );
  }

  if (!profile) {
    return (
      <CoachLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error || 'Failed to load profile'}</p>
            <button
              onClick={fetchProfile}
              className="px-4 py-2 bg-[#00ABFF] text-white rounded-lg hover:bg-[#00ABFF]/90"
            >
              Retry
            </button>
          </div>
        </div>
      </CoachLayout>
    );
  }

  return (
    <CoachLayout noPadding>
      <div className="p-3 lg:p-6 text-white">

      {/* Tabs - Compact on mobile */}
      <div className="bg-surface-1/50 rounded-lg p-1 mb-4 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'skills', label: 'Skills', icon: BookOpen },
            { id: 'availability', label: 'Schedule', icon: Calendar },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`
                flex-1 flex items-center justify-center gap-1.5 px-3 lg:px-4 py-2 lg:py-2.5 rounded-md text-xs lg:text-sm font-medium whitespace-nowrap transition-colors
                ${activeTab === id
                  ? 'bg-[#00ABFF] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto">
        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 lg:p-4 bg-red-900/30 border border-red-800 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 lg:w-5 lg:h-5 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 lg:p-4 bg-green-900/30 border border-green-800 rounded-lg flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle className="w-4 h-4 lg:w-5 lg:h-5 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="space-y-4 lg:space-y-6">
            <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-4 lg:p-6">
              <h2 className="text-sm lg:text-lg font-semibold mb-3 lg:mb-4 text-[#00ABFF]">Basic Information</h2>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs lg:text-sm text-gray-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="w-full px-3 lg:px-4 py-2.5 bg-surface-0 border border-border rounded-lg text-sm focus:ring-2 focus:ring-[#00ABFF] focus:border-[#00ABFF]"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-xs lg:text-sm text-gray-400 mb-1.5">Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => updateField('bio', e.target.value)}
                    rows={3}
                    placeholder="Tell parents about your teaching experience..."
                    className="w-full px-3 lg:px-4 py-2.5 bg-surface-0 border border-border rounded-lg text-sm focus:ring-2 focus:ring-[#00ABFF] focus:border-[#00ABFF] resize-none"
                  />
                  <p className="text-[10px] lg:text-xs text-gray-500 mt-1">
                    {formData.bio.length}/500 characters
                  </p>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs lg:text-sm text-gray-400 mb-1.5">WhatsApp Number *</label>
                  <input
                    type="tel"
                    value={formData.whatsapp_number}
                    onChange={(e) => updateField('whatsapp_number', e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 lg:px-4 py-2.5 bg-surface-0 border border-border rounded-lg text-sm focus:ring-2 focus:ring-[#00ABFF] focus:border-[#00ABFF]"
                  />
                </div>

                {/* City and Experience - Stack on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs lg:text-sm text-gray-400 mb-1.5">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      placeholder="Mumbai"
                      className="w-full px-3 lg:px-4 py-2.5 bg-surface-0 border border-border rounded-lg text-sm focus:ring-2 focus:ring-[#00ABFF] focus:border-[#00ABFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs lg:text-sm text-gray-400 mb-1.5">Years of Experience</label>
                    <input
                      type="number"
                      value={formData.years_experience}
                      onChange={(e) => updateField('years_experience', parseInt(e.target.value) || 0)}
                      min={0}
                      max={50}
                      className="w-full sm:w-32 px-3 lg:px-4 py-2.5 bg-surface-0 border border-border rounded-lg text-sm focus:ring-2 focus:ring-[#00ABFF] focus:border-[#00ABFF]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Availability Status */}
            <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-4 lg:p-6">
              <h2 className="text-sm lg:text-lg font-semibold mb-3 lg:mb-4 text-[#00ABFF]">Availability Status</h2>

              <div className="space-y-3 lg:space-y-4">
                {/* Is Available */}
                <div className="flex items-center justify-between p-3 lg:p-4 bg-surface-0 rounded-lg gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm lg:text-base">Available for Sessions</p>
                    <p className="text-xs lg:text-sm text-gray-400">Toggle off if temporarily unavailable</p>
                  </div>
                  <button
                    onClick={() => updateField('is_available', !formData.is_available)}
                    className={`
                      relative w-12 h-6 lg:w-14 lg:h-7 rounded-full transition-colors flex-shrink-0
                      ${formData.is_available ? 'bg-green-500' : 'bg-gray-700'}
                    `}
                  >
                    <span
                      className={`
                        absolute top-0.5 left-0.5 w-5 h-5 lg:w-6 lg:h-6 bg-white rounded-full transition-transform
                        ${formData.is_available ? 'translate-x-6 lg:translate-x-7' : ''}
                      `}
                    />
                  </button>
                </div>

                {/* Accepting New Students */}
                <div className="flex items-center justify-between p-3 lg:p-4 bg-surface-0 rounded-lg gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm lg:text-base">Accepting New Students</p>
                    <p className="text-xs lg:text-sm text-gray-400">
                      Current: {profile.current_children}/{profile.max_children} students
                    </p>
                  </div>
                  <button
                    onClick={() => updateField('is_accepting_new', !formData.is_accepting_new)}
                    className={`
                      relative w-12 h-6 lg:w-14 lg:h-7 rounded-full transition-colors flex-shrink-0
                      ${formData.is_accepting_new ? 'bg-green-500' : 'bg-gray-700'}
                    `}
                  >
                    <span
                      className={`
                        absolute top-0.5 left-0.5 w-5 h-5 lg:w-6 lg:h-6 bg-white rounded-full transition-transform
                        ${formData.is_accepting_new ? 'translate-x-6 lg:translate-x-7' : ''}
                      `}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SKILLS TAB */}
        {activeTab === 'skills' && (
          <div className="space-y-4 lg:space-y-6">
            {/* Skill Tags */}
            <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-4 lg:p-6">
              <h2 className="text-sm lg:text-lg font-semibold mb-1 lg:mb-2 text-[#00ABFF]">Teaching Skills</h2>
              <p className="text-xs lg:text-sm text-gray-400 mb-3 lg:mb-4">
                Select skills to match with students who need your expertise.
              </p>

              <div className="bg-surface-0 rounded-lg p-3 lg:p-4">
                <SkillTagSelector
                  selectedTags={formData.skill_tags}
                  onChange={(tags) => updateField('skill_tags', tags)}
                  maxTags={20}
                  placeholder="Select your teaching skills..."
                />
              </div>

              {!profile.verified_at && formData.skill_tags.length > 0 && (
                <p className="text-xs lg:text-sm text-yellow-500 mt-3 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                  Skills will be verified by admin
                </p>
              )}
            </div>

            {/* Certifications */}
            <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-4 lg:p-6">
              <div className="flex items-center justify-between mb-3 lg:mb-4 gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm lg:text-lg font-semibold text-[#00ABFF]">Certifications</h2>
                  <p className="text-xs lg:text-sm text-gray-400">Add your teaching certifications</p>
                </div>
                <button
                  onClick={addCertification}
                  className="px-2.5 lg:px-3 py-1.5 bg-surface-1 hover:bg-surface-2 rounded-lg text-xs lg:text-sm flex-shrink-0"
                >
                  + Add
                </button>
              </div>

              {formData.certifications.length === 0 ? (
                <p className="text-gray-500 text-center py-6 lg:py-8 text-sm">No certifications added yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {formData.certifications.map((cert, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 py-1.5 bg-surface-1 rounded-full text-xs lg:text-sm"
                    >
                      <Award className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-yellow-400" />
                      {cert}
                      <button
                        onClick={() => removeCertification(cert)}
                        className="text-gray-400 hover:text-red-400 ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AVAILABILITY TAB */}
        {activeTab === 'availability' && (
          <div className="space-y-4 lg:space-y-6">
            {/* Weekly Schedule */}
            <div className="bg-[#1a1a24] rounded-xl border border-gray-800 overflow-hidden">
              <AvailabilityCalendar
                coachId={profile.id}
                readOnly={false}
              />
            </div>

            {/* Mark Time Off */}
            <div className="bg-surface-1 rounded-xl overflow-hidden border border-border">
              <CoachAvailabilityCard coachId={profile.id} coachEmail={profile.email} />
            </div>
          </div>
        )}

        {/* Save Button - Sticky on mobile */}
        {activeTab !== 'availability' && (
          <div className="sticky bottom-20 lg:bottom-4 mt-4 lg:mt-8 bg-[#0a0a0a] pt-3 pb-1 -mx-3 px-3 lg:mx-0 lg:px-0 lg:bg-transparent lg:pt-0 lg:pb-0">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full lg:w-auto lg:ml-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#00ABFF] text-white text-sm lg:text-base font-medium rounded-xl hover:bg-[#00ABFF]/90 disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 lg:w-5 lg:h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </main>
      </div>
    </CoachLayout>
  );
}
