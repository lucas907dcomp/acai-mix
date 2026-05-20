-- ============================================================
-- Migration: 009 sale_cancellation
-- Adds soft-delete capability to the `sales` table:
--   - 3 new columns: status, cancelled_at, cancelled_by
--   - CHECK constraint enforcing consistency
--   - Partial indexes for common query patterns
--   - AFTER UPDATE trigger reversing shift totals on cancellation
--   - SECURITY DEFINER helper function can_cancel_sale()
--   - RLS UPDATE policy gated by is_admin() AND can_cancel_sale()
--   - Dashboard views (shift_summary, daily_summary) updated to
--     exclude cancelled rows from aggregates
--
-- Reversible: see ROLLBACK section at bottom of file (commented).
-- Companion DDL doc: docs/architecture/fase2-tech-decisions.md
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Add columns to sales
-- ------------------------------------------------------------
-- DEFAULT 'COMPLETED' on ALTER TABLE backfills every existing row
-- atomically — no data migration step required.

ALTER TABLE sales
  ADD COLUMN status        TEXT        NOT NULL DEFAULT 'COMPLETED'
    CHECK (status IN ('COMPLETED', 'CANCELLED')),
  ADD COLUMN cancelled_at  TIMESTAMPTZ,
  ADD COLUMN cancelled_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL;

-- Consistency CHECK:
--   COMPLETED → cancelled_at MUST be NULL and cancelled_by MUST be NULL
--   CANCELLED → cancelled_at MUST be NOT NULL
--               cancelled_by MAY be NULL (survives ON DELETE SET NULL
--               so historical audit rows are not wiped when the auth
--               user is removed)
ALTER TABLE sales
  ADD CONSTRAINT sales_cancellation_fields_consistency
  CHECK (
    (status = 'COMPLETED' AND cancelled_at IS NULL AND cancelled_by IS NULL)
    OR
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL)
  );

-- ------------------------------------------------------------
-- 2. Indexes
-- ------------------------------------------------------------
-- Partial index for the hot path (dashboard, history, PDV list).
-- Co-exists with the existing full `idx_sales_location_created`
-- (from migration 003) which still supports audit/export queries
-- that need to include cancelled rows. Postgres will pick the
-- partial automatically for queries with `WHERE status='COMPLETED'`.
CREATE INDEX idx_sales_completed_location_created
  ON sales (location_id, created_at DESC)
  WHERE status = 'COMPLETED';

-- Cancellation audit queries ("show me everything cancelled today").
-- Tiny index since cancellations are rare.
CREATE INDEX idx_sales_cancelled_at
  ON sales (cancelled_at DESC)
  WHERE status = 'CANCELLED';

-- ------------------------------------------------------------
-- 3. Trigger: reverse shift totals on cancellation
-- ------------------------------------------------------------
-- AFTER UPDATE OF status ensures the trigger fires only on the
-- specific column change. The WHEN clause is defensive (UPDATE
-- writing the same status value will not fire).
--
-- Recursion: this function updates `shifts` only. The only trigger
-- on `shifts` (migration 005 `trg_update_shift_totals`) is AFTER
-- INSERT on `sales`, so there is no cycle.
--
-- SECURITY DEFINER mirrors the existing `update_shift_totals`
-- function (migration 005) so it can update `shifts` even when the
-- calling role only has UPDATE on `sales`.

CREATE OR REPLACE FUNCTION update_shift_totals_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- COMPLETED → CANCELLED : subtract from shift totals
  IF OLD.status = 'COMPLETED' AND NEW.status = 'CANCELLED' THEN
    UPDATE shifts SET
      sale_count  = GREATEST(sale_count  - 1, 0),
      total_sales = GREATEST(total_sales - OLD.amount, 0),
      total_pix   = GREATEST(total_pix
                    - CASE WHEN OLD.payment_method = 'pix'
                           THEN OLD.amount ELSE 0 END, 0),
      total_card  = GREATEST(total_card
                    - CASE WHEN OLD.payment_method IN ('credit','debit')
                           THEN OLD.amount ELSE 0 END, 0),
      total_cash  = GREATEST(total_cash
                    - CASE WHEN OLD.payment_method = 'cash'
                           THEN OLD.amount ELSE 0 END, 0)
    WHERE id = OLD.shift_id;

  -- CANCELLED → COMPLETED : explicitly not supported in Phase 2.
  -- Raise so the gap is loud, not silent.
  ELSIF OLD.status = 'CANCELLED' AND NEW.status = 'COMPLETED' THEN
    RAISE EXCEPTION
      'Uncancelling a sale is not supported (sale_id=%, shift_id=%)',
      OLD.id, OLD.shift_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_shift_totals_on_update
  AFTER UPDATE OF status ON sales
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_shift_totals_on_update();

-- ------------------------------------------------------------
-- 4. Update dashboard views to exclude cancelled rows
-- ------------------------------------------------------------
-- DROP + CREATE (instead of CREATE OR REPLACE) keeps the change
-- deterministic and avoids edge cases where REPLACE can fail when
-- the SELECT signature changes. No foreign keys reference these
-- views, so DROP is safe.

DROP VIEW IF EXISTS shift_summary;
DROP VIEW IF EXISTS daily_summary;

