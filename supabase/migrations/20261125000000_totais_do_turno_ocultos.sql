-- Caixa à vista do público (Sorveteria Iris, 25/11/2026): esconde o total do
-- turno na tela do PDV. Default false: as outras lojas seguem mostrando.
ALTER TABLE locations ADD COLUMN shift_totals_hidden BOOLEAN NOT NULL DEFAULT false;
