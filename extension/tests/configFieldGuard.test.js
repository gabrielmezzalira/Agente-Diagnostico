// extension/tests/configFieldGuard.test.js
//
// Testes unitários das seis funções puras de extension/lib/configFieldGuard.js
// — carregadas num contexto vm VAZIO (sem document/chrome/window), provando
// que o helper não toca DOM, storage nem qualquer API da extensão. Estes
// testes já passam desde a Task 1 (o helper nasceu lá) — são a semente que
// trava o contrato das regras, não um RED.
//
// Rodar (a partir da raiz do repositório):
//   node --test extension/tests/configFieldGuard.test.js

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')
const assert = require('node:assert/strict')

function loadGuard() {
  const filePath = path.join(__dirname, '..', 'lib', 'configFieldGuard.js')
  const code = fs.readFileSync(filePath, 'utf8')
  const context = vm.createContext({})
  vm.runInContext(code, context, { filename: filePath })
  return context
}

test('as seis funções existem no contexto e são function', () => {
  const guard = loadGuard()
  assert.strictEqual(typeof guard.createConfigFieldState, 'function')
  assert.strictEqual(typeof guard.recordConfigFieldEdit, 'function')
  assert.strictEqual(typeof guard.canRenderOverwriteConfigField, 'function')
  assert.strictEqual(typeof guard.takeConfigFieldSnapshot, 'function')
  assert.strictEqual(typeof guard.canResyncConfigFieldAfterSave, 'function')
  assert.strictEqual(typeof guard.isConfigSaveConfirmed, 'function')
})

test('estado novo permite sobrescrita do polling; depois de uma edição, não permite mais', () => {
  const guard = loadGuard()
  const state0 = guard.createConfigFieldState()
  assert.strictEqual(guard.canRenderOverwriteConfigField(state0), true)

  const state1 = guard.recordConfigFieldEdit(state0)
  assert.strictEqual(guard.canRenderOverwriteConfigField(state1), false)
})

test('recordConfigFieldEdit não muta o argumento — devolve objeto novo', () => {
  const guard = loadGuard()
  const state0 = guard.createConfigFieldState()
  guard.recordConfigFieldEdit(state0)
  assert.strictEqual(state0.editCount, 0)
})

test('canResyncConfigFieldAfterSave só permite reescrita se não houve edição nova após o carimbo', () => {
  const guard = loadGuard()
  let state = guard.recordConfigFieldEdit(guard.createConfigFieldState())
  const snapshot = guard.takeConfigFieldSnapshot(state)
  assert.strictEqual(guard.canResyncConfigFieldAfterSave(state, snapshot), true)

  state = guard.recordConfigFieldEdit(state)
  assert.strictEqual(guard.canResyncConfigFieldAfterSave(state, snapshot), false)
})

test('isConfigSaveConfirmed só é true sem lastError e com response.ok === true', () => {
  const guard = loadGuard()
  assert.strictEqual(guard.isConfigSaveConfirmed({ ok: true }, undefined), true)
  assert.strictEqual(guard.isConfigSaveConfirmed({ ok: false }, undefined), false)
  assert.strictEqual(guard.isConfigSaveConfirmed(undefined, undefined), false)
  assert.strictEqual(
    guard.isConfigSaveConfirmed({ ok: true }, { message: 'Could not establish connection' }),
    false
  )
})
