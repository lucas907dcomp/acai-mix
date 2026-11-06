-- Loja de um operador pode dispensar o nome de quem abriu o turno.
-- Default true mantém o Power Mix perguntando.

ALTER TABLE locations ADD COLUMN ask_operator_name BOOLEAN NOT NULL DEFAULT true;
