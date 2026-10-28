/**
 * Adaptador fino entre o `WebSocket` do navegador e o `AgpSocket` do feed do painel AGP (Fase 10): entrega ao
 * feed só o que ele usa (`data` e `code`), sem os tipos de evento do DOM. Arquivo próprio para a composição de
 * produção e os testes de integração usarem exatamente o mesmo código.
 */
import type { AgpSocket } from './agpQuestionsFeed';

export function openBrowserSocket(url: string): AgpSocket {
  const ws = new WebSocket(url);
  const socket: AgpSocket = { onopen: null, onmessage: null, onclose: null, close: () => ws.close() };
  ws.onopen = () => socket.onopen?.();
  ws.onmessage = (event) => socket.onmessage?.({ data: event.data as unknown });
  ws.onclose = (event) => socket.onclose?.({ code: event.code });
  return socket;
}
