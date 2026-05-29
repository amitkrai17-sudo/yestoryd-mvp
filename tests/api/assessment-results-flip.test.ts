// =============================================================================
// WA-FLIP-ASSESSMENT TESTS
// tests/api/assessment-results-flip.test.ts
//
//   T1 — /parent/assessment/[childId] route: well-formed UUID → 307 redirect
//        with Location pointing at /parent/intelligence/<id>.
//   T2 — /parent/assessment/[childId] route: invalid UUID → 307 fallback to
//        /parent/sessions.
//
// Caller-shape assertions (analyze route Site 1 sends 5 vars + templateButtons
// utility_cta with url='parent/assessment/<childId>') are covered by reading
// the file in CI; a route-handler integration test would require mocking
// substantially more of the analyze route's heavy pipeline than the change
// surface justifies. The shape is verified by the migration's pre/post DO
// blocks (caller-DB-Meta alignment) and by hand-grep at review time.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { GET } from '@/app/parent/assessment/[childId]/route';

function makeRequest(): any {
  return new Request('https://yestoryd.com/parent/assessment/anything') as any;
}

const params = (id: string) => ({ params: Promise.resolve({ childId: id }) });

describe('/parent/assessment/[childId] — WA-FLIP-ASSESSMENT redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('T1: well-formed UUID → 307 to /parent/intelligence/<id>', async () => {
    const childId = '9594b1c0-213c-4e30-a758-058fffac20a5';
    const response = await GET(makeRequest(), params(childId));

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).not.toBeNull();
    expect(location).toMatch(/\/parent\/intelligence\/9594b1c0-213c-4e30-a758-058fffac20a5$/);
  });

  it('T2: invalid UUID → 307 fallback to /parent/sessions', async () => {
    const response = await GET(makeRequest(), params('not-a-uuid'));

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).not.toBeNull();
    expect(location).toMatch(/\/parent\/sessions$/);
  });

  it('T2b: empty childId → 307 fallback to /parent/sessions', async () => {
    const response = await GET(makeRequest(), params(''));

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toMatch(/\/parent\/sessions$/);
  });
});
