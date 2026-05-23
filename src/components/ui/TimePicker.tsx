import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X } from 'lucide-react';

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export default function TimePicker({ value, onChange, placeholder = '选择时间' }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(value ? value.split(':')[0] : '09');
  const [minute, setMinute] = useState(value ? value.split(':')[1] : '00');
  const hourRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      if (h) setHour(h);
      if (m) setMinute(m);
    }
  }, [value]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const hIdx = HOURS.indexOf(hour);
        const mIdx = MINUTES.indexOf(minute);
        if (hourRef.current && hIdx >= 0) hourRef.current.scrollTop = hIdx * 32;
        if (minRef.current && mIdx >= 0) minRef.current.scrollTop = mIdx * 32;
      }, 50);
    }
  }, [open, hour, minute]);

  const handleConfirm = () => {
    onChange(`${hour}:${minute}`);
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.05] px-3 py-2 text-sm text-white hover:border-white/[0.2] hover:bg-white/[0.08] transition"
      >
        <Clock size={14} className="text-sky-400" />
        <span className={value ? 'text-white' : 'text-slate-500'}>{value || placeholder}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] rounded-2xl border border-white/[0.08] bg-[#0c1628]/98 backdrop-blur p-4 shadow-2xl min-w-[260px]"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">选择时间</span>
                <button onClick={() => setOpen(false)} className="rounded p-0.5 text-slate-500 hover:text-white"><X size={14} /></button>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="mb-1 text-center text-[10px] text-slate-500">时</p>
                  <div ref={hourRef} className="h-[160px] overflow-y-auto rounded-xl border border-white/[0.05] bg-[#060d18]">
                    {HOURS.map(h => (
                      <button key={h} type="button" onClick={() => setHour(h)} className={`w-full py-1.5 text-center text-sm transition ${h === hour ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-slate-400 hover:bg-white/[0.03] hover:text-white'}`}>{h}</button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-center text-[10px] text-slate-500">分</p>
                  <div ref={minRef} className="h-[160px] overflow-y-auto rounded-xl border border-white/[0.05] bg-[#060d18]">
                    {MINUTES.map(m => (
                      <button key={m} type="button" onClick={() => setMinute(m)} className={`w-full py-1.5 text-center text-sm transition ${m === minute ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-slate-400 hover:bg-white/[0.03] hover:text-white'}`}>{m}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-bold text-white tracking-wider">{hour}:{minute}</span>
                <div className="flex gap-2">
                  {value && <button type="button" onClick={handleClear} className="rounded-xl border border-white/[0.08] px-3 py-1.5 text-xs text-slate-400 hover:text-white">清除</button>}
                  <button type="button" onClick={handleConfirm} className="rounded-xl bg-sky-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-sky-600">确定</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
