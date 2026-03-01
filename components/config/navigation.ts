import { type LucideIcon } from 'lucide-react';
import {
  Home,
  Users,
  Calendar,
  Phone,
  User,
  BarChart3,
  BookOpen,
  GraduationCap,
  HelpCircle,
  MessageSquare,
  Settings,
  Briefcase,
  FileText,
  LayoutDashboard,
  CheckSquare,
  MapPin,
  Radio,
  IndianRupee,
  Brain,
  Ticket,
  UserSearch,
  UserPlus,
} from 'lucide-react';

export type PortalType = 'parent' | 'coach' | 'admin';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group?: string;
  badge?: number;
}

export interface PortalNavConfig {
  basePath: string;
  portalName: string;
  bottomNav: NavItem[];  // Max 5 items for mobile bottom nav
  sidebar: NavItem[];    // All items including secondary
}

export const navigationConfig: Record<PortalType, PortalNavConfig> = {
  // ===========================================================================
  // PARENT
  // ===========================================================================
  parent: {
    basePath: '/parent',
    portalName: 'Parent Portal',
    bottomNav: [
      { id: 'home', label: 'Home', href: '/parent/dashboard', icon: Home },
      { id: 'progress', label: 'Progress', href: '/parent/progress', icon: BarChart3 },
      { id: 'sessions', label: 'Sessions', href: '/parent/sessions', icon: Calendar },
      { id: 'tasks', label: 'Tasks', href: '/parent/tasks', icon: CheckSquare },
      { id: 'support', label: 'Support', href: '/parent/support', icon: HelpCircle },
    ],
    sidebar: [
      { id: 'dashboard', label: 'Dashboard', href: '/parent/dashboard', icon: Home, group: 'Overview' },
      { id: 'journey', label: 'Journey', href: '/parent/journey', icon: MapPin, group: 'Overview' },
      { id: 'sessions', label: 'Sessions', href: '/parent/sessions', icon: Calendar, group: 'Learning' },
      { id: 'progress', label: 'Progress', href: '/parent/progress', icon: BarChart3, group: 'Learning' },
      { id: 'tasks', label: 'Daily Tasks', href: '/parent/tasks', icon: CheckSquare, group: 'Learning' },
      { id: 'elearning', label: 'E-Learning', href: '/parent/elearning', icon: BookOpen, group: 'Learning' },
      { id: 'support', label: 'Support', href: '/parent/support', icon: HelpCircle, group: 'Account' },
    ],
  },

  // ===========================================================================
  // COACH
  // ===========================================================================
  coach: {
    basePath: '/coach',
    portalName: 'Coach Portal',
    bottomNav: [
      { id: 'home', label: 'Home', href: '/coach/dashboard', icon: Home },
      { id: 'students', label: 'Students', href: '/coach/students', icon: Users },
      { id: 'sessions', label: 'Sessions', href: '/coach/sessions', icon: Calendar },
      { id: 'calls', label: 'Calls', href: '/coach/discovery-calls', icon: Phone },
      { id: 'profile', label: 'Me', href: '/coach/profile', icon: User },
    ],
    sidebar: [
      { id: 'dashboard', label: 'Dashboard', href: '/coach/dashboard', icon: Home, group: 'Overview' },
      { id: 'students', label: 'Students', href: '/coach/students', icon: Users, group: 'Work' },
      { id: 'sessions', label: 'Sessions', href: '/coach/sessions', icon: Calendar, group: 'Work' },
      { id: 'calls', label: 'Discovery Calls', href: '/coach/discovery-calls', icon: Phone, group: 'Work' },
      { id: 'templates', label: 'Templates', href: '/coach/templates', icon: FileText, group: 'Work' },
      { id: 'ai', label: 'rAI Assistant', href: '/coach/ai-assistant', icon: Brain, group: 'AI' },
      { id: 'profile', label: 'Profile', href: '/coach/profile', icon: User, group: 'Account' },
      { id: 'earnings', label: 'Earnings', href: '/coach/earnings', icon: Briefcase, group: 'Account' },
    ],
  },

  // ===========================================================================
  // ADMIN
  // ===========================================================================
  admin: {
    basePath: '/admin',
    portalName: 'Admin Portal',
    bottomNav: [
      { id: 'home', label: 'Home', href: '/admin', icon: Home },
      { id: 'crm', label: 'CRM', href: '/admin/crm', icon: UserSearch },
      { id: 'coaches', label: 'Coaches', href: '/admin/coaches', icon: GraduationCap },
      { id: 'payments', label: 'Payments', href: '/admin/payments', icon: IndianRupee },
      { id: 'settings', label: 'Settings', href: '/admin/settings', icon: Settings },
    ],
    sidebar: [
      { id: 'dashboard', label: 'Dashboard', href: '/admin', icon: LayoutDashboard, group: 'Overview' },
      { id: 'crm', label: 'CRM', href: '/admin/crm', icon: UserSearch, group: 'Operations' },
      { id: 'coaches', label: 'Coaches', href: '/admin/coaches', icon: GraduationCap, group: 'Operations' },
      { id: 'coach-apps', label: 'Applications', href: '/admin/coach-applications', icon: UserPlus, group: 'Operations' },
      { id: 'group-classes', label: 'Group Classes', href: '/admin/group-classes', icon: Calendar, group: 'Operations' },
      { id: 'communication', label: 'Communication', href: '/admin/communication', icon: Radio, group: 'Operations' },
      { id: 'templates', label: 'Templates', href: '/admin/templates', icon: FileText, group: 'Content' },
      { id: 'content', label: 'Content', href: '/admin/content-upload', icon: BookOpen, group: 'Content' },
      { id: 'elearning', label: 'E-Learning', href: '/admin/elearning', icon: BookOpen, group: 'Content' },
      { id: 'payments', label: 'Payments', href: '/admin/payments', icon: IndianRupee, group: 'Finance' },
      { id: 'payouts', label: 'Payouts', href: '/admin/payouts', icon: Briefcase, group: 'Finance' },
      { id: 'coupons', label: 'Coupons', href: '/admin/coupons', icon: Ticket, group: 'Finance' },
      { id: 'settings', label: 'Settings', href: '/admin/settings', icon: Settings, group: 'System' },
    ],
  },
};

export function getNavConfig(portal: PortalType): PortalNavConfig {
  return navigationConfig[portal];
}
