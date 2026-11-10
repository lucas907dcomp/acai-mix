-- Avisos ao cliente pelo WhatsApp a cada fase (10/11/2026) e a fase
-- "aguardando entregador" (depois de chamar o motoboy no Entrega Fácil).
BEGIN;
ALTER TABLE delivery_orders ADD COLUMN whatsapp_chat TEXT;
ALTER TABLE delivery_orders DROP CONSTRAINT delivery_orders_status_check;
ALTER TABLE delivery_orders ADD CONSTRAINT delivery_orders_status_check
  CHECK (status IN ('novo', 'preparo', 'aguardando', 'saiu', 'entregue', 'cancelado'));
COMMIT;
