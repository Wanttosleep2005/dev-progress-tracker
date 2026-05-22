-- 共享项目表
CREATE TABLE IF NOT EXISTS devtrack_projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 项目成员表
CREATE TABLE IF NOT EXISTS devtrack_project_members (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  email TEXT,
  display_name TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  PRIMARY KEY (project_id, user_id)
);

-- 启用 RLS
ALTER TABLE devtrack_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE devtrack_project_members ENABLE ROW LEVEL SECURITY;

-- devtrack_projects 访问策略
DROP POLICY IF EXISTS "Projects insert" ON devtrack_projects;
DROP POLICY IF EXISTS "Projects update" ON devtrack_projects;
DROP POLICY IF EXISTS "Projects delete" ON devtrack_projects;
DROP POLICY IF EXISTS "Projects select" ON devtrack_projects;

CREATE POLICY "Projects insert" ON devtrack_projects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Projects update" ON devtrack_projects FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Projects delete" ON devtrack_projects FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Projects select" ON devtrack_projects FOR SELECT USING (true);

-- devtrack_project_members 访问策略
DROP POLICY IF EXISTS "Members insert" ON devtrack_project_members;
DROP POLICY IF EXISTS "Members update" ON devtrack_project_members;
DROP POLICY IF EXISTS "Members delete" ON devtrack_project_members;
DROP POLICY IF EXISTS "Members select" ON devtrack_project_members;

CREATE POLICY "Members insert" ON devtrack_project_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Members update" ON devtrack_project_members FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Members delete" ON devtrack_project_members FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Members select" ON devtrack_project_members FOR SELECT USING (true);

-- 索引
CREATE INDEX IF NOT EXISTS idx_projects_owner ON devtrack_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_members_project ON devtrack_project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON devtrack_project_members(user_id);

SELECT '✅ 项目共享表创建完成！' AS status;