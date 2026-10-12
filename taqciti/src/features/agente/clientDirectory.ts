/**
 * De onde vêm os clientes do seletor, e como uma sessão nasce no Agente (Fase 8, D-08/D-13).
 *
 * Inversão de dependência (CLAUDE.md, SOLID — D): o seletor (`ClientPicker`) e quem o compõe só
 * conhecem estas duas interfaces. A origem real — as rotas novas do backend (decisão B1) ou, no
 * futuro, o AGM — entra depois, implementando as mesmas portas, sem mexer em nenhuma tela. É como
 * um cardápio impresso que pode vir de qualquer cozinha.
 *
 * Enquanto a decisão B1 não for aplicada, o padrão de produção são as implementações
 * "indisponível" abaixo: a lista falha, e o seletor cai no plano B (ID manual, D-02).
 *
 * `ClientSummary` leva só o necessário para a tela (minimização de dados, LGPD): nada de
 * `ProjectResponse` inteiro, chave de API ou contexto do projeto.
 */

/** Uma linha do seletor. `id` é o id do projeto; `client` é o rótulo; `name` é o nome do projeto. */
export interface ClientSummary {
  id: string;
  client: string;
  name: string;
}

/** O nome já existe (sem contar acento nem caixa). */
export class DuplicateClientError extends Error {
  constructor(message = 'Já existe um cliente com esse nome.') {
    super(message);
    this.name = 'DuplicateClientError';
  }
}

/** A origem dos clientes ainda não está ligada ao backend (ou está fora do ar). */
export class ClientDirectoryUnavailableError extends Error {
  constructor(message = 'A lista de clientes não está disponível.') {
    super(message);
    this.name = 'ClientDirectoryUnavailableError';
  }
}

export interface ClientDirectory {
  list(): Promise<ClientSummary[]>;
  /** Cria um cliente só com o nome. Nome repetido rejeita com `DuplicateClientError`. */
  create(name: string): Promise<ClientSummary>;
}

export interface AgenteSessionGateway {
  /** Cria a sessão do Agente para o cliente escolhido e devolve o id dela. */
  createSession(clientId: string, name: string): Promise<{ sessionId: string }>;
}

export const unavailableClientDirectory: ClientDirectory = {
  list: () => Promise.reject(new ClientDirectoryUnavailableError()),
  create: () => Promise.reject(new ClientDirectoryUnavailableError()),
};

export const unavailableSessionGateway: AgenteSessionGateway = {
  createSession: () => Promise.reject(new ClientDirectoryUnavailableError()),
};
