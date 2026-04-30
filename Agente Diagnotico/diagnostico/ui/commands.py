# =============================================================================
# ui/commands.py
#
# CommandHandler: captura teclas do teclado sem bloquear o event loop.
#
# Desafio: capturar teclas únicas (P, R, Q, S) sem precisar que o usuário
# pressione Enter. O input() padrão do Python só retorna após Enter — não serve.
#
# Solução: colocar o terminal em "modo raw" via termios/tty e usar
# asyncio.add_reader() para ser notificado quando uma tecla é pressionada,
# sem bloquear nada.
#
# Por que NÃO usar prompt_toolkit?
# O prompt_toolkit é poderoso mas conflita com o Rich.Live quando ambos tentam
# controlar o terminal ao mesmo tempo. O termios é stdlib puro, mais leve e
# não tem esse conflito — Rich cuida do OUTPUT (o que aparece na tela) enquanto
# o termios/add_reader cuida do INPUT (o que o usuário digita), sem interferência.
# =============================================================================

import asyncio
import os
import sys
import termios   # interface para configurações do terminal Unix/macOS
from typing import Awaitable, Callable


class CommandHandler:
    """Captura teclas únicas do teclado e despacha para handlers assíncronos.

    Só funciona quando stdin é um TTY (terminal interativo). Se stdin for um
    pipe (ex: echo "..." | python3 main.py), isatty() retorna False e o
    CommandHandler se desativa automaticamente — sem erros.

    Uso:
        handler = CommandHandler()
        handler.on("p", minha_funcao_async)
        handler.on("q", outra_funcao_async)
        await handler.run()   # inicia a captura (bloqueante até stop() ser chamado)
    """

    def __init__(self) -> None:
        # Dicionário de handlers: tecla → função async a chamar
        # Chaves são sempre minúsculas para normalizar (P e p chamam o mesmo handler)
        self._handlers: dict[str, Callable[[], Awaitable[None]]] = {}
        self._running = False

    def on(self, key: str, handler: Callable[[], Awaitable[None]]) -> None:
        """Registra um handler assíncrono para uma tecla específica.

        Ex: handler.on("p", on_p)  →  pressionar P chama await on_p()
        """
        self._handlers[key.lower()] = handler

    async def run(self) -> None:
        """Inicia a captura de teclas. Retorna quando stop() for chamado.

        Fluxo interno:
        1. Salva as configurações atuais do terminal (para restaurar ao sair)
        2. Coloca o terminal em modo raw (sem buffer, sem echo)
        3. Registra um callback no event loop para ser chamado quando stdin tiver dados
        4. Loop: espera tecla, chama handler, repete
        5. Ao sair (stop() ou erro): restaura as configurações originais

        Por que modo raw?
        No modo normal (cooked), o terminal só manda dados para o programa
        quando o usuário pressiona Enter. No modo raw, cada tecla é entregue
        imediatamente — essencial para atalhos de teclado de uma letra só.
        """
        # Se não for um terminal interativo (ex: pipe), não faz nada
        if not sys.stdin.isatty():
            return

        self._running = True

        # Queue para comunicar entre o callback (síncrono, chamado pelo event loop)
        # e o loop principal desta corrotina (assíncrono, usa await)
        queue: asyncio.Queue[str] = asyncio.Queue()

        # get_running_loop() é o correto em contexto async (Python 3.10+).
        # get_event_loop() pode retornar um loop diferente ou dar DeprecationWarning.
        loop = asyncio.get_running_loop()
        fd = sys.stdin.fileno()  # file descriptor do stdin (normalmente 0)

        # Salva as configurações ATUAIS do terminal para restaurar depois.
        # tcgetattr() lê a struct termios com todas as flags de configuração.
        old_settings = termios.tcgetattr(fd)

        def _read_char() -> None:
            """Callback síncrono chamado pelo event loop quando stdin tem dados.

            Usa os.read(fd, 1) em vez de sys.stdin.read(1) porque em modo
            cbreak o TextIOWrapper do Python pode bufferizar e não entregar o
            caractere imediatamente. os.read() acessa o file descriptor diretamente,
            sem buffer de Python no meio.
            """
            try:
                raw = os.read(fd, 1)
                ch = raw.decode("utf-8", errors="replace")
                loop.call_soon_threadsafe(queue.put_nowait, ch)
            except Exception:
                pass  # stdin fechou ou outro erro → ignora silenciosamente

        try:
            # Por que cbreak e não setraw?
            #
            # setraw() remove a flag OPOST do terminal, que é responsável por
            # traduzir '\n' em '\r\n' na saída. Sem OPOST, o Rich (que usa '\n'
            # internamente) fica desalinhado: o cursor desce mas não volta à
            # coluna 0, fazendo a tela parecer "torta" e os painéis quebrarem.
            #
            # cbreak() remove apenas ECHO (sem eco do que é digitado) e ICANON
            # (sem buffer de linha — entrega cada tecla imediatamente), mas
            # MANTÉM o OPOST intacto. O Rich funciona perfeitamente assim.
            #
            # Consequência: Ctrl+C ainda gera SIGINT (KeyboardInterrupt) em vez
            # de \x03. Isso é desejável — o orchestrator já captura KeyboardInterrupt.
            new_settings = termios.tcgetattr(fd)
            # new_settings[3] é o campo lflag (local flags)
            # ECHO  → exibe o que o usuário digita (queremos desativar)
            # ICANON → modo de linha (queremos desativar para ler tecla a tecla)
            new_settings[3] &= ~(termios.ECHO | termios.ICANON)
            # VMIN=0, VTIME=0: leitura não-bloqueante no nível do kernel.
            # O event loop cuida de aguardar via select/kqueue (add_reader),
            # então não precisamos de bloqueio no read() em si.
            new_settings[6][termios.VMIN] = 0
            new_settings[6][termios.VTIME] = 0
            termios.tcsetattr(fd, termios.TCSADRAIN, new_settings)

            # add_reader() registra _read_char como callback do event loop.
            # Usa kqueue/epoll/select por baixo — zero CPU quando não há tecla.
            loop.add_reader(fd, _read_char)

            while self._running:
                try:
                    # Aguarda tecla com timeout de 0.5s para checar _running periodicamente.
                    key = await asyncio.wait_for(queue.get(), timeout=0.5)
                except asyncio.TimeoutError:
                    continue  # sem tecla → verifica _running e tenta de novo

                # Despacha para o handler registrado (se existir).
                # Ctrl+C/D agora chegam como KeyboardInterrupt — não precisam
                # de tratamento especial aqui (o orchestrator captura lá fora).
                handler = self._handlers.get(key.lower())
                if handler:
                    await handler()

        finally:
            # SEMPRE restaura o terminal, mesmo se der exceção.
            loop.remove_reader(fd)
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)

    def stop(self) -> None:
        """Sinaliza o loop para encerrar na próxima iteração."""
        self._running = False
