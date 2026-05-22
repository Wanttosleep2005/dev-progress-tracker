import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const shortcuts = [
  { keys: '?', desc: '查看快捷帮助' },
  { keys: 'Esc', desc: '关闭弹窗或搜索面板' },
];

export default function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (
        event.key === '?' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !(event.target as HTMLElement)?.matches?.('input,textarea,[contenteditable]')
      ) {
        event.preventDefault();
        setOpen(value => !value);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={event => event.stopPropagation()}
            className="glass glow w-full max-w-md p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">快捷帮助</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.05] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-1">
              {shortcuts.map(shortcut => (
                <div key={shortcut.keys} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/[0.02]">
                  <span className="text-sm text-slate-300">{shortcut.desc}</span>
                  <kbd className="rounded-md bg-white/[0.04] px-2 py-1 font-mono text-xs text-slate-400">{shortcut.keys}</kbd>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-[10px] text-slate-600">按 `?` 可以随时再次打开</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
