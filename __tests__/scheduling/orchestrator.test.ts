// ============================================================================
// ORCHESTRATOR TESTS
// __tests__/scheduling/orchestrator.test.ts
// ============================================================================

// Mock all external dependencies
const mockFrom = jest.fn();
const mockSupabase = { from: mockFrom };

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

jest.mock('@/lib/scheduling/session-manager', () => ({
  scheduleSession: jest.fn().mockResolvedValue({ success: true, sessionId: 'sess-1' }),
  rescheduleSession: jest.fn().mockResolvedValue({ success: true, sessionId: 'sess-1', meetLink: 'https://meet.google.com/test' }),
  cancelSession: jest.fn().mockResolvedValue({ success: true, sessionId: 'sess-1' }),
  bulkReassign: jest.fn().mockResolvedValue({ success: true, sessionsReassigned: 2, errors: [] }),
}));

jest.mock('@/lib/scheduling/coach-availability-handler', () => ({
  processUnavailability: jest.fn().mockResolvedValue({ success: true, action: 'rescheduled', sessionsAffected: 2, errors: [] }),
  processCoachReturn: jest.fn().mockResolvedValue({ success: true, sessionsTransferredBack: 1, errors: [] }),
  processCoachExit: jest.fn().mockResolvedValue({ success: true, enrollmentsReassigned: 1, errors: [] }),
}));

jest.mock('@/lib/scheduling/enrollment-scheduler', () => ({
  scheduleEnrollmentSessions: jest.fn().mockResolvedValue({ success: true, sessionsCreated: 12, manualRequired: 0, errors: [] }),
}));

jest.mock('@/lib/settings/getSettings', () => ({
  getSetting: jest.fn().mockResolvedValue('3'),
}));

jest.mock('@/lib/scheduling/redis-store', () => ({
  checkIdempotency: jest.fn().mockResolvedValue({ isDuplicate: false }),
  setIdempotency: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/scheduling/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { dispatch } from '@/lib/scheduling/orchestrator';
import { cancelSession, rescheduleSession } from '@/lib/scheduling/session-manager';
import { processUnavailability } from '@/lib/scheduling/coach-availability-handler';
import { checkIdempotency, setIdempotency } from '@/lib/scheduling/redis-store';

const mockCheckIdempotency = checkIdempotency as jest.Mock;
const mockSetIdempotency = setIdempotency as jest.Mock;

describe('Scheduling Orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckIdempotency.mockResolvedValue({ isDuplicate: false });
    mockSetIdempotency.mockResolvedValue(undefined);
  });

  // ========================================================================
  // session.cancel
  // ========================================================================
  describe('session.cancel', () => {
    it('should cancel session via session-manager', async () => {
      const result = await dispatch('session.cancel', {
        sessionId: 'test-session-id',
        reason: 'Test cancellation',
        cancelledBy: 'parent',
        requestId: 'req-1',
      });

      expect(result.success).toBe(true);
      expect(result.event).toBe('session.cancel');
      expect(cancelSession).toHaveBeenCalledWith('test-session-id', 'Test cancellation', 'parent');
    });

    it('should fail when sessionId is missing', async () => {
      const result = await dispatch('session.cancel', {
        reason: 'No session ID',
        requestId: 'req-2',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('sessionId required');
    });
  });

  // ========================================================================
  // session.reschedule
  // ========================================================================
  describe('session.reschedule', () => {
    it('should reschedule session with new date/time', async () => {
      const result = await dispatch('session.reschedule', {
        sessionId: 'sess-1',
        newDate: '2026-02-15',
        newTime: '16:00',
        reason: 'Parent requested',
        requestId: 'req-3',
      });

      expect(result.success).toBe(true);
      expect(rescheduleSession).toHaveBeenCalledWith(
        'sess-1',
        { date: '2026-02-15', time: '16:00' },
        'Parent requested'
      );
    });

    it('should fail when required fields are missing', async () => {
      const result = await dispatch('session.reschedule', {
        sessionId: 'sess-1',
        requestId: 'req-4',
        // Missing newDate and newTime
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('newDate');
    });
  });

  // ========================================================================
  // coach.unavailable
  // ========================================================================
  describe('coach.unavailable', () => {
    it('should process coach unavailability', async () => {
      const result = await dispatch('coach.unavailable', {
        coachId: 'coach-1',
        startDate: '2026-02-01',
        endDate: '2026-02-03',
        reason: 'Sick leave',
        requestId: 'req-5',
      });

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('rescheduled');
      expect(processUnavailability).toHaveBeenCalledWith(
        'coach-1', '2026-02-01', '2026-02-03', 'Sick leave'
      );
    });

    it('should fail when required fields are missing', async () => {
      const result = await dispatch('coach.unavailable', {
        coachId: 'coach-1',
        requestId: 'req-6',
        // Missing startDate, endDate
      });

      expect(result.success).toBe(false);
    });
  });

  // ========================================================================
  // session.no_show
  // ========================================================================
  describe('session.no_show', () => {
    it('should fail when sessionId is missing', async () => {
      const result = await dispatch('session.no_show', {
        requestId: 'req-7',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('sessionId required');
    });
  });

  // ========================================================================
  // Idempotency
  // ========================================================================
  describe('idempotency', () => {
    it('should return cached result for duplicate events from Redis', async () => {
      const cachedResult = { success: true, event: 'session.cancel' as const, data: { sessionId: 'sess-1' } };
      mockCheckIdempotency.mockResolvedValue({ isDuplicate: true, cachedResult });

      const result = await dispatch('session.cancel', {
        sessionId: 'sess-1',
        reason: 'Test',
        requestId: 'req-8',
      });

      expect(result).toEqual(cachedResult);
      expect(cancelSession).not.toHaveBeenCalled();
    });

    it('should store result in Redis after processing', async () => {
      await dispatch('session.cancel', {
        sessionId: 'sess-1',
        reason: 'Test',
        requestId: 'req-9',
      });

      expect(mockSetIdempotency).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ success: true }),
        expect.any(Number)
      );
    });
  });

  // ========================================================================
  // Unknown events
  // ========================================================================
  describe('unknown events', () => {
    it('should return error for unknown event type', async () => {
      const result = await dispatch('unknown.event' as any, {
        requestId: 'req-10',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown event');
    });
  });
});
