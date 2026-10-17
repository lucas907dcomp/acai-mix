-- Remove o bloqueio por mensalidade (criado em 20261002000000_billing.sql, revertido).
-- Decisão do Lucas em 17/10/2026: o sistema do AçaiMix nunca mais bloqueia.
DROP TABLE IF EXISTS billing;
