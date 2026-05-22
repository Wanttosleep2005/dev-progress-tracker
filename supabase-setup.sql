-- ============================================
-- Dev Progress Tracker - Supabase 数据库设置
-- ============================================
-- 使用方法：
-- 1. 访问 https://supabase.com 登录或注册
-- 2. 创建新项目（免费版足够）
-- 3. 进入左侧 SQL Editor
-- 4. 复制粘贴此脚本并运行
-- ============================================

-- 1. 创建同步记录表
CREATE TABLE IF NOT EXISTS devtrack_sync_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  project_id INTEGER,
  payload JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  client_id TEXT NOT NULL
);

-- 2. 启用行级安全策略
ALTER TABLE devtrack_sync_records ENABLE ROW LEVEL SECURITY;

-- 3. 创建访问策略（允许已登录用户操作自己的数据）
DROP POLICY IF EXISTS "Allow authenticated insert" ON devtrack_sync_records;
DROP POLICY IF EXISTS "Allow authenticated update" ON devtrack_sync_records;
DROP POLICY IF EXISTS "Allow authenticated delete" ON devtrack_sync_records;

CREATE POLICY "Allow authenticated insert" ON devtrack_sync_records FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON devtrack_sync_records FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete" ON devtrack_sync_records FOR DELETE USING (auth.role() = 'authenticated');

-- 4. 创建索引提升查询性能
CREATE INDEX IF NOT EXISTS idx_sync_user_id ON devtrack_sync_records(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_entity ON devtrack_sync_records(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_project ON devtrack_sync_records(project_id);

SELECT '✅ DevTrack 数据库设置完成！' AS status;