#!/usr/bin/env python3
# =============================================================================
# main.py
#
# Ponto de entrada da aplicação. Lê os argumentos da linha de comando e
# despacha para o modo correto: interativo (legado) ou tempo real (novo).
#
# Modos disponíveis:
#   python3 main.py                              → modo interativo (padrão)
#   python3 main.py --mode realtime --source stdin  → modo tempo real via stdin
# =============================================================================

import argparse  # biblioteca padrão para parsing de argumentos da linha de comando
import asyncio   # biblioteca padrão para programação assíncrona (event loop)

# Imports do modo interativo (legado) — usados apenas em _run_interactive()
from config import load_config
from llm import GeminiClient
from conversation import ConversationManager
from report import ReportGenerator
from agent import DiagnosticAgent


def prompt_report_decision() -> bool:
    """Pergunta ao usuário se quer gerar o relatório ou continuar a entrevista.

    Retorna True para gerar, False para continuar.
    Loop até receber "1" ou "2".
    """
    print("\n" + "-" * 40)
    print("  1. Gerar relatório")
    print("  2. Continuar entrevista")
    print("-" * 40)
    while True:
        choice = input("Escolha [1/2]: ").strip()
        if choice == "1":
            return True
        if choice == "2":
            return False
        print("Digite 1 ou 2.")


def _run_interactive() -> None:
    """Modo interativo legado: entrevista por texto no terminal.

    Este é o modo original da aplicação — o comercial digita as respostas
    do cliente manualmente. Funciona exatamente como antes da integração
    com o Taqtic. Preservado intacto como fallback e para dev/testes.
    """
    print("\n" + "=" * 60)
    print("  🚨 AGENTE DE DIAGNÓSTICO TÉCNICO — CITi")
    print("=" * 60)
    print("\nCom base em uma entrevista profunda, vou ajudar a diagnosticar")
    print("riscos e complexidade do seu projeto.")
    print("\nDica: responda com a máxima clareza técnica possível.\n")

    try:
        config = load_config()
    except ValueError as e:
        print(f"❌ Erro de configuração: {e}")
        return

    # Injeção de dependências: cria os componentes e passa para o DiagnosticAgent.
    # O agente não sabe qual LLM está usando nem como o histórico é armazenado —
    # ele só conhece as interfaces (LLMClient, ConversationManager, ReportGenerator).
    llm = GeminiClient(config.gemini_api_key, config.model_name)
    conversation = ConversationManager()
    reporter = ReportGenerator(config.reports_dir)
    agent = DiagnosticAgent(llm, conversation, reporter)

    project_description = input("Descreva o projeto (uma linha): ").strip()
    if not project_description:
        print("❌ Descrição vazia. Encerrando.")
        return

    print("\n⏳ Iniciando entrevista...\n")

    try:
        # start() injeta o system prompt + descrição do projeto e gera a 1ª pergunta
        response = agent.start(project_description)
        print(f"Agente: {response}\n")

        while True:
            # O agente sinaliza quando acha que tem contexto suficiente para o relatório
            if agent.offered_report:
                if not prompt_report_decision():
                    agent.offered_report = False  # usuário quer continuar → reseta o flag
                else:
                    print("\n⏳ Gerando relatório de diagnóstico...\n")
                    report_content, filepath = agent.generate_report()
                    print(report_content)
                    print(f"\n✅ Relatório salvo em: {filepath}")
                    return

            user_input = input("Você: ").strip()

            if not user_input:
                continue  # linha em branco → ignora e pede de novo

            if user_input.lower() in ["sair", "exit", "quit"]:
                print("\n✋ Entrevista interrompida.")
                return
            if user_input == "gere agora":
                # Atalho para gerar o relatório antes do agente oferecer
                print("Gerando o ralatório antecipadamente.")
                report_content, filepath = agent.generate_report()
                print(report_content)
                print(f"\n✅ Relatório salvo em: {filepath}")
                return
            if user_input.lower() == "proxima pergunta":
                # Atalho para pular a pergunta atual e pedir uma diferente
                print("\n⏭️  Pulando pergunta...\n")
                response = agent.respond("[O usuário pediu para pular esta pergunta. Faça uma pergunta diferente sobre outra área de risco ainda não explorada.]")
                print(f"Agente: {response}\n")
                continue

            # Fluxo normal: envia a resposta do usuário e recebe a próxima pergunta
            response = agent.respond(user_input)
            print(f"\nAgente: {response}\n")

    except KeyboardInterrupt:
        print("\n\n⚠️ Entrevista interrompida pelo usuário.")
    except Exception as e:
        print(f"\n❌ Erro durante a entrevista: {e}")
        raise


