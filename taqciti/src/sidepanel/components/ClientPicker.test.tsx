/**
 * Teste de componente do ClientPicker (D-08, D-02, D-14, UI-SPEC §3): estados da lista, busca sem
 * acento, seleção em DOIS passos (clicar na linha só marca; quem confirma é o botão do rodapé),
 * criar cliente inline, plano B do ID manual (só com a lista em erro), teclado e texto de cliente
 * renderizado como texto. Mesmo padrão de Toggle.test.tsx (createRoot + act).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientSummary } from '@/features/agente/clientDirectory';
import { ClientPicker } from './ClientPicker';

type PickerProps = Parameters<typeof ClientPicker>[0];

const CLIENTS: ClientSummary[] = [
  { id: 'c-beta', client: 'Beta SA', name: 'Beta SA' },
  { id: 'c-acai', client: 'Açaí Ltda', name: 'Pipeline de vendas' },
  { id: 'c-sp', client: 'São Paulo Tech', name: 'Dashboard' },
];

const VALID_UUID = '11111111-2222-4333-8444-555555555555';
const DUPLICATE_HINT = 'Já existe um cliente com esse nome. Selecione-o na lista.';
const CREATE_CLIENT_ERROR =
  'Não foi possível criar o cliente. Confira a conexão e tente de novo.';
const CREATE_SESSION_ERROR =
  'Não foi possível criar a sessão no Agente. A reunião continua guardada só aqui. Tente de novo.';
const MANUAL_FORMAT_ERROR =
  'O ID precisa ser um UUID, como aparece no web app do Agente.';

/** Monta o picker num root próprio e devolve os atalhos de consulta dos grupos de teste. */
function usePickerHarness() {
  const ctx = { host: null as unknown as HTMLDivElement, root: null as unknown as Root };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    ctx.host = document.createElement('div');
    document.body.append(ctx.host);
    ctx.root = createRoot(ctx.host);
  });

  afterEach(() => {
    act(() => ctx.root.unmount());
    ctx.host.remove();
  });

  return {
    get host() {
      return ctx.host;
    },
    render(overrides: Partial<PickerProps> = {}) {
      const props: PickerProps = {
        status: 'ready',
        clients: CLIENTS,
        mode: 'live',
        busy: false,
        error: null,
        onConfirm: () => {},
        onCreate: () => {},
        onManualId: () => {},
        onRetry: () => {},
        onBack: () => {},
        ...overrides,
      };
      act(() => ctx.root.render(<ClientPicker {...props} />));
    },
    typeInto(input: HTMLInputElement, value: string) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!;
      act(() => {
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    },
    press(target: Element, key: string) {
      act(() => {
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
    },
    buttonByText: (text: string) =>
      Array.from(ctx.host.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === text,
      ),
    input: () => ctx.host.querySelector<HTMLInputElement>('input')!,
    rows: () =>
      Array.from(
        ctx.host.querySelectorAll<HTMLLIElement>('ul[aria-label="Clientes"] > li'),
      ),
    rowButton: (index: number) =>
      Array.from(
        ctx.host.querySelectorAll<HTMLLIElement>('ul[aria-label="Clientes"] > li'),
      )[index]!.querySelector('button')!,
  };
}

describe('ClientPicker — lista, busca e seleção', () => {
  const h = usePickerHarness();

  it('loading: 4 linhas-esqueleto, "Carregando clientes…" polite, busca e criar desabilitados, sem campo de ID', () => {
    h.render({ status: 'loading', clients: [] });

    expect(h.host.querySelectorAll('[data-skeleton-row]')).toHaveLength(4);
    expect(h.host.querySelector('[aria-live="polite"]')!.textContent).toBe(
      'Carregando clientes…',
    );
    expect(h.input().disabled).toBe(true);
    expect(h.buttonByText('Criar cliente novo')!.disabled).toBe(true);
    expect(h.host.textContent).not.toContain('ID da sessão do Agente');
  });

  it('ready sem clientes: mensagem de vazio, corpo e ação "Criar cliente novo"', () => {
    h.render({ clients: [] });

    expect(h.host.textContent).toContain('Nenhum cliente cadastrado ainda.');
    expect(h.host.textContent).toContain('Crie o primeiro para vincular esta reunião.');
    expect(h.buttonByText('Criar cliente novo')!.disabled).toBe(false);
    expect(h.rows()).toHaveLength(0);
  });

  it('ready com 3 clientes: contador, ordem alfabética, sem dica quando projeto = cliente; "acai" -> Resultados · 1', () => {
    h.render();

    expect(h.host.textContent).toContain('3 clientes');
    expect(h.rows().map((li) => li.getAttribute('title'))).toEqual([
      'Açaí Ltda',
      'Beta SA',
      'São Paulo Tech',
    ]);
    expect(h.rows()[0]!.textContent).toContain('Pipeline de vendas');
    // "Beta SA" tem projeto igual ao cliente: só o rótulo, sem linha de dica.
    expect(h.rows()[1]!.querySelectorAll('.text-caption')).toHaveLength(0);

    h.typeInto(h.input(), 'acai');

    expect(h.host.textContent).toContain('Resultados · 1');
    expect(h.rows()).toHaveLength(1);
  });

  it('busca sem resultado: "Nenhum cliente com “xyz”." e a ação "Criar cliente “xyz”"', () => {
    h.render();
    h.typeInto(h.input(), 'xyz');

    expect(h.host.textContent).toContain('Nenhum cliente com “xyz”.');
    expect(h.buttonByText('Criar cliente “xyz”')).toBeDefined();
    expect(h.rows()).toHaveLength(0);
  });

  it('clicar na linha seleciona sem confirmar; de novo desmarca; outra linha troca a seleção', () => {
    const onConfirm = vi.fn();
    h.render({ onConfirm });

    act(() => h.rowButton(0).click());
    expect(h.rowButton(0).getAttribute('aria-pressed')).toBe('true');
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => h.rowButton(0).click());
    expect(h.rowButton(0).getAttribute('aria-pressed')).toBe('false');

    act(() => h.rowButton(0).click());
    act(() => h.rowButton(1).click());
    expect(h.rowButton(0).getAttribute('aria-pressed')).toBe('false');
    expect(h.rowButton(1).getAttribute('aria-pressed')).toBe('true');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('CTA do rodapé: "Vincular reunião" (live) / "Enviar reunião" (ended); desabilitado sem seleção; confirma uma vez', () => {
    const onConfirm = vi.fn();
    h.render({ onConfirm });
    expect(h.buttonByText('Vincular reunião')!.disabled).toBe(true);

    // Ordem alfabética: a linha 0 é "Açaí Ltda" (c-acai).
    act(() => h.rowButton(0).click());
    expect(h.buttonByText('Vincular reunião')!.disabled).toBe(false);
    act(() => h.buttonByText('Vincular reunião')!.click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(CLIENTS[1]);

    h.render({ mode: 'ended', onConfirm });
    expect(h.buttonByText('Enviar reunião')).toBeDefined();
    expect(h.host.textContent).toContain(
      'A transcrição guardada será enviada para a sessão deste cliente.',
    );
  });

  it('busy: CTA "Vinculando…"/"Enviando…" desabilitado e lista com aria-busy', () => {
    h.render({ busy: true });
    expect(h.buttonByText('Vinculando…')!.disabled).toBe(true);
    expect(
      h.host.querySelector('ul[aria-label="Clientes"]')!.getAttribute('aria-busy'),
    ).toBe('true');

    h.render({ busy: true, mode: 'ended' });
    expect(h.buttonByText('Enviando…')!.disabled).toBe(true);
  });

  it('status error: mensagem documentada e "Tentar de novo" chama onRetry', () => {
    const onRetry = vi.fn();
    h.render({ status: 'error', clients: [], onRetry });

    expect(h.host.textContent).toContain(
      'Não consegui carregar os clientes. Confira a conexão e tente de novo — ou cole abaixo o ID de uma sessão que já existe.',
    );
    act(() => h.buttonByText('Tentar de novo')!.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('↓ no campo de busca foca a primeira linha; Esc chama onBack e não chega ao document', () => {
    const onBack = vi.fn();
    const documentListener = vi.fn();
    document.addEventListener('keydown', documentListener);
    h.render({ onBack });

    h.press(h.input(), 'ArrowDown');
    expect(document.activeElement).toBe(h.rowButton(0));

    h.press(h.input(), 'Escape');
    h.press(h.rowButton(0), 'Escape');

    expect(onBack).toHaveBeenCalledTimes(2);
    expect(documentListener).not.toHaveBeenCalled();
    document.removeEventListener('keydown', documentListener);
  });

  it('nome com HTML aparece como texto literal e o li leva o nome completo em title', () => {
    const evil = '<img src=x onerror=alert(1)>';
    h.render({ clients: [{ id: 'c-evil', client: evil, name: evil }] });

    expect(h.host.querySelector('img')).toBeNull();
    expect(h.rows()[0]!.textContent).toContain(evil);
    expect(h.rows()[0]!.getAttribute('title')).toBe(evil);
  });
});

describe('ClientPicker — criar cliente inline', () => {
  const h = usePickerHarness();

  function openForm(overrides: Partial<PickerProps> = {}) {
    h.render(overrides);
    act(() => h.buttonByText('Criar cliente novo')!.click());
  }

  it('"Criar cliente novo" troca a lista pelo formulário com a cópia do UI-SPEC', () => {
    openForm();

    const field = h.input();
    expect(h.host.querySelector('label')!.textContent).toBe('Nome do cliente');
    expect(field.placeholder).toBe('Ex.: Empresa XYZ');
    expect(field.maxLength).toBe(120);
    expect(h.host.textContent).toContain(
      'Só o nome basta. Tipo de projeto, maturidade e contexto você completa depois no Agente.',
    );
    expect(h.buttonByText('Criar e vincular')).toBeDefined();
    expect(h.buttonByText('Voltar à lista')).toBeDefined();
    expect(h.host.querySelector('ul[aria-label="Clientes"]')).toBeNull();

    h.render({ mode: 'ended' });
    expect(h.buttonByText('Criar e enviar')).toBeDefined();
  });

  it('campo vazio ou só com espaços mantém o CTA desabilitado; "  Nova Co  " + Enter envia "Nova Co"', () => {
    const onCreate = vi.fn();
    openForm({ onCreate });
    expect(h.buttonByText('Criar e vincular')!.disabled).toBe(true);

    h.typeInto(h.input(), '   ');
    expect(h.buttonByText('Criar e vincular')!.disabled).toBe(true);
    h.press(h.input(), 'Enter');
    expect(onCreate).not.toHaveBeenCalled();

    h.typeInto(h.input(), '  Nova Co  ');
    expect(h.buttonByText('Criar e vincular')!.disabled).toBe(false);
    h.press(h.input(), 'Enter');
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith('Nova Co');
  });

  it('nome igual a um cliente existente (sem acento/caixa) mostra a dica e não envia', () => {
    const onCreate = vi.fn();
    openForm({ onCreate });

    h.typeInto(h.input(), ' acai LTDA ');

    expect(h.host.textContent).toContain(DUPLICATE_HINT);
    expect(h.buttonByText('Criar e vincular')!.disabled).toBe(true);
    h.press(h.input(), 'Enter');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('"Criar cliente “xyz”" (busca sem resultado) abre o formulário já preenchido com "xyz"', () => {
    h.render();
    h.typeInto(h.input(), 'xyz');
    act(() => h.buttonByText('Criar cliente “xyz”')!.click());

    expect(h.input().value).toBe('xyz');
    expect(h.buttonByText('Criar e vincular')!.disabled).toBe(false);
  });

  it('busy no formulário: CTA "Criando…" desabilitado e campo inerte com aria-busy', () => {
    openForm();
    h.typeInto(h.input(), 'Nova Co');
    h.render({ busy: true });

    expect(h.buttonByText('Criando…')!.disabled).toBe(true);
    expect(h.input().getAttribute('aria-busy')).toBe('true');
    expect(h.input().disabled).toBe(true);
  });

  it('erro ao criar: mensagem assertive abaixo do campo e o texto digitado continua lá', () => {
    openForm();
    h.typeInto(h.input(), 'Nova Co');

    h.render({ error: 'create-client' });
    const message = h.host.querySelector('[aria-live="assertive"]')!;
    expect(message.textContent).toBe(CREATE_CLIENT_ERROR);
    expect(message.className).toContain('text-danger');
    expect(h.input().value).toBe('Nova Co');

    h.render({ error: 'create-session' });
    expect(h.host.querySelector('[aria-live="assertive"]')!.textContent).toBe(
      CREATE_SESSION_ERROR,
    );
    expect(h.input().value).toBe('Nova Co');
  });

  it('recusa de duplicado vinda do servidor mostra a dica e mantém o CTA desabilitado até o texto mudar', () => {
    const onCreate = vi.fn();
    openForm({ onCreate });
    h.typeInto(h.input(), 'Cliente Novo');
    h.press(h.input(), 'Enter');
    expect(onCreate).toHaveBeenCalledTimes(1);

    h.render({ error: 'duplicate', onCreate });
    expect(h.host.textContent).toContain(DUPLICATE_HINT);
    expect(h.buttonByText('Criar e vincular')!.disabled).toBe(true);

    h.typeInto(h.input(), 'Cliente Novo 2');
    expect(h.buttonByText('Criar e vincular')!.disabled).toBe(false);
  });

  it('Esc no formulário volta à lista sem criar, sem onBack, descarta o texto e não chega ao document', () => {
    const onCreate = vi.fn();
    const onBack = vi.fn();
    const documentListener = vi.fn();
    document.addEventListener('keydown', documentListener);
    openForm({ onCreate, onBack });
    h.typeInto(h.input(), 'Nova Co');

    h.press(h.input(), 'Escape');

    expect(h.host.querySelector('ul[aria-label="Clientes"]')).not.toBeNull();
    expect(onCreate).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
    expect(documentListener).not.toHaveBeenCalled();

    act(() => h.buttonByText('Criar cliente novo')!.click());
    expect(h.input().value).toBe('');
    document.removeEventListener('keydown', documentListener);
  });

  it('"Voltar à lista" volta sem criar nada', () => {
    const onCreate = vi.fn();
    openForm({ onCreate });
    h.typeInto(h.input(), 'Nova Co');

    act(() => h.buttonByText('Voltar à lista')!.click());

    expect(h.host.querySelector('ul[aria-label="Clientes"]')).not.toBeNull();
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe('ClientPicker — plano B do ID manual (D-02)', () => {
  const h = usePickerHarness();

  const manualCta = () => h.buttonByText('Vincular com este ID');

  it('só com a lista em erro aparece o campo "ID da sessão do Agente" com o placeholder documentado', () => {
    h.render({ status: 'error', clients: [] });

    expect(h.host.querySelector('label')!.textContent).toBe('ID da sessão do Agente');
    expect(h.input().placeholder).toBe('cole aqui o ID (UUID) da sessão ativa');
    expect(manualCta()).toBeDefined();
  });

  it('com a lista carregada (ready) ou carregando (loading) o campo NÃO existe no DOM', () => {
    h.render({ status: 'ready' });
    expect(h.host.textContent).not.toContain('ID da sessão do Agente');
    expect(manualCta()).toBeUndefined();

    h.render({ status: 'loading', clients: [] });
    expect(h.host.textContent).not.toContain('ID da sessão do Agente');
    expect(manualCta()).toBeUndefined();
  });

  it('vazio ou só espaços desabilita o CTA sem mostrar erro', () => {
    h.render({ status: 'error', clients: [] });
    expect(manualCta()!.disabled).toBe(true);

    h.typeInto(h.input(), '   ');
    expect(manualCta()!.disabled).toBe(true);
    expect(h.host.textContent).not.toContain(MANUAL_FORMAT_ERROR);
  });

  it('texto que não é UUID mostra a mensagem de formato e mantém o CTA desabilitado', () => {
    const onManualId = vi.fn();
    h.render({ status: 'error', clients: [], onManualId });

    h.typeInto(h.input(), 'sessao-qualquer');

    expect(h.host.textContent).toContain(MANUAL_FORMAT_ERROR);
    expect(manualCta()!.disabled).toBe(true);
    h.press(h.input(), 'Enter');
    expect(onManualId).not.toHaveBeenCalled();
  });

  it('UUID válido (com espaços nas pontas) habilita o CTA e chama onManualId com o ID limpo', () => {
    const onManualId = vi.fn();
    h.render({ status: 'error', clients: [], onManualId });

    h.typeInto(h.input(), `  ${VALID_UUID}  `);
    expect(manualCta()!.disabled).toBe(false);
    act(() => manualCta()!.click());

    expect(onManualId).toHaveBeenCalledTimes(1);
    expect(onManualId).toHaveBeenCalledWith(VALID_UUID);
  });

  it('busy: CTA vira "Vinculando…" (live) / "Enviando…" (ended), desabilitado, e o valor digitado fica', () => {
    h.render({ status: 'error', clients: [] });
    h.typeInto(h.input(), VALID_UUID);

    h.render({ status: 'error', clients: [], busy: true });
    expect(h.buttonByText('Vinculando…')!.disabled).toBe(true);
    expect(h.input().getAttribute('aria-busy')).toBe('true');
    expect(h.input().value).toBe(VALID_UUID);

    h.render({ status: 'error', clients: [], busy: true, mode: 'ended' });
    expect(h.buttonByText('Enviando…')!.disabled).toBe(true);
  });
});
