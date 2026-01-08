// components/child/BottomNav.tsx
// SUBTLE VERSION - Clean, minimal, with small labels

'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

interface BottomNavProps {
  childId: string;
  activeTab: 'home' | 'games' | 'stories' | 'rewards';
}

export default function BottomNav({ childId, activeTab }: BottomNavProps) {
  const router = useRouter();

  const tabs = [
    { 
      id: 'home', 
      icon: '🏠', 
      label: 'Home',
      path: `/child/${childId}/play`
    },
    { 
      id: 'games', 
      icon: '🎮', 
      label: 'Practice',
      path: `/child/${childId}/games`
    },
    { 
      id: 'stories', 
      icon: '📚', 
      label: 'Library',
      path: `/child/${childId}/stories`
    },
    { 
      id: 'rewards', 
      icon: '🏆', 
      label: 'Progress',
      path: `/child/${childId}/rewards`
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40">
      <div className="flex justify-around items-center max-w-lg mx-auto py-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          
          return (
            <motion.button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              className="flex flex-col items-center py-1 px-4 min-w-[64px]"
              whileTap={{ scale: 0.95 }}
            >
              {/* Icon */}
              <div className={`text-2xl mb-0.5 transition-all ${
                isActive ? '' : 'grayscale opacity-50'
              }`}>
                {tab.icon}
              </div>
              
              {/* Label */}
              <span className={`text-xs font-medium transition-colors ${
                isActive ? 'text-[#FF0099]' : 'text-gray-400'
              }`}>
                {tab.label}
              </span>
              
              {/* Active indicator - subtle dot */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="w-1 h-1 bg-[#FF0099] rounded-full mt-1"
                />
              )}
            </motion.button>
          );
        })}
      </div>
      
      {/* Safe area padding for iPhone */}
      <div className="h-safe-area-inset-bottom bg-white" />
    </nav>
  );
}
