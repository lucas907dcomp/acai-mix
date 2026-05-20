-- Dashboard views: shift_summary, daily_summary
-- security_invoker = true: RLS do usuário chamador é aplicado (isolamento por location_id)

CREATE OR REPLACE VIEW shift_summary
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
  COUNT(sl.id)                                                                         AS total_sales,
  COALESCE(SUM(sl.amount), 0)                                                          AS total_amount,
  CASE WHEN COUNT(sl.id) > 0
    THEN ROUND((SUM(sl.amount) / COUNT(sl.id))::numeric, 2)
    ELSE 0
  END                                                                                   AS avg_ticket,
  COALESCE(SUM(CASE WHEN sl.payment_method = 'pix'                        THEN sl.amount ELSE 0 END), 0) AS total_pix,
  COALESCE(SUM(CASE WHEN sl.payment_method IN ('credit','debit')           THEN sl.amount ELSE 0 END), 0) AS total_card,
  COALESCE(SUM(CASE WHEN sl.payment_method = 'cash'                       THEN sl.amount ELSE 0 END), 0) AS total_cash,
  EXTRACT(EPOCH FROM (COALESCE(s.closed_at, now()) - s.opened_at)) / 60  AS duration_minutes
FROM shifts s
LEFT JOIN sales sl ON sl.shift_id = s.id
GROUP BY s.id, s.location_id, s.shift_number, s.opened_at, s.closed_at, s.status, s.opened_by;

CREATE OR REPLACE VIEW daily_summary
WITH (security_invoker = true)
AS
SELECT
  DATE(sl.created_at AT TIME ZONE 'America/Sao_Paulo')                                  AS sale_date,
  sl.location_id,
  COUNT(*)                                                                               AS total_sales,
  COALESCE(SUM(sl.amount), 0)                                                            AS total_amount,
  CASE WHEN COUNT(*) > 0
    THEN ROUND((SUM(sl.amount) / COUNT(*))::numeric, 2)
    ELSE 0
  END                                                                                    AS avg_ticket,
  COUNT(DISTINCT sl.shift_id)                                                            AS total_shifts,
  COALESCE(SUM(CASE WHEN sl.payment_method = 'pix'                        THEN sl.amount ELSE 0 END), 0) AS total_pix,
  COALESCE(SUM(CASE WHEN sl.payment_method IN ('credit','debit')           THEN sl.amount ELSE 0 END), 0) AS total_card,
  COALESCE(SUM(CASE WHEN sl.payment_method = 'cash'                       THEN sl.amount ELSE 0 END), 0) AS total_cash
FROM sales sl
GROUP BY sale_date, sl.location_id;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_sales_location_created  ON sales (location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_shift_payment     ON sales (shift_id, payment_method);
CREATE INDEX IF NOT EXISTS idx_shifts_location_status  ON shifts (location_id, status);
