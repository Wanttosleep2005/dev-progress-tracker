import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';

const Overview = lazy(() => import('./pages/Overview'));
const TodayCommand = lazy(() => import('./pages/TodayCommand'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const TodayTasks = lazy(() => import('./pages/TodayTasks'));
const FocusSessions = lazy(() => import('./pages/FocusSessions'));
const TaskBoard = lazy(() => import('./pages/TaskBoard'));
const TaskDependencies = lazy(() => import('./pages/TaskDependencies'));
const Architecture = lazy(() => import('./pages/Architecture'));
const Pomodoro = lazy(() => import('./pages/Pomodoro'));
const Milestones = lazy(() => import('./pages/Milestones'));
const Timeline = lazy(() => import('./pages/Timeline'));
const Diary = lazy(() => import('./pages/Diary'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Gantt = lazy(() => import('./pages/Gantt'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Collaboration = lazy(() => import('./pages/Collaboration'));
const CollaborationControl = lazy(() => import('./pages/CollaborationControl'));
const AICommandCenter = lazy(() => import('./pages/AICommandCenter'));
const Projects = lazy(() => import('./pages/Projects'));
const Achievements = lazy(() => import('./pages/Achievements'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const BackupRecovery = lazy(() => import('./pages/BackupRecovery'));
const Invite = lazy(() => import('./pages/Invite'));
const Account = lazy(() => import('./pages/Account'));

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-4 text-sm text-slate-400">
        正在加载页面内容...
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="today-command" element={<TodayCommand />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="today-tasks" element={<TodayTasks />} />
            <Route path="focus-sessions" element={<FocusSessions />} />
            <Route path="tasks" element={<TaskBoard />} />
            <Route path="dependencies" element={<TaskDependencies />} />
            <Route path="architecture" element={<Architecture />} />
            <Route path="pomodoro" element={<Pomodoro />} />
            <Route path="milestones" element={<Milestones />} />
            <Route path="timeline" element={<Timeline />} />
            <Route path="diary" element={<Diary />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="gantt" element={<Gantt />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="sprints" element={<Navigate to="/tasks" replace />} />
            <Route path="collaboration" element={<Collaboration />} />
            <Route path="collaboration-control" element={<CollaborationControl />} />
            <Route path="ai-command" element={<AICommandCenter />} />
            <Route path="projects" element={<Projects />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="account" element={<Account />} />
            <Route path="backup" element={<BackupRecovery />} />
            <Route path="invite" element={<Invite />} />
            <Route path="invite/:token" element={<Invite />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
