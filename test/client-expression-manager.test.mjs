import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { mountClient, findAll, textOf } from './client-harness.mjs'
import { createMiniReact } from './mini-react.mjs'
const image =
  'data:image/webp;base64,' +
  readFileSync(new URL('../src/client/assets/whale-girl/thinking.webp', import.meta.url)).toString(
    'base64',
  )
function draft(name = 'Pack') {
  return {
    manifest: {
      schemaVersion: 1,
      name,
      author: '',
      version: '1.0.0',
      fallback: 'thinking',
      actions: { thinking: 'images/thinking.webp' },
    },
    files: { 'images/thinking.webp': image },
  }
}
function pack() {
  return {
    ...draft(),
    id: 'custom:test',
    name: 'Pack',
    author: '',
    version: '1.0.0',
    revision: 'r1',
    actionCount: 1,
    bytes: 10,
    updatedAt: 'now',
  }
}
async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}
function fixture(options = {}) {
  const runtime = createMiniReact()
  const mounted = mountClient({ ReactImpl: runtime.React })
  const listeners = new Set()
  let state = {
    phase: options.phase || 'ready',
    busy: false,
    revision: 1,
    errorCode: null,
    catalog: {
      available: true,
      packs: options.packs || [pack()],
      selectedSkin: options.selected || null,
    },
  }
  const calls = []
  const store = {
    getSnapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    refresh: async () => {
      calls.push(['refresh'])
    },
    get: async (id) => {
      calls.push(['get', id])
      return options.loaded || pack()
    },
    save: async (...args) => {
      calls.push(['save', ...args])
      if (options.saveError) throw new Error('not persisted')
      return { ...pack(), ...args[0], revision: 'r2' }
    },
    remove: async (...args) => {
      calls.push(['remove', ...args])
      state = { ...state, catalog: { ...state.catalog, packs: [], selectedSkin: 'whale' } }
      listeners.forEach((fn) => fn())
      return { deleted: true, selectedSkin: 'whale' }
    },
    previewZip: async (value) => {
      calls.push(['previewZip', value])
      return draft('Pack')
    },
    exportZip: async () => {
      calls.push(['exportZip'])
      return { base64: 'eA==', name: 'pack.zip' }
    },
  }
  runtime.mount(mounted.exported.ExpressionPacks, {
    t: (key) => key,
    store,
    onSelect: async (skin) => {
      calls.push(['onSelect', skin])
    },
  })
  const tree = () => runtime.current()
  const nodes = (predicate) => findAll(tree(), predicate)
  const button = (label) => nodes((n) => n.type === 'button' && textOf(n) === label)[0]
  const input = (label) => {
    const wrapper = nodes(
      (n) =>
        n.type === 'label' &&
        n.children.some((child) => child?.type === 'span' && textOf(child) === label),
    )[0]
    return findAll(wrapper, (n) => n.type === 'input')[0]
  }
  return {
    mounted,
    runtime,
    store,
    calls,
    tree,
    nodes,
    button,
    input,
    dispose() {
      runtime.unmount()
      mounted.dispose()
    },
  }
}

test('expression pack layout keeps the settings panel width stable across tabs', () => {
  const mounted = mountClient()
  try {
    const css = mounted.styles
      .filter((element) => element.attributes['data-dsh-hud'] === 'styles')
      .map((element) => element.textContent)
      .join('')
    assert.ok(
      !/:has\(\.dshh-packs\)/.test(css),
      'no tab-specific width rule: switching to Packs must not resize the dialog',
    )
    assert.match(css, /container-name:packs/, 'content adapts to the shared 480px panel instead')
    assert.match(css, /@container packs \(max-width:560px\)/)
  } finally {
    mounted.dispose()
  }
})

