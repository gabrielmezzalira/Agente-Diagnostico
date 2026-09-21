# ⏸️ Retomar a Fase 02 — Discovery Mode (plano 02-03 pausado)

> Arquivo de retomada gerado automaticamente pelo `/gsd-execute-phase 02`.
> Guarde-o na raiz do projeto. Quando puder aplicar a migration no Supabase,
> siga o **Passo 1** e depois o **Passo 2**. Ao terminar, pode apagar este arquivo.

**Data da pausa:** 2026-09-20
**Branch:** `feat/ajustes_pendencias`
**Onde parou:** plano **02-03**, no checkpoint `blocking-human` da **Task 3** (aplicar a migration ao Supabase).

---

## Situação atual (o que já está pronto e o que falta)

A Fase 02 tem 3 planos. Estado:

| Plano | Status | Observação |
|-------|--------|-----------|
| 02-01 | ✅ Completo | `DISCOVERY_AREA_SET` (18 áreas), `DiscoveryPromptBuilder`, `SessionState.mode`, seleção de builder no pipeline. `DISC-02` completo. |
| 02-02 | ✅ Completo | Gate do bloco comercial em `llm.generate_report` por `mode` + teste de precisão das 4 superfícies. `DISC-03` completo. |
| 02-03 | ⏸️ **Pausado (2/4 tasks)** | Task 1 (decisão) ✅ · Task 2 (migration+schemas+teste) ✅ · **Task 3 (aplicar migration) ⛔ pendente** · Task 4 (toggle frontend) ⬜ não iniciada |

**Decisão já tomada na Task 1 (não reabrir):** a coluna `projects.mode` foi definida como
`text DEFAULT 'sales'` **sem CHECK/enum nativo** (padrão do repo; validação do enum fica no Pydantic `Literal`).

**Código já commitado do 02-03 (na branch `feat/ajustes_pendencias`):**
- `6b6f55a` — `feat(02-03): migration aditiva projects.mode + campo mode nos schemas Pydantic`
  - `supabase/migrations/20260921000000_add_mode_to_projects.sql` (escrita, **ainda não aplicada** ao banco)
  - `backend/app/models/projects.py` — `ProjectMode = Literal["sales","discovery"]` + campo `mode` em `ProjectCreate`/`ProjectUpdate`/`ProjectResponse`
  - `backend/tests/test_projects.py` — teste `test_project_mode_default_and_validation`
- `5aaab54` / `7ba74b3` — SUMMARY parcial + STATE/ROADMAP marcando a pausa

---

## ⚠️ O que ainda falta (2 passos)

### Passo 1 — Aplicar a migration ao Supabase (Task 3, one-way)

A migration só está **escrita**; a coluna `mode` **ainda não existe** no banco vivo. Escolha UMA forma
(é `ADD COLUMN IF NOT EXISTS`, então reaplicar é seguro):

**Opção A — manual no dashboard (recomendada, não expõe segredo):**
Supabase Dashboard → **SQL Editor** → cole e execute:
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS mode text DEFAULT 'sales';
```

**Opção B — via CLI, na sua máquina** (o token fica local, não vai pro chat):
```bash
cd "C:/Users/anton/OneDrive/Desktop/Agente-Diagnostico"
supabase db push
```

**Verificação (rode no SQL Editor depois de aplicar):**
```sql
-- deve retornar 1 linha, com default 'sales'::text
SELECT column_name, column_default FROM information_schema.columns
WHERE table_name='projects' AND column_name='mode';

-- deve retornar 0
SELECT count(*) FROM projects WHERE mode IS NULL;
```

### Passo 2 — Concluir o plano 02-03 (Task 4 — toggle no frontend)

A Task 4 é **código puro do frontend** (não depende do banco). Falta:
1. Em `frontend/src/lib/api.ts`: adicionar `mode: 'sales' | 'discovery'` às interfaces `Project` e `ProjectCreate`.
2. Em `frontend/src/pages/ProjectFormPage.tsx`:
   - `mode: 'sales'` no `DEFAULT_FORM`;
   - no `useEffect` de carga (edição): `mode: (p.mode === 'discovery' ? 'discovery' : 'sales')` (mesmo padrão defensivo do `source`);
   - um `<Field label="Modo do projeto" required>` com dois radios (`Vendas`=sales, `Discovery`=discovery), no mesmo padrão do radio "Fonte de transcrição" (`name="mode"`, `checked={form.mode === value}`, `onChange={() => set('mode', value)}`), posicionado perto de "Fonte de transcrição".
3. Verificar: `cd frontend && npm run build` (tsc + vite) passa.
4. Commit atômico só do frontend.

> Detalhes completos: `.planning/phases/02-discovery-mode-discoverypromptbuilder/02-03-PLAN.md` (Task 4).

---

## ▶️ Como retomar (numa nova sessão do Claude Code)

**Importante:** o plano 02-03 tem um `02-03-SUMMARY.md` **parcial (halted)**. Por isso um
`/gsd-execute-phase 02` "seco" pode achar que a fase já terminou e **pular** as tasks 3 e 4.
Para retomar de forma confiável, depois de fazer o **Passo 1** acima, faça `/clear` e cole:

```
/gsd-execute-phase 02

O plano 02-03 está pausado no checkpoint da Task 3. Já apliquei a migration
ao Supabase (Passo 1 do RETOMAR_FASE_02.md). Continue o 02-03 a partir da
Task 4 (toggle sales|discovery no frontend): despache um gsd-executor
sequencial para a Task 4, depois faça a verificação da fase.
```

Se o agente disser que o 02-03 já está "summarized/completo", oriente-o a **ignorar o SUMMARY
parcial halted** e executar a **Task 4** descrita acima (é a única coisa de código que resta), e
então rodar a verificação da fase (`gsd-verifier`) para fechar `DISC-01`.

### Verificação final da fase (depois da Task 4)
```bash
cd backend  && python -m pytest -q     # verde, exceto a falha pré-existente test_schema.py::test_tables_exist (precisa de Supabase vivo)
cd frontend && npm run build           # tsc + vite passam
```
Depois: `/gsd-verify-work 02` para o teste manual (criar projeto em "Discovery", reabrir e conferir
o toggle; criar em "Vendas" e conferir 8 áreas).

---

## Contexto rápido (por que esta pausa é segura)

- Tudo que está commitado é **aditivo**. Com `mode` default `'sales'` em todo lugar, o comportamento
  atual (vendas) fica **inalterado** mesmo com a coluna ainda não aplicada — `project.get("mode")`
  retorna `None` → cai no ramo `sales`.
- A migration é **idempotente** (`ADD COLUMN IF NOT EXISTS`), então aplicar/reaplicar não quebra nada
  nem duplica.
- Rollback (se necessário): `git revert 6b6f55a` desfaz o código; a coluna no banco (one-way) só some
  com uma migration de remoção (`ALTER TABLE projects DROP COLUMN IF EXISTS mode;`) — decisão do time.
