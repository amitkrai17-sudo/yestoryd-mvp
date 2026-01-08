// components/child/StatsBar.tsx
// Stats display: Videos watched, Quizzes completed, Perfect scores

'use client';

import { motion } from 'framer-motion';

interface StatsBarProps {
  videosWatched: number;
  quizzesCompleted: number;
  perfectScores: number;
}

export default function StatsBar({ videosWatched, quizzesCompleted, perfectScores }: StatsBarProps) {
  const stats = [
    {
      icon: '▶️',
      value: videosWatched,
      label: 'Videos',
      color: 'text-blue-500',
      bg: 'bg-blue-50'
    },
    {
      icon: '✅',
      value: quizzesCompleted,
      label: 'Quizzes',
      color: 'text-green-500',
      bg: 'bg-green-50'
    },
    {
      icon: '⭐',
      value: perfectScores,
      label: 'Perfect!',
      color: 'text-yellow-500',
      bg: 'bg-yellow-50'
    }
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`${stat.bg} rounded-xl p-4 text-center`}
        >
          <motion.div
            className="text-2xl mb-1"
            animate={stat.value > 0 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: stat.value > 0 ? Infinity : 0, repeatDelay: 3 }}
          >
            {stat.icon}
          </motion.div>
          <div className={`text-2xl font-bold ${stat.color}`}>
            {stat.value}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {stat.label}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
