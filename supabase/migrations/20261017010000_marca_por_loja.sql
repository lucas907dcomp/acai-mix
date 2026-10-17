-- Marca por loja: o mesmo banco passa a atender mais de um cliente, e o
-- relatório do dia e a tela de login mostravam o AçaiMix fixo no código.
--
-- NULL = cai no nome da loja e sem logo. As duas lojas do AçaiMix recebem
-- a marca e a logo de sempre, então o relatório delas continua igual.

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS logo_url   TEXT;

UPDATE locations
   SET brand_name = 'Açaí Mix', logo_url = '/logos/acai-mix.jpg'
 WHERE id IN ('a0000000-0000-0000-0000-000000000001', '5e4b73af-2ff8-4fdc-87d9-8f0d0ba98f6f');

COMMENT ON COLUMN locations.brand_name IS 'Marca exibida no login e no relatório. NULL = nome da loja.';
COMMENT ON COLUMN locations.logo_url   IS 'Logo do relatório do dia (caminho em /public ou URL). NULL = sem logo.';