CREATE VIEW shift_summary
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.location_id,
  s.shift_number,
  s.opened_at,
  s.closed_at,
  s.status,
  s.opened_by,
  COUNT(sl.id) FILTER (WHERE sl.status = 'COMPLETED')                                          AS total_sales,
  COALESCE(SUM(sl.amount) FILTER (WHERE sl.status = 'COMPLETED'), 0)                           AS total_amount,
  CASE WHEN COUNT(sl.id) FILTER (WHERE sl.status = 'COMPLETED') > 0
    THEN ROUND(
      (SUM(sl.amount) FILTER (WHERE sl.status = 'COMPLETED')
       / COUNT(sl.id) FILTER (WHERE sl.status = 'COMPLETED'))::numeric, 2)
    ELSE 0
  END                                                                                          AS avg_ticket,
  COALESCE(SUM(sl.amount) FILTER (WHERE sl.status = 'COMPLETED' AND sl.payment_method = 'pix'),                   0) AS total_pix,
  COALESCE(SUM(sl.amount) FILTER (WHERE sl.status = 'COMPLETED' AND sl.payment_method IN ('credit','debit')),     0) AS total_card,
  COALESCE(SUM(sl.amount) FILTER (WHERE sl.status = 'COMPLETED' AND sl.payment_method = 'cash'),                  0) AS total_cash,
  EXTRACT(EPOCH FROM (COALESCE(s.closed_at, now()) - s.opened_at)) / 60                        AS duration_minutes
FROM shifts s
LEFT JOIN sales sl ON sl.shift_id = s.id
GROUP BY s.id, s.location_id, s.shift_number, s.opened_at, s.closed_at, s.status, s.opened_by;

CREATE VIEW daily_summary
WITH (security_invoker = true)
AS
SELECT
  DATE(sl.created_at AT TIME ZONE 'America/Sao_Paulo')                                         AS sale_date,
  sl.location_id,
  COUNT(*)                                                                                     AS total_sales,
  COALESCE(SUM(sl.amount), 0)                                                                  AS total_amount,
  CASE WHEN COUNT(*) > 0
    THEN ROUND((SUM(sl.amount) / COUNT(*))::numeric, 2)
    ELSE 0
  END                                                                                          AS avg_ticket,
  COUNT(DISTINCT sl.shift_id)                                                                  AS total_shifts,
  COALESCE(SUM(CASE WHEN sl.payment_method = 'pix'                  THEN sl.amount ELSE 0 END), 0) AS total_pix,
  COALESCE(SUM(CASE WHEN sl.payment_method IN ('credit','debit')     THEN sl.amount ELSE 0 END), 0) AS total_card,
  COALESCE(SUM(CASE WHEN sl.payment_method = 'cash'                 THEN sl.amount ELSE 0 END), 0) AS total_cash
FROM sales sl
WHERE sl.status = 'COMPLETED'   -- Excludes cancelled from daily aggregates
GROUP BY sale_date, sl.location_id;

-- ------------------------------------------------------------
-- 5. RLS: SECURITY DEFINER helper + UPDATE policy for cancellation
-- ------------------------------------------------------------
-- can_cancel_sale() runs SECURITY DEFINER so it bypasses RLS on
-- `sales` and `shifts`, avoiding any recursion risk (gotcha doc:
-- feedback_rls_patterns.md). Pattern is identical to `is_admin()`
-- (migration 002) and `get_my_location_id()` (migration 003), both
-- validated in production.
--
-- Returns TRUE only when:
--   - the target sale exists
--   - the target sale is still COMPLETED (not already cancelled)
--   - the shift owning the sale is still 'open'
--   - the shift belongs to the caller's location
-- Covers AC-F3.2, AC-F3.6, AC-F3.8.

CREATE OR REPLACE FUNCTION can_cancel_sale(p_sale_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM sales s
    JOIN shifts sh ON sh.id = s.shift_id
    WHERE s.id           = p_sale_id
      AND s.status       = 'COMPLETED'
      AND sh.status      = 'open'
      AND sh.location_id = get_my_location_id()
  );
$$;

-- UPDATE policy for cancellation.
-- USING:      gate at row read time (who can target this row)
-- WITH CHECK: gate at row write time (what the new row state must be)
-- The WITH CHECK forces an exact cancellation shape, preventing an
-- admin from rewriting amount/payment_method/etc. via this policy.
CREATE POLICY "sales_update_cancel_admin"
  ON sales FOR UPDATE
  TO authenticated
  USING (is_admin() AND can_cancel_sale(id))
  WITH CHECK (
    is_admin()
    AND status        = 'CANCELLED'
    AND cancelled_at IS NOT NULL
    AND cancelled_by  = auth.uid()
  );

COMMIT;

-- ============================================================
-- ROLLBACK (manual — execute in a separate transaction if needed)
-- ============================================================
-- BEGIN;
--   DROP POLICY  IF EXISTS "sales_update_cancel_admin"   ON sales;
--   DROP FUNCTION IF EXISTS can_cancel_sale(UUID);
--   DROP VIEW    IF EXISTS daily_summary;
--   DROP VIEW    IF EXISTS shift_summary;
--   -- Recreate the pre-009 versions of the views (see migration 006).
--   DROP TRIGGER IF EXISTS trg_update_shift_totals_on_update ON sales;
--   DROP FUNCTION IF EXISTS update_shift_totals_on_update();
--   DROP INDEX   IF EXISTS idx_sales_cancelled_at;
--   DROP INDEX   IF EXISTS idx_sales_completed_location_created;
--   ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_cancellation_fields_consistency;
--   ALTER TABLE sales DROP COLUMN IF EXISTS cancelled_by;
--   ALTER TABLE sales DROP COLUMN IF EXISTS cancelled_at;
--   ALTER TABLE sales DROP COLUMN IF EXISTS status;
-- COMMIT;
