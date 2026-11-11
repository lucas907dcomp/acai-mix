-- Cardápio virtual por loja (11/11/2026): /cardapio/<id da loja> lê
-- delivery_menu e a vitrine da loja. locations continua fechada ao público;
-- só os campos de vitrine saem pela função abaixo.

BEGIN;

ALTER TABLE locations
  -- Número do WhatsApp do delivery com DDI e DDD, só dígitos.
  ADD COLUMN delivery_whatsapp TEXT CHECK (delivery_whatsapp ~ '^\d{10,15}$'),
  -- Cor da marca no cardápio (#RRGGBB). NULL = roxo açaí padrão.
  ADD COLUMN delivery_cor TEXT CHECK (delivery_cor ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE delivery_menu ADD COLUMN foto_url TEXT CHECK (char_length(foto_url) <= 500);

CREATE FUNCTION fn_cardapio_loja(loc UUID)
RETURNS TABLE (nome TEXT, logo_url TEXT, cor TEXT, whatsapp TEXT, taxa NUMERIC, info TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(brand_name, name), logo_url, delivery_cor, delivery_whatsapp, delivery_fee, delivery_info
  FROM locations WHERE id = loc AND delivery_enabled AND active;
$$;

REVOKE ALL ON FUNCTION fn_cardapio_loja(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_cardapio_loja(UUID) TO anon, authenticated;

-- A policy antiga consultava locations, que o anônimo não lê: voltava vazio.
DROP POLICY "delivery_menu_public_read" ON delivery_menu;
CREATE POLICY "delivery_menu_public_read" ON delivery_menu FOR SELECT TO anon, authenticated
  USING (ativo AND EXISTS (SELECT 1 FROM fn_cardapio_loja(location_id)));

-- Loja de demonstração: número de teste do WAHA e identidade para a vitrine.
UPDATE locations
SET delivery_whatsapp = '5579996681077', delivery_cor = '#5B1A6B', brand_name = 'Açaí da Orla'
WHERE id = 'de000000-0000-4000-8000-000000000001';

COMMIT;
