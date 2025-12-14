// Example: How to add ChatWidget to Parent Dashboard
// Add this to your app/parent/dashboard/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import ParentLayout from '@/components/parent/ParentLayout';
import { ChatWidget } from '@/components/chat';
// ... other imports

export default function ParentDashboard() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);
  const [child, setChild] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // redirect to login
        return;
      }
      setUser(user);

      // Get child data
      const { data: childData } = await supabase
        .from('children')
        .select('*')
        .eq('parent_email', user.email)
        .eq('enrollment_status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setChild(childData);
      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return <ParentLayout><div>Loading...</div></ParentLayout>;
  }

  return (
    <ParentLayout>
      {/* Your existing dashboard content */}
      <div className="max-w-5xl mx-auto">
        {/* ... dashboard cards, progress, sessions, etc. */}
      </div>

      {/* Add ChatWidget at the end - it will float in bottom-right */}
      {user && (
        <ChatWidget
          childId={child?.id}
          childName={child?.child_name || child?.name}
          userRole="parent"
          userEmail={user.email}
          primaryColor="#f59e0b" // Amber/Orange
        />
      )}
    </ParentLayout>
  );
}


// ============================================================
// Example: How to add ChatWidget to Coach Dashboard
// ============================================================

// Add this to your app/coach/dashboard/page.tsx

/*
'use client';

import { ChatWidget } from '@/components/chat';

export default function CoachDashboard() {
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [coach, setCoach] = useState<any>(null);

  // ... your existing coach dashboard code

  return (
    <CoachLayout>
      {/* Your existing dashboard content *//*}

      {/* ChatWidget for coach - can chat about any assigned student *//*}
      {coach && (
        <ChatWidget
          childId={selectedStudent?.id}
          childName={selectedStudent?.child_name}
          userRole="coach"
          userEmail={coach.email}
          primaryColor="#8b5cf6" // Purple for coach
        />
      )}
    </CoachLayout>
  );
}
*/


// ============================================================
// Example: How to add ChatWidget to Admin Dashboard
// ============================================================

/*
'use client';

import { ChatWidget } from '@/components/chat';

export default function AdminDashboard() {
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [admin, setAdmin] = useState<any>(null);

  // ... your existing admin dashboard code

  return (
    <AdminLayout>
      {/* Your existing dashboard content *//*}

      {/* ChatWidget for admin - can access any child *//*}
      {admin && (
        <ChatWidget
          childId={selectedChild?.id}
          childName={selectedChild?.child_name}
          userRole="admin"
          userEmail={admin.email}
          primaryColor="#059669" // Emerald for admin
        />
      )}
    </AdminLayout>
  );
}
*/
