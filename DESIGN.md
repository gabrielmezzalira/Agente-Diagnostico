# CITi · Design System (tema escuro)

Referência para o Claude Code. Telas em `DocuData Redesign.dc.html` e `Agente Diagnostico Redesign.dc.html` (1440 px).

## Cores
| Token | Valor | Uso |
|---|---|---|
| bg | #030504 | fundo da página |
| sidebar | #070b09 | sidebar e painéis laterais |
| card | linear-gradient(180deg,#0e1913,#0a120d) + borda rgba(62,224,111,0.2) + inset 0 1px 0 rgba(62,224,111,0.12) | cards (sempre com contorno verde) |
| card-inner | rgba(62,224,111,0.055) + borda rgba(62,224,111,0.17) | inputs e itens dentro de cards |
| border | rgba(255,255,255,0.08) | bordas padrão |
| border-strong | rgba(255,255,255,0.14) | botões secundários, inputs |
| text | #f2f5f3 / #ffffff | texto e títulos |
| text-2 | #c3cbc6 | texto secundário |
| muted | #8a948e | legendas, descrições |
| dim | #5d6661 | vazios, zeros |
| green | #3ee06f | ação primária, sucesso, ativo |
| green-soft | rgba(62,224,111,0.12) + borda rgba(62,224,111,0.35) | chips e estados ativos |
| red | #ff6b6b | alerta, excluir |
| amber | #f2c14e | atenção, em andamento |
| violet | #b197fc | pessoas, pendente de aprovação |
| chart-grey | #4a5550 | séries de referência (total, puxados) |

Glow: radial-gradient verde a 8–14% no topo das páginas; box-shadow 0 0 24px rgba(62,224,111,0.25) no botão primário. Sem outros gradientes.

## Tipografia
- Geist 400/500/600/700; Geist Mono para números, IDs, datas e rótulos.
- H1 de página 44px/700, letter-spacing -0.035em. H1 de projeto 38px. Título de card 18–22px/700.
- Rótulo de seção: Geist Mono 11px, caixa alta, letter-spacing 0.16em, cor muted (verde quando é eyebrow, com traço verde de 18×2px antes).
- Corpo 14–15.5px, line-height 1.55.

## Layout
- Sidebar 248px (logo CITi branco, nome do produto em mono, navegação, card do usuário no rodapé). Item ativo: fundo green-soft, texto verde, ponto verde com glow.
- Topbar 72px: busca com ⌘K, seletor de subárea (Dados | Dev), ação primária à direita.
- Conteúdo: padding 40px 48px, gap 28px entre blocos.
- Abas do projeto: sublinhado verde de 2px na ativa; contadores em pílula verde mono.

## Componentes
- Card: fundo verde muito escuro em gradiente vertical, borda verde 20%, brilho interno no topo e sombra 0 12px 32px preta; raio 16px, padding 22–28px. O card precisa se destacar do fundo.
- Botões (altura 38px, raio 10px, 13.5px/600): primário verde com texto #04120a; secundário surface translúcida com border-strong; ghost; perigo com texto e borda vermelhos; "ativo" em green-soft.
- Chip: pílula 12px/600 com fundo e borda suaves da cor do estado.
- Status: ponto 7px com glow (verde ok, vermelho alerta, âmbar atenção, cinza neutro).
- Kanban: coluna com rótulo mono colorido + contador; card surface-2 raio 12px; progresso em barra de 5px.
- Tabelas: cabeçalho em rótulo mono, linhas 14px separadas por border; notas de 0 a 5 em quadrados tingidos de verde proporcional ao valor.
- Gráficos: barras com raio 6px no topo, verde para o realizado e chart-grey para referência, grade 5% branco, eixos em mono 10.5px.
- Estado vazio: borda tracejada border-strong, texto dim centralizado.

## Densidade
- Um botão primário por card. Ações secundárias agrupadas em "+ Documento" ou no menu ···.
- Status como ícone + texto (círculo verde com ✓, anel âmbar, anel tracejado para opcional), não como chips preenchidos.
- Itens fechados/antigos aparecem colapsados em uma linha.
