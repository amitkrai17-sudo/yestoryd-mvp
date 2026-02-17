// file: lib/rai/admin-insights.ts
// Retrieves pre-computed insights for admin queries

import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

// ============================================================
// INSIGHT TYPES
// ============================================================

export type InsightType = 
  | 'at_risk_children'
  | 'top_coaches'
  | 'conversion_rate'
  | 'inactive_children'
  | 'revenue_trends'
  | 'coach_workload'
  | 'session_completion'
  | 'weekly_summary';

// ============================================================
// QUERY → INSIGHT TYPE MAPPING
// ============================================================

const INSIGHT_PATTERNS: Array<{ pattern: RegExp; insightType: InsightType }> = [
  // At-risk children
  { pattern: /at.?risk|struggling|need.?attention|falling.?behind|concern/i, insightType: 'at_risk_children' },
  
  // Top coaches
  { pattern: /top.?coach|best.?coach|performing.?coach|coach.?ranking/i, insightType: 'top_coaches' },
  
  // Conversion rate
  { pattern: /conversion|enroll.?rate|assess.?to.?enroll|signup.?rate/i, insightType: 'conversion_rate' },
  
  // Inactive children
  { pattern: /inactive|no.?session|missing|absent|haven.?t.?attended|2.?weeks?/i, insightType: 'inactive_children' },
  
  // Revenue trends
  { pattern: /revenue|earning|income|money|financial|growth.?rate|month.?over.?month/i, insightType: 'revenue_trends' },
  
  // Coach workload
  { pattern: /workload|distribution|capacity|how.?many.?students|coach.?load/i, insightType: 'coach_workload' },
  
  // Session completion
  { pattern: /completion.?rate|session.?rate|no.?show|cancelled|attendance/i, insightType: 'session_completion' },
  
  // Weekly summary (catch-all for general health questions)
  { pattern: /summary|overview|health|status|how.?are.?we.?doing|platform.?status/i, insightType: 'weekly_summary' },
];

// ============================================================
// DETECT INSIGHT TYPE FROM QUERY
// ============================================================

export function detectInsightType(query: string): InsightType | null {
  const lowerQuery = query.toLowerCase();
  
  for (const { pattern, insightType } of INSIGHT_PATTERNS) {
    if (pattern.test(lowerQuery)) {
      return insightType;
    }
  }
  
  return null;
}

// ============================================================
// GET INSIGHT FROM DATABASE
// ============================================================

export async function getInsight(insightType: InsightType): Promise<any | null> {
  const { data, error } = await supabase
    .from('admin_insights')
    .select('insight_data, computed_at')
    .eq('insight_type', insightType)
    .order('computed_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) {
    console.warn(`No insight found for type: ${insightType}`);
    return null;
  }
  
  return {
    ...(data.insight_data as Record<string, unknown>),
    _computed_at: data.computed_at
  };
}

// ============================================================
// FORMAT INSIGHT FOR RESPONSE
// ============================================================

export function formatInsightResponse(insightType: InsightType, data: any): string {
  if (!data) {
    return "I don't have recent data for that. The insights are computed weekly on Sunday night. Would you like me to check something else?";
  }
  
  const computedDate = new Date(data._computed_at || data.computed_at);
  const daysAgo = Math.floor((Date.now() - computedDate.getTime()) / (1000 * 60 * 60 * 24));
  const freshness = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;
  
  switch (insightType) {
    case 'at_risk_children':
      return formatAtRiskChildren(data, freshness);
    
    case 'top_coaches':
      return formatTopCoaches(data, freshness);
    
    case 'conversion_rate':
      return formatConversionRate(data, freshness);
    
    case 'inactive_children':
      return formatInactiveChildren(data, freshness);
    
    case 'revenue_trends':
      return formatRevenueTrends(data, freshness);
    
    case 'coach_workload':
      return formatCoachWorkload(data, freshness);
    
    case 'session_completion':
      return formatSessionCompletion(data, freshness);
    
    case 'weekly_summary':
      return formatWeeklySummary(data, freshness);
    
    default:
      return `Here's the data: ${JSON.stringify(data)}`;
  }
}

// ============================================================
// FORMAT FUNCTIONS FOR EACH INSIGHT TYPE
// ============================================================

