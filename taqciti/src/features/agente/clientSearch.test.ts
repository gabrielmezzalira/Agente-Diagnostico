/**
 * Busca e ordenação de clientes do seletor (D-08): sem acento, sem caixa, em pt-BR. Cada caso
 * corresponde a uma forma real de a pessoa digitar ("acai" para "Açaí", espaços nas pontas).
 */
import { describe, expect, it } from 'vitest';
import {
  ClientDirectoryUnavailableError,
  unavailableClientDirectory,
  unavailableSessionGateway,
  type ClientSummary,
} from './clientDirectory';
import {
  clientHint,
  countLabel,
  filterClients,
  isDuplicateClientName,
  sortClients,
} from './clientSearch';

function client(name: string, project = name, id = name): ClientSummary {
  return { id, client: name, name: project };
}

const CLIENTS: ClientSummary[] = [
  client('Açaí Ltda', 'Pipeline de vendas'),
  client('São Paulo Tech', 'Dashboard'),
  client('Beta SA', 'Beta SA'),
];

describe('filterClients', () => {
  it('"acai" encontra "Açaí Ltda" e "  SAO paulo " encontra "São Paulo Tech"', () => {
    expect(filterClients(CLIENTS, 'acai').map((c) => c.client)).toEqual(['Açaí Ltda']);
    expect(filterClients(CLIENTS, '  SAO paulo ').map((c) => c.client)).toEqual([
      'São Paulo Tech',
    ]);
  });

  it('busca vazia (ou só espaços) devolve todos', () => {
    expect(filterClients(CLIENTS, '')).toHaveLength(3);
    expect(filterClients(CLIENTS, '   ')).toHaveLength(3);
  });

  it('casa por cliente OU por nome do projeto', () => {
    expect(filterClients(CLIENTS, 'pipeline').map((c) => c.client)).toEqual([
      'Açaí Ltda',
    ]);
    expect(filterClients(CLIENTS, 'dash').map((c) => c.client)).toEqual([
      'São Paulo Tech',
    ]);
    expect(filterClients(CLIENTS, 'zzz')).toEqual([]);
  });
});

describe('sortClients', () => {
  it('ordena pelo cliente em pt-BR: "Ágape" antes de "Beta"; "beta" e "Beta" ficam juntos', () => {
    const sorted = sortClients([
      client('Beta'),
      client('Zeta'),
      client('beta', 'x', 'b2'),
      client('Ágape'),
    ]);
    expect(sorted.map((c) => c.client)).toEqual(['Ágape', 'Beta', 'beta', 'Zeta']);
  });

  it('não altera o array recebido', () => {
    const original = [client('B'), client('A')];
    sortClients(original);
    expect(original.map((c) => c.client)).toEqual(['B', 'A']);
  });
});

describe('isDuplicateClientName', () => {
  it('" açaí ltda " duplica "Açaí Ltda"; "Açaí Ltda 2" não', () => {
    expect(isDuplicateClientName(' açaí ltda ', CLIENTS)).toBe(true);
    expect(isDuplicateClientName('Açaí Ltda 2', CLIENTS)).toBe(false);
  });
});

describe('clientHint', () => {
  it('omite a dica quando o projeto é igual ao cliente ou está vazio', () => {
    expect(clientHint({ id: '1', client: 'X', name: 'X' })).toBeUndefined();
    expect(clientHint({ id: '1', client: 'X', name: '' })).toBeUndefined();
    expect(clientHint({ id: '1', client: 'X', name: 'Pipeline' })).toBe('Pipeline');
  });
});

describe('countLabel', () => {
  it('singular, plural e resultados de busca', () => {
    expect(countLabel(1, false)).toBe('1 cliente');
    expect(countLabel(3, false)).toBe('3 clientes');
    expect(countLabel(2, true)).toBe('Resultados · 2');
  });
});

describe('implementações "indisponível"', () => {
  it('list() e createSession() rejeitam com ClientDirectoryUnavailableError', async () => {
    await expect(unavailableClientDirectory.list()).rejects.toBeInstanceOf(
      ClientDirectoryUnavailableError,
    );
    await expect(unavailableClientDirectory.create('X')).rejects.toBeInstanceOf(
      ClientDirectoryUnavailableError,
    );
    await expect(
      unavailableSessionGateway.createSession('1', 'X'),
    ).rejects.toBeInstanceOf(ClientDirectoryUnavailableError);
  });
});
