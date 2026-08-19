-- Horário em que a loja troca do turno 1 para o turno 2.
--
-- Estava fixo em 16 no código do PDV (getShiftNumber), o que valia enquanto
-- existia uma loja só. A AçaiMix Barra troca às 15h, então um turno aberto à
-- mão entre 15h e 16h lá era criado como turno 1, quando já devia ser o 2.
--
-- DEFAULT 16 preserva exatamente o que o código fazia antes: qualquer loja
-- que não seja marcada continua trocando às 16h, como sempre.

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS shift_change_hour SMALLINT NOT NULL DEFAULT 16
  CHECK (shift_change_hour BETWEEN 0 AND 23);

COMMENT ON COLUMN locations.shift_change_hour IS
  'Hora local (0-23) em que o turno 1 vira turno 2 nesta loja. Default 16 = comportamento anterior à coluna.';
