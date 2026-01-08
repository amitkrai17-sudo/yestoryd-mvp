// =============================================================================
// PARENT GATE COMPONENT
// Simple math challenge to prevent accidental exits by kids
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Lock } from 'lucide-react';

interface ParentGateProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ParentGate({ onSuccess, onCancel }: ParentGateProps) {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(false);
  
  // Generate random math problem
  useEffect(() => {
    generateProblem();
  }, []);
  
  const generateProblem = () => {
    // Numbers that result in answers between 10-50
    const n1 = Math.floor(Math.random() * 20) + 10;
    const n2 = Math.floor(Math.random() * 20) + 5;
    setNum1(n1);
    setNum2(n2);
    setAnswer('');
    setError(false);
  };
  
  const handleSubmit = () => {
    const correctAnswer = num1 + num2;
    if (parseInt(answer) === correctAnswer) {
      onSuccess();
    } else {
      setError(true);
      setTimeout(() => {
        generateProblem();
      }, 1000);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#FF0099]/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#FF0099]" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800">Parent Check</h2>
              <p className="text-xs text-gray-400">Solve to continue</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Math problem */}
        <div className="bg-gradient-to-br from-[#FF0099]/10 to-purple-100 rounded-2xl p-6 mb-6">
          <p className="text-sm text-gray-500 text-center mb-3">
            What is...
          </p>
          <div className="text-center">
            <span className="text-4xl font-bold text-gray-800">
              {num1} + {num2} = ?
            </span>
          </div>
        </div>
        
        {/* Input */}
        <div className="mb-4">
          <input
            type="number"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setError(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter answer"
            className={`
              w-full px-4 py-3 text-xl text-center font-semibold rounded-xl border-2 outline-none transition-colors
              ${error 
                ? 'border-red-400 bg-red-50 shake' 
                : 'border-gray-200 focus:border-[#FF0099]'}
            `}
            autoFocus
          />
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-500 text-sm text-center mt-2"
            >
              That's not right. Try again!
            </motion.p>
          )}
        </div>
        
        {/* Submit button */}
        <motion.button
          onClick={handleSubmit}
          disabled={!answer}
          className={`
            w-full py-3 rounded-xl font-semibold transition-all
            ${answer 
              ? 'bg-[#FF0099] text-white' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
          `}
          whileTap={answer ? { scale: 0.98 } : {}}
        >
          Continue
        </motion.button>
        
        {/* Cancel link */}
        <button
          onClick={onCancel}
          className="w-full text-center text-sm text-gray-400 mt-4 hover:text-gray-600"
        >
          Go back to learning
        </button>
      </motion.div>
      
      {/* Shake animation CSS */}
      <style jsx>{`
        .shake {
          animation: shake 0.5s ease-in-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
      `}</style>
    </motion.div>
  );
}
