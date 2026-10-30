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

// Aba AGP da Taqciti (Fase 10, D-09): o que ela mostra e a divergência aceita com o web app
export const TAQCITI_AGP_TAB_NOTES: readonly string[] = [
  'Durante a call, a aba "AGP" do painel da Taqciti mostra as perguntas que o Agente gerou para a sessão vinculada, cada uma com a lente Produto ou Dados.',
  'Sem cliente vinculado, a aba mostra só um aviso: ela nunca mostra perguntas de uma sessão que não foi escolhida.',
  'A aba só mostra as perguntas. Gerar, fixar e descartar continuam sendo feitos aqui no web app.',
  'Fixar ou descartar uma pergunta aqui no web app não tira o cartão da aba AGP: ele continua lá até a Taqciti se reconectar ao Agente. Só a pergunta que ninguém fixou some sozinha quando o tempo dela acaba.',
  'Com a captura pausada ou com o envio ao Agente desligado, a aba mostra "Pausado" e mantém as últimas perguntas recebidas.',
]

export const TAQCITI_OLD_EXTENSION_WARNING =
  'Se você tem a extensão antiga do Agente Diagnóstico instalada, remova-a em chrome://extensions antes de instalar a Taqciti.'
