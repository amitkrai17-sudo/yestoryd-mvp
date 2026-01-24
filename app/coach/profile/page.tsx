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
            <Loader2 className="w-10 h-10 animate-spin text-[#FF0099] mx-auto mb-4" />
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
              className="px-4 py-2 bg-[#FF0099] text-white rounded-lg hover:bg-[#FF0099]/90"
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
      <div className="p-6 text-white">

      {/* Tabs */}
      <div className="border-b border-gray-800 bg-[#12121a]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'skills', label: 'Skills & Expertise', icon: BookOpen },
              { id: 'availability', label: 'Availability', icon: Calendar },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                  ${activeTab === id 
                    ? 'border-[#FF0099] text-[#FF0099]' 
                    : 'border-transparent text-gray-400 hover:text-white'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-800 rounded-lg flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold mb-4 text-[#FF0099]">Basic Information</h2>
              
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#FF0099] focus:border-[#FF0099]"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => updateField('bio', e.target.value)}
                    rows={4}
                    placeholder="Tell parents about your teaching experience and approach..."
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#FF0099] focus:border-[#FF0099]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.bio.length}/500 characters
                  </p>
                </div>

                {/* Phone */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">WhatsApp Number *</label>
                      <input
                        type="tel"
                        value={formData.whatsapp_number}
                        onChange={(e) => updateField('whatsapp_number', e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#FF0099] focus:border-[#FF0099]"
                    />
                  </div>
                  </div>

                {/* City and Experience */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      placeholder="Mumbai"
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#FF0099] focus:border-[#FF0099]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Years of Experience</label>
                    <input
                      type="number"
                      value={formData.years_experience}
                      onChange={(e) => updateField('years_experience', parseInt(e.target.value) || 0)}
                      min={0}
                      max={50}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#FF0099] focus:border-[#FF0099]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Availability Status */}
            <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold mb-4 text-[#FF0099]">Availability Status</h2>
              
              <div className="space-y-4">
                {/* Is Available */}
                <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                  <div>
                    <p className="font-medium">Available for Sessions</p>
                    <p className="text-sm text-gray-400">Toggle off if you're temporarily unavailable</p>
                  </div>
                  <button
                    onClick={() => updateField('is_available', !formData.is_available)}
                    className={`
                      relative w-14 h-7 rounded-full transition-colors
                      ${formData.is_available ? 'bg-green-500' : 'bg-gray-700'}
                    `}
                  >
                    <span
                      className={`
                        absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform
                        ${formData.is_available ? 'translate-x-7' : ''}
                      `}
                    />
                  </button>
                </div>

                {/* Accepting New Students */}
                <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                  <div>
                    <p className="font-medium">Accepting New Students</p>
                    <p className="text-sm text-gray-400">
                      Current: {profile.current_children}/{profile.max_children} students
                    </p>
                  </div>
                  <button
                    onClick={() => updateField('is_accepting_new', !formData.is_accepting_new)}
                    className={`
                      relative w-14 h-7 rounded-full transition-colors
                      ${formData.is_accepting_new ? 'bg-green-500' : 'bg-gray-700'}
                    `}
                  >
                    <span
                      className={`
                        absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform
                        ${formData.is_accepting_new ? 'translate-x-7' : ''}
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
          <div className="space-y-6">
            {/* Skill Tags */}
            <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold mb-2 text-[#FF0099]">Teaching Skills</h2>
              <p className="text-sm text-gray-400 mb-4">
                Select the skills you can teach. This helps match you with students who need your expertise.
              </p>
              
              <div className="bg-gray-900 rounded-lg p-4">
                <SkillTagSelector
                  selectedTags={formData.skill_tags}
                  onChange={(tags) => updateField('skill_tags', tags)}
                  maxTags={20}
                  placeholder="Select your teaching skills..."
                />
              </div>

              {!profile.verified_at && formData.skill_tags.length > 0 && (
                <p className="text-sm text-yellow-500 mt-3 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Skills will be verified by admin before appearing on your profile
                </p>
              )}
            </div>

            {/* Certifications */}
            <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#FF0099]">Certifications</h2>
                  <p className="text-sm text-gray-400">Add your teaching certifications</p>
                </div>
                <button
                  onClick={addCertification}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
                >
                  + Add
                </button>
              </div>

              {formData.certifications.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No certifications added yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {formData.certifications.map((cert, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-full text-sm"
                    >
                      <Award className="w-4 h-4 text-yellow-400" />
                      {cert}
                      <button
                        onClick={() => removeCertification(cert)}
                        className="text-gray-400 hover:text-red-400"
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
          <div className="space-y-6">
            {/* Weekly Schedule */}
            <div className="bg-[#1a1a24] rounded-xl border border-gray-800 overflow-hidden">
              <AvailabilityCalendar
                coachId={profile.id}
                readOnly={false}
              />
            </div>
            
            {/* Mark Time Off */}
            <div className="bg-white rounded-xl overflow-hidden">
              <CoachAvailabilityCard coachId={profile.id} coachEmail={profile.email} />
            </div>
          </div>
        )}

        {/* Save Button */}
        {activeTab !== 'availability' && (
          <div className="flex justify-end mt-8">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-[#FF0099] text-white rounded-lg hover:bg-[#FF0099]/90 disabled:bg-pink-800 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
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
