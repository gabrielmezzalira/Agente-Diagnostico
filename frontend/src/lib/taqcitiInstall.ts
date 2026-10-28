// dados da página de instalação da Taqciti — Fase 9, D-06/D-07/D-11
// Só texto e constantes (sem React, sem imports), para a página só compor e o teste rodar em Node.

/**
 * Link de download do instalador. `null` enquanto o time não publicar a distribuição
 * (decisão de 2026-10-28): a página mostra TAQCITI_DOWNLOAD_PENDING_NOTICE no lugar do botão.
 * Quando o time definir a URL (https, host e repositório confirmados), troque o `null` por ela
 * e ajuste EXPECTED_HOST/EXPECTED_PATH_PREFIX em taqcitiInstall.test.ts.
 */
export const TAQCITI_RELEASES_URL: string | null = null

export const TAQCITI_DOWNLOAD_PENDING_NOTICE =
  'O link de download será publicado após o deploy. Enquanto isso, peça o instalador ao time.'

export type TaqcitiInstallSystem = 'windows' | 'macos' | 'linux'

export const TAQCITI_SYSTEM_LABELS: Readonly<Record<TaqcitiInstallSystem, string>> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
}

export const TAQCITI_INSTALL_STEPS: Readonly<Record<TaqcitiInstallSystem, readonly string[]>> = {
  windows: [
    'Baixe o instalador (arquivo .exe) — o link desta página, quando estiver publicado.',
    'Dê dois cliques no arquivo. Se o Windows avisar "Windows protegeu o seu PC", clique em "Mais informações" e depois em "Executar assim mesmo".',
    'Se o instalador perguntar qual navegador usar, escolha o Google Chrome.',
    'Ao terminar, uma aba abre no navegador com o guia visual: siga o passo a passo dele.',
  ],
  macos: [
    'Baixe o instalador (arquivo .pkg) — o link desta página, quando estiver publicado.',
    'Clique com o botão direito no arquivo, escolha "Abrir" e clique em "Abrir" de novo na janela de aviso de desenvolvedor não identificado.',
    'Digite a senha do seu computador quando o instalador pedir.',
    'Ao terminar, o guia visual abre no navegador: siga o passo a passo dele.',
  ],
  linux: [
    'Baixe o instalador (arquivo .run) — o link desta página, quando estiver publicado.',
    'No terminal, dê permissão de execução com "chmod +x" no arquivo e execute-o.',
    'Ao terminar, o guia visual abre no navegador: siga o passo a passo dele.',
  ],
}

export const TAQCITI_LINK_STEPS: readonly string[] = [
  'Abra a reunião no Google Meet com a Taqciti ativa.',
  'Clique na bolha "!" que aparece na tela da reunião.',
  'Clique em "Selecionar cliente" e escolha o cliente (ou crie um novo).',
  'A transcrição passa a aparecer na sessão desse cliente, aqui no web app.',
  'Ao sair da sala da reunião, a sessão é encerrada sozinha.',
]

export const TAQCITI_OLD_EXTENSION_WARNING =
  'Se você tem a extensão antiga do Agente Diagnóstico instalada, remova-a em chrome://extensions antes de instalar a Taqciti.'