test('selects keep the native arrow and share one right-hand inset', () => {
  const mounted = mountClient()
  try {
    const css = mounted.styles
      .filter((element) => element.attributes['data-dsh-hud'] === 'styles')
      .map((element) => element.textContent)
      .join('')
    // Only switch buttons may reset appearance; selects must keep the browser arrow.
    assert.ok(
      !/select\{[^}]*appearance:none/.test(css),
      'selects keep the browser arrow instead of a hand-drawn one',
    )
    assert.ok(
      !/background-image:linear-gradient\(45deg,transparent/.test(css),
      'no custom arrow gradients',
    )
    assert.match(
      css,
      /\.dshh-selectWrap\{[^}]*padding-right:10px/,
      'the wrapper reserves a real gap between the native arrow and the border',
    )
    assert.match(
      css,
      /\.dshh-settingRow select\{[^}]*padding:5px 0 5px 8px/,
      'the select itself carries no right padding so the arrow keeps its arrow',
    )
  } finally {
    mounted.dispose()
  }
})

test('form focus uses an inset blue ring and the footer is a plain aligned bar', async () => {
  const mounted = mountClient()
  try {
    const css = mounted.styles
      .filter((element) => element.attributes['data-dsh-hud'] === 'styles')
      .map((element) => element.textContent)
      .join('')
    assert.match(
      css,
      /\.dshh-packs input:focus-visible[^{]*\{[^}]*outline:none/,
      'inputs must not get the near-white outer outline',
    )
    assert.match(
      css,
      /box-shadow:0 0 0 2px color-mix/,
      'focus is shown by a soft inset ring instead',
    )
    assert.match(css, /\.dshh-packEditorFooter\{[^}]*flex:none/)
    assert.ok(
      !/\.dshh-packEditorFooter\{[^}]*position:sticky/.test(css),
      'the footer is a normal bottom bar, not a sticky strip over the scroll body',
    )
  } finally {
    mounted.dispose()
  }
})

test('the packs pane keeps vertical-only padding so it does not double the dialog inset', () => {
  const mounted = mountClient()
  try {
    const css = mounted.styles
      .filter((element) => element.attributes['data-dsh-hud'] === 'styles')
      .map((element) => element.textContent)
      .join('')
    assert.match(
      css,
      /\.dshh-packs\{[^}]*padding:\d+px 0(?: \d+px)?;/,
      'horizontal inset comes from .dshh-settingsPanel; the pane itself only pads vertically',
    )
    assert.doesNotMatch(
      css,
      /\.dshh-packs\{[^}]*padding:\d+px \d+px/,
      '左右不能再写死内边距，否则会和面板的横向留白叠加',
    )
  } finally {
    mounted.dispose()
  }
})

test('editor drops the unsaved-hint copy and shows a compact progress footer', async () => {
  const f = fixture()
  try {
    f.button('packs.new').props.onClick()
    await flush()
    assert.equal(
      f.nodes((n) => textOf(n) === 'packs.unsavedHint').length,
      0,
      'the long paragraph is intentionally removed from the editor',
    )
    const footer = f.nodes((n) => n.type === 'footer')[0]
    const progress = findAll(footer, (n) => n.props?.className === 'dshh-packProgressBar')[0]
    assert.equal(progress.props['aria-valuenow'], 0, 'no action mapped yet')
    assert.equal(progress.props['aria-valuemax'], 30)
    assert.equal(
      findAll(footer, (n) => n.props?.className === 'dshh-packPrimary').length,
      1,
      'save is the single primary action',
    )
    assert.equal(
      findAll(footer, (n) => n.type === 'button' && n.props?.className === 'dshh-packSecondary')
        .length,
      0,
      'save-as-new only appears when editing an existing pack',
    )
  } finally {
    f.dispose()
  }
})

test('expression packs drop the intro copy and scroll inside a fixed-height body', async () => {
  const f = fixture()
  try {
    assert.equal(
      f.nodes((n) => n.props?.className === 'dshh-packIntro').length,
      0,
      'the intro paragraph is intentionally removed',
    )
    const body = f.nodes((n) => n.props?.className === 'dshh-packBody')[0]
    assert.ok(body, 'library and editor share one scroll body')
    assert.ok(
      f.nodes((n) => n.props?.className === 'dshh-packLibrary').length > 0,
      'the pack list renders inside that body',
    )
    f.button('packs.new').props.onClick()
    await flush()
    assert.ok(
      f.nodes((n) => n.props?.className === 'dshh-packEditor').length > 0,
      'the editor also renders inside the same scroll body',
    )
  } finally {
    f.dispose()
  }
})

test('packs list renders rows rather than the old skin dropdown', async () => {
  const f = fixture()
  try {
    // 皮肤卡片搬到设置面板顶部后，这里只剩包列表本身：确认旧的下拉框没有回来，
    // 且每个包给的是行（带缩略图与动作数），不是一排可选方块。
    assert.equal(
      f.nodes((n) => n.type === 'select' && n.props?.id === 'dshh-pack-active').length,
      0,
      'the old dropdown is gone',
    )
    assert.equal(
      f.nodes((n) => n.props?.className === 'dshh-skinCube').length,
      0,
      '皮肤卡片由设置面板渲染，不属于包列表',
    )
    assert.ok(
      f.nodes((n) => n.props?.className === 'dshh-packCard').length > 0,
      '包以卡片行的形式列出',
    )
  } finally {
    f.dispose()
  }
})

test('expression manager has no automatic save/select and Use delegates only to onSelect', async () => {
  const f = fixture()
  try {
    assert.deepEqual(f.calls, [['refresh']])
    f.button('packs.use').props.onClick()
    await flush()
    assert.deepEqual(f.calls[1], ['onSelect', 'custom:test'])
    assert.equal(f.calls.filter((c) => c[0] === 'save').length, 0)
  } finally {
    f.dispose()
  }
})

test('expression manager previews every optional action with own thinking fallback and actual-size swatches', async () => {
  const f = fixture()
  try {
    f.button('packs.edit').props.onClick()
    await flush()
    assert.equal(f.nodes((n) => n.props?.className === 'dshh-packAction').length, 30)
    assert.equal(f.nodes((n) => n.type === 'select').length, 30)
    assert.equal(f.nodes((n) => n.props?.className?.includes('dshh-packSample-')).length, 2)
    const thinking = f.nodes((n) => n.props?.id === 'dshh-pack-action-thinking')[0]
    assert.equal(thinking.props.value, 'images/thinking.webp')
    assert.equal(thinking.children[0].props.disabled, true, 'required default cannot be cleared')
    const typingPreview = f.nodes(
      (n) =>
        n.type === 'button' && n.props?.['aria-label'] === 'packs.preview · packs.action.typing',
    )[0]
    typingPreview.props.onClick()
    const large = f.nodes((n) => n.props?.className === 'dshh-packLarge')[0]
    assert.equal(findAll(large, (n) => n.type === 'img')[0].props.src, image)
    assert.equal(f.calls.filter((c) => c[0] === 'save').length, 0)
  } finally {
    f.dispose()
  }
})

test('expression editor retains its draft after failed persistence and forwards expected revision', async () => {
  const f = fixture({ saveError: true })
  try {
    f.button('packs.edit').props.onClick()
    await flush()
    f.input('packs.name').props.onChange({ currentTarget: { value: 'Edited name' } })
    f.button('packs.save').props.onClick()
    await flush()
    const call = f.calls.find((c) => c[0] === 'save')
    assert.equal(call[1].manifest.name, 'Edited name')
    assert.equal(call[2], 'custom:test')
    assert.equal(call[3], 'r1')
    assert.equal(f.input('packs.name').props.value, 'Edited name')
    assert.ok(textOf(f.tree()).includes('packs.error.request-failed'))
    assert.ok(!textOf(f.tree()).includes('packs.saved'))
  } finally {
    f.dispose()
  }
})

test('expression manager requires explicit deletion confirmation for selected packs', async () => {
  const f = fixture({ selected: 'custom:test' })
  try {
    f.button('packs.delete').props.onClick()
    assert.equal(f.calls.filter((c) => c[0] === 'remove').length, 0)
    assert.ok(textOf(f.tree()).includes('packs.deleteSelected'))
    f.button('packs.confirmDelete').props.onClick()
    await flush()
    assert.deepEqual(
      f.calls.find((c) => c[0] === 'remove'),
      ['remove', 'custom:test', 'r1'],
    )
  } finally {
    f.dispose()
  }
})

test('expression editor explicitly cleans only unused files and preserves mapped thinking', async () => {
  const loaded = pack()
  loaded.files['images/unused.webp'] = image
  const f = fixture({ loaded })
  try {
    f.button('packs.edit').props.onClick()
    await flush()
    assert.equal(f.calls.filter((c) => c[0] === 'save').length, 0)
    f.button('packs.cleanUnused').props.onClick()
    f.button('packs.save').props.onClick()
    await flush()
    const sent = f.calls.find((c) => c[0] === 'save')[1]
    assert.deepEqual(Object.keys(sent.files), ['images/thinking.webp'])
    assert.equal(sent.manifest.actions.thinking, 'images/thinking.webp')
  } finally {
    f.dispose()
  }
})

test('ZIP import stays in preview and duplicate names require explicit new-pack choice', async () => {
  const previous = globalThis.FileReader
  globalThis.FileReader = class {
    readAsDataURL() {
      this.result = 'data:application/zip;base64,eA=='
      this.onload()
    }
  }
  const f = fixture()
  try {
    f.input('packs.import').props.onChange({
      currentTarget: { files: [{ name: 'pack.zip', size: 1 }], value: 'pack.zip' },
    })
    await flush()
    assert.equal(f.calls.filter((c) => c[0] === 'save').length, 0)
    assert.ok(textOf(f.tree()).includes('packs.importPreview'))
    assert.ok(textOf(f.tree()).includes('packs.duplicate'))
    assert.equal(f.button('packs.saveNew').props.disabled, true)
    const checkbox = f.nodes((n) => n.type === 'input' && n.props.type === 'checkbox')[0]
    checkbox.props.onChange({ currentTarget: { checked: true } })
    assert.equal(f.button('packs.saveNew').props.disabled, false)
    f.button('packs.saveNew').props.onClick()
    await flush()
    const sent = f.calls.find((c) => c[0] === 'save')
    assert.equal(sent[2], undefined, 'same-name import never silently edits an existing id')
  } finally {
    f.dispose()
    globalThis.FileReader = previous
  }
})

test('unavailable manager presents localized restart guidance and disables import mutations', () => {
  const f = fixture({ phase: 'restartRequired' })
  try {
    assert.ok(textOf(f.tree()).includes('packs.restartRequired'))
    assert.equal(f.button('packs.new').props.disabled, true)
    assert.equal(f.input('packs.import').props.disabled, true)
    assert.equal(f.button('packs.refresh').props.disabled, false)
  } finally {
    f.dispose()
  }
})

test('action guessing is conservative and one-image defaults are represented by an empty required slot', () => {
  const f = fixture()
  try {
    assert.equal(f.mounted.exported.guessExpressionAction('rice-notes.WEBP'), 'rice_notes')
    assert.equal(f.mounted.exported.guessExpressionAction('MY-CAT.png'), undefined)
    assert.equal(f.mounted.exported.emptyExpressionDraft().manifest.actions.thinking, '')
  } finally {
    f.dispose()
  }
})
