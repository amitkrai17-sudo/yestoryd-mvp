# YESTORYD - GAP IMPLEMENTATION PLAN
## Building All 10 Verified Gaps

**Based on:** Comprehensive Logic Audit (Feb 1, 2026)  
**Principle:** Add what's missing, don't modify what's working

---

## GAP #1: REFUND PROCESSING [CRITICAL]

### 1.1 Database Schema

```sql
-- Termination/Refund tracking table
CREATE TABLE IF NOT EXISTS enrollment_terminations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id),
  
  -- Termination details
  terminated_by TEXT NOT NULL, -- 'parent', 'admin', 'system'
  termination_reason TEXT NOT NULL,
  termination_notes TEXT,
  
  -- Session accounting
  sessions_total INTEGER NOT NULL,
  sessions_completed INTEGER NOT NULL,
  sessions_remaining INTEGER NOT NULL,
  
  -- Financial calculation
  original_amount INTEGER NOT NULL,        -- Paise
  refund_amount INTEGER NOT NULL,          -- Paise (prorated)
  coach_settlement_amount INTEGER NOT NULL, -- For completed sessions
  platform_retention INTEGER NOT NULL,     -- Admin fees, etc.
  
  -- Razorpay refund
  razorpay_payment_id TEXT NOT NULL,
  razorpay_refund_id TEXT,
  refund_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  refund_initiated_at TIMESTAMPTZ,
  refund_completed_at TIMESTAMPTZ,
  refund_failure_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL
);

CREATE INDEX idx_terminations_enrollment ON enrollment_terminations(enrollment_id);
CREATE INDEX idx_terminations_status ON enrollment_terminations(refund_status);
```

### 1.2 Refund Calculation Logic

```typescript
// lib/refund/calculator.ts

interface RefundCalculation {
  originalAmount: number;
  sessionsTotal: number;
  sessionsCompleted: number;
  sessionsRemaining: number;
  refundAmount: number;
  coachSettlement: number;
  platformRetention: number;
}

export function calculateRefund(
  originalAmount: number,
  sessionsTotal: number,
  sessionsCompleted: number,
  coachCostPercent: number = 50
): RefundCalculation {
  const sessionsRemaining = sessionsTotal - sessionsCompleted;
  
  // Per-session value
  const perSessionValue = originalAmount / sessionsTotal;
  
  // Refund for unused sessions
  const refundAmount = Math.round(perSessionValue * sessionsRemaining);
  
  // Coach settlement for completed sessions
  const coachPerSession = (originalAmount * coachCostPercent / 100) / sessionsTotal;
  const coachSettlement = Math.round(coachPerSession * sessionsCompleted);
  
  // Platform keeps the rest
  const platformRetention = originalAmount - refundAmount - coachSettlement;
  
  return {
    originalAmount,
    sessionsTotal,
    sessionsCompleted,
    sessionsRemaining,
    refundAmount,
    coachSettlement,
    platformRetention,
  };
}

// Full refund eligibility (within 24 hours, no sessions)
export function isFullRefundEligible(
  paymentDate: Date,
  sessionsCompleted: number
): boolean {
  const hoursSincePurchase = (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60);
  return hoursSincePurchase < 24 && sessionsCompleted === 0;
}
```

### 1.3 Refund API Route

