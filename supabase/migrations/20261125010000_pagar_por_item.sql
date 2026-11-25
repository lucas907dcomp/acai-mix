-- Pedido conjunto pago por partes (Sorveteria Iris, 25/11/2026): cada pessoa
-- paga os seus itens. Default false: as outras lojas seguem pagando tudo junto.
ALTER TABLE locations ADD COLUMN pay_by_item BOOLEAN NOT NULL DEFAULT false;
