import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import type { Toast as ToastType } from '../stores/useToast';
import { useToast } from '../stores/useToast';

const icons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const colors = {
  info: 'border-blue-500/30 text-blue-400',
  success: 'border-green-500/30 text-green-400',
  warning: 'border-amber-500/30 text-amber-400',
  error: 'border-red-500/30 text-red-400',
};

export default function Toast({ toast }: { toast: ToastType }) {
  const [visible, setVisible] = useState(true);
  const { remove } = useToast();
  const Icon = icons[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence onExitComplete={() => remove(toast.id)}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className={`glass flex w-full items-start gap-3 border px-4 py-3 shadow-2xl ${colors[toast.type]}`}
        >
          <Icon size={16} className="mt-0.5 shrink-0" />
          <p className="flex-1 text-sm leading-5">{toast.message}</p>
          <button onClick={() => setVisible(false)} className="shrink-0 text-slate-500 hover:text-white"><X size={14} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