function formatAtRiskChildren(data: any, freshness: string): string {
  const count = data.count || 0;
  
  if (count === 0) {
    return `Great news! No children are currently at risk. All enrolled students have had sessions in the last 2 weeks. (Updated ${freshness})`;
  }
  
  const children = data.children || [];
  const names = children.slice(0, 5).map((c: any) => c.child_name).join(', ');
  const moreCount = count > 5 ? ` and ${count - 5} more` : '';
  
  return `⚠️ ${count} children need attention (no completed session in 14+ days):\n\n${names}${moreCount}\n\nCriteria: ${data.criteria}\n(Updated ${freshness})`;
}

function formatTopCoaches(data: any, freshness: string): string {
  const coaches = data.coaches || [];
  
  if (coaches.length === 0) {
    return `No coach performance data available yet. (Updated ${freshness})`;
  }
  
  const top3 = coaches.slice(0, 3).map((c: any, i: number) => 
    `${i + 1}. ${c.name} - ${c.sessions_completed} sessions (${c.completion_rate}% completion, ${c.student_count} students)`
  ).join('\n');
  
  return `🏆 Top Performing Coaches (${data.period}):\n\n${top3}\n\n(Updated ${freshness})`;
}

function formatConversionRate(data: any, freshness: string): string {
  return `📊 Enrollment Conversion:\n\n• Total Assessed: ${data.total_assessed}\n• Total Enrolled: ${data.total_enrolled}\n• Conversion Rate: ${data.conversion_rate}%\n\nPeriod: ${data.period}\n(Updated ${freshness})`;
}

function formatInactiveChildren(data: any, freshness: string): string {
  const count = data.count || 0;
  
  if (count === 0) {
    return `✅ All enrolled children are active! Everyone has sessions scheduled or completed recently. (Updated ${freshness})`;
  }
  
  const children = data.children || [];
  const names = children.slice(0, 5).map((c: any) => c.child_name).join(', ');
  const moreCount = count > 5 ? ` and ${count - 5} more` : '';
  
  return `⚠️ ${count} children inactive for 2+ weeks:\n\n${names}${moreCount}\n\nConsider reaching out to re-engage these families.\n(Updated ${freshness})`;
}

function formatRevenueTrends(data: any, freshness: string): string {
  const thisMonth = (data.this_month / 100).toLocaleString('en-IN'); // Convert paise to rupees
  const lastMonth = (data.last_month / 100).toLocaleString('en-IN');
  const growth = data.growth_rate;
  const growthEmoji = growth > 0 ? '📈' : growth < 0 ? '📉' : '➡️';
  
  return `${growthEmoji} Revenue Trends:\n\n• ${data.this_month_name}: ₹${thisMonth}\n• ${data.last_month_name}: ₹${lastMonth}\n• Growth: ${growth > 0 ? '+' : ''}${growth}%\n\n(Updated ${freshness})`;
}

function formatCoachWorkload(data: any, freshness: string): string {
  const coaches = data.coaches || [];
  
  const distribution = coaches.slice(0, 5).map((c: any) => 
    `• ${c.name}: ${c.student_count} students, ${c.upcoming_sessions} upcoming sessions`
  ).join('\n');
  
  return `👥 Coach Workload Distribution:\n\n${distribution}\n\nTotal Students: ${data.total_students}\nAvg per Coach: ${data.average_per_coach}\n\n(Updated ${freshness})`;
}

function formatSessionCompletion(data: any, freshness: string): string {
  return `📅 Session Stats (${data.period}):\n\n• Total Sessions: ${data.total_sessions}\n• Completed: ${data.completed} ✅\n• No-shows: ${data.no_show} ❌\n• Cancelled: ${data.cancelled} 🚫\n• Completion Rate: ${data.completion_rate}%\n\n(Updated ${freshness})`;
}

function formatWeeklySummary(data: any, freshness: string): string {
  return `📊 Platform Health Summary:\n\n• At-Risk Children: ${data.at_risk_count}\n• Inactive (2+ weeks): ${data.inactive_count}\n• Conversion Rate: ${data.conversion_rate}%\n• Session Completion: ${data.session_completion_rate}%\n• Revenue This Month: ₹${((data.revenue_this_month || 0) / 100).toLocaleString('en-IN')}\n• Revenue Growth: ${data.revenue_growth > 0 ? '+' : ''}${data.revenue_growth}%\n• Active Coaches: ${data.total_coaches}\n\n(Updated ${freshness})`;
}

// ============================================================
// MAIN HANDLER FOR ADMIN INSIGHT QUERIES
// ============================================================

export async function handleAdminInsightQuery(query: string): Promise<string | null> {
  const insightType = detectInsightType(query);
  
  if (!insightType) {
    return null; // Not an insight query, let regular handler process it
  }
  
  const data = await getInsight(insightType);
  return formatInsightResponse(insightType, data);
}
