-- ============================================================
-- Migration: 011_dashboard_layouts
-- Description: Create dashboard_layouts table for custom dashboards
-- ============================================================

CREATE TABLE dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'داشبورد اصلی',
  is_default BOOLEAN NOT NULL DEFAULT false,
  layout_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dashboard_layouts_user_id ON dashboard_layouts(user_id);
CREATE INDEX idx_dashboard_layouts_is_default ON dashboard_layouts(is_default);

-- Trigger for updated_at
CREATE TRIGGER update_dashboard_layouts_updated_at
  BEFORE UPDATE ON dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
