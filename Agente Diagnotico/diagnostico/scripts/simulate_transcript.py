#!/usr/bin/env python3
# =============================================================================
# scripts/simulate_transcript.py
#
# Simulador de transcrição: lê um arquivo .jsonl e envia os chunks via HTTP
# POST para o WebhookServer, reproduzindo uma reunião ao vivo.
#
# Uso:
#   python3 scripts/simulate_transcript.py                     # usa fixture padrão
#   python3 scripts/simulate_transcript.py fixtures/outra.jsonl
#   python3 scripts/simulate_transcript.py --delay 2.0         # 2s entre chunks
#   python3 scripts/simulate_transcript.py --url http://127.0.0.1:9000  # porta diferente
#
# Fluxo de uso completo (dois terminais):
#   Terminal 1: python3 main.py --mode realtime --source taqtic
#   Terminal 2: python3 scripts/simulate_transcript.py
#
# O simulador:
# 1. Verifica se o servidor está de pé via GET /healthz
# 2. Lê o arquivo .jsonl linha por linha
# 3. Envia cada chunk via POST /transcription
# 4. Espera DELAY segundos entre cada chunk (simula ritmo da fala)
# 5. Imprime confirmação de cada envio no terminal
# =============================================================================

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# Caminho padrão da fixture — relativo à raiz do projeto (diagnostico/)
_DEFAULT_FIXTURE = Path(__file__).parent.parent / "fixtures" / "reuniao_ecommerce.jsonl"
_DEFAULT_URL = "http://127.0.0.1:8765"
_DEFAULT_DELAY = 1.5   # segundos entre chunks
_HEALTHZ_RETRIES = 10  # tentativas de healthcheck antes de desistir
_HEALTHZ_WAIT = 1.0    # segundos entre tentativas


def wait_for_server(base_url: str) -> bool:
    """Aguarda o WebhookServer estar pronto via GET /healthz.

    Tenta _HEALTHZ_RETRIES vezes com _HEALTHZ_WAIT segundos entre cada.
    Retorna True se o servidor respondeu 200 em alguma tentativa.

    Por que não usar requests? Para manter o simulador sem dependências
    externas além da stdlib — facilita rodar em qualquer ambiente sem pip.
    """
    url = f"{base_url}/healthz"
    print(f"Aguardando servidor em {url}...")

    for attempt in range(1, _HEALTHZ_RETRIES + 1):
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read())
                    print(f"✓ Servidor pronto (tentativa {attempt}): {data}")
                    return True
        except (urllib.error.URLError, OSError):
            # Servidor ainda não está de pé — espera e tenta de novo
            print(f"  [{attempt}/{_HEALTHZ_RETRIES}] Servidor não respondeu, aguardando {_HEALTHZ_WAIT}s...")
            time.sleep(_HEALTHZ_WAIT)

    return False


def send_chunk(base_url: str, payload: dict) -> bool:
    """Envia um chunk via POST /transcription.

    Retorna True se o servidor retornou 200, False caso contrário.
    Não levanta exceção — o simulador continua mesmo se um chunk falhar.
    """
    url = f"{base_url}/transcription"
    body = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except (urllib.error.URLError, OSError) as e:
        print(f"  ✗ Erro ao enviar chunk: {e}")
        return False


def run(fixture_path: Path, base_url: str, delay: float) -> None:
    """Lê o arquivo .jsonl e envia cada linha como um chunk."""
    if not fixture_path.exists():
        print(f"✗ Arquivo não encontrado: {fixture_path}")
        sys.exit(1)

    # Lê todas as linhas válidas antes de começar (valida o arquivo todo de uma vez)
    chunks = []
    with fixture_path.open(encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue  # ignora linhas em branco
            try:
                chunks.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"  ✗ Linha {lineno} inválida (ignorada): {e}")

    if not chunks:
        print("✗ Nenhum chunk válido no arquivo.")
        sys.exit(1)

    print(f"\n📄 {len(chunks)} chunks carregados de: {fixture_path.name}")
    print(f"⏱  Delay entre chunks: {delay}s")
    print(f"🎯 Enviando para: {base_url}/transcription\n")
    print("-" * 50)

    # Envia cada chunk com delay entre eles
    for i, payload in enumerate(chunks, 1):
        speaker = payload.get("speaker", "?")
        text = payload.get("text", "")[:60]  # trunca para o terminal
        ellipsis = "..." if len(payload.get("text", "")) > 60 else ""

        ok = send_chunk(base_url, payload)

        status_icon = "✓" if ok else "✗"
        print(f"[{i:02d}/{len(chunks)}] {status_icon} [{speaker}] {text}{ellipsis}")

        # Não espera após o último chunk
        if i < len(chunks):
            time.sleep(delay)

    print("-" * 50)
    print(f"\n✅ Simulação concluída: {len(chunks)} chunks enviados.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Simulador de transcrição para o Agente de Diagnóstico CITi",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Exemplos:\n"
            "  python3 scripts/simulate_transcript.py\n"
            "  python3 scripts/simulate_transcript.py fixtures/reuniao_ecommerce.jsonl --delay 2.0\n"
            "  python3 scripts/simulate_transcript.py --url http://127.0.0.1:9000\n"
        ),
    )
    parser.add_argument(
        "fixture",
        nargs="?",
        type=Path,
        default=_DEFAULT_FIXTURE,
        help=f"Caminho do arquivo .jsonl (padrão: {_DEFAULT_FIXTURE.name})",
    )
    parser.add_argument(
        "--url",
        default=_DEFAULT_URL,
        help=f"URL base do WebhookServer (padrão: {_DEFAULT_URL})",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=_DEFAULT_DELAY,
        help=f"Segundos entre chunks (padrão: {_DEFAULT_DELAY})",
    )
    parser.add_argument(
        "--no-healthcheck",
        action="store_true",
        help="Pula o healthcheck e começa a enviar imediatamente",
    )
    args = parser.parse_args()

    print("\n🎬 Simulador de Transcrição — CITi")
    print("=" * 50)

    if not args.no_healthcheck:
        if not wait_for_server(args.url):
            print(f"\n✗ Servidor não respondeu após {_HEALTHZ_RETRIES} tentativas.")
            print("  Certifique-se de que o agente está rodando:")
            print("  python3 main.py --mode realtime --source taqtic")
            sys.exit(1)

    run(fixture_path=args.fixture, base_url=args.url, delay=args.delay)


if __name__ == "__main__":
    main()
