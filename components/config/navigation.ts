import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Phone,
  DollarSign,
  FileText,
  Brain,
  User,
  BookOpen,
  TrendingUp,
  Settings,
  Home,
  Library,
  HelpCircle,
  UserSearch,
  Radio,
  IndianRupee,
} from 'lucide-react';

export type PortalType = 'coach' | 'parent' | 'admin';

export interface NavItem {
  id: string;
  href: string;
  icon: LucideIcon;
  label: string;
  shortLabel?: string;
  badge?: number;
  children?: NavItem[];
}

export interface PortalNavConfig {
  basePath: string;
  portalName: string;
  bottomNav: NavItem[];
  sidebar: NavItem[];
}

export const navigationConfig: Record<PortalType, PortalNavConfig> = {
  coach: {
    basePath: '/coach',
    portalName: 'Coach Portal',
    bottomNav: [
      { id: 'home', href: '/coach/dashboard', icon: Home, label: 'Dashboard', shortLabel: 'Home' },
      { id: 'students', href: '/coach/students', icon: Users, label: 'Students' },
      { id: 'sessions', href: '/coach/sessions', icon: Calendar, label: 'Sessions' },
      { id: 'calls', href: '/coach/discovery-calls', icon: Phone, label: 'Calls' },
      { id: 'profile', href: '/coach/profile', icon: User, label: 'Profile' },
    ],
    sidebar: [
      { id: 'dashboard', href: '/coach/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'students', href: '/coach/students', icon: Users, label: 'My Students' },
      { id: 'sessions', href: '/coach/sessions', icon: Calendar, label: 'Sessions' },
      { id: 'calls', href: '/coach/discovery-calls', icon: Phone, label: 'Discovery Calls' },
      { id: 'earnings', href: '/coach/earnings', icon: DollarSign, label: 'Earnings' },
      { id: 'templates', href: '/coach/templates', icon: FileText, label: 'Templates' },
      { id: 'ai', href: '/coach/ai-assistant', icon: Brain, label: 'AI Assistant' },
      { id: 'profile', href: '/coach/profile', icon: User, label: 'Profile' },
    ],
  },
  parent: {
    basePath: '/parent',
    portalName: 'Parent Portal',
    bottomNav: [
      { id: 'home', href: '/parent/dashboard', icon: Home, label: 'Home' },
      { id: 'progress', href: '/parent/progress', icon: TrendingUp, label: 'Progress' },
      { id: 'sessions', href: '/parent/sessions', icon: Calendar, label: 'Sessions' },
      { id: 'library', href: '/parent/elearning', icon: Library, label: 'Library' },
      { id: 'support', href: '/parent/support', icon: HelpCircle, label: 'Support' },
    ],
    sidebar: [
      { id: 'dashboard', href: '/parent/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'progress', href: '/parent/progress', icon: TrendingUp, label: 'Child Progress' },
      { id: 'sessions', href: '/parent/sessions', icon: Calendar, label: 'Sessions' },
      { id: 'elearning', href: '/parent/elearning', icon: BookOpen, label: 'E-Learning' },
      { id: 'support', href: '/parent/support', icon: HelpCircle, label: 'Support' },
    ],
  },
  admin: {
    basePath: '/admin',
    portalName: 'Admin Portal',
    bottomNav: [
      { id: 'dashboard', href: '/admin', icon: LayoutDashboard, label: 'Dashboard', shortLabel: 'Home' },
      { id: 'crm', href: '/admin/crm', icon: UserSearch, label: 'CRM', shortLabel: 'CRM' },
      { id: 'payments', href: '/admin/payments', icon: IndianRupee, label: 'Payments', shortLabel: 'Payments' },
      { id: 'communication', href: '/admin/communication', icon: Radio, label: 'Comms', shortLabel: 'Comms' },
      { id: 'coaches', href: '/admin/coach-applications', icon: Users, label: 'Coaches', shortLabel: 'Coaches' },
      { id: 'settings', href: '/admin/settings', icon: Settings, label: 'Settings', shortLabel: 'Settings' },
    ],
    sidebar: [
      { id: 'dashboard', href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'crm', href: '/admin/crm', icon: Users, label: 'CRM' },
      { id: 'coaches', href: '/admin/coaches', icon: Users, label: 'Coaches' },
      { id: 'group-classes', href: '/admin/group-classes', icon: Calendar, label: 'Group Classes' },
      { id: 'payouts', href: '/admin/payouts', icon: DollarSign, label: 'Payouts' },
      { id: 'tds', href: '/admin/tds', icon: DollarSign, label: 'TDS' },
      { id: 'coupons', href: '/admin/coupons', icon: FileText, label: 'Coupons' },
      { id: 'elearning', href: '/admin/elearning', icon: BookOpen, label: 'E-Learning' },
      { id: 'settings', href: '/admin/settings', icon: Settings, label: 'Settings' },
    ],
  },
};

export function getNavConfig(portal: PortalType): PortalNavConfig {
  return navigationConfig[portal];
}