```typescript
// app/api/refund/initiate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import Razorpay from 'razorpay';
import { calculateRefund, isFullRefundEligible } from '@/lib/refund/calculator';
import { z } from 'zod';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const RefundSchema = z.object({
  enrollmentId: z.string().uuid(),
  reason: z.string().min(10).max(500),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const requestId = `refund_${Date.now()}`;
  const supabase = createClient();

  try {
    const body = await request.json();
    const validation = RefundSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { enrollmentId, reason, notes } = validation.data;

    // 1. Get enrollment details
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        *,
        payments!inner(razorpay_payment_id, amount),
        scheduled_sessions(id, status)
      `)
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    if (enrollment.status === 'terminated') {
      return NextResponse.json({ error: 'Enrollment already terminated' }, { status: 400 });
    }

    // 2. Calculate sessions
    const sessionsCompleted = enrollment.scheduled_sessions?.filter(
      (s: any) => s.status === 'completed'
    ).length || 0;
    const sessionsTotal = enrollment.sessions_total;

    // 3. Calculate refund
    const calculation = calculateRefund(
      enrollment.payments.amount,
      sessionsTotal,
      sessionsCompleted
    );

    // 4. Check full refund eligibility
    const fullRefund = isFullRefundEligible(
      new Date(enrollment.created_at),
      sessionsCompleted
    );

    if (fullRefund) {
      calculation.refundAmount = enrollment.payments.amount;
      calculation.coachSettlement = 0;
      calculation.platformRetention = 0;
    }

    // 5. Initiate Razorpay refund
    let razorpayRefund;
    try {
      razorpayRefund = await razorpay.payments.refund(
        enrollment.payments.razorpay_payment_id,
        {
          amount: calculation.refundAmount,
          notes: {
            enrollmentId,
            reason,
            requestId,
          },
        }
      );
    } catch (razorpayError: any) {
      console.error(JSON.stringify({
        requestId,
        event: 'razorpay_refund_failed',
        error: razorpayError.message,
      }));
      return NextResponse.json(
        { error: 'Razorpay refund failed', details: razorpayError.message },
        { status: 500 }
      );
    }

    // 6. Create termination record
    const { data: termination, error: terminationError } = await supabase
      .from('enrollment_terminations')
      .insert({
        enrollment_id: enrollmentId,
        terminated_by: 'admin',
        termination_reason: reason,
        termination_notes: notes,
        sessions_total: sessionsTotal,
        sessions_completed: sessionsCompleted,
        sessions_remaining: calculation.sessionsRemaining,
        original_amount: enrollment.payments.amount,
        refund_amount: calculation.refundAmount,
        coach_settlement_amount: calculation.coachSettlement,
        platform_retention: calculation.platformRetention,
        razorpay_payment_id: enrollment.payments.razorpay_payment_id,
        razorpay_refund_id: razorpayRefund.id,
        refund_status: 'processing',
        refund_initiated_at: new Date().toISOString(),
        created_by: admin.email,
      })
      .select()
      .single();

    if (terminationError) {
      console.error(JSON.stringify({
        requestId,
        event: 'termination_record_failed',
        error: terminationError.message,
      }));
    }

    // 7. Update enrollment status
    await supabase
      .from('enrollments')
      .update({ 
        status: 'terminated',
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    // 8. Cancel remaining sessions
    await supabase
      .from('scheduled_sessions')
      .update({ 
        status: 'cancelled',
        cancellation_reason: 'Enrollment terminated - refund processed',
      })
      .eq('enrollment_id', enrollmentId)
      .in('status', ['scheduled', 'pending']);

    // 9. Send notification to parent
    // Queue via QStash
    await fetch(`${process.env.QSTASH_URL}/v2/publish/${process.env.NEXT_PUBLIC_SITE_URL}/api/communication/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: 'refund_initiated',
        recipient: enrollment.parent_email,
        data: {
          childName: enrollment.child_name,
          refundAmount: calculation.refundAmount / 100,
          expectedDays: 7,
        },
      }),
    });

    console.log(JSON.stringify({
      requestId,
      event: 'refund_initiated',
      enrollmentId,
      refundAmount: calculation.refundAmount,
      razorpayRefundId: razorpayRefund.id,
    }));

    return NextResponse.json({
      success: true,
      termination,
      calculation,
      razorpayRefundId: razorpayRefund.id,
    });

  } catch (error: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'refund_error',
      error: error.message,
    }));
    return NextResponse.json(
      { error: 'Refund processing failed', details: error.message },
      { status: 500 }
    );
  }
}
```

### 1.4 Razorpay Refund Webhook Handler

```typescript
// Add to app/api/payment/webhook/route.ts or create separate route

// Handle refund.processed and refund.failed events
if (event === 'refund.processed') {
  const { refund } = payload.payload;
  
  await supabase
    .from('enrollment_terminations')
    .update({
      refund_status: 'completed',
      refund_completed_at: new Date().toISOString(),
    })
    .eq('razorpay_refund_id', refund.entity.id);
    
  // Send confirmation to parent
  await sendCommunication({
    template: 'refund_completed',
    // ...
  });
}

if (event === 'refund.failed') {
  const { refund } = payload.payload;
  
  await supabase
    .from('enrollment_terminations')
    .update({
      refund_status: 'failed',
      refund_failure_reason: refund.entity.error_description,
    })
    .eq('razorpay_refund_id', refund.entity.id);
    
  // Alert admin
  await sendAdminAlert({
    type: 'refund_failed',
    refundId: refund.entity.id,
    reason: refund.entity.error_description,
  });
}
```

---

## GAP #2: FAILED PAYMENT NOTIFICATION [HIGH]

### 2.1 Add to Payment Webhook

```typescript
// In app/api/payment/webhook/route.ts

// Handle payment.failed event
if (event === 'payment.failed') {
  const { payment } = payload.payload;
  const { error } = payment.entity;
  
  console.log(JSON.stringify({
    requestId,
    event: 'payment_failed',
    paymentId: payment.entity.id,
    orderId: payment.entity.order_id,
    errorCode: error?.code,
    errorDescription: error?.description,
  }));

  // Get order details for context
  const order = await razorpay.orders.fetch(payment.entity.order_id);
  const parentEmail = order.notes?.parentEmail;
  const parentPhone = order.notes?.parentPhone;
  const childName = order.notes?.childName;

  if (parentEmail || parentPhone) {
    // Create retry link (valid for 24 hours)
    const retryToken = generateSecureToken();
    
    await supabase
      .from('payment_retry_tokens')
      .insert({
        order_id: payment.entity.order_id,
        token: retryToken,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        parent_email: parentEmail,
      });

    const retryLink = `${process.env.NEXT_PUBLIC_SITE_URL}/payment/retry?token=${retryToken}`;

    // Send notification
    await fetch(`${process.env.QSTASH_URL}/v2/publish/${process.env.NEXT_PUBLIC_SITE_URL}/api/communication/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: 'payment_failed',
        recipient: parentPhone || parentEmail,
        channel: parentPhone ? 'whatsapp' : 'email',
        data: {
          childName,
          errorMessage: getHumanReadableError(error?.code),
          retryLink,
          expiresIn: '24 hours',
        },
      }),
    });
  }

  // Track for admin dashboard
  await supabase
    .from('failed_payments')
    .insert({
      razorpay_payment_id: payment.entity.id,
      razorpay_order_id: payment.entity.order_id,
      error_code: error?.code,
      error_description: error?.description,
      parent_email: parentEmail,
      amount: payment.entity.amount,
      notified: true,
    });
}

