-- Loja que não usa o Consumo de Funcionárias (Sorveteria Iris, 24/11/2026)
-- esconde o item do menu. Default false: as outras lojas seguem com ele.
ALTER TABLE locations ADD COLUMN employee_consumption_hidden BOOLEAN NOT NULL DEFAULT false;
