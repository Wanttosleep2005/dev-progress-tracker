import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { Achievement } from '../types';
import { ACHIEVEMENT_LEVEL_LABELS, ACHIEVEMENT_LEVEL_COLORS } from '../types';

interface Props {
  achievement: Achievement | null;
  onClose: () => void;
}

export default function AchievementUnlockModal({ achievement, onClose }: Props) {
  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [achievement, onClose]);

  useEffect(() => {
    if (achievement) {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }
  }, [achievement, onClose]);

  const color = achievement ? ACHIEVEMENT_LEVEL_COLORS[achievement.level] : '#cd7f32';

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Card */}
          <motion.div
            className="relative z-10 mx-4 w-full max-w-sm overflow-hidden rounded-[32px] border-2 bg-[#0f1119]/95 p-8 shadow-2xl"
            style={{ borderColor: color }}
            initial={{ y: 80, scale: 0.8, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -40, scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>

            {/* Icon */}
            <motion.div
              className="mb-5 flex justify-center"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 15,
                delay: 0.2,
              }}
            >
              <div
                className="flex h-20 w-20 items-center justify-center rounded-[28px] text-4xl"
                style={{
                  background: `${color}15`,
                  boxShadow: `0 0 40px ${color}25`,
                }}
              >
                {achievement.icon}
              </div>
            </motion.div>

            {/* "Achievement Unlocked" heading */}
            <motion.h2
              className="mb-2 text-center text-xl font-bold text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              成就解锁！
            </motion.h2>

            {/* Title */}
            <motion.p
              className="mb-1 text-center text-sm font-semibold"
              style={{ color }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              {achievement.title}
            </motion.p>

            {/* Description */}
            <motion.p
              className="mb-5 text-center text-xs text-slate-400"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              {achievement.description}
            </motion.p>

            {/* Level badge with glow */}
            <motion.div
              className="flex justify-center"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, type: 'spring', stiffness: 400, damping: 15 }}
            >
              <span
                className="rounded-full px-4 py-1.5 text-xs font-bold"
                style={{
                  background: `${color}15`,
                  color,
                  boxShadow: `0 0 20px ${color}30`,
                }}
              >
                {ACHIEVEMENT_LEVEL_LABELS[achievement.level]}
              </span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