function getHumanReadableError(code: string): string {
  const errors: Record<string, string> = {
    'BAD_REQUEST_ERROR': 'Payment could not be processed. Please try again.',
    'GATEWAY_ERROR': 'Bank server is temporarily unavailable. Please try after some time.',
    'SERVER_ERROR': 'Something went wrong. Please try again.',
    'PAYMENT_CANCELLED': 'Payment was cancelled. You can retry when ready.',
  };
  return errors[code] || 'Payment failed. Please try again or use a different payment method.';
}
```

### 2.2 Payment Retry Page

```typescript
// app/payment/retry/page.tsx

'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PaymentRetryPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    async function validateToken() {
      const response = await fetch(`/api/payment/validate-retry?token=${token}`);
      const data = await response.json();
      
      if (data.expired) {
        setExpired(true);
      } else if (data.order) {
        setOrderData(data.order);
      }
      setLoading(false);
    }
    
    if (token) validateToken();
  }, [token]);

  if (loading) return <LoadingSpinner />;
  if (expired) return <ExpiredMessage />;
  if (!orderData) return <InvalidTokenMessage />;

  return (
    <PaymentForm 
      orderId={orderData.id}
      amount={orderData.amount}
      prefillData={orderData.notes}
    />
  );
}
```

### 2.3 Database Table

```sql
CREATE TABLE IF NOT EXISTS payment_retry_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  parent_email TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_retry_tokens_token ON payment_retry_tokens(token);
CREATE INDEX idx_retry_tokens_order ON payment_retry_tokens(order_id);

