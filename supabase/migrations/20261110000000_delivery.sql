-- Delivery (10/11/2026): cardápio próprio da loja + pedidos que chegam pelo
-- WhatsApp (agente de IA) e caem na tela Delivery do PDV.
--
-- O cardápio do delivery NÃO é a tabela products: tem açaí pronto com
-- acompanhamento fixo ("Diplomata") e tamanhos com preço. Só aparece em loja
-- com delivery_enabled = true; o default false mantém as outras lojas iguais.

BEGIN;

ALTER TABLE locations ADD COLUMN delivery_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE delivery_menu (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  secao           TEXT NOT NULL CHECK (char_length(secao) BETWEEN 1 AND 40),
  nome            TEXT NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 60),
  descricao       TEXT CHECK (char_length(descricao) <= 200),
  -- [{ "nome": "M 500 ml", "preco": 22.9 }]; item de tamanho único tem 1 entrada.
  tamanhos        JSONB NOT NULL CHECK (jsonb_typeof(tamanhos) = 'array' AND jsonb_array_length(tamanhos) > 0),
  ordem           INT NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX delivery_menu_location_idx ON delivery_menu (location_id, ordem);

ALTER TABLE delivery_menu ENABLE ROW LEVEL SECURITY;

-- Cardápio é público (link mandado ao cliente), mas só de loja com delivery ligado.
CREATE POLICY "delivery_menu_public_read" ON delivery_menu FOR SELECT TO anon, authenticated
  USING (ativo AND EXISTS (SELECT 1 FROM locations l WHERE l.id = location_id AND l.delivery_enabled));

CREATE POLICY "delivery_menu_admin_all" ON delivery_menu FOR ALL TO authenticated
  USING (fn_is_admin_of_location(location_id))
  WITH CHECK (fn_is_admin_of_location(location_id));

CREATE TABLE delivery_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            BIGINT GENERATED ALWAYS AS IDENTITY,
  location_id       UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  cliente_nome      TEXT NOT NULL CHECK (char_length(cliente_nome) BETWEEN 1 AND 80),
  cliente_telefone  TEXT NOT NULL CHECK (char_length(cliente_telefone) BETWEEN 8 AND 20),
  endereco          TEXT NOT NULL CHECK (char_length(endereco) BETWEEN 3 AND 300),
  -- [{ "nome": "Açaí Diplomata", "tamanho": "M 500 ml", "qtd": 1, "preco": 22.9, "obs": "sem banana" }]
  itens             JSONB NOT NULL CHECK (jsonb_typeof(itens) = 'array' AND jsonb_array_length(itens) > 0),
  total             NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  pagamento         TEXT NOT NULL CHECK (pagamento IN ('Pix', 'Cartão na entrega', 'Dinheiro')),
  troco_para        NUMERIC(10,2) CHECK (troco_para >= 0),
  observacao        TEXT CHECK (char_length(observacao) <= 300),
  status            TEXT NOT NULL DEFAULT 'novo'
                    CHECK (status IN ('novo', 'preparo', 'saiu', 'entregue', 'cancelado')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX delivery_orders_location_idx ON delivery_orders (location_id, created_at DESC);

ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;

-- Quem cria o pedido é o agente (service role, passa por cima do RLS).
-- O caixa da loja (staff ou admin) vê e anda com o status.
CREATE POLICY "delivery_orders_select_own" ON delivery_orders FOR SELECT TO authenticated
  USING (location_id = get_my_location_id() OR is_owner_of_location(location_id));

CREATE POLICY "delivery_orders_update_own" ON delivery_orders FOR UPDATE TO authenticated
  USING (location_id = get_my_location_id())
  WITH CHECK (location_id = get_my_location_id());

CREATE OR REPLACE FUNCTION fn_touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER delivery_orders_touch BEFORE UPDATE ON delivery_orders
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- Pedido novo aparece na hora na tela do caixa.
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_orders;

COMMIT;
