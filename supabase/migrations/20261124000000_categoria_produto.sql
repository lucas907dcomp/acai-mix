-- Categoria do produto avulso (24/11/2026). NULL = sem categoria: a loja que
-- não usa categoria vê a mesma grade de sempre.
ALTER TABLE products ADD COLUMN category TEXT CHECK (char_length(category) <= 30);
