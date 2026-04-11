// app/coach/batches/page.tsx
// Coach's tuition students organized by batch with progress tracking
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users, UserPlus, Clock, Video, MapPin, BookOpen,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { supabase } from '@/lib/supabase/client';
import { getAvatarColor } from '@/lib/utils/avatar-colors';

// ============================================================
// TYPES
// ============================================================

interface StudentProgress {
  childId: string;
  childName: string;
  completed: number;
  purchased: number;
}

interface BatchData {
  batchId: string;
  rate: number;         // paise
  duration: number;     // minutes
  frequency: number;
  mode: string;
  students: StudentProgress[];
}

// ============================================================
// COMPONENT
// ============================================================

export default function CoachBatchesPage() {
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBatches(); }, []);

  const loadBatches = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: coach } = await supabase
        .from('coaches')
        .select('id')
        .eq('email', user.email!)
        .single();
      if (!coach) return;

      // Fetch all tuition onboardings for this coach
      const { data: rows } = await supabase
        .from('tuition_onboarding')
        .select('batch_id, child_id, child_name, session_rate, session_duration_minutes, sessions_per_week, sessions_purchased, default_session_mode')
        .eq('coach_id', coach.id)
        .eq('status', 'parent_completed');

      if (!rows?.length) { setBatches([]); return; }

      // Fetch completed session counts
      const childIds = rows.map(r => r.child_id).filter(Boolean);
      const { data: completedRows } = await supabase
        .from('scheduled_sessions')
        .select('child_id')
        .in('child_id', childIds)
        .eq('session_type', 'tuition')
        .eq('status', 'completed');

      const completedMap = new Map<string, number>();
      for (const s of completedRows || []) {
        if (s.child_id) completedMap.set(s.child_id, (completedMap.get(s.child_id) || 0) + 1);
      }

      // Group by batch_id
      const batchMap = new Map<string, BatchData>();
      for (const r of rows) {
        const bid = (r as any).batch_id as string;
        if (!bid) continue;

        const student: StudentProgress = {
          childId: r.child_id || '',
          childName: r.child_name,
          completed: completedMap.get(r.child_id || '') || 0,
          purchased: r.sessions_purchased || 0,
        };

        const existing = batchMap.get(bid);
        if (existing) {
          existing.students.push(student);
        } else {
          batchMap.set(bid, {
            batchId: bid,
            rate: r.session_rate,
            duration: r.session_duration_minutes ?? 60,
            frequency: r.sessions_per_week ?? 2,
            mode: r.default_session_mode || 'online',
            students: [student],
          });
        }
      }

      setBatches(Array.from(batchMap.values()).sort((a, b) => b.students.length - a.students.length));
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" className="text-[#00ABFF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Classes"
        subtitle={`${batches.length} classes, ${batches.reduce((s, b) => s + b.students.length, 0)} students`}
        action={
          <Link
            href="/coach/onboard-student"
            className="h-9 px-4 rounded-xl text-sm font-medium bg-[#00ABFF] text-white hover:bg-[#00ABFF]/90 inline-flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Student
          </Link>
        }
      />

      {batches.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No tuition students yet"
          description="Onboard your first student to get started with tuition classes."
          action={{ label: 'Onboard Student', href: '/coach/onboard-student' }}
        />
      ) : (
        <div className="space-y-4">
          {batches.map(batch => {
            const isSolo = batch.students.length === 1;
            return (
              <div
                key={batch.batchId}
                className="bg-surface-1/50 rounded-2xl border border-border p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isSolo ? (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-gradient-to-br ${getAvatarColor(batch.students[0].childName)}`}>
                        {batch.students[0].childName.charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#00ABFF]/20 flex items-center justify-center">
                        <Users className="w-4 h-4 text-[#00ABFF]" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-white text-sm">
                        {isSolo ? batch.students[0].childName : `Batch (${batch.students.length} students)`}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-text-tertiary">
                        <span>{batch.rate / 100}/session</span>
                        <span>&middot;</span>
                        <span><Clock className="w-3 h-3 inline" /> {batch.duration}m</span>
                        <span>&middot;</span>
                        <span>{batch.frequency}x/week</span>
                        <span>&middot;</span>
                        <span>{batch.mode === 'online' ? <Video className="w-3 h-3 inline" /> : <MapPin className="w-3 h-3 inline" />} {batch.mode === 'online' ? 'Online' : 'In-Person'}</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/coach/onboard-student?batchId=${batch.batchId}`}
                    className="h-8 px-3 rounded-xl text-xs font-medium border border-gray-600 text-gray-300 hover:bg-gray-700 inline-flex items-center gap-1"
                  >
                    <UserPlus className="w-3 h-3" />Add
                  </Link>
                </div>

                {/* Students */}
                {!isSolo && (
                  <div className="space-y-2 pl-10">
                    {batch.students.map(student => {
                      const pct = student.purchased > 0 ? Math.round((student.completed / student.purchased) * 100) : 0;
                      return (
                        <div key={student.childId} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-semibold text-[10px] bg-gradient-to-br ${getAvatarColor(student.childName)}`}>
                              {student.childName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-white">{student.childName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                              <div className="h-full bg-[#00ABFF] rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-text-tertiary w-12 text-right">{student.completed}/{student.purchased}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Solo student progress */}
                {isSolo && (
                  <div className="flex items-center justify-between pl-10">
                    <span className="text-xs text-text-tertiary">Progress</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#00ABFF] rounded-full"
                          style={{ width: `${batch.students[0].purchased > 0 ? Math.round((batch.students[0].completed / batch.students[0].purchased) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-tertiary">{batch.students[0].completed}/{batch.students[0].purchased}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
