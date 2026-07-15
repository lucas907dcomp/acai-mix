---
name: project-epic10-context
description: Context for EPIC-10 (AçaiMix multi-produto) — 5 stories created 2026-05-26, key architectural decisions and file locations
metadata:
  type: project
---

EPIC-10 (Catálogo Multi-Produto e Adicional Casquinha) foi destrinchado em 5 stories em 2026-05-26.

**Why:** PDV da loja de açaí só vendia açaí por peso. Precisava suportar casquinha (+R$1,00 toggle) e produtos avulsos (picolé, água, refri) sem quebrar backward-compatibility de nenhuma venda existente.

**Stories criadas:**
- `docs/stories/10.2.story.md` — Migration DB (executar PRIMEIRO — pré-requisito de todas)
- `docs/stories/10.1.story.md` — Toggle casquinha PDV (depende de 10.2; paralela com 10.3)
- `docs/stories/10.3.story.md` — CRUD admin de produtos avulsos (depende de 10.2)
- `docs/stories/10.4.story.md` — PDV multi-produto (depende de 10.2 + 10.3)
- `docs/stories/10.5.story.md` — Dashboard e histórico por produto (depende de 10.2 + 10.4)

**Decisões arquiteturais já tomadas (não reabrir):**
- Schema: `products` ganha `product_type`, `unit_price`, `sort_order`, `created_by`, `updated_by`
- Schema: `sales` ganha `has_casquinha`, `product_id` (nullable retrocompat), `quantity`
- Trigger BEFORE INSERT/UPDATE em `sales` para coerência peso vs unit (não CHECK constraint pura)
- Casquinha = toggle de venda, preço fixo R$1,00 hardcoded (`CASQUINHA_PRICE = 1.00`)
- 1 venda = 1 produto (sem carrinho multi-item)
- Catálogo PDV offline via Dexie `product_catalog` com TTL 5min, sem Supabase Realtime
- CSV exportado: novas colunas ao FINAL (não reordenar existentes — contador usa planilha)

**How to apply:** Ao criar stories de follow-up do EPIC-10, referenciar as decisões acima e não contradizê-las. A ordem de desenvolvimento é F2 → (F1 + F3 em paralelo) → F4 → F5.
