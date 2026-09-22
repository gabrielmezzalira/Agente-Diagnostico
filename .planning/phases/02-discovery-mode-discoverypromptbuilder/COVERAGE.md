# Fase 2: Discovery Mode + DiscoveryPromptBuilder — Declaração de Cobertura de API

**No external API integration:** esta fase adiciona uma coluna Supabase + um campo Pydantic a um
Supabase já integrado; nenhuma superfície nova de API/SDK externa é introduzida.

## Detalhamento

O plano 02-01 (esta entrega) é 100% interno ao repositório: adiciona `DISCOVERY_AREA_SET` (registro
estático em `coverage_areas.py`), a classe irmã `DiscoveryPromptBuilder` (novo módulo,
`discovery_prompt_builder.py`) e o fork por `mode` em `session_state.py`/`pipeline.py`. Nenhum desses
pontos chama uma API externa nova, biblioteca nova ou SDK novo — o `google.genai` (Gemini) e o cliente
`supabase-py` já integrados continuam sendo os únicos pontos de I/O externo do sistema, inalterados
por esta fase.

A coluna `projects.mode` (Supabase) e os campos Pydantic `ProjectCreate/Update/Response.mode` ficam a
cargo do plano 02-03 desta mesma fase — quando chegarem, seguem o mesmo padrão já estabelecido
(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `Literal[...]` no Pydantic) usado por todas as colunas
enum-like existentes (`project_type`, `source`, `status`, `severity`), sem introduzir nenhuma
integração de API externa nova.
