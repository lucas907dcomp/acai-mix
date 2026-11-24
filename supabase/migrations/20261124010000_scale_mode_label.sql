-- Urano US 20/2 POP-S (Sorveteria Iris, 24/11/2026): só fala em formato de
-- etiqueta (USECB2) e só quando o peso estabiliza (F5) ou alguém aperta P.
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_scale_mode_check;
ALTER TABLE locations ADD CONSTRAINT locations_scale_mode_check
  CHECK (scale_mode IN ('continuous', 'polling', 'label'));
