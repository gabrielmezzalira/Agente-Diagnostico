/**
 * Entry point do service worker: só compõe. Cada parte mora num arquivo próprio (D-05, Fase 10):
 *   - `bootstrap.ts`: a cadeia de inicialização `ready` (migrar, hidratar, recuperar, preferências);
 *   - `browserListeners.ts`: os eventos do navegador (instalação, ícone, abas, abertura, alarmes);
 *   - `messageRouter.ts`: o roteador das mensagens validadas para a máquina de estados e o histórico local.
 *
 * Listeners registrados sincronamente aqui no topo (exigência do MV3); handlers aguardam a hidratação.
 *
 * O que a extensão faz: captura as legendas do Meet, guarda no histórico local e mostra. Quando a reunião é
 * vinculada a um cliente, envia a transcrição ao Agente Diagnóstico (`/webhook/extension`, Fase 8) e lê as
 * perguntas da sessão pelo `/ws/{session_id}`, só leitura (aba AGP, Fase 10). A ata pode ser salva no Google Drive.
 */
import { registerAgpQuestionsFeed } from './agpQuestionsFeedInstance';
import { registerBrowserListeners } from './browserListeners';
import { registerMessageRouter } from './messageRouter';
// Por último: o corpo do bootstrap (configurar o encerramento e disparar a cadeia `ready`) roda depois de
// todos os outros módulos carregados, como rodava quando tudo morava neste arquivo.
import { ready } from './bootstrap';

// Painel AGP (Fase 10): segue a sessão da reunião ao vivo e espelha as perguntas do Agente.
registerAgpQuestionsFeed(ready);

// Eventos do navegador: instalação, clique no ícone, abas, abertura do navegador e alarmes.
registerBrowserListeners(ready);

// Mensagens do content script e das UIs.
registerMessageRouter(ready);
