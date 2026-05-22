import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';

const Overview = lazy(() => import('./pages/Overview'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const TodayTasks = lazy(() => import('./pages/TodayTasks'));
const FocusSessions = lazy(() => import('./pages/FocusSessions'));
const TaskBoard = lazy(() => import('./pages/TaskBoard'));
const Pomodoro = lazy(() => import('./pages/Pomodoro'));
const Milestones = lazy(() => import('./pages/Milestones'));
const Timeline = lazy(() => import('./pages/Timeline'));
const Diary = lazy(() => import('./pages/Diary'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Gantt = lazy(() => import('./pages/Gantt'));
const Collaboration = lazy(() => import('./pages/Collaboration'));
const Projects = lazy(() => import('./pages/Projects'));
const SettingsPage = lazy(() => import('./pages/Settings'));

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
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="today-tasks" element={<TodayTasks />} />
            <Route path="focus-sessions" element={<FocusSessions />} />
            <Route path="tasks" element={<TaskBoard />} />
            <Route path="pomodoro" element={<Pomodoro />} />
            <Route path="milestones" element={<Milestones />} />
            <Route path="timeline" element={<Timeline />} />
            <Route path="diary" element={<Diary />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="gantt" element={<Gantt />} />
            <Route path="collaboration" element={<Collaboration />} />
            <Route path="projects" element={<Projects />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
