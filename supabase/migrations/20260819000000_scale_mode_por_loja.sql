-- Modo de comunicação da balança, por loja.
--
-- As duas lojas usam balanças de fabricantes diferentes, e elas conversam de
-- formas opostas:
--   • Loja 1 — Urano UPX Wind D3: transmite o peso sozinha, continuamente.
--   • Loja 2 — Toledo Prix 3 Fit/2: só responde quando perguntada (ENQ 0x05,
--     protocolo PRT5). Fica muda se ninguém perguntar.
--
-- O formato do pacote é o mesmo nas duas (STX + 5 dígitos + ETX), então só
-- muda quem inicia a conversa.
--
-- DEFAULT 'continuous' de propósito: é exatamente o comportamento que já roda
-- hoje. Qualquer loja existente (incluindo a que está vendendo agora) continua
-- idêntica depois desta migration, sem nenhum UPDATE. Só a loja nova precisa
-- ser marcada como 'polling', num comando explícito e separado.

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS scale_mode TEXT NOT NULL DEFAULT 'continuous'
  CHECK (scale_mode IN ('continuous', 'polling'));

COMMENT ON COLUMN locations.scale_mode IS
  'Como a balança desta loja fala: continuous = transmite sozinha (Urano); polling = só responde a ENQ 0x05 (Toledo Prix). Default continuous preserva o comportamento anterior à coluna.';
