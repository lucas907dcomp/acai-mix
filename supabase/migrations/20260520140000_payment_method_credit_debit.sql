-- Migration: 004 payment_method_credit_debit
-- Splits 'card' into 'credit' and 'debit' in sales table

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;

ALTER TABLE sales
  ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('pix', 'credit', 'debit', 'cash'));