def _make_renderer(ui_mode: str, tracker):
    """Cria o renderer correto baseado no modo de UI.

    Separado de _run_realtime para ser chamado em cada branch de source
    (file, taqtic, stdin) sem duplicar código.

    Args:
        ui_mode: "cli" → CLIRenderer (terminal Rich); "web" → WebRenderer (browser).
        tracker:  CoverageTracker compartilhado — renderer e orchestrator usam o mesmo.
    """
    if ui_mode == "web":
        from ui.web_renderer import WebRenderer
        return WebRenderer(tracker, host="127.0.0.1", port=8080)

    from ui.renderer import CLIRenderer
    return CLIRenderer(tracker)


async def _run_realtime(source_name: str, ui_mode: str = "cli") -> None:
    """Modo tempo real: recebe transcrição do Taqtic e assiste a reunião ao vivo.

    Esta função é assíncrona (async def) porque o modo realtime usa asyncio
    para rodar múltiplas tarefas concorrentemente (ingestão, render, teclado).
    É chamada via asyncio.run() no main(), que cria o event loop e roda até
    a função terminar.

    O source_name determina de onde vem a transcrição:
    - "taqtic" → webhook HTTP do Taqtic (passo 9, ainda não implementado)
    - "file"   → tail de arquivo .jsonl (passo 12, ainda não implementado)
    - "stdin"  → lê do stdin linha por linha (implementado agora, usado para dev)
    """
    # Import local para não carregar os módulos de realtime quando só o modo
    # interativo for usado — mantém o startup do modo legado rápido
    from realtime_agent import RealtimeOrchestrator

    if source_name == "file":
        from transcription.file_tail import FileTailSource
        from coverage.tracker import CoverageTracker
        import os

        # Caminho do arquivo lido do ambiente (ou default)
        transcript_file = os.environ.get(
            "TRANSCRIPT_FILE",
            "transcripts/live.jsonl",
        )

        print("\n" + "=" * 60)
        print("  🚀 DIAGNÓSTICO EM TEMPO REAL — CITi")
        print("=" * 60)
        print(f"Fonte: arquivo — monitorando {transcript_file}")
        if ui_mode == "web":
            print("UI: browser — http://127.0.0.1:8080")
        else:
            print("Teclas:  [P] perguntas  [R] relatório  [S] sync  [Q] sair")
        print()

        # from_start=True: lê desde o início para replay de fixture gravada.
        # Útil para testar com fixtures/reuniao_ecommerce.jsonl sem o simulador.
        source = FileTailSource(path=transcript_file, from_start=True)

        llm = None
        try:
            config = load_config()
            llm = GeminiClient(config.gemini_api_key, config.model_name)
            print("✓ Classificador ativo (Gemini configurado).")
        except (ValueError, Exception):
            print("⚠️  LLM não configurado — mapa de cobertura estático.")

        tracker  = CoverageTracker()
        renderer = _make_renderer(ui_mode, tracker)
        orchestrator = RealtimeOrchestrator(source=source, llm=llm, tracker=tracker, renderer=renderer)
        await orchestrator.run()
        return

    # Seleciona a fonte de transcrição.
    # Taqtic é o modo principal (webhook HTTP local).
    # Stdin é o fallback para dev/demo sem a extensão Chrome instalada.
    if source_name == "taqtic":
        from transcription.webhook_server import WebhookServer
        from transcription.taqtic import TaqticWebhookSource
        from coverage.tracker import CoverageTracker

        # Lê configurações opcionais do ambiente.
        # Se não tiver config (ex: rodando sem .env), usa defaults seguros.
        webhook_host = "127.0.0.1"
        webhook_port = 8765
        webhook_secret = ""
        try:
            cfg = load_config()
            # Config pode ter campos extras quando definidos no .env.
            # Usamos getattr com default para não quebrar se o campo não existir.
            webhook_host   = getattr(cfg, "webhook_host",   webhook_host)
            webhook_port   = int(getattr(cfg, "webhook_port",   webhook_port))
            webhook_secret = getattr(cfg, "webhook_secret", webhook_secret)
        except (ValueError, Exception):
            pass  # config não encontrada → usa defaults

        server = WebhookServer(host=webhook_host, port=webhook_port, secret=webhook_secret)
        source = TaqticWebhookSource(server=server)

        print("\n" + "=" * 60)
        print("  🚀 DIAGNÓSTICO EM TEMPO REAL — CITi")
        print("=" * 60)
        print(f"Webhook: http://{webhook_host}:{webhook_port}/transcription")
        if ui_mode == "web":
            print("UI: browser — http://127.0.0.1:8080")
        else:
            print("Teclas:  [P] perguntas  [R] relatório  [S] sync  [Q] sair")
        print()

        # Carrega o LLM (mesmo código do bloco stdin abaixo)
        llm = None
        try:
            config = load_config()
            llm = GeminiClient(config.gemini_api_key, config.model_name)
            print("✓ Classificador ativo (Gemini configurado).")
        except (ValueError, Exception):
            print("⚠️  LLM não configurado — mapa de cobertura estático.")

        tracker  = CoverageTracker()
        renderer = _make_renderer(ui_mode, tracker)
        orchestrator = RealtimeOrchestrator(source=source, llm=llm, tracker=tracker, renderer=renderer)

        # O WebhookServer precisa ser iniciado ANTES do orchestrator.run()
        # porque o run() já dispara a _ingestion_task que consome o stream().
        await source.server.start()
        print(f"\n✅ Aguardando conexão do Taqtic em http://{webhook_host}:{webhook_port}")
        print("   Ou simule com: python3 scripts/simulate_transcript.py\n")

        try:
            await orchestrator.run()
        finally:
            # Para o server mesmo se o orchestrator lançar exceção
            await source.server.stop()
            source.stop()
        return

    from transcription.stdin_source import StdinSource
    from coverage.tracker import CoverageTracker

    print("\n" + "=" * 60)
    print("  🚀 DIAGNÓSTICO EM TEMPO REAL — CITi")
    print("=" * 60)
    print("Fonte: stdin — pipe a transcrição ou cole linha por linha.")
    if ui_mode == "web":
        print("UI: browser — http://127.0.0.1:8080")
    else:
        print("Teclas: [P] perguntas  [R] relatório  [S] sync  [Q] sair")
    print()

    # Tenta carregar o LLM para o classificador. Se não houver API key configurada,
    # o modo realtime funciona sem classificação (painel visual ativo, sem atualização
    # automática do mapa) — útil para testar a UI sem gastar tokens.
    llm = None
    try:
        config = load_config()
        llm = GeminiClient(config.gemini_api_key, config.model_name)
        print("✓ Classificador ativo (Gemini configurado).")
    except (ValueError, Exception):
        print("⚠️  LLM não configurado — mapa de cobertura não será atualizado automaticamente.")
        print("   Configure GEMINI_API_KEY no .env para habilitar o classificador.\n")

    source   = StdinSource()
    tracker  = CoverageTracker()
    renderer = _make_renderer(ui_mode, tracker)
    # RealtimeOrchestrator recebe fonte, LLM, tracker e renderer injetados.
    # Quando llm=None, o CoverageClassifier não é criado e o mapa permanece
    # estático (todas as áreas em RED até o usuário encerrar).
    orchestrator = RealtimeOrchestrator(source=source, llm=llm, tracker=tracker, renderer=renderer)
    await orchestrator.run()  # bloqueia até Q ser pressionado ou stdin fechar


