'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Calendar,
  TrendingUp,
  HelpCircle,
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
} from 'lucide-react';
import ChatWidget from '@/components/chat/ChatWidget';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { supabase } from '@/lib/supabase/client';

// Context for sharing child data across pages
interface ParentContextType {
  childId: string | null;
  childName: string;
  parentEmail: string;
  parentName: string;
  enrollmentId: string | null;
  coachPhone: string;
  coachName: string;
  loading: boolean;
}

const ParentContext = createContext<ParentContextType>({
  childId: null,
  childName: '',
  parentEmail: '',
  parentName: '',
  enrollmentId: null,
  coachPhone: '',
  coachName: '',
  loading: true,
});

export const useParentContext = () => useContext(ParentContext);

interface ParentLayoutProps {
  children: React.ReactNode;
}

interface ChildInfo {
  id: string;
  name: string;
  lead_status: string;
  enrolled_at: string | null;
  created_at: string;
}

const navigation = [
  { name: 'Dashboard', href: '/parent/dashboard', icon: Home },
  { name: 'Sessions', href: '/parent/sessions', icon: Calendar },
  { name: 'Progress', href: '/parent/progress', icon: TrendingUp },
  { name: 'Submit Request', href: '/parent/support', icon: HelpCircle },
];

export default function ParentLayout({ children }: ParentLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [childName, setChildName] = useState('');
  const [childId, setChildId] = useState<string | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [enrolledChildren, setEnrolledChildren] = useState<ChildInfo[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [showChildSelector, setShowChildSelector] = useState(false);
  const [coachPhone, setCoachPhone] = useState('918976287997');
  const [coachName, setCoachName] = useState('Rucha');
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // Activity tracking - tracks login and page views automatically
  useActivityTracker({
    userType: 'parent',
    userEmail: parentEmail || null,
    enabled: !!parentEmail,
  });

  useEffect(() => {
    fetchParentInfo();
  }, []);

  async function fetchParentInfo() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/parent/login');
        return;
      }

      setParentEmail(user.email || '');

      // First find parent record
      const { data: parentData } = await supabase
        .from('parents')
        .select('id, name, email')
        .eq('email', user.email ?? '')
        .maybeSingle();

      let parentId = parentData?.id;
      setParentName(parentData?.name || user.email?.split('@')[0] || 'Parent');

      // Find enrolled children - try by parent_id first, then by email
      let childrenList: ChildInfo[] = [];

      if (parentId) {
        const { data: childrenByParentId } = await supabase
          .from('children')
          .select('id, name, lead_status, enrolled_at, created_at')
          .eq('parent_id', parentId)
          .eq('lead_status', 'enrolled')
          .order('enrolled_at', { ascending: false });

        if (childrenByParentId && childrenByParentId.length > 0) {
          childrenList = childrenByParentId as any;
        }
      }

      // Fallback: try by parent_email
      if (childrenList.length === 0) {
        const { data: childrenByEmail } = await supabase
          .from('children')
          .select('id, name, lead_status, enrolled_at, created_at')
          .eq('parent_email', user.email ?? '')
          .eq('lead_status', 'enrolled')
          .order('enrolled_at', { ascending: false });

        if (childrenByEmail && childrenByEmail.length > 0) {
          childrenList = childrenByEmail as any;
        }
      }

      console.log('Found enrolled children:', childrenList.length, childrenList);

      if (childrenList.length > 0) {
        // Keep ALL enrolled children (no deduplication)
        setEnrolledChildren(childrenList);

        // Select the first (most recent) child by default
        const selectedChild = childrenList[0];
        setSelectedChildId(selectedChild.id);
        setChildId(selectedChild.id);
        setChildName(selectedChild.name || 'Child');

        // Get enrollment and coach info
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select(`
            id,
            coaches (
              name,
              phone,
              email
            )
          `)
          .eq('child_id', selectedChild.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (enrollment) {
          setEnrollmentId(enrollment.id);
          if (enrollment.coaches) {
            // Handle coaches - it might be an array or single object
            const coachData = Array.isArray(enrollment.coaches)
              ? enrollment.coaches[0]
              : enrollment.coaches;

            if (coachData) {
              setCoachName(coachData.name || 'Rucha');
              setCoachPhone(coachData.phone || '918976287997');
            }
          }
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching parent info:', error);
      setLoading(false);
    }
  }

  async function handleChildSelect(child: ChildInfo) {
    setSelectedChildId(child.id);
    setChildId(child.id);
    setChildName(child.name || 'Child');
    setShowChildSelector(false);

    // Update enrollment info for selected child
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select(`
        id,
        coaches (
          name,
          phone
        )
      `)
      .eq('child_id', child.id)
      .eq('status', 'active')
      .maybeSingle();

    if (enrollment) {
      setEnrollmentId(enrollment.id);
      if (enrollment.coaches) {
        // Handle coaches - it might be an array or single object
        const coachData = Array.isArray(enrollment.coaches)
          ? enrollment.coaches[0]
          : enrollment.coaches;

        if (coachData) {
          setCoachName(coachData.name || 'Rucha');
          setCoachPhone(coachData.phone || '918976287997');
        }
      }
    }

    window.location.reload();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/parent/login');
  }

  const contextValue: ParentContextType = {
    childId,
    childName,
    parentEmail,
    parentName,
    enrollmentId,
    coachPhone,
    coachName,
    loading,
  };

  const hasMultipleChildren = enrolledChildren.length > 1;

  return (
    <ParentContext.Provider value={contextValue}>
      <div className="min-h-screen bg-surface-0">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed top-0 left-0 z-50 h-full w-72 bg-surface-1 border-r border-white/[0.08] shadow-xl shadow-black/30 transform transition-transform duration-300 ease-out lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-6 border-b border-white/[0.08]">
              <div className="flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                  <Image
                    src="/images/logo.png"
                    alt="Yestoryd"
                    width={140}
                    height={40}
                    className="h-10 w-auto"
                  />
                </Link>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-2 text-text-tertiary hover:text-white rounded-lg hover:bg-white/[0.05]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-[#FF0099] mt-1 font-medium">Parent Portal</p>
            </div>

            {/* Child Selector */}
            {childName && (
              <div className="mx-4 mt-4 relative">
                <button
                  onClick={() => hasMultipleChildren && setShowChildSelector(!showChildSelector)}
                  className={`w-full p-4 bg-gradient-to-br from-[#FF0099]/5 to-[#FF0099]/10 border border-[#FF0099]/20 rounded-xl transition-all text-left ${
                    hasMultipleChildren ? 'cursor-pointer hover:border-[#FF0099]/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center shadow-md">
                        <span className="text-xl text-white font-bold">{childName.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white">{childName}</p>
                        <p className="text-sm text-[#FF0099]">
                          {hasMultipleChildren ? `${enrolledChildren.length} children enrolled` : 'Active Program'}
                        </p>
                      </div>
                    </div>
                    {hasMultipleChildren && (
                      <ChevronDown className={`w-5 h-5 text-[#FF0099] transition-transform ${showChildSelector ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </button>

                {/* Child dropdown */}
                {showChildSelector && hasMultipleChildren && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-surface-2 border border-white/[0.08] rounded-xl shadow-xl shadow-black/20 overflow-hidden z-50">
                    <div className="p-2 bg-surface-3 border-b border-white/[0.08]">
                      <p className="text-xs text-text-tertiary font-medium px-2">Select a child</p>
                    </div>
                    {enrolledChildren.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => handleChildSelect(child)}
                        className={`w-full px-4 py-3 text-left hover:bg-white/[0.05] transition-colors flex items-center gap-3 ${
                          child.id === selectedChildId ? 'bg-[#FF0099]/5' : ''
                        }`}
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center">
                          <span className="text-sm text-white font-bold">{child.name?.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1">
                          <span className="font-medium text-text-secondary block">{child.name}</span>
                          <span className="text-xs text-text-tertiary">
                            Enrolled {child.enrolled_at ? new Date(child.enrolled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                          </span>
                        </div>
                        {child.id === selectedChildId && (
                          <span className="text-xs bg-[#FF0099] text-white px-2 py-1 rounded-full">Current</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-[#FF0099]/10 text-[#FF0099]'
                        : 'text-text-secondary hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User Info */}
            <div className="p-4 border-t border-white/[0.08]">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 bg-[#FF0099]/10 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-[#FF0099]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{parentName}</p>
                  <p className="text-xs text-[#FF0099] truncate">{parentEmail}</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-colors mt-2"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="lg:pl-72">
          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-30 bg-surface-1 border-b border-white/[0.08]">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 text-text-secondary hover:text-[#FF0099] hover:bg-[#FF0099]/5 rounded-lg"
              >
                <Menu className="w-6 h-6" />
              </button>
              <Link href="/">
                <Image
                  src="/images/logo.png"
                  alt="Yestoryd"
                  width={100}
                  height={32}
                  className="h-8 w-auto"
                />
              </Link>
              <div className="w-10" />
            </div>
          </header>

          <main className="p-4 lg:p-8 min-h-screen">{children}</main>
        </div>

        {/* rAI Chat Widget - Shows on all pages */}
        {childId && (
          <ChatWidget
            childId={childId}
            childName={childName}
            userRole="parent"
            userEmail={parentEmail}
          />
        )}
      </div>
    </ParentContext.Provider>
  );
}
