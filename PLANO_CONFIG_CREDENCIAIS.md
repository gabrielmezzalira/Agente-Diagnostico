# Plano — Configurar credenciais do backend (`backend/.env`)

> Este plano segue o template obrigatório do `CLAUDE.md` ("Regras de Planejamento de Tasks"):
> as sete seções — linguagem comum, como, riscos, prevenção, conserto, decisões do time, verificação.

**Origem:** ao rodar a suíte de testes do backend, 12 testes passaram, 4 são stubs propositais
(`test_projects.py`) e **1 deu erro** — `test_schema.py::test_tables_exist` — com a mensagem:

```
RuntimeError: SUPABASE_URL and SUPABASE_KEY must be set. Check backend/.env
```

**Esclarecimento importante: isto NÃO é um bug de código.** É uma configuração local faltando.
O arquivo `backend/.env` não está (e não pode estar) no repositório porque guarda segredos — está
listado no `.gitignore`. Cada pessoa que roda o projeto precisa criar o seu.

---

## 1. O que muda (em linguagem comum)

Hoje o backend não sabe **onde** fica o banco de dados nem tem a **senha** para entrar nele. Essas duas
informações moram num arquivo local chamado `backend/.env`, que ainda não existe na sua máquina.

**Analogia:** o sistema é uma casa e o banco de dados é o cofre. O código sabe abrir o cofre, mas ninguém
entregou a ele o **endereço** do cofre nem a **chave**. Esse plano cria o "chaveiro" (`backend/.env`) com
o endereço e a chave, para que o sistema consiga entrar.

Depois disso:
- o teste de integração `test_tables_exist` consegue conectar no banco e conferir se as 9 tabelas existem;
- o backend consegue **subir de verdade** (hoje ele para de propósito se não achar essas variáveis).

Nada no comportamento do produto muda — é só destravar o acesso ao banco no ambiente local.

---

## 2. Como vai ser alterado

Nenhum arquivo de **código** é alterado. Cria-se **um único arquivo de configuração local**:

1. **Pegar as credenciais no Supabase**
   Painel do Supabase → seu projeto → **Settings → API**. Copiar:
   - **Project URL** → será o `SUPABASE_URL`
   - **`service_role` key** (a secreta — **não** a `anon`) → será o `SUPABASE_KEY`

2. **Criar o arquivo `backend/.env`** com o conteúdo (trocar pelos valores reais):
   ```
   SUPABASE_URL=https://seuprojeto.supabase.co
   SUPABASE_KEY=sua-service-role-key-aqui
   GEMINI_API_KEY=sua-chave-gemini
   ```
   > Variáveis opcionais, só se for usar esses recursos: `RECALL_API_KEY`, `RECALL_REGION`,
   > `PUBLIC_WEBHOOK_URL`, `CITIFLOW_BASE_URL`.

3. **Garantir que as migrations foram aplicadas** no projeto Supabase (arquivos em
   `supabase/migrations/`). Sem isso, o teste conecta mas acusa tabela faltando.

Tudo é configuração — não há commit de código, não há mudança de comportamento do sistema.

---

## 3. Riscos de cada ação

| Ação | O que pode dar errado |
|------|-----------------------|
| Pegar as credenciais | Copiar a chave errada (`anon` em vez de `service_role`) → conexão funciona mas sem permissão para ler o `information_schema`, e o teste falha mesmo com o banco certo. |
| Criar o `backend/.env` | Colar a chave `service_role` num lugar público (chat, commit, print) → **vazamento de segredo** com acesso total ao banco. |
| Criar o `backend/.env` | Commitar o `.env` sem querer → segredo vai parar no histórico do git (difícil de remover). |
| Migrations | Rodar contra o banco de **produção** achando que é o de dev → alteração indevida em dados reais. |

---

## 4. Como prevenir

| Risco | Prevenção |
|-------|-----------|
| Chave errada | Conferir no painel que a chave copiada está na linha **`service_role`**. Ela é longa e marcada como secreta. |
| Vazamento de segredo | Digitar a chave **direto no arquivo** `backend/.env`, nunca colar no chat/print/commit. Tratar como senha. |
| Commit acidental | `backend/.env` já está no `.gitignore` (linhas 2–4). Antes de commitar, rodar `git status` e confirmar que `.env` **não** aparece. |
| Banco errado | Usar a URL do **projeto de desenvolvimento** do Supabase. Confirmar o nome do projeto no topo do painel antes de copiar. |

---

## 5. Como consertar (plano de rollback)

- **Se algo der errado com o arquivo:** simplesmente apague `backend/.env`. O sistema volta exatamente ao
  estado atual (o teste de integração volta a ser pulado/erro, o resto continua funcionando). Nenhum código
  é tocado, então não há commit para reverter.
- **Se a `service_role` key vazar:** no painel do Supabase → **Settings → API → Reset** (revoga a chave
  antiga e gera uma nova). Atualizar o `backend/.env` com a nova chave.
- **Se o `.env` for commitado por engano:** remover do índice com
  `git rm --cached backend/.env`, commitar a remoção e **resetar a `service_role` key** (o segredo já
  ficou no histórico e deve ser considerado comprometido).

---

## 6. Decisões que são do usuário/time — **DECISÃO EM ABERTO**

Estas escolhas **não** podem ser feitas pelo executor sozinho — dependem do time:

- **Qual projeto Supabase usar** (dev, staging ou o mesmo de produção). Definir para não apontar sem querer
  para produção.
- **Quem detém a `service_role` key** e como ela é distribuída para o time com segurança
  (ex.: gerenciador de segredos, não por mensagem).
- **Manter o teste `test_tables_exist` como teste de integração** (exige banco real) **ou** marcá-lo para
  rodar só em CI com credenciais — hoje ele "quebra" a suíte local de quem não tem `.env`. Decisão de
  estratégia de testes: parar e combinar com o time antes de mexer.

---

## 7. Verificação (ponta a ponta)

Depois de criar o `backend/.env`:

1. **Rodar só o teste de schema:**
   ```
   cd backend
   python -m pytest tests/test_schema.py -v
   ```
   **Esperado:** `test_tables_exist PASSED` (as 9 tabelas encontradas).

2. **Rodar a suíte completa:**
   ```
   cd backend
   python -m pytest -v
   ```
   **Esperado:** 13 passed, 4 skipped, 0 error (os 4 skipped são stubs propositais do `test_projects.py`).

3. **Conferir que o segredo não foi commitado:**
   ```
   git status
   ```
   **Esperado:** `backend/.env` **não** aparece na lista de arquivos a commitar.

Se o passo 1 passar, o acesso ao banco está configurado corretamente e o "erro" da rodada de testes
está resolvido.