def main() -> None:
    """Ponto de entrada. Lê argumentos e despacha para o modo correto.

    argparse é a biblioteca padrão do Python para parsing de argumentos CLI.
    Gera automaticamente o --help com as opções disponíveis.
    """
    parser = argparse.ArgumentParser(
        description="Agente de Diagnóstico CITi",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Exemplos:\n"
            "  python3 main.py                                   # modo interativo (padrão)\n"
            "  python3 main.py --mode realtime --source stdin    # tempo real via stdin\n"
        ),
    )
    parser.add_argument(
        "--mode",
        choices=["interactive", "realtime"],
        default="interactive",
        help="Modo de operação (default: interactive)",
    )
    parser.add_argument(
        "--source",
        choices=["taqtic", "file", "stdin"],
        default="taqtic",
        help="Fonte de transcrição no modo realtime (default: taqtic)",
    )
    parser.add_argument(
        "--ui",
        choices=["cli", "web"],
        default="cli",
        help="Interface de usuário no modo realtime: cli (terminal) ou web (browser, default: cli)",
    )
    args = parser.parse_args()

    if args.mode == "realtime":
        # asyncio.run() cria um novo event loop, roda a corrotina até o fim
        # e fecha o loop. É o ponto de entrada padrão para código assíncrono.
        asyncio.run(_run_realtime(args.source, ui_mode=args.ui))
    else:
        # Modo interativo é síncrono — chama diretamente sem asyncio
        _run_interactive()


if __name__ == "__main__":
    main()
