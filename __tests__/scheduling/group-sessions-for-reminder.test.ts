// ============================================================================
// GROUP-SESSIONS-FOR-REMINDER TESTS
// __tests__/scheduling/group-sessions-for-reminder.test.ts
// ============================================================================
//
// Helper is a pure data transform — no mocks needed.
//
// Required coverage (Phase 1 of 2.4):
//   G1 — N=1 unbatched → one group of one
//   G2 — N=2 batched (batch_id='A') → one group of two
//   G3 — N=3 batched (batch_id='B') → one group of three
//   G4 — N=2 same slot, batch_id=null → TWO separate groups
//
// Plus joinChildNames coverage for N=0,1,2,3,4.
// ============================================================================

import {
  groupSessionsForReminder,
  joinChildNames,
  type ReminderSessionRow,
} from '@/lib/scheduling/group-sessions-for-reminder';

describe('joinChildNames (Oxford-style)', () => {
  it('N=0 → empty string', () => {
    expect(joinChildNames([])).toBe('');
  });
  it('N=1 → plain name', () => {
    expect(joinChildNames(['Harshi'])).toBe('Harshi');
  });
  it('N=2 → ampersand only', () => {
    expect(joinChildNames(['Harshi', 'Shivaay'])).toBe('Harshi & Shivaay');
  });
  it('N=3 → commas + ampersand before last', () => {
    expect(joinChildNames(['A', 'B', 'C'])).toBe('A, B & C');
  });
  it('N=4 → commas + ampersand before last', () => {
    expect(joinChildNames(['Anirudh', 'Parinee', 'Raysha', 'Suryanshi']))
      .toBe('Anirudh, Parinee, Raysha & Suryanshi');
  });
});

describe('groupSessionsForReminder', () => {
  // G1 ──────────────────────────────────────────────────────────────────
  it('G1: N=1 unbatched → one group of one', () => {
    const rows: ReminderSessionRow[] = [
      {
        id: 's1',
        batch_id: null,
        scheduled_date: '2026-05-08',
        scheduled_time: '17:30:00',
        children: { child_name: 'Harshi' },
      },
    ];

    const groups = groupSessionsForReminder(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('s1:2026-05-08:17:30:00');
    expect(groups[0].primary.id).toBe('s1');
    expect(groups[0].siblings.map((s) => s.id)).toEqual(['s1']);
    expect(groups[0].childNames).toEqual(['Harshi']);
    expect(groups[0].sessionIds).toEqual(['s1']);
    expect(joinChildNames(groups[0].childNames)).toBe('Harshi');
  });

  // G2 ──────────────────────────────────────────────────────────────────
  it('G2: N=2 batched (batch_id=A) → one group of two', () => {
    const rows: ReminderSessionRow[] = [
      {
        id: 's1',
        batch_id: 'A',
        scheduled_date: '2026-05-08',
        scheduled_time: '17:30:00',
        children: { child_name: 'Harshi' },
      },
      {
        id: 's2',
        batch_id: 'A',
        scheduled_date: '2026-05-08',
        scheduled_time: '17:30:00',
        children: { child_name: 'Shivaay' },
      },
    ];

    const groups = groupSessionsForReminder(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('A:2026-05-08:17:30:00');
    expect(groups[0].primary.id).toBe('s1');
    expect(groups[0].siblings.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(groups[0].childNames).toEqual(['Harshi', 'Shivaay']);
    expect(groups[0].sessionIds).toEqual(['s1', 's2']);
    expect(joinChildNames(groups[0].childNames)).toBe('Harshi & Shivaay');
  });

  // G3 ──────────────────────────────────────────────────────────────────
  it('G3: N=3 batched (batch_id=B) → one group of three', () => {
    const rows: ReminderSessionRow[] = [
      {
        id: 's1',
        batch_id: 'B',
        scheduled_date: '2026-05-08',
        scheduled_time: '18:00:00',
        children: { child_name: 'Anirudh' },
      },
      {
        id: 's2',
        batch_id: 'B',
        scheduled_date: '2026-05-08',
        scheduled_time: '18:00:00',
        children: { child_name: 'Parinee' },
      },
      {
        id: 's3',
        batch_id: 'B',
        scheduled_date: '2026-05-08',
        scheduled_time: '18:00:00',
        children: { child_name: 'Raysha' },
      },
    ];

    const groups = groupSessionsForReminder(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('B:2026-05-08:18:00:00');
    expect(groups[0].sessionIds).toEqual(['s1', 's2', 's3']);
    expect(groups[0].childNames).toEqual(['Anirudh', 'Parinee', 'Raysha']);
    expect(joinChildNames(groups[0].childNames)).toBe('Anirudh, Parinee & Raysha');
  });

  // G4 ──────────────────────────────────────────────────────────────────
  it('G4: N=2 same slot but batch_id=null → TWO separate groups', () => {
    const rows: ReminderSessionRow[] = [
      {
        id: 's1',
        batch_id: null,
        scheduled_date: '2026-05-08',
        scheduled_time: '17:30:00',
        children: { child_name: 'Harshi' },
      },
      {
        id: 's2',
        batch_id: null,
        scheduled_date: '2026-05-08',
        scheduled_time: '17:30:00',
        children: { child_name: 'Shivaay' },
      },
    ];

    const groups = groupSessionsForReminder(rows);

    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe('s1:2026-05-08:17:30:00');
    expect(groups[1].key).toBe('s2:2026-05-08:17:30:00');
    expect(groups[0].childNames).toEqual(['Harshi']);
    expect(groups[1].childNames).toEqual(['Shivaay']);
    expect(groups[0].sessionIds).toEqual(['s1']);
    expect(groups[1].sessionIds).toEqual(['s2']);
  });

  // Extra: children as array (Supabase join often returns arrays)
  it('tolerates children arriving as a single-element array', () => {
    const rows: ReminderSessionRow[] = [
      {
        id: 's1',
        batch_id: null,
        scheduled_date: '2026-05-08',
        scheduled_time: '17:30:00',
        children: [{ child_name: 'Harshi' }],
      },
    ];
    const groups = groupSessionsForReminder(rows);
    expect(groups[0].childNames).toEqual(['Harshi']);
  });

  // Extra: missing child row falls back to 'Student'
  it('falls back to "Student" when child relation is null', () => {
    const rows: ReminderSessionRow[] = [
      {
        id: 's1',
        batch_id: null,
        scheduled_date: '2026-05-08',
        scheduled_time: '17:30:00',
        children: null,
      },
    ];
    const groups = groupSessionsForReminder(rows);
    expect(groups[0].childNames).toEqual(['Student']);
  });
});