CREATE TABLE IF NOT EXISTS failed_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_payment_id TEXT NOT NULL,
  razorpay_order_id TEXT NOT NULL,
  error_code TEXT,
  error_description TEXT,
  parent_email TEXT,
  amount INTEGER,
  notified BOOLEAN DEFAULT false,
  retry_count INTEGER DEFAULT 0,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_failed_payments_order ON failed_payments(razorpay_order_id);
```

---

## GAP #3: ADMIN PAYMENTS DASHBOARD [MEDIUM]

### 3.1 Dashboard Page

```typescript
// app/admin/payments/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';

export default function AdminPaymentsDashboard() {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchPayments();
    fetchStats();
  }, [dateRange, statusFilter]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Payments Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Today's Revenue" value={stats?.todayRevenue} />
        <StatCard title="This Month" value={stats?.monthRevenue} />
        <StatCard title="Failed Payments" value={stats?.failedCount} variant="warning" />
        <StatCard title="Pending Refunds" value={stats?.pendingRefunds} />
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
        <ExportButton onClick={exportToCSV} />
      </div>

      {/* Payments Table */}
      <DataTable 
        columns={paymentColumns}
        data={payments}
        onRowClick={(payment) => openPaymentDetail(payment.id)}
      />
    </div>
  );
}

const paymentColumns = [
  { key: 'created_at', header: 'Date', format: 'datetime' },
  { key: 'parent_name', header: 'Parent' },
  { key: 'child_name', header: 'Child' },
  { key: 'amount', header: 'Amount', format: 'currency' },
  { key: 'status', header: 'Status', render: StatusBadge },
  { key: 'razorpay_payment_id', header: 'Razorpay ID' },
  { key: 'actions', header: '', render: ActionMenu },
];
```

### 3.2 Dashboard API

```typescript
// app/api/admin/payments/route.ts

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const supabase = createClient();
  
  let query = supabase
    .from('payments')
    .select(`
      *,
      enrollments(id, status, child_name),
      enrollment_terminations(refund_status, refund_amount)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  if (status && status !== 'all') query = query.eq('status', status);

  const { data, count, error } = await query;

  return NextResponse.json({ payments: data, total: count, page, limit });
}

// Stats endpoint
// app/api/admin/payments/stats/route.ts
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().setDate(1)).toISOString();

  const [todayResult, monthResult, failedResult, refundResult] = await Promise.all([
    supabase.from('payments').select('amount').eq('status', 'captured').gte('created_at', today),
    supabase.from('payments').select('amount').eq('status', 'captured').gte('created_at', monthStart),
    supabase.from('failed_payments').select('id', { count: 'exact', head: true }).is('converted_at', null),
    supabase.from('enrollment_terminations').select('id', { count: 'exact', head: true }).eq('refund_status', 'pending'),
  ]);

  return NextResponse.json({
    todayRevenue: todayResult.data?.reduce((sum, p) => sum + p.amount, 0) || 0,
    monthRevenue: monthResult.data?.reduce((sum, p) => sum + p.amount, 0) || 0,
    failedCount: failedResult.count || 0,
    pendingRefunds: refundResult.count || 0,
  });
}
```

---

## GAP #4: E-LEARNING CONTENT [HIGH - CONTENT WORK]

**This is primarily content creation, not code work.**

### 4.1 Content Requirements

| Stage | Age | Videos Needed | Topics |
|-------|-----|---------------|--------|
| Foundation | 4-6 | 159-393 | Letter sounds, blending, CVC words |
| Building | 7-9 | 159-393 | Digraphs, long vowels, fluency |
| Mastery | 10-12 | 159-393 | Advanced phonics, comprehension |

### 4.2 Infrastructure Already Exists

- `elearning_modules` table ✅
- `elearning_progress` tracking ✅
- rAI recommendation engine ✅
- Gamification system ✅

### 4.3 Content Pipeline (Not Code)

1. Script writing (GravityWrite)
2. Recording (Camtasia)
3. Editing
4. Upload to YouTube unlisted
5. Create module records in database
6. Link quizzes

---

## GAP #5: DISCOVERY_CALLS.CHILD_ID FK [MEDIUM]

### 5.1 Migration SQL

```sql
-- Add column with foreign key
ALTER TABLE discovery_calls 
ADD COLUMN IF NOT EXISTS child_id UUID REFERENCES children(id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_discovery_calls_child_id 
ON discovery_calls(child_id);

-- Backfill existing records
UPDATE discovery_calls dc 
SET child_id = (
  SELECT c.id 
  FROM children c 
  WHERE LOWER(c.parent_email) = LOWER(dc.parent_email)
  ORDER BY c.created_at DESC 
  LIMIT 1
)
WHERE dc.child_id IS NULL 
  AND dc.parent_email IS NOT NULL;

-- Verify backfill
SELECT 
  COUNT(*) as total,
  COUNT(child_id) as linked,
  COUNT(*) - COUNT(child_id) as unlinked
FROM discovery_calls;
```

### 5.2 Update Cal.com Webhook

```typescript
// In app/api/webhooks/cal/route.ts

// After extracting booking data, look up child
const { data: existingChild } = await supabase
  .from('children')
  .select('id')
  .eq('parent_email', parentEmail.toLowerCase())
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

// Include child_id in insert
const { data: discoveryCall } = await supabase
  .from('discovery_calls')
  .insert({
    // ... existing fields
    child_id: existingChild?.id || null,
  })
  .select()
  .single();
```

### 5.3 Update Assessment Completion

```typescript
// In assessment completion flow

// After creating/updating child, link any unlinked discovery calls
const { data: unlinkedCall } = await supabase
  .from('discovery_calls')
  .select('id')
  .eq('parent_email', parentEmail.toLowerCase())
  .is('child_id', null)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (unlinkedCall) {
  await supabase
    .from('discovery_calls')
    .update({ child_id: child.id })
    .eq('id', unlinkedCall.id);
}
```

---

## GAP #6: PARENT SELF-SERVICE RESCHEDULING [MEDIUM]

### 6.1 Database Schema

```sql
-- Track reschedule limits
ALTER TABLE enrollments 
ADD COLUMN IF NOT EXISTS reschedules_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_reschedules INTEGER DEFAULT 2;
```

### 6.2 Reschedule API

```typescript
// app/api/parent/session/reschedule/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireParentAuth } from '@/lib/api-auth';
import { findAvailableSlots } from '@/lib/scheduling/slot-finder';
import { updateCalendarEvent } from '@/lib/googleCalendar';

const RescheduleSchema = z.object({
  sessionId: z.string().uuid(),
  newDateTime: z.string().datetime(),
});

export async function POST(request: NextRequest) {
  const parent = await requireParentAuth(request);
  if (parent instanceof NextResponse) return parent;

  const supabase = createClient();
  const body = await request.json();
  const validation = RescheduleSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { sessionId, newDateTime } = validation.data;

  // 1. Verify session belongs to parent's child
  const { data: session } = await supabase
    .from('scheduled_sessions')
    .select(`
      *,
      enrollments!inner(id, reschedules_used, max_reschedules, parent_id),
      children!inner(parent_id)
    `)
    .eq('id', sessionId)
    .eq('children.parent_id', parent.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // 2. Check reschedule limit
  if (session.enrollments.reschedules_used >= session.enrollments.max_reschedules) {
    return NextResponse.json({ 
      error: 'Reschedule limit reached. Please contact support.' 
    }, { status: 400 });
  }

  // 3. Verify new slot is available
  const isAvailable = await checkSlotAvailability(
    session.coach_id,
    new Date(newDateTime),
    session.session_type
  );

  if (!isAvailable) {
    return NextResponse.json({ error: 'Selected time is not available' }, { status: 400 });
  }

  // 4. Update session
  const oldDateTime = session.scheduled_time;
  
  await supabase
    .from('scheduled_sessions')
    .update({
      scheduled_time: newDateTime,
      rescheduled_from: oldDateTime,
      rescheduled_at: new Date().toISOString(),
      rescheduled_by: 'parent',
    })
    .eq('id', sessionId);

  // 5. Update Google Calendar
  if (session.google_event_id) {
    await updateCalendarEvent(session.google_event_id, {
      startTime: newDateTime,
      // ... other details
    });
  }

  // 6. Increment reschedule count
  await supabase
    .from('enrollments')
    .update({ 
      reschedules_used: session.enrollments.reschedules_used + 1 
    })
    .eq('id', session.enrollment_id);

  // 7. Notify coach
  await sendCommunication({
    template: 'session_rescheduled_coach',
    recipient: session.coach_email,
    data: {
      childName: session.child_name,
      oldTime: oldDateTime,
      newTime: newDateTime,
    },
  });

  return NextResponse.json({ success: true, newDateTime });
}
```

### 6.3 Available Slots API

```typescript
// app/api/parent/session/available-slots/route.ts

export async function GET(request: NextRequest) {
  const parent = await requireParentAuth(request);
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const weekStart = searchParams.get('weekStart');

  // Get session details
  const { data: session } = await supabase
    .from('scheduled_sessions')
    .select('coach_id, session_type')
    .eq('id', sessionId)
    .single();

  // Find available slots using existing slot finder
  const slots = await findAvailableSlots({
    coachId: session.coach_id,
    sessionType: session.session_type,
    weekStart: new Date(weekStart),
    excludeSessionId: sessionId,
  });

  return NextResponse.json({ slots });
}
```

---

## GAP #7: NOTIFICATION PREFERENCES [LOW]

### 7.1 Database Schema

```sql
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "whatsapp": true,
  "email": true,
  "sms": false,
  "marketing": false,
  "session_reminders": true,
  "progress_updates": true,
  "promotional": false
}'::jsonb;
```

### 7.2 Preferences API

```typescript
// app/api/parent/notification-preferences/route.ts

export async function GET(request: NextRequest) {
  const parent = await requireParentAuth(request);
  
  const { data } = await supabase
    .from('parents')
    .select('notification_preferences')
    .eq('id', parent.id)
    .single();

  return NextResponse.json(data?.notification_preferences || {});
}

export async function PUT(request: NextRequest) {
  const parent = await requireParentAuth(request);
  const preferences = await request.json();

  await supabase
    .from('parents')
    .update({ notification_preferences: preferences })
    .eq('id', parent.id);

  return NextResponse.json({ success: true });
}
```

### 7.3 Update Communication Send

```typescript
// In lib/communication/index.ts

async function shouldSendNotification(
  parentId: string,
  channel: 'whatsapp' | 'email' | 'sms',
  type: 'session_reminders' | 'progress_updates' | 'promotional'
): Promise<boolean> {
  const { data: parent } = await supabase
    .from('parents')
    .select('notification_preferences')
    .eq('id', parentId)
    .single();

  const prefs = parent?.notification_preferences || {};
  
  // Check channel enabled
  if (prefs[channel] === false) return false;
  
  // Check notification type enabled
  if (prefs[type] === false) return false;
  
  return true;
}
```

---

## GAP #8: COACH SKILL MATCHING [LOW]

### 8.1 Database Schema

```sql
CREATE TABLE IF NOT EXISTS coach_specializations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES coaches(id),
  specialization_type TEXT NOT NULL, -- 'age_group', 'phonics_level', 'learning_need'
  specialization_value TEXT NOT NULL, -- '4-6', 'foundation', 'dyslexia'
  proficiency_level INTEGER DEFAULT 5, -- 1-10
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coach_specializations ON coach_specializations(coach_id);
CREATE INDEX idx_specializations_type ON coach_specializations(specialization_type, specialization_value);
```

### 8.2 Enhanced Smart Match

```typescript
// Add to existing smart match function

// Calculate skill match score
const skillMatchScore = calculateSkillMatch(coach.specializations, child);

function calculateSkillMatch(
  specializations: Specialization[],
  child: Child
): number {
  let score = 0;
  
  // Age group match
  const ageSpec = specializations.find(
    s => s.specialization_type === 'age_group' && 
         isAgeInRange(child.age, s.specialization_value)
  );
  if (ageSpec) score += ageSpec.proficiency_level * 2;
  
  // Phonics level match
  const phonicsSpec = specializations.find(
    s => s.specialization_type === 'phonics_level' &&
         s.specialization_value === child.phonics_focus
  );
  if (phonicsSpec) score += phonicsSpec.proficiency_level * 3;
  
  // Learning needs match
  if (child.learning_needs) {
    const needsSpec = specializations.find(
      s => s.specialization_type === 'learning_need' &&
           s.specialization_value === child.learning_needs
    );
    if (needsSpec) score += needsSpec.proficiency_level * 4;
  }
  
  return score;
}
```

---

## GAP #9: AUTOMATED LEAD SCORING [LOW]

### 9.1 Scoring Algorithm

```typescript
// lib/crm/lead-scoring.ts

interface LeadScore {
  total: number;
  breakdown: {
    assessmentComplete: number;
    engagementScore: number;
    responseTimeScore: number;
    discoveryBooked: number;
  };
  status: 'hot' | 'warm' | 'cold';
}

export function calculateLeadScore(child: Child, interactions: Interaction[]): LeadScore {
  const breakdown = {
    assessmentComplete: child.assessment_completed ? 30 : 0,
    engagementScore: calculateEngagement(interactions),
    responseTimeScore: calculateResponseTime(interactions),
    discoveryBooked: child.discovery_call_id ? 20 : 0,
  };
  
  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  
  return {
    total,
    breakdown,
    status: total >= 70 ? 'hot' : total >= 40 ? 'warm' : 'cold',
  };
}
```

### 9.2 Scoring Cron

```typescript
// app/api/cron/lead-scoring/route.ts

export async function POST(request: NextRequest) {
  // Run nightly to update lead scores
  
  const { data: children } = await supabase
    .from('children')
    .select('*, communication_logs(*)')
    .eq('status', 'lead');

  for (const child of children) {
    const score = calculateLeadScore(child, child.communication_logs);
    
    await supabase
      .from('children')
      .update({ 
        lead_score: score.total,
        lead_status: score.status,
      })
      .eq('id', child.id);
  }
  
  return NextResponse.json({ processed: children.length });
}
```

---

## GAP #10: PAYOUT-TO-BANK RECONCILIATION [MEDIUM]

### 10.1 Database Schema

```sql
ALTER TABLE coach_payouts
ADD COLUMN IF NOT EXISTS bank_transfer_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS bank_transfer_date DATE,
ADD COLUMN IF NOT EXISTS bank_utr_number TEXT,
ADD COLUMN IF NOT EXISTS bank_transfer_proof_url TEXT,
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reconciled_by TEXT;
```

### 10.2 Reconciliation API

```typescript
// app/api/admin/payouts/reconcile/route.ts

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  
  const body = await request.json();
  const { payoutId, utrNumber, transferDate, proofUrl } = body;

  await supabase
    .from('coach_payouts')
    .update({
      bank_transfer_status: 'completed',
      bank_transfer_date: transferDate,
      bank_utr_number: utrNumber,
      bank_transfer_proof_url: proofUrl,
      reconciled_at: new Date().toISOString(),
      reconciled_by: admin.email,
    })
    .eq('id', payoutId);

  // Generate receipt for coach
  await generateCoachReceipt(payoutId);

  return NextResponse.json({ success: true });
}
```

---

## EXECUTION ORDER

```
Week 1: Critical & High Priority
├── Day 1-2: Gap #1 - Refund Processing (4-6 hrs)
├── Day 3: Gap #2 - Failed Payment Notification (2-3 hrs)
└── Day 4-5: Gap #5 - discovery_calls FK (1 hr) + Gap #3 - Payments Dashboard (4-6 hrs)

Week 2: Medium Priority
├── Day 1-2: Gap #6 - Parent Self-Reschedule (4-6 hrs)
├── Day 3: Gap #10 - Payout Reconciliation (3-4 hrs)
└── Day 4-5: Gap #7 - Notification Preferences (2-3 hrs)

Week 3: Low Priority (Optional)
├── Gap #8 - Coach Skill Matching (3-4 hrs)
└── Gap #9 - Automated Lead Scoring (2-3 hrs)

Ongoing: Gap #4 - E-Learning Content (Content team, not code)
```

---

## CLAUDE CODE EXECUTION

For each gap, paste:

```
Implement Gap #X from YESTORYD-GAP-IMPLEMENTATION-PLAN.md

Start with the database schema, then create the API routes, then any UI components.
Follow the existing patterns in the codebase.
Do not modify existing working logic.
```
