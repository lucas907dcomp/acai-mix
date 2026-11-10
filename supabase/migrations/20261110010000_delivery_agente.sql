-- Agente de delivery (10/11/2026): o que a IA precisa saber de cada loja e a
-- memória da conversa por cliente. Só a Edge Function (service role) mexe em
-- delivery_conversas; o RLS sem policy fecha a tabela para o app.

BEGIN;

ALTER TABLE locations
  ADD COLUMN delivery_agent_name TEXT,
  -- Texto livre da loja: horário, bairros atendidos, tempo médio, chave Pix,
  -- regra de montagem, promoções. A IA responde dúvidas a partir daqui.
  ADD COLUMN delivery_info TEXT,
  -- ponytail: taxa única; por bairro quando alguma loja cobrar diferente.
  ADD COLUMN delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0);

ALTER TABLE delivery_orders
  ADD COLUMN taxa_entrega NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (taxa_entrega >= 0);

CREATE TABLE delivery_conversas (
  location_id  UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  telefone     TEXT NOT NULL,
  mensagens    JSONB NOT NULL DEFAULT '[]',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, telefone)
);

ALTER TABLE delivery_conversas ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Item de montar: quantos acompanhamentos vêm inclusos e quanto custa cada
-- extra. O código cobra o extra sozinho (a IA errava a conta). NULL = item pronto.
ALTER TABLE delivery_menu
  ADD COLUMN acomp_inclusos INT CHECK (acomp_inclusos >= 0),
  ADD COLUMN acomp_extra NUMERIC(10,2) CHECK (acomp_extra >= 0),
  -- Lista do que dá para escolher; vazio = a IA não oferece montar.
  ADD COLUMN acomp_opcoes TEXT[];
