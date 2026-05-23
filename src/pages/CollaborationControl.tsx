import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Stethoscope } from 'lucide-react';
import OwnerControlCenter from '../components/collaboration/OwnerControlCenter';
import { useAppStore } from '../stores/useAppStore';
import { useCloudStore } from '../stores/useCloudStore';

export default function CollaborationControl() {
  const currentProjectId = useAppStore(state => state.currentProjectId);
  const project = useAppStore(state => state.projects.find(item => item.id === currentProjectId));
  const loadTeam = useCloudStore(state => state.loadTeam);
  const canOwn = useCloudStore(state => state.canOwn);
  const isOwner = canOwn(currentProjectId);

  useEffect(() => {
    if (currentProjectId) loadTeam(currentProjectId);
  }, [currentProjectId, loadTeam]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            <Stethoscope size={26} className="text-cyan-300" />
            协作诊断与管控
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            把 Owner 首次配置、权限落地审计和同步诊断从团队协作主流程里拆出来。成员可查看自己的本机同步状态，Owner 额外查看团队成员身份、角色和最后活跃。
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] text-slate-500">当前项目</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck size={14} className={isOwner ? 'text-emerald-300' : 'text-slate-500'} />
            {project ? `${project.icon} ${project.name}` : '未选择项目'} · {isOwner ? 'Owner 视图' : '成员视图'}
          </p>
        </div>
      </div>

      <OwnerControlCenter isOwner={isOwner} />
    </motion.div>
  );
}
