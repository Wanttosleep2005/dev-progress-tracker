import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppStore } from '../../stores/useAppStore';
import { ChevronDown, Trophy } from 'lucide-react';

export default function WorkspaceBar() {
  const { projectId: pid } = useParams();
  const projectId = pid ? parseInt(pid) : null;
  const { projects, currentProjectId, achievements } = useAppStore();
  const [showProjects, setShowProjects] = useState(false);

  const currentProject = projects.find(p => p.id === (projectId ?? currentProjectId));
  const unlockedCount = achievements.filter(a => a.unlockedAt).length;

  // Close dropdown on click outside
  useEffect(() => {
    const handler = () => setShowProjects(false);
    if (showProjects) {
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [showProjects]);

  return (
    <header className="h-14 bg-[#0a0a12] border-b border-[rgba(255,255,255,0.04)] flex items-center justify-between px-6 shrink-0">
      {/* Left: Project selector */}
      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setShowProjects(!showProjects); }}
          className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors"
        >
          {currentProject ? (
            <>
              <span className="text-lg">{currentProject.icon}</span>
              <div className="text-left">
                <p className="text-sm font-medium text-white">{currentProject.name}</p>
                <p className="text-[10px] text-slate-500">工作区</p>
              </div>
            </>
          ) : (
            <span className="text-sm text-slate-400">选择项目</span>
          )}
          <ChevronDown size={14} className="text-slate-500" />
        </button>

        {showProjects && (
          <div className="absolute top-full left-0 mt-1 w-64 glass p-2 z-50 border border-white/[0.06] rounded-xl">
            <p className="text-[10px] text-slate-500 uppercase px-3 py-1.5 font-medium">切换项目</p>
            {projects.map(p => (
              <Link
                key={p.id}
                to={`/project/${p.id}/dashboard`}
                onClick={() => setShowProjects(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  p.id === (projectId ?? currentProjectId)
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-slate-300 hover:bg-white/[0.02]'
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.name}</span>
              </Link>
            ))}
            <div className="border-t border-white/[0.04] mt-1 pt-1">
              <Link
                to="/"
                onClick={() => setShowProjects(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.02] transition-all"
              >
                <span>📁</span>
                <span>管理项目</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Right: Achievements + settings */}
      <div className="flex items-center gap-4">
        <Link
          to={projectId ? `/project/${projectId}/analytics` : '/'}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors"
        >
          <Trophy size={14} className="text-amber-400" />
          <span className="text-xs text-slate-400">
            <span className="text-amber-400 font-medium">{unlockedCount}</span>
            <span className="text-slate-600">/{achievements.length}</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
