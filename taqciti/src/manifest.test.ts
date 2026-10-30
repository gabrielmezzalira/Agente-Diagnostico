// @vitest-environment node
/**
 * Teste do manifesto MV3 (D-04 / WR-06, Fase 10).
 *
 * Garante que a permissão `tabs` está pedida — é ela que faz o Chrome entregar a URL nova ao
 * `chrome.tabs.onUpdated` quando a aba da reunião vai para `chrome://`, `about:`, `data:` ou `file://`
 * (a DA-4 "saiu da sala" depende disso) — e que `host_permissions` segue sendo só `<all_urls>`.
 * Roda em ambiente `node` porque o import do `manifest.config.ts` não precisa de DOM.
 */
import { describe, expect, it } from 'vitest';
import manifestExport from '../manifest.config';

// `defineManifest` pode devolver uma união (objeto, função ou promessa); o nosso é um objeto literal.
function asManifestObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('manifest.config.ts deveria exportar um objeto de manifesto');
  }
  return value as Record<string, unknown>;
}

describe('manifest.config.ts', () => {
  const manifest = asManifestObject(manifestExport);

  it('pede as seis permissões, com "tabs" por último', () => {
    expect(manifest.permissions).toEqual(['storage', 'sidePanel', 'scripting', 'identity', 'alarms', 'tabs']);
  });

  it('mantém host_permissions exatamente como <all_urls>', () => {
    expect(manifest.host_permissions).toEqual(['<all_urls>']);
  });

  it('continua MV3 e com o Chrome mínimo 116', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.minimum_chrome_version).toBe('116');
  });
});
