import {
  Home,
  Calendar,
  TrendingUp,
  BookOpen,
  Users,
  DollarSign,
  CheckSquare,
} from 'lucide-react';
import { NavItem } from '@/components/navigation/BottomNav';

// Parent Portal Navigation - Light Theme
// Mobile bottom nav (4 items max for usability)
export const parentNavItems: NavItem[] = [
  { label: 'Home', href: '/parent/dashboard', icon: Home },
  { label: 'Sessions', href: '/parent/sessions', icon: Calendar },
  { label: 'Tasks', href: '/parent/tasks', icon: CheckSquare },
  { label: 'Progress', href: '/parent/progress', icon: TrendingUp },
];

// Coach Portal Navigation - Dark Theme
// Mobile bottom nav (4 items max for usability)
export const coachNavItems: NavItem[] = [
  { label: 'Home', href: '/coach/dashboard', icon: Home },
  { label: 'Students', href: '/coach/students', icon: Users },
  { label: 'Sessions', href: '/coach/sessions', icon: Calendar },
  { label: 'Earnings', href: '/coach/earnings', icon: DollarSign },
];
