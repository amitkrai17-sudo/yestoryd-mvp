// =============================================================================
// FILE: app/coach/test-session-form/page.tsx
// PURPOSE: Test page for the new SessionForm component
// ACCESS: /coach/test-session-form
// =============================================================================

'use client';

import { useState } from 'react';
import SessionForm from '@/components/coach/session-form';

export default function TestSessionFormPage() {
  const [showForm, setShowForm] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [testAge, setTestAge] = useState(8);

  // Mock data for testing
  const mockProps = {
    sessionId: 'test-session-123',
    childId: 'test-child-456',
    childName: `Test Child (Age ${testAge})`,
    childAge: testAge,
    coachId: 'test-coach-789',
    sessionNumber: 3,
    onClose: () => {
      console.log('Form closed');
      setShowForm(false);
    },
    onComplete: () => {
      console.log('Form completed successfully!');
      setCompleted(true);
      setShowForm(false);
    },
  };

  return (
    <div className="min-h-screen bg-surface-0 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">Session Form Test Page</h1>
        <p className="text-text-tertiary text-sm mb-6">
          Test the new 4-step session completion form with contextual suggestions.
        </p>

        <div className="mb-4 flex gap-4 items-center">
          <button
            onClick={() => {
              setShowForm(true);
              setCompleted(false);
            }}
            className="px-4 py-2 bg-[#00ABFF] text-white rounded-lg hover:bg-[#00ABFF]/80 transition-all"
          >
            Open Form
          </button>

          <div className="flex items-center gap-2 text-sm text-text-tertiary">
            <span>Status:</span>
            {completed ? (
              <span className="text-green-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Completed
              </span>
            ) : showForm ? (
              <span className="text-blue-400">Form Open</span>
            ) : (
              <span className="text-text-tertiary">Closed</span>
            )}
          </div>
        </div>

        {/* Test with different ages */}
        <div className="mb-6 p-4 bg-surface-1 rounded-lg border border-border">
          <p className="text-sm text-text-tertiary mb-3">Test different child ages (affects available focus areas and skills):</p>
          <div className="flex flex-wrap gap-2">
            {[5, 6, 7, 8, 9, 10, 11, 12].map(age => (
              <button
                key={age}
                onClick={() => {
                  setTestAge(age);
                  setShowForm(true);
                  setCompleted(false);
                }}
                className={`px-3 py-1.5 rounded text-sm transition-all ${
                  testAge === age && showForm
                    ? 'bg-[#00ABFF] text-white'
                    : 'bg-surface-2 text-text-secondary hover:bg-surface-3'
                }`}
              >
                Age {age}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-tertiary mt-2">
            Current: Age {testAge} | Available focus areas will filter based on age range
          </p>
        </div>

        {/* Feature checklist */}
        <div className="mb-6 p-4 bg-surface-1/50 rounded-lg border border-border">
          <p className="text-sm font-semibold text-white mb-3">Features to Test:</p>
          <ul className="text-sm text-text-tertiary space-y-1">
            <li className="flex items-start gap-2">
              <span className="text-[#00ABFF]">1.</span>
              <span>Step 1: Rating scale and focus area selection (filtered by age)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#00ABFF]">2.</span>
              <span>Step 2: Contextual quick-picks for highlights and challenges</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#00ABFF]">3.</span>
              <span>Step 2: Skills grouped by level (Foundation/Building/Advanced)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#00ABFF]">4.</span>
              <span>Step 3: AI suggestion based on progress level</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#00ABFF]">5.</span>
              <span>Step 3: Homework templates based on focus area</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#00ABFF]">6.</span>
              <span>Step 4: Review summary with all data</span>
            </li>
          </ul>
        </div>

        {showForm && (
          <SessionForm {...mockProps} />
        )}

        {/* Console output display */}
        <div className="mt-8 p-4 bg-surface-0 rounded-lg border border-border">
          <p className="text-xs text-text-tertiary mb-2">
            Open browser console (F12) to see form data structure on submit.
          </p>
          <p className="text-xs text-text-tertiary">
            Look for: Form State, Event Data, Child Summary, Content for Embedding
          </p>
        </div>

        {/* Data structure reference */}
        <div className="mt-4 p-4 bg-surface-0 rounded-lg border border-border">
          <p className="text-xs font-semibold text-text-tertiary mb-2">Expected Data Structure:</p>
          <pre className="text-xs text-text-tertiary overflow-x-auto">
{`{
  focus_area: "phonics_letter_sounds",
  overall_rating: 4,
  progress_rating: "improved",
  engagement_level: "high",
  skills_worked_on: ["Digraphs (th, sh, ch, wh)", ...],
  highlights: ["Mastered new digraph sounds", ...],
  challenges: ["Confusing similar sounds", ...],
  next_session_focus: "Continue Current Level",
  homework_items: ["Practice worksheet", ...],
  form_version: "2.0"
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
