---
status: complete
phase: 02-discovery-mode-discoverypromptbuilder
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md]
started: 2026-09-21T14:04:25Z
updated: 2026-09-21T17:10:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Mate qualquer backend/frontend em execução. Suba o backend (uvicorn) e o frontend (vite) do zero. O backend boota sem exceção, conecta no Supabase, e a home de projetos carrega listando projetos reais (uma query primária retorna dados vivos, sem erro).
result: pass

### 2. Projeto discovery inicia sessão com 18 áreas de cobertura
expected: Crie (ou edite) um projeto com o modo "discovery" e abra uma sessão. A coluna de Cobertura (esquerda) mostra as 18 áreas de discovery (blocos Produto e Dados), NÃO as 8 áreas do modo sales. Um projeto em modo "sales" continua mostrando as 8 áreas de sempre.
result: pass
notes: "Após corrigir o RLS (SUPABASE_KEY = service_role + restart do backend), criar projeto discovery 'visus' e iniciar uma NOVA sessão levou à tela ao vivo com 'ao vivo' verde (WebSocket conectou) e a coluna de Cobertura mostrando as 18 áreas discovery (Produto + Dados). Confirmado pelo humano 2026-09-21. O bloqueio anterior era config de ambiente (B-003), não defeito da Fase 2."

### 3. Relatório de sessão discovery sem bloco comercial CITi
expected: Gere o relatório final de uma sessão de um projeto em modo "discovery". O Markdown resultante NÃO traz a seção de portfólio/catálogo/referência de tecnologias da CITi. O mesmo relatório para um projeto "sales" continua trazendo esse bloco comercial, como hoje.
result: pass
notes: "Confirmado pelo humano 2026-09-21 (opção a): relatório de sessão discovery gerado sem a seção comercial da CITi. Desbloqueado após o fix do modelo Gemini (B-005). Reforçado pela cobertura automatizada test_disc03_citi_portfolio_absent_from_all_four_discovery_surfaces."

### 4. Coluna projects.mode aplicada e persistindo no Supabase
expected: No formulário de projeto o toggle sales|discovery aparece; ao salvar um projeto como "discovery" e reabrir a edição, o modo salvo é "discovery" (persistiu no banco). A coluna projects.mode existe no Supabase com default 'sales'.
result: pass
notes: "Projeto 'visus' persistiu mode=discovery (foi o que fez a sessão nascer com 18 áreas). Coluna projects.mode confirmada no Supabase (SUMMARY 02-03, Task 3, default 'sales'::text) e toggle no formulário com build verde (auto). End-to-end confirmado pelo humano 2026-09-21."

### 5. SessionState mode='discovery' inicializa 18 áreas (DISC-02)
expected: SessionState em mode='discovery' inicializa coverage com exatamente as 18 chaves de DISCOVERY_AREA_SET, nenhuma not_applicable.
result: pass
source: automated
coverage_id: D1-02-01

### 6. SessionState mode='sales' inalterado — 8 áreas (SC#4)
expected: SessionState em mode='sales' (ou default) continua inicializando as 8 chaves de SALES_AREA_SET com o mesmo esquema critical/optional/inactive de hoje, sem regressão.
result: pass
source: automated
coverage_id: D2-02-01

### 7. 3 prompts realtime do DiscoveryPromptBuilder com DMS e sem CITi (DISC-03)
expected: Os 3 prompts realtime (coverage_classifier, red_flag_detector, question_planner) contêm calibração por DMS e NÃO contêm CITI_PORTFOLIO/CATALOG/TECH_REFERENCE.
result: pass
source: automated
coverage_id: D3-02-01

### 8. generate_report(mode='discovery') omite bloco comercial (DISC-03/SC#3)
expected: generate_report(mode='discovery') não injeta o bloco comercial na mensagem 'user' enviada ao Gemini.
result: pass
source: automated
coverage_id: D1-02-02

### 9. generate_report(mode='sales'/default) mantém bloco comercial (SC#4)
expected: generate_report em modo sales/default injeta o bloco comercial byte-idêntico ao comportamento atual, na mesma posição.
result: pass
source: automated
coverage_id: D2-02-02

### 10. pipeline._run_report_generator repassa mode (DISC-03)
expected: pipeline._run_report_generator repassa mode=self.state.mode para llm.generate_report.
result: pass
source: automated
coverage_id: D3-02-02

### 11. ProjectMode + campo mode nos schemas Pydantic (DISC-01)
expected: ProjectMode + campo mode em ProjectCreate/Update/Response com validação de enum na borda (Pydantic Literal); default 'sales', 'discovery' aceito, inválido rejeitado.
result: pass
source: automated
coverage_id: D2-02-03

### 12. Toggle sales|discovery no formulário + tipo em api.ts (DISC-01)
expected: Toggle sales|discovery em ProjectFormPage.tsx + tipo mode em Project/ProjectCreate (api.ts); build tsc + vite verde.
result: pass
source: automated
coverage_id: D3-02-03

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none — nenhum defeito da Fase 2. O bloqueio inicial de criação de projeto era config de ambiente (RLS/SUPABASE_KEY), resolvido; ver B-003. Achados colaterais de robustez do create_project em B-004; escopo novo em B-001/B-002.]
