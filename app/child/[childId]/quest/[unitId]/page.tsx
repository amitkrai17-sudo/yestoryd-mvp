// app/child/[childId]/quest/[unitId]/page.tsx
// Quest Flow Page - YESTORYD BRAND COLORS

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function QuestPage() {
  const params = useParams();
  const router = useRouter();
  const childId = params.childId as string;
  const unitId = params.unitId as string;

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setLoading(false), 1500);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#00ABFF]/10 via-white to-[#FF0099]/10 flex flex-col items-center justify-center">
        <motion.div
          className="relative"
          animate={{ y: [0, -15, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-[#FF0099] to-[#7B008B] rounded-full blur-xl opacity-30"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <div className="relative w-24 h-24 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-full flex items-center justify-center shadow-xl">
            <motion.span
              className="text-5xl"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              🚀
            </motion.span>
          </div>
        </motion.div>
        <motion.p 
          className="mt-6 text-[#7B008B] font-bold text-lg"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Preparing your adventure...
        </motion.p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#00ABFF]/10 via-white to-[#FF0099]/10 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <motion.button
          onClick={() => router.push(`/child/${childId}/play`)}
          className="p-2 rounded-full bg-white shadow-lg hover:shadow-xl border-2 border-[#FF0099]/20"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg className="w-6 h-6 text-[#7B008B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </motion.button>
        
        <h1 className="text-lg font-bold text-[#7B008B]">Quest Mode</h1>
        
        <div className="w-10" />
      </div>

      {/* Coming Soon Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-8 shadow-xl text-center max-w-md mx-auto mt-16 border-2 border-[#FF0099]/20"
      >
        <motion.div
          className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-full flex items-center justify-center shadow-xl"
          animate={{ 
            y: [0, -10, 0],
            boxShadow: [
              '0 10px 30px rgba(255,0,153,0.3)',
              '0 20px 40px rgba(255,0,153,0.4)',
              '0 10px 30px rgba(255,0,153,0.3)'
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-6xl">🏗️</span>
        </motion.div>
        
        <h2 className="text-2xl font-black text-[#7B008B] mb-2">
          Building Something Amazing!
        </h2>
        
        <p className="text-gray-600 mb-6">
          Our builders are working hard! The games and videos will be ready very soon. 🎮✨
        </p>

        <div className="bg-gradient-to-r from-[#FFDE00]/20 to-[#FF0099]/20 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-center gap-4">
            <motion.div
              className="text-3xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              🎮
            </motion.div>
            <motion.div
              className="text-3xl"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
            >
              📹
            </motion.div>
            <motion.div
              className="text-3xl"
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
            >
              🏆
            </motion.div>
          </div>
          <p className="text-sm text-[#7B008B] mt-2 font-medium">Games • Videos • Prizes</p>
        </div>
        
        <motion.button
          onClick={() => router.push(`/child/${childId}/play`)}
          className="w-full bg-gradient-to-r from-[#FF0099] to-[#7B008B] text-white py-4 rounded-xl font-black text-lg shadow-lg"
          whileHover={{ scale: 1.02, boxShadow: '0 10px 30px rgba(255,0,153,0.4)' }}
          whileTap={{ scale: 0.98 }}
        >
          ← Back to Home
        </motion.button>
      </motion.div>

      {/* Fun fact */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center"
      >
        <div className="inline-flex items-center gap-2 bg-[#FFDE00]/20 px-4 py-2 rounded-full">
          <span className="text-xl">💡</span>
          <p className="text-[#7B008B] text-sm font-medium">
            Reading 20 mins/day = 1.8 million words/year!
          </p>
        </div>
      </motion.div>
    </div>
  );
}
