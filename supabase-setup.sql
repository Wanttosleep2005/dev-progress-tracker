-- ============================================
-- Dev Progress Tracker - Supabase 数据库设置
-- ============================================
-- 使用方法：
-- 1. 访问 https://supabase.com 登录或注册
-- 2. 创建新项目（免费版足够）
-- 3. 进入左侧 SQL Editor
-- 4. 复制粘贴此脚本并运行
-- ============================================

-- ============================================
-- 1. 同步记录表
-- ============================================
CREATE TABLE IF NOT EXISTS devtrack_sync_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  remote_project_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  project_id INTEGER,
  payload JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  client_id TEXT NOT NULL
);

-- 启用行级安全策略
ALTER TABLE devtrack_sync_records ENABLE ROW LEVEL SECURITY;

-- 创建访问策略
DROP POLICY IF EXISTS "Allow authenticated insert" ON devtrack_sync_records;
DROP POLICY IF EXISTS "Allow authenticated update" ON devtrack_sync_records;
DROP POLICY IF EXISTS "Allow authenticated delete" ON devtrack_sync_records;

CREATE POLICY "Allow authenticated insert" ON devtrack_sync_records FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON devtrack_sync_records FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete" ON devtrack_sync_records FOR DELETE USING (auth.role() = 'authenticated');

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sync_user_id ON devtrack_sync_records(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_entity ON devtrack_sync_records(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_project ON devtrack_sync_records(project_id);
CREATE INDEX IF NOT EXISTS idx_sync_remote_project ON devtrack_sync_records(remote_project_id);

-- ============================================
-- 2. 共享项目表
-- ============================================
CREATE TABLE IF NOT EXISTS devtrack_projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE devtrack_projects ENABLE ROW LEVEL SECURITY;

-- 创建访问策略
DROP POLICY IF EXISTS "Projects insert" ON devtrack_projects;
DROP POLICY IF EXISTS "Projects update" ON devtrack_projects;
DROP POLICY IF EXISTS "Projects delete" ON devtrack_projects;
DROP POLICY IF EXISTS "Projects select" ON devtrack_projects;

CREATE POLICY "Projects insert" ON devtrack_projects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Projects update" ON devtrack_projects FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Projects delete" ON devtrack_projects FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Projects select" ON devtrack_projects FOR SELECT USING (true);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_owner ON devtrack_projects(owner_id);

-- ============================================
-- 3. 项目成员表
-- ============================================
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
ALTER TABLE devtrack_project_members ENABLE ROW LEVEL SECURITY;

-- 创建访问策略
DROP POLICY IF EXISTS "Members insert" ON devtrack_project_members;
DROP POLICY IF EXISTS "Members update" ON devtrack_project_members;
DROP POLICY IF EXISTS "Members delete" ON devtrack_project_members;
DROP POLICY IF EXISTS "Members select" ON devtrack_project_members;

CREATE POLICY "Members insert" ON devtrack_project_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Members update" ON devtrack_project_members FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Members delete" ON devtrack_project_members FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Members select" ON devtrack_project_members FOR SELECT USING (true);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_members_project ON devtrack_project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON devtrack_project_members(user_id);

SELECT '✅ DevTrack 数据库设置完成！' AS status;