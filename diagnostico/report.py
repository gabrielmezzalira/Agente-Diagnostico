# =============================================================================
# report.py
#
# Responsabilidade única: salvar o relatório de diagnóstico em disco.
#
# O ReportGenerator não sabe o que está no relatório nem como ele foi gerado —
# ele só recebe o conteúdo pronto e persiste em um arquivo Markdown com
# timestamp no nome.
# =============================================================================

from pathlib import Path
from datetime import datetime


class ReportGenerator:
    """Salva relatórios de diagnóstico em arquivos Markdown com timestamp.

    Recebe o diretório de destino no construtor. O save() cuida de criar
    a pasta se não existir, gerar um nome único por timestamp e escrever
    o arquivo.

    Por que injetar o reports_dir no construtor em vez de ler do .env aqui?
    Seguindo a Inversão de Dependência (SOLID): o ReportGenerator não precisa
    saber de onde vem o caminho — ele só precisa de um caminho. Quem decide
    de onde vir (config.py, argumento de teste, etc.) é quem cria a instância.
    """

    def __init__(self, reports_dir: str) -> None:
        # Path() é preferível a string pura para caminhos de arquivo:
        # - funciona em Windows (\ e /) e Unix (/) sem ajuste manual
        # - o operador / para concatenar caminhos é mais legível que os.path.join
        # - métodos como mkdir(), write_text(), exists() ficam disponíveis direto
        self._reports_dir = Path(reports_dir)

    def save(self, content: str) -> Path:
        """Persiste o conteúdo do relatório e retorna o caminho do arquivo criado.

        O nome do arquivo inclui um timestamp para que múltiplos diagnósticos
        não sobrescrevam uns aos outros — cada execução gera um arquivo único.

        Args:
            content: conteúdo Markdown completo do relatório, gerado pelo LLM.

        Returns:
            Path do arquivo criado (ex: reports/diagnostico_20260429_143211.md)
        """
        # mkdir com parents=True cria todos os diretórios intermediários se
        # não existirem (ex: se reports_dir for "data/reports", cria "data/" também).
        # exist_ok=True evita erro se a pasta já existir.
        self._reports_dir.mkdir(parents=True, exist_ok=True)

        # strftime formata o datetime atual como string:
        # %Y → ano com 4 dígitos (ex: 2026)
        # %m → mês com 2 dígitos (ex: 04)
        # %d → dia com 2 dígitos (ex: 29)
        # %H → hora em formato 24h (ex: 14)
        # %M → minutos (ex: 32)
        # %S → segundos (ex: 11)
        # Resultado: "20260429_143211"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"diagnostico_{timestamp}.md"

        # O operador / no Path concatena caminhos de forma portável:
        # Path("reports") / "diagnostico_xxx.md" → Path("reports/diagnostico_xxx.md")
        filepath = self._reports_dir / filename

        # write_text() escreve o conteúdo de uma vez, cria o arquivo se não existir
        # e fecha automaticamente. encoding="utf-8" garante que acentos e emojis
        # do relatório sejam salvos corretamente.
        filepath.write_text(content, encoding="utf-8")

        return filepath
