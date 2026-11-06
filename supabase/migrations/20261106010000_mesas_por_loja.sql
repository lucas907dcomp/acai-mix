-- Mesas fixas no PDV: pedidos conjuntos que nunca somem. Default 0 mantém as
-- lojas atuais sem mesa nenhuma.

ALTER TABLE locations
  ADD COLUMN table_count SMALLINT NOT NULL DEFAULT 0 CHECK (table_count BETWEEN 0 AND 30);
