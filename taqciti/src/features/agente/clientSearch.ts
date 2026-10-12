/**
 * Busca, ordenação e checagem de duplicidade da lista de clientes (D-08) — funções puras, sem acesso
 * à extensão, à rede nem ao relógio. Tudo é insensível a maiúsculas e a acentos em pt-BR: "acai"
 * encontra "Açaí", "sao paulo" encontra "São Paulo".
 */
import type { ClientSummary } from './clientDirectory';

/** Ordem alfabética de pt-BR; `base` ignora caixa e acento ("Ágape" fica antes de "Beta"). */
const COLLATOR = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/** Texto comparável: sem acento (NFD sem marcas), em minúsculas pt-BR e sem espaços nas pontas. */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

/** Mantém os clientes cujo nome OU projeto contém a busca. Busca vazia devolve todos. */
export function filterClients(
  clients: readonly ClientSummary[],
  query: string,
): ClientSummary[] {
  const needle = foldText(query);
  if (needle === '') return [...clients];
  return clients.filter(
    (item) => foldText(item.client).includes(needle) || foldText(item.name).includes(needle),
  );
}

/** Cópia ordenada pelo nome do cliente; o array recebido não é alterado. */
export function sortClients(clients: readonly ClientSummary[]): ClientSummary[] {
  return [...clients].sort((a, b) => COLLATOR.compare(a.client, b.client));
}

/** Já existe um cliente com este nome (sem contar acento, caixa nem espaços nas pontas)? */
export function isDuplicateClientName(name: string, clients: readonly ClientSummary[]): boolean {
  const target = foldText(name);
  return clients.some((item) => foldText(item.client) === target);
}

/** Dica da linha: o nome do projeto — omitida quando vazia ou igual ao cliente. */
export function clientHint(item: ClientSummary): string | undefined {
  const hint = item.name.trim();
  if (hint === '' || foldText(hint) === foldText(item.client)) return undefined;
  return hint;
}

/** Contador da lista (UI-SPEC): "1 cliente", "N clientes" ou, com busca, "Resultados · N". */
export function countLabel(count: number, searching: boolean): string {
  if (searching) return `Resultados · ${count}`;
  return count === 1 ? '1 cliente' : `${count} clientes`;
}
