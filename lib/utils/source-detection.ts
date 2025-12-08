/**
 * Source Detection Utility
 * Determines where a parent came from to correctly assign coaches and track revenue
 */

export interface SourceInfo {
  source: string;
  type: 'platform' | 'coach_direct' | 'campaign' | 'unknown';
  coachId?: string;
  coachSubdomain?: string;
  assignTo: string;
  canReassign: boolean;
}

// Coach subdomain to ID mapping
const COACH_SUBDOMAIN_MAP: Record<string, string> = {
  'rucha': 'coach_001',
  'priya': 'coach_002',
  'amit': 'coach_003',
  // Add more coaches as they join
};

// Default coach (Rucha - founder)
const DEFAULT_COACH_ID = 'coach_001';

/**
 * Detect the source of a visitor and determine coach assignment
 */
export function detectSource(referer: string | null, hostname?: string): SourceInfo {
  // If we have hostname directly (from middleware), use it
  const urlToCheck = hostname || referer || '';
  
  try {
    // Handle direct hostname check (from middleware)
    if (hostname) {
      return detectFromHostname(hostname);
    }
    
    // Handle referer URL check
    if (referer) {
      const url = new URL(referer);
      return detectFromHostname(url.hostname);
    }
  } catch (error) {
    // Invalid URL, return default
  }

  // Default: came from unknown source, assign to Rucha
  return {
    source: 'direct',
    type: 'unknown',
    assignTo: DEFAULT_COACH_ID,
    canReassign: true,
  };
}

function detectFromHostname(hostname: string): SourceInfo {
  const parts = hostname.split('.');
  
  // Local development (localhost:3000)
  if (hostname.includes('localhost')) {
    return {
      source: 'localhost',
      type: 'platform',
      assignTo: DEFAULT_COACH_ID,
      canReassign: true,
    };
  }

  // Main domain (yestoryd.com or www.yestoryd.com)
  if (hostname === 'yestoryd.com' || hostname === 'www.yestoryd.com') {
    return {
      source: 'yestoryd.com',
      type: 'platform',
      assignTo: DEFAULT_COACH_ID,
      canReassign: true, // Rucha can reassign to other coaches
    };
  }

  // Coach subdomain (e.g., rucha.yestoryd.com, priya.yestoryd.com)
  if (parts.length === 3 && parts[1] === 'yestoryd' && parts[2] === 'com') {
    const subdomain = parts[0].toLowerCase();
    
    // Skip special subdomains
    if (['www', 'admin', 'api', 'dashboard'].includes(subdomain)) {
      return {
        source: 'yestoryd.com',
        type: 'platform',
        assignTo: DEFAULT_COACH_ID,
        canReassign: true,
      };
    }

    // Look up coach by subdomain
    const coachId = COACH_SUBDOMAIN_MAP[subdomain];
    
    if (coachId) {
      return {
        source: `${subdomain}.yestoryd.com`,
        type: 'coach_direct',
        coachId: coachId,
        coachSubdomain: subdomain,
        assignTo: coachId,
        canReassign: false, // Direct referral, stays with that coach
      };
    }
  }

  // Unknown source, default to Rucha
  return {
    source: hostname,
    type: 'unknown',
    assignTo: DEFAULT_COACH_ID,
    canReassign: true,
  };
}

/**
 * Get assignment type based on how student was assigned
 */
export function getAssignmentType(sourceInfo: SourceInfo, wasReassigned: boolean = false): string {
  if (wasReassigned) {
    return 'rucha_assigned'; // Manually reassigned by Rucha
  }
  
  if (sourceInfo.type === 'coach_direct') {
    return 'direct'; // Came directly from coach's page
  }
  
  return 'auto_rucha'; // Default assignment to Rucha from main platform
}

/**
 * Check if this coach assignment is eligible for Rucha's dual income
 * (She gets both coach share + platform share when she's the coach)
 */
export function isRuchaDualIncome(coachId: string): boolean {
  return coachId === DEFAULT_COACH_ID;
}
