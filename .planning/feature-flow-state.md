# Feature Flow State
feature: "Redesign das telas do Agente Diagnóstico e do DocuData no design system CITi (tema escuro) + telas novas (Discovery/Produto no DocuData; configuração/vínculo, setup de sessão, histórico/relatório e status de envio no Agente)"
modo: "UI-ONLY"
tier: "COMPLEXA"
stack: "Agente: React 19 + Vite + TS + Tailwind 4 (frontend/). DocuData: repo separado ~/Documents/Faculdade/CIti/Liderança Dados/Agentes/Documentador/docudata-frontend (Next.js)."
etapa: 11
etapa_nome: "Revisão do usuário do Agente; depois DocuData (mesmo kit). Etapa 12 (verificação) pendente."
gates_reusados: ["design-system+DESIGN.md (~/Downloads/Documento visual pontos_positivos/DESIGN.md)", "prototype (telas de referência prontas nos 2 .dc.html)"]
started_at: "2026-10-14T03:50:00Z"
last_saved: "2026-10-16T01:54:50Z"
status: "em_progresso"
branch_agente: "feat/redesign-ui-citi (cortada de origin/main em 6d0c60e; pushada em origin/feat/redesign-ui-citi)"

## Decisões do usuário (2026-10-14)
- Redesign é feature NOVA; a integração Agente × DocuData fica pausada na Etapa 12 (estado em .planning/feature-flow-state-integracao-docudata.md).
- Ordem: AGENTE primeiro (kit de componentes + 4 telas do protótipo), depois leva o kit ao DocuData.
- Telas novas: Discovery + Produto + o que falta no Agente (desenhadas no mesmo design system; não existem em protótipo).
- "Baseie 100% nessas telas": fidelidade ao protótipo e ao DESIGN.md.

## Referência
- Protótipos (1440 px): ~/Downloads/Documento visual pontos_positivos/Agente Diagnostico Redesign.dc.html (01 Projetos, 02 Projeto, 03 Sessão encerrada, 04 Sessão ao vivo) e DocuData Redesign.dc.html (01 Escolha de subárea … 11 Avaliações do gerente).
- DESIGN.md na mesma pasta: tokens, tipografia, layout, componentes, densidade.
- Telas atuais do Agente: frontend/src/pages/{HomePage, ProjectDetailPage, ProjectFormPage, SessionSetupPage, SessionActivePage, PricingListPage, PricingEditorPage}.tsx

## Concluído
- [x] Etapa 0 — repo do Agente (frontend) mapeado à mão; grafo não necessário para UI

## Próximas
- [x] Etapas 4–7 — DESIGN.md copiado para a raiz; plano em .planning/redesign-ui/PLANO-REDESIGN-AGENTE.md
- [x] Etapa 10 (Agente) — tokens, kit src/components/ui, casca src/components/layout, 10 telas + 3 novas (Sessões, Extensão, Configurações) + bloco Integração DocuData. Build/tsc/17 testes OK; conferido visualmente com API falsa. NÃO commitado.
- [ ] Etapa 6 — libs (lucide-react já existe; fonte Geist a adicionar)
- [ ] Etapa 7 — UI-SPEC do Agente
- [x] Agente: commitado e PUSHADO em origin/feat/redesign-ui-citi (5 commits, sem PR)
- [~] DocuData (worktree ../Documentador-redesign, branch feat/redesign-ui-citi, 4 commits, PUSHADO em origin/feat/redesign-ui-citi): tokens+kit src app/components/ds, casca app/components/shell, recoloração em lote de todas as telas, telas 01/02/03, subárea Produto, Discovery (Requisitos, Reuniões, Encaminhar), novo projeto. Build OK, 47 testes OK. FALTA: polir SprintCard/Planejamento/Painel/Tasks/Métricas/gráficos/Performance/Avaliações/login contra o protótipo e conferir com dados reais.
- [ ] Etapas 9–11 — motion/taste e auditoria
- [ ] Etapa 10 — implementação (Agente), depois DocuData
- [ ] Etapa 12 — verificação (nunca pulada)

## Regras do repo que valem aqui
- Branch por fase; sem push/commit sem pedido do usuário. DocuData: working tree dele tem alterações do usuário (nunca git add -A); AGENTS.md exige spec por vez.
- Nunca ler .env. Respostas em português.
