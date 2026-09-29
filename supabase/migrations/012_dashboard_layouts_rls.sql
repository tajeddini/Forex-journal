-- ============================================================
-- Migration: 012_dashboard_layouts_rls
-- Description: Enable RLS for dashboard_layouts table
-- ============================================================

ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- Users can only view their own dashboard layouts
CREATE POLICY "Users can view own dashboard layouts"
  ON dashboard_layouts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own dashboard layouts
CREATE POLICY "Users can insert own dashboard layouts"
  ON dashboard_layouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own dashboard layouts
CREATE POLICY "Users can update own dashboard layouts"
  ON dashboard_layouts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own dashboard layouts
CREATE POLICY "Users can delete own dashboard layouts"
  ON dashboard_layouts FOR DELETE
  USING (auth.uid() = user_id);
