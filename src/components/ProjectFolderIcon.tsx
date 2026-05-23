import { Folder } from 'lucide-react';

interface ProjectFolderIconProps {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClass = {
  sm: {
    box: 'h-9 w-11 rounded-xl',
    icon: 22,
    text: 'text-[9px]',
  },
  md: {
    box: 'h-12 w-14 rounded-2xl',
    icon: 28,
    text: 'text-[10px]',
  },
  lg: {
    box: 'h-20 w-24 rounded-[22px]',
    icon: 46,
    text: 'text-xs',
  },
};

function getProjectMark(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return '项目';
  const compact = trimmed.replace(/\s+/g, '');
  return compact.length > 4 ? compact.slice(0, 4) : compact;
}

export default function ProjectFolderIcon({ name, color, size = 'md', className = '' }: ProjectFolderIconProps) {
  const sizes = sizeClass[size];
  const mark = getProjectMark(name);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-[#111827] shadow-lg ${sizes.box} ${className}`}
      style={{
        background: `linear-gradient(145deg, ${color}2e, rgba(15,23,42,0.94) 62%)`,
        boxShadow: `0 12px 28px ${color}22`,
      }}
    >
      <Folder
        size={sizes.icon}
        strokeWidth={1.8}
        className="absolute inset-0 m-auto text-white/35"
        style={{ color }}
      />
      <span className={`relative z-10 max-w-[82%] truncate font-semibold text-white drop-shadow ${sizes.text}`}>
        {mark}
      </span>
      <span className="absolute inset-x-2 bottom-1 h-px bg-white/15" />
    </div>
  );
}
