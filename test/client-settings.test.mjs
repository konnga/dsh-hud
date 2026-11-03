/** The standalone settings entry and runtime share the same local preferences. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mountClient, findAll, fakeStore, textOf } from './client-harness.mjs'
import { runningDom } from './client-running-dom.mjs'
import { createMiniReact } from './mini-react.mjs'

const key = 'dsh-hud:display-settings'
const skinKey = 'dsh-hud:running-skin'
const t = (key) => key
const visibility = { showGit: true, showTools: true, showBalance: true, showTimer: true }
const defaults = { imageSize: 56, showElapsed: true, showTurnDuration: true, ...visibility }

function fixture(options = {}) {
  const mounted = mountClient(options)
  const store = fakeStore({ phase: 'idle', sessionId: 'settings-session', panelOpen: false })
  const dockProps = {
    t,
    store,
    sessionId: 'settings-session',
    useSessions: (select) => select({ byId: { 'settings-session': { cwd: '/tmp' } } }),
  }
  const dock = () => mounted.components['dsh-hud-pill'](dockProps)
  const pill = () => findAll(dock(), (node) => node.props?.['data-dsh-hud'] === 'settings-pill')[0]
  const panel = () => mounted.components['dsh-hud-settings']({ t })
  const open = (trigger = { isConnected: false }) =>
    pill().props.onClick({ currentTarget: trigger })
  /**
   * 表情包相关设置（思考中动画、图片尺寸、显示用时）都在「表情包」标签页里。
   * 直接以 `initialTab: 'packs'` 渲染那一页：不用切 tab，也就不会留下订阅。
   */
  const packsPanel = () => mounted.components['dsh-hud-settings']({ t, initialTab: 'packs' })
  const input = (setting) =>
    findAll(panel(), (node) => node.props?.['data-setting'] === setting)[0] ||
    findAll(packsPanel(), (node) => node.props?.['data-setting'] === setting)[0]
  const change = (setting, value) => {
    var control = input(setting)
    if (control.props.role === 'switch') {
      if (control.props['aria-checked'] !== value) control.props.onClick()
    } else control.props.onChange({ currentTarget: { value: String(value) } })
  }
  const native = () => mounted.components['dsh-hud-running-skin']({ t })
  const nativeButtons = () => findAll(native(), (node) => node.props?.className === 'dshh-skinCube')
  const close = () =>
    findAll(panel(), (node) => node.props?.className === 'dshh-settingsClose')[0].props.onClick()
  return {
    ...mounted,
    dock,
    dockProps,
    pill,
    open,
    panel,
    packsPanel,
    input,
    change,
    native,
    nativeButtons,
    close,
  }
}

test('A single gear in the existing dock opens a separate overlay; native selector stays registered', () => {
  const f = fixture()
  try {
    assert.equal(
      f.registrations.filter((entry) => entry.options.name === 'conversation.input.dock').length,
      1,
    )
    assert.equal(
      f.registrations.find((entry) => entry.options.id === 'dsh-hud-settings').options.name,
      'shell.overlay',
    )
    assert.equal(f.panel(), null)
    assert.equal(f.pill().props['aria-expanded'], false)
    assert.equal(f.pill().props['aria-haspopup'], 'dialog')
    assert.equal(f.pill().props['aria-label'], 'settings.title')
    f.open()
    assert.equal(f.pill().props['aria-expanded'], true)
    const dialog = findAll(f.panel(), (node) => node.props?.role === 'dialog')[0]
    assert.equal(dialog.props['aria-modal'], true)
    assert.equal(dialog.props.id, 'dshh-settings-dialog')
    const selector = rawFind(f.packsPanel(), (node) => node?.type?.name === 'SkinRow')[0]
    assert.equal(selector.type, f.components['dsh-hud-running-skin'], '两个入口复用同一个组件')
    assert.deepEqual(
      f.nativeButtons().map((button) => button.props.key),
      ['off', 'whale', 'cyber-whale', 'longdress-whale'],
    )
    f.close()
    assert.equal(f.panel(), null)
    assert.equal(f.pill().props['aria-expanded'], false)
    assert.equal(f.windowStub.localStorage.getItem(key), null, '开合面板不能写入显示偏好')
  } finally {
    f.dispose()
  }
})

test('Both display controls save only supported local values; size and elapsed apply immediately', () => {
  const f = fixture()
  const dom = runningDom(f)
  const root = dom.root()
  try {
    dom.tick()
    f.open()
    assert.deepEqual(
      Object.fromEntries(
        Object.keys(defaults).map((name) => {
          const control = f.input(name)
          return [
            name,
            control.props.role === 'switch' ? control.props['aria-checked'] : control.props.value,
          ]
        }),
      ),
      defaults,
    )
    assert.equal(f.input('playful'), undefined)
    assert.equal(f.input('rice'), undefined)
    assert.equal(
      findAll(f.panel(), (node) => node.props?.role === 'switch').length,
      5,
      '「常规」页：四颗胶囊开关 + 每轮耗时',
    )
    assert.equal(
      findAll(f.packsPanel(), (node) => node.props?.['data-setting'] === 'showElapsed').length,
      1,
      '「显示用时」跟着「思考中动画」在表情包页',
    )
    assert.equal(
      findAll(f.packsPanel(), (node) => node.props?.['data-setting'] === 'showTurnDuration').length,
      0,
      '每轮耗时的开关在「常规」页，不在表情包页',
    )
    f.change('imageSize', 40)
    f.change('showElapsed', false)
    assert.deepEqual(JSON.parse(f.windowStub.localStorage.getItem(key)), {
      ...defaults,
      imageSize: 40,
      showElapsed: false,
    })
    const css = f.styles.find(
      (tag) => tag.attributes['data-dsh-hud'] === 'running-skin',
    ).textContent
    assert.ok(css.includes('width:40px;height:40px'))
    assert.ok(css.includes('min-height:40px'))
    assert.equal(root.content.children[0].children[0].children[0].hidden, true)
    assert.equal(dom.time(root), '1 分 1 秒', '隐藏用时不改变真实计时内容')
    f.change('showElapsed', true)
    assert.equal(root.content.children[0].children[0].children[0].hidden, false)
    f.change('imageSize', 999)
    assert.equal(f.input('imageSize').props.value, 56)
  } finally {
    f.dispose()
  }
})

test('Opening and closing settings does not reset event-driven running text', () => {
  const f = fixture({ storageValues: { [key]: JSON.stringify({ rotateMs: 8000 }) } })
  let activity = {
    key: 'call-1',
    phase: 'tool',
    toolName: 'read_file',
    turn: 1,
    step: 1,
  }
  f.exported.configureRunningText({
    readActivity: () => activity,
    resolveText: (text) => text.zh,
  })
  const dom = runningDom(f)
  const root = dom.root()
  try {
    f.exported.refreshRunningText()
    assert.equal(dom.phrase(root), '正在读取文件')
    f.open()
    assert.equal(f.input('rotateMs'), undefined)
    activity = { ...activity, key: 'call-2', step: 2 }
    f.exported.refreshRunningText()
    assert.equal(dom.phrase(root), '正在读取文件')
    assert.equal(dom.image(root).getAttribute('data-action'), 'reading', '同一全库池的第二张')
    const secondPhrase = dom.phrase(root)
    f.close()
    f.open()
    assert.equal(dom.phrase(root), secondPhrase)
    assert.equal(f.intervals.filter((item) => item.ms === 300 && !item.cancelled).length, 1)
  } finally {
    f.dispose()
  }
})

test('Stored preferences initialize before the first status render; invalid JSON safely defaults', () => {
  for (const [stored, expected] of [
    [
      JSON.stringify({ imageSize: 64, rotateMs: 8000, playful: false }),
      { ...defaults, imageSize: 64 },
    ],
    ['not json', defaults],
    ['null', defaults],
    [
      JSON.stringify({ imageSize: -1, playful: 'false', showElapsed: false }),
      { ...defaults, showElapsed: false },
    ],
  ]) {
    const f = fixture({ storageValues: { [key]: stored } })
    try {
      f.open()
      assert.equal(f.input('imageSize').props.value, expected.imageSize)
      assert.equal(f.input('playful'), undefined)
      assert.equal(f.input('showElapsed').props['aria-checked'], expected.showElapsed)
      assert.equal(f.windowStub.localStorage.getItem(key), stored, '读取不覆写')
    } finally {
      f.dispose()
    }
  }
})

test('Cross-window events and focus refresh settings without opening the panel', () => {
  const f = fixture()
  try {
    f.windowStub.localStorage.setItem(key, JSON.stringify({ imageSize: 48 }))
    f.dispatch('focus')
    assert.equal(f.panel(), null)
    f.open()
    assert.equal(f.input('imageSize').props.value, 48)
    f.dispatch('storage', { key, newValue: JSON.stringify({ imageSize: 64, showElapsed: false }) })
    assert.equal(f.input('imageSize').props.value, 64)
    assert.equal(f.input('showElapsed').props['aria-checked'], false)
    f.dispatch('storage', { key: 'other', newValue: '{}' })
    assert.equal(f.input('imageSize').props.value, 64)
    f.dispatch('storage', { key, newValue: '{}', storageArea: {} })
    assert.equal(f.input('imageSize').props.value, 64)
    f.dispatch('storage', { key: null, newValue: null })
    assert.equal(f.input('imageSize').props.value, 56)
  } finally {
    f.dispose()
  }
})

test('Storage write failures keep effective preferences and report a recoverable local warning', () => {
  const f = fixture({ storageWriteFails: true })
  try {
    f.open()
    f.change('imageSize', 32)
    assert.equal(f.input('imageSize').props.value, 32)
    assert.ok(
      findAll(f.panel(), (node) => node.props?.className === 'dshh-settingsError').length === 1,
    )
    f.dispatch('focus')
    assert.equal(f.input('imageSize').props.value, 32)
    f.close()
    f.open()
    assert.equal(f.input('imageSize').props.value, 32)
    f.dispatch('storage', { key, newValue: JSON.stringify({ imageSize: 48 }) })
    assert.equal(f.input('imageSize').props.value, 48)
    assert.equal(
      findAll(f.panel(), (node) => node.props?.className === 'dshh-settingsError').length,
      0,
    )
  } finally {
    f.dispose()
  }
})

test('Restore defaults also restores the native skin selection without closing the panel', () => {
  const f = fixture()
  try {
    f.open()
    f.change('imageSize', 32)
    f.change('showElapsed', false)
    f.nativeButtons()[2].props.onClick()
    assert.equal(f.windowStub.localStorage.getItem(skinKey), 'cyber-whale')
    findAll(f.panel(), (node) => node.type === 'footer')[0].children[0].props.onClick()
    assert.deepEqual(JSON.parse(f.windowStub.localStorage.getItem(key)), defaults)
    assert.equal(f.windowStub.localStorage.getItem(skinKey), 'whale')
    assert.equal(f.nativeButtons()[1].props['aria-pressed'], true)
    assert.notEqual(f.panel(), null)
  } finally {
    f.dispose()
  }
})

test('Escape, close and backdrop dismiss; focus returns to the same connected trigger', () => {
  const f = fixture()
  let focused = 0
  const trigger = {
    isConnected: true,
    focus: () => {
      focused++
    },
  }
  try {
    f.open(trigger)
    const panel = f.panel()
    panel.props.onClick({ currentTarget: trigger, target: {} })
    assert.notEqual(f.panel(), null, '面板内部点击不能关闭')
    const dialog = findAll(panel, (node) => node.props?.role === 'dialog')[0]
    let prevented = false
    let stopped = false
    dialog.props.onKeyDown({
      key: 'Escape',
      preventDefault: () => {
        prevented = true
      },
      stopPropagation: () => {
        stopped = true
      },
    })
    assert.equal(prevented, true)
    assert.equal(stopped, true)
    assert.equal(f.panel(), null)
    assert.equal(focused, 1)
    f.open(trigger)
    const backdrop = f.panel()
    backdrop.props.onClick({ target: trigger, currentTarget: trigger })
    assert.equal(f.panel(), null)
    assert.equal(focused, 2)
  } finally {
    f.dispose()
  }
})

test('Dialog Tab wraps keyboard focus in both directions', () => {
  const f = fixture()
  try {
    f.open()
    const element = findAll(f.panel(), (node) => node.props?.role === 'dialog')[0]
    let firstFocus = 0
    let lastFocus = 0
    let prevented = 0
    const first = {
      focus: () => {
        firstFocus++
      },
    }
    const last = {
      focus: () => {
        lastFocus++
      },
    }
    const dialog = { querySelectorAll: () => [first, last] }
    const keydown = (shiftKey) =>
      element.props.onKeyDown({
        key: 'Tab',
        shiftKey,
        currentTarget: dialog,
        preventDefault: () => {
          prevented++
        },
        stopPropagation() {},
      })
    f.documentStub.activeElement = last
    keydown(false)
    assert.equal(firstFocus, 1)
    f.documentStub.activeElement = first
    keydown(true)
    assert.equal(lastFocus, 1)
    f.documentStub.activeElement = dialog
    keydown(false)
    assert.equal(firstFocus, 2)
    assert.equal(prevented, 3)
  } finally {
    f.dispose()
  }
})

function rawFind(node, predicate, found = []) {
  if (!node || typeof node !== 'object') return found
  if (Array.isArray(node)) {
    for (const child of node) rawFind(child, predicate, found)
    return found
  }
  if (predicate(node)) found.push(node)
  for (const child of node.children ?? []) rawFind(child, predicate, found)
  return found
}

test('Mounted settings panel reacts to gear, preference and close events without page reload', () => {
  const mini = createMiniReact()
  const f = fixture({ ReactImpl: mini.React })
  let focused = 0
  try {
    // Real hooks: evaluate each component independently, retaining handlers.
    mini.mount(f.components['dsh-hud-pill'], f.dockProps)
    const entry = rawFind(mini.current(), (node) => node.type?.name === 'SettingsPill')[0]
    mini.unmount()
    mini.mount(entry.type, entry.props)
    const open = mini.current().props.onClick
    mini.unmount()
    const originalQuery = f.documentStub.querySelector
    f.documentStub.querySelector = (selector) =>
      selector === '[data-dsh-hud="settings-dialog"]'
        ? {
            focus: () => {
              focused++
            },
          }
        : originalQuery(selector)
    mini.mount(f.components['dsh-hud-settings'], { t })
    assert.equal(mini.current(), null)
    open({ currentTarget: { isConnected: false } })
    assert.notEqual(mini.current(), null)
    assert.equal(focused, 1, '打开时焦点进入对话框')
    const setting = () =>
      rawFind(mini.current(), (node) => node.props?.['data-setting'] === 'imageSize')[0]
    setting().props.onChange({ currentTarget: { value: '40' } })
    assert.equal(setting().props.value, 40, '订阅刷新受控字段')
    assert.equal(focused, 1, '改字段不重复抢焦点')
    rawFind(
      mini.current(),
      (node) => node.props?.className === 'dshh-settingsClose',
    )[0].props.onClick()
    assert.equal(mini.current(), null)
  } finally {
    mini.unmount()
    f.dispose()
  }
})

test('Changes made by the native selector appear in the standalone selector, and vice versa', () => {
  const f = fixture()
  try {
    f.open()
    const standalone = () => {
      const entry = rawFind(f.panel(), (node) => node?.type?.name === 'SkinRow')[0]
      return findAll(entry.type(entry.props), (node) => node.props?.className === 'dshh-skinCube')
    }
    f.nativeButtons()[1].props.onClick()
    assert.equal(standalone()[1].props['aria-pressed'], true)
    standalone()[0].props.onClick()
    assert.equal(f.nativeButtons()[0].props['aria-pressed'], true)
    assert.equal(f.intervals.filter((item) => item.ms === 300 && !item.cancelled).length, 0)
    standalone()[2].props.onClick()
    assert.equal(f.nativeButtons()[2].props['aria-pressed'], true)
  } finally {
    f.dispose()
  }
})

test('Open settings is not persisted; disposing releases the panel state and listeners', () => {
  const f = fixture()
  f.open()
  assert.notEqual(f.panel(), null)
  assert.equal(f.windowStub.localStorage.getItem(key), null)
  f.dispose()
  assert.equal(f.panel(), null)
  assert.ok([...(f.listeners.get('storage') ?? [])].length === 0)
  assert.ok([...(f.listeners.get('focus') ?? [])].length === 0)
})

test('Read-only local storage still offers a usable settings entry and in-memory preferences', () => {
  const f = fixture({ storageReadFails: true, storageWriteFails: true })
  try {
    f.open()
    assert.equal(f.input('imageSize').props.value, 56)
    f.change('showElapsed', false)
    f.dispatch('focus')
    assert.equal(f.input('showElapsed').props['aria-checked'], false)
    assert.equal(f.input('rotateMs'), undefined)
    f.close()
    assert.equal(f.panel(), null)
  } finally {
    f.dispose()
  }
})

test('Switches use explicit track/thumb elements, accessible state and label targets, not native checkbox skins', () => {
  const f = fixture()
  try {
    f.open()
    for (const setting of ['showElapsed', ...Object.keys(visibility)]) {
      let control = f.input(setting)
      assert.equal(control.type, 'button')
      assert.equal(control.props.type, 'button')
      assert.equal(control.props.role, 'switch')
      assert.equal(control.props['aria-checked'], true)
      assert.ok(control.props['aria-label'])
      assert.equal(control.children[0].props.className, 'dshh-switchTrack')
      assert.equal(control.children[0].props['aria-hidden'], true)
      assert.equal(control.children[0].children[0].props.className, 'dshh-switchThumb')
      // 开关现在分散在「常规」（四颗胶囊）和「表情包」（显示用时）两页，label 跟着各自那页走。
      assert.equal(
        [f.panel(), f.packsPanel()]
          .map(
            (tree) =>
              findAll(
                tree,
                (node) => node.type === 'label' && node.props.htmlFor === control.props.id,
              ).length,
          )
          .reduce((a, b) => a + b, 0),
        1,
      )
      control.props.onClick()
      control = f.input(setting)
      assert.equal(control.props['aria-checked'], false)
      assert.equal(JSON.parse(f.windowStub.localStorage.getItem(key))[setting], false)
      control.props.onClick()
      assert.equal(f.input(setting).props['aria-checked'], true)
    }
    assert.equal(
      findAll(f.panel(), (node) => node.type === 'input' && node.props.type === 'checkbox').length,
      0,
    )
    const css = f.styles.find((tag) => tag.attributes['data-dsh-hud'] === 'styles').textContent
    assert.ok(css.includes('.dshh-switchThumb{box-sizing:border-box;'))
    assert.ok(css.includes('width:40px;height:22px;'))
    assert.ok(css.includes('left:2px;top:2px;width:16px;height:16px;'))
    assert.ok(css.includes('transform:translateX(18px)'))
    assert.ok(css.includes('.dshh-switchTrack,.dshh-switchThumb{transition:none}'))
    assert.ok(!css.includes('.dshh-settingRow input::after'))
    // 40px track minus two 1px borders: knob leaves 2px clearance on either end.
    assert.equal(40 - 2 - (2 + 18 + 16), 2)
    assert.equal(22 - 2 - (2 + 16), 2)
  } finally {
    f.dispose()
  }
})

test('Interval configuration is absent and old stored interval is dropped on the next save', () => {
  const f = fixture({ storageValues: { [key]: JSON.stringify({ imageSize: 48, rotateMs: 2000 }) } })
  try {
    f.open()
    assert.equal(f.input('imageSize').props.value, 48)
    assert.equal(f.input('rotateMs'), undefined)
    assert.equal(
      findAll(f.panel(), (node) => node.type === 'select').length,
      1,
      'image size only; custom packs now live in the Packs tab, and there is no interval selector',
    )
    f.change('showElapsed', false)
    assert.deepEqual(JSON.parse(f.windowStub.localStorage.getItem(key)), {
      ...defaults,
      imageSize: 48,
      showElapsed: false,
    })
    f.dispatch('storage', { key, newValue: JSON.stringify({ imageSize: 64, rotateMs: 8000 }) })
    assert.equal(f.input('imageSize').props.value, 64)
    assert.equal(f.input('rotateMs'), undefined)
    assert.equal(
      Object.hasOwn(JSON.parse(f.windowStub.localStorage.getItem(key)), 'rotateMs'),
      false,
    )
  } finally {
    f.dispose()
  }
})

test('Mounted switches subscribe to preference changes without remounting or moving focus', () => {
  const mini = createMiniReact()
  const f = fixture({ ReactImpl: mini.React })
  try {
    mini.mount(f.components['dsh-hud-pill'], f.dockProps)
    const entry = rawFind(mini.current(), (node) => node.type?.name === 'SettingsPill')[0]
    mini.unmount()
    mini.mount(entry.type, entry.props)
    const open = mini.current().props.onClick
    mini.unmount()
    mini.mount(f.components['dsh-hud-settings'], { t })
    open({ currentTarget: { isConnected: false } })
    rawFind(
      mini.current(),
      (node) => node.props?.id === 'dshh-settings-tab-packs',
    )[0].props.onClick()
    const control = () =>
      rawFind(mini.current(), (node) => node.props?.['data-setting'] === 'showElapsed')[0]
    assert.equal(control().props['aria-checked'], true)
    control().props.onClick()
    assert.equal(control().props['aria-checked'], false)
    control().props.onClick()
    assert.equal(control().props['aria-checked'], true)
  } finally {
    mini.unmount()
    f.dispose()
  }
})

test('Legacy playful and rice preferences cannot restrict actions or survive the next save', () => {
  for (const legacyRice of [true, false]) {
    const stored = JSON.stringify({ rice: legacyRice, playful: false, imageSize: 48 })
    const f = fixture({ storageValues: { [key]: stored } })
    const dom = runningDom(f)
    const root = dom.root()
    let eventIndex = 0
    let activity = {
      key: 'waiting-0',
      phase: 'waiting',
      toolName: null,
      attemptId: null,
      turn: 1,
      step: 0,
    }
    f.exported.configureRunningText({
      readActivity: () => activity,
      resolveText: (text) => text.zh,
    })
    try {
      f.exported.refreshRunningText()
      f.open()
      assert.equal(f.input('rice'), undefined)
      assert.equal(f.input('playful'), undefined)
      assert.equal(f.input('imageSize').props.value, 48)
      assert.equal(f.windowStub.localStorage.getItem(key), stored, '读取旧偏好不覆写存储')
      const actions = f.exported.ACTION_POOL
      assert.ok(actions.includes('butterfly'))
      assert.ok(actions.some((action) => action.startsWith('rice_')))
      const assertEventActions = () => {
        for (const action of [...actions.slice(1), actions[0]]) {
          activity = { ...activity, key: `waiting-${++eventIndex}`, step: eventIndex }
          f.exported.refreshRunningText()
          assert.equal(dom.phrase(root), '等待模型响应')
          assert.equal(dom.image(root).getAttribute('data-action'), action)
        }
      }
      assertEventActions()
      f.change('showElapsed', false)
      assert.deepEqual(JSON.parse(f.windowStub.localStorage.getItem(key)), {
        ...defaults,
        imageSize: 48,
        showElapsed: false,
      })
      // Other windows may still write obsolete fields: synchronization must not filter cues.
      f.dispatch('storage', {
        key,
        newValue: JSON.stringify({ rice: !legacyRice, playful: false, imageSize: 64 }),
      })
      assert.equal(f.input('imageSize').props.value, 64)
      assert.equal(f.input('showElapsed').props['aria-checked'], true)
      assertEventActions()
    } finally {
      f.dispose()
    }
  }
})

test('Switch state is visible as localized On/Off text, not just color or knob position', () => {
  const f = fixture()
  try {
    f.open()
    for (const setting of ['showElapsed', ...Object.keys(visibility)]) {
      let control = f.input(setting)
      assert.equal(control.children[1].props.className, 'dshh-switchState')
      assert.equal(
        control.children[1].props['aria-hidden'],
        true,
        'ARIA state already conveys this to assistive tools',
      )
      assert.deepEqual(control.children[1].children, ['settings.on'])
      assert.equal(control.props['aria-checked'], true)
      control.props.onClick()
      control = f.input(setting)
      assert.deepEqual(control.children[1].children, ['settings.off'])
      assert.equal(control.props['aria-checked'], false)
    }
    const dictionary = f.dictionaries[0].dictionary
    assert.equal(dictionary.zh['settings.on'], '开')
    assert.equal(dictionary.zh['settings.off'], '关')
    assert.equal(dictionary.en['settings.on'], 'On')
    assert.equal(dictionary.en['settings.off'], 'Off')
  } finally {
    f.dispose()
  }
})

test('分组分割线只画在两组之间，不会和 footer 的上边框叠成 2px 粗线', () => {
  const f = fixture()
  try {
    const css = f.styles.find((tag) => tag.attributes['data-dsh-hud'] === 'styles').textContent
    assert.ok(
      css.includes('.dshh-settingsGroup{padding:16px 0;}'),
      '分组自己不带下边框：否则最后那一组会和 footer 的上边框贴在一起',
    )
    assert.ok(
      css.includes('.dshh-settingsGroup+.dshh-settingsGroup{border-top:1px solid'),
      '只有相邻两组之间才需要一条分隔线',
    )
    assert.ok(
      !css.includes('.dshh-settingsGroup{padding:16px 0;border-bottom'),
      '不能再用「每组都画下边框」的写法',
    )
    assert.ok(
      css.includes(
        '.dshh-settingsFooter{display:flex;justify-content:flex-end;border-top:1px solid',
      ),
      'footer 的上边框是设置区与「恢复默认」之间唯一的那条线',
    )
  } finally {
    f.dispose()
  }
})

test('Dark-theme switches use the real blue token, not the near-white brand-primary token', () => {
  const f = fixture()
  try {
    const css = f.styles.find((tag) => tag.attributes['data-dsh-hud'] === 'styles').textContent
    const onTrack = css.match(
      /\.dshh-settingsPanel \.dshh-settingsSwitch\[aria-checked=true\] \.dshh-switchTrack\{([^}]*)\}/,
    )[1]
    assert.ok(onTrack.includes('var(--dsw-alias-brand-primary-new-colorprimary-new-color,#4176e6)'))
    assert.ok(!onTrack.includes('var(--dsw-alias-brand-primary,'))
    const offTrack = css.match(/\.dshh-settingsPanel \.dshh-switchTrack\{([^}]*)\}/)[1]
    assert.ok(offTrack.includes('background:#4b5563'))
    const thumb = css.match(/\.dshh-settingsPanel \.dshh-switchThumb\{([^}]*)\}/)[1]
    assert.ok(thumb.includes('background:#fff'))
    assert.ok(css.includes('flex:0 0 76px;width:76px;height:32px'))
    // 40px track + 8px gap + 24px state text + 4px padding = stable 76px hit area.
    assert.equal(40 + 8 + 24 + 4, 76)
  } finally {
    f.dispose()
  }
})

test('Capsule preferences independently hide four capsules, retain gear and preserve session binding', () => {
  const f = fixture()
  try {
    f.open()
    const state = f.dockProps.store.getSnapshot()
    state.tools = { active: { name: 'bash', callId: 'c', startedAt: Date.now() }, total: 1 }
    state.provider = { mode: 'account' }
    state.balance = {
      phase: 'ready',
      wallets: [{ currency: 'USD', balance: '10' }],
      bonus: [],
      at: Date.now(),
    }
    state.sessionTime = {
      sessionId: 'settings-session',
      value: { available: true, createdAt: Date.now() - 1000 },
    }
    const controls = {
      showGit: 'pill',
      showTools: 'tools-pill',
      showBalance: 'balance-pill',
      showTimer: 'session-timer',
    }
    const visible = (attr) =>
      findAll(f.dock(), (node) => node.props?.['data-dsh-hud'] === attr).length
    for (const [setting, attr] of Object.entries(controls)) {
      assert.equal(visible(attr), 1, attr)
      f.change(setting, false)
      assert.equal(visible(attr), 0, attr)
      assert.equal(visible('settings-pill'), 1)
      f.change(setting, true)
      assert.equal(visible(attr), 1)
    }
    for (const setting of Object.keys(controls)) f.change(setting, false)
    for (const attr of Object.values(controls)) assert.equal(visible(attr), 0)
    assert.equal(visible('settings-pill'), 1)
    assert.deepEqual(JSON.parse(f.windowStub.localStorage.getItem(key)), {
      ...defaults,
      showGit: false,
      showTools: false,
      showBalance: false,
      showTimer: false,
    })
  } finally {
    f.dispose()
  }
  const mini = createMiniReact()
  const hidden = fixture({
    ReactImpl: mini.React,
    storageValues: {
      [key]: JSON.stringify({
        showGit: false,
        showTools: false,
        showBalance: false,
        showTimer: false,
      }),
    },
  })
  try {
    const bindings = []
    hidden.dockProps.store.bindSession = (...args) => bindings.push(args)
    mini.mount(hidden.components['dsh-hud-pill'], hidden.dockProps)
    assert.deepEqual(bindings, [['settings-session', '/tmp']])
    hidden.dispatch('storage', { key, newValue: JSON.stringify({ showGit: true }) })
    assert.equal(
      rawFind(mini.current(), (node) => node.props?.['data-dsh-hud'] === 'pill').length,
      1,
    )
    hidden.dispatch('storage', { key, newValue: JSON.stringify({ showGit: false }) })
    assert.equal(
      rawFind(mini.current(), (node) => node.props?.['data-dsh-hud'] === 'pill').length,
      0,
    )
    assert.equal(bindings.length, 1, 'toggling visibility does not rebind or alter session')
  } finally {
    mini.unmount()
    hidden.dispose()
  }
})

function relayFixture(options = {}) {
  const requests = []
  const pending = []
  const f = fixture({
    ...options,
    rpc: (channel, method, payload) => {
      if (
        !['provider-list', 'provider-detail-balance', 'provider-key', 'provider-token'].includes(
          method,
        )
      )
        return Promise.resolve({ ok: false })
      requests.push({ channel, method, payload })
      return new Promise((resolve, reject) => pending.push({ resolve, reject }))
    },
  })
  const directory = f.registrations
    .find((r) => r.options.id === 'dsh-hud-settings')
    .options.inject().directory
  const list = (
    providers = [
      {
        id: 'relay',
        label: 'Relay',
        baseURL: 'https://u:secret@example.test/v1/private?token=secret#x',
        token: { ref: 'PRIVATE_TOKEN', configured: true },
      },
    ],
  ) => ({ ok: true, value: { available: true, providers } })
  return { ...f, directory, requests, pending, list }
}
const settle = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
const relayBalance = (provider = 'relay', fields = {}) => ({
  ok: true,
  value: {
    available: true,
    balance: {
      provider,
      kind: 'relay',
      currency: 'USD',
      remaining: null,
      usedKey: '1.25',
      ...fields,
    },
  },
})

test('Relay directory is lazy, redacts addresses, queries only requested relay, deduplicates and never switches models', async () => {
  const f = relayFixture()
  try {
    assert.equal(f.requests.length, 0)
    const stop = f.directory.activate()
    assert.equal(f.directory.getSnapshot().phase, 'loading')
    f.pending.shift().resolve(f.list())
    await settle()
    assert.equal(f.requests.length, 1, 'listing does not fetch external balances')
    assert.equal(f.directory.getSnapshot().providers[0].baseURL, 'https://example.test')
    assert.equal(f.directory.getSnapshot().providers[0].token.configured, true)
    assert.ok(!JSON.stringify(f.directory.getSnapshot()).includes('PRIVATE_TOKEN'))
    assert.equal(f.directory.getSnapshot().details.relay, undefined)
    const query = f.directory.query('relay')
    await f.directory.query('relay')
    await f.directory.query('missing')
    assert.equal(f.requests.length, 2)
    assert.deepEqual(f.requests[1], {
      channel: '/dsh-hud-rpc',
      method: 'provider-detail-balance',
      payload: { args: { provider: 'relay' } },
    })
    f.pending.shift().resolve(relayBalance())
    await query
    assert.equal(f.directory.getSnapshot().details.relay.balance.remaining, null)
    assert.equal(f.directory.getSnapshot().details.relay.balance.usedKey, '1.25')
    stop()
    await f.directory.query('relay')
    assert.equal(f.requests.length, 2, 'closed panel does not issue requests')
  } finally {
    f.dispose()
  }
})

test('Relay requests ignore stale list/detail replies after refresh or close and allow retry after rejection', async () => {
  const f = relayFixture()
  try {
    let stop = f.directory.activate()
    const old = f.pending.shift()
    const refresh = f.directory.refresh()
    const fresh = f.pending.shift()
    fresh.resolve(f.list())
    await refresh
    old.resolve(f.list([]))
    await settle()
    assert.equal(f.directory.getSnapshot().providers.length, 1)
    const query = f.directory.query('relay')
    const obsolete = f.pending.shift()
    stop()
    const frozen = f.directory.getSnapshot()
    obsolete.resolve(relayBalance())
    await query
    assert.equal(f.directory.getSnapshot(), frozen)
    stop = f.directory.activate()
    f.pending.shift().resolve(f.list())
    await settle()
    const failed = f.directory.query('relay')
    f.pending.shift().reject(new Error('network secret must not be displayed'))
    await failed
    assert.equal(f.directory.getSnapshot().details.relay.phase, 'error')
    const mismatch = f.directory.query('relay')
    f.pending.shift().resolve(relayBalance('another-relay'))
    await mismatch
    assert.equal(f.directory.getSnapshot().details.relay.balance, null)
    const retry = f.directory.query('relay')
    f.pending.shift().resolve(relayBalance('relay', { remaining: '0' }))
    await retry
    assert.equal(
      f.directory.getSnapshot().details.relay.balance.remaining,
      '0',
      'zero is only shown when actually returned',
    )
    stop()
  } finally {
    f.dispose()
  }
})

test('a queried balance is cached locally so reopening does not ask again, and expires', async () => {
  const realNow = Date.now
  let now = realNow()
  const f = relayFixture()
  try {
    Date.now = () => now
    let stop = f.directory.activate()
    f.pending.shift().resolve(f.list())
    await settle()
    const query = f.directory.query('relay')
    f.pending.shift().resolve(relayBalance('relay', { remaining: '7.25' }))
    await query
    assert.ok(f.windowStub.localStorage.getItem('dsh-hud:relay-balance-cache'))
    stop()

    // A brand-new directory (a fresh page load) starts from the cached reading.
    const reopened = f.registrations
      .find((r) => r.options.id === 'dsh-hud-settings')
      .options.inject().directory
    const second = relayFixture({
      storageValues: {
        'dsh-hud:relay-balance-cache': f.windowStub.localStorage.getItem(
          'dsh-hud:relay-balance-cache',
        ),
      },
    })
    try {
      second.directory.activate()
      second.pending.shift().resolve(second.list())
      await settle()
      assert.equal(
        second.directory.getSnapshot().details.relay?.balance?.remaining,
        '7.25',
        'the cached reading is shown without another balance request',
      )
      assert.equal(
        second.requests.filter((r) => r.method === 'provider-detail-balance').length,
        0,
        'opening the panel does not re-query a fresh cached balance',
      )
      // Past the TTL the stale number is dropped and the query button returns.
      now += 11 * 60 * 1000
      second.directory.refresh()
      second.pending.shift().resolve(second.list())
      await settle()
      assert.equal(second.directory.getSnapshot().details.relay, undefined)
    } finally {
      second.dispose()
    }
    void reopened
  } finally {
    Date.now = realNow
    f.dispose()
  }
})

test('opening the balances tab queries missing readings but skips fresh cached ones', async () => {
  const realNow = Date.now
  let now = realNow()
  Date.now = () => now
  // The cache must already exist when the directory is constructed (that is when it hydrates).
  const f = relayFixture({
    storageValues: {
      'dsh-hud:relay-balance-cache': JSON.stringify({
        relay: {
          detail: {
            phase: 'ready',
            balance: {
              provider: 'relay',
              kind: 'relay',
              currency: 'USD',
              remaining: '9.00',
              usedAccount: null,
              usedKey: null,
              wallets: [],
            },
          },
          at: now,
        },
      }),
    },
  })
  try {
    const directory = f.registrations
      .find((r) => r.options.id === 'dsh-hud-settings')
      .options.inject().directory
    directory.activate(true)
    f.pending.shift().resolve(
      f.list([
        { id: 'relay', label: 'Relay', baseURL: 'https://a.test', token: null },
        { id: 'other', label: 'Other', baseURL: 'https://b.test', token: null },
      ]),
    )
    await settle()
    const queried = f.requests.filter((r) => r.method === 'provider-detail-balance')
    assert.deepEqual(
      queried.map((r) => r.payload.args.provider),
      ['other'],
      'the cached provider is not queried again; the missing one is filled in automatically',
    )
    assert.equal(directory.getSnapshot().details.relay.balance.remaining, '9.00')
  } finally {
    Date.now = realNow
    f.dispose()
  }
})

test('a queried balance survives switching tabs and a list refresh; removed providers are dropped', async () => {
  const f = relayFixture()
  try {
    let stop = f.directory.activate()
    f.pending.shift().resolve(
      f.list([
        { id: 'relay', label: 'Relay', baseURL: 'https://example.test', token: null },
        { id: 'gone', label: 'Gone', baseURL: 'https://gone.test', token: null },
      ]),
    )
    await settle()
    const query = f.directory.query('relay')
    f.pending.shift().resolve(relayBalance('relay', { remaining: '12.5' }))
    await query
    assert.equal(f.directory.getSnapshot().details.relay.balance.remaining, '12.5')

    // Leaving the tab deactivates and clears credentials; coming back refreshes the list.
    stop()
    stop = f.directory.activate()
    f.pending
      .shift()
      .resolve(
        f.list([{ id: 'relay', label: 'Relay', baseURL: 'https://example.test', token: null }]),
      )
    await settle()
    assert.equal(
      f.directory.getSnapshot().details.relay?.balance?.remaining,
      '12.5',
      'the queried balance is a result, not a credential: it must survive the tab round-trip',
    )
    assert.deepEqual(f.directory.getSnapshot().secrets, {}, 'credentials still reset on leave')
    assert.equal(f.directory.getSnapshot().details.gone, undefined, 'removed providers drop out')
    stop()
  } finally {
    f.dispose()
  }
})

test('Relay directory represents unsupported, failure, empty lists, invalid addresses and unusual provider IDs safely', async () => {
  const f = relayFixture()
  const stop = f.directory.activate()
  try {
    f.pending.shift().resolve({ ok: true, value: { available: false } })
    await settle()
    assert.equal(f.directory.getSnapshot().phase, 'unsupported')
    let refresh = f.directory.refresh()
    f.pending.shift().reject(new Error('offline'))
    await refresh
    assert.equal(f.directory.getSnapshot().phase, 'error')
    refresh = f.directory.refresh()
    f.pending.shift().resolve(f.list([]))
    await refresh
    assert.deepEqual(f.directory.getSnapshot().providers, [])
    assert.equal(f.directory.getSnapshot().phase, 'ready')
    refresh = f.directory.refresh()
    f.pending.shift().resolve(
      f.list([
        { id: '__proto__', label: 'Odd', baseURL: 'javascript:alert(1)', token: null },
        { id: 'toString', label: 'Other', baseURL: 'invalid', token: { configured: false } },
      ]),
    )
    await refresh
    assert.equal(f.directory.getSnapshot().providers[0].baseURL, null)
    assert.equal(f.directory.getSnapshot().providers[0].token, null)
    const query = f.directory.query('__proto__')
    f.pending.shift().resolve(relayBalance('__proto__'))
    await query
    assert.equal(f.directory.getSnapshot().details.__proto__.phase, 'ready')
    assert.equal(Object.getPrototypeOf(f.directory.getSnapshot().details), Object.prototype)
  } finally {
    stop()
    f.dispose()
  }
})

test('Relay balance component renders loading, token statuses and used-vs-remaining semantics, cleaning up on unmount', async () => {
  const mini = createMiniReact()
  const f = relayFixture({ ReactImpl: mini.React })
  let unmounted = false
  try {
    // Open settings through its entry, then inspect the child declaration without rendering child hooks.
    mini.mount(f.components['dsh-hud-pill'], f.dockProps)
    const gear = rawFind(mini.current(), (n) => n.type?.name === 'SettingsPill')[0]
    mini.unmount()
    mini.mount(gear.type, gear.props)
    mini.current().props.onClick({ currentTarget: { isConnected: false } })
    mini.unmount()
    mini.mount(f.components['dsh-hud-settings'], { t, directory: f.directory })
    rawFind(mini.current(), (n) => n.props?.id === 'dshh-settings-tab-balances')[0].props.onClick()
    const relay = rawFind(mini.current(), (n) => n.type?.name === 'RelayBalances')[0]
    mini.unmount()
    mini.mount(relay.type, relay.props)
    assert.ok(textOf(mini.current()).includes('settings.relays.loading'))
    f.pending.shift().resolve(
      f.list([
        {
          id: 'relay',
          label: 'Relay',
          baseURL: 'https://example.test',
          token: { configured: true },
        },
        { id: 'toString', label: 'Second', token: { configured: false } },
        { id: 'third', label: 'Third', token: null },
      ]),
    )
    await settle()
    let text = textOf(mini.current())
    for (const status of ['tokenConfigured', 'tokenMissing', 'tokenUnsupported'])
      assert.ok(
        rawFind(mini.current(), (n) => n.props?.title === 'settings.relays.' + status).length > 0,
      )
    // Opening the tab queries every provider that has no fresh reading yet.
    const auto = f.pending.splice(0)
    assert.equal(auto.length, 3, 'one automatic balance request per listed provider')
    auto.forEach((request) => request.resolve(relayBalance('relay', { remaining: '5.00' })))
    await settle()
    text = textOf(mini.current())
    assert.ok(text.includes('settings.relays.remaining'), 'the automatic reading is rendered')
    assert.ok(
      !text.includes('settings.relays.notQueried'),
      'the passive not-yet-queried label is gone',
    )
    for (const label of ['Second', 'Third']) {
      for (const action of ['showToken', 'copyToken'])
        assert.equal(
          rawFind(
            mini.current(),
            (n) => n.props?.['aria-label'] === 'settings.relays.' + action + ' · ' + label,
          )[0].props.disabled,
          true,
        )
    }
    assert.equal(
      textOf(rawFind(mini.current(), (n) => n.props?.['data-token-provider'] === 'toString')[0]),
      'settings.relays.tokenNotConfigured',
    )
    assert.equal(
      textOf(rawFind(mini.current(), (n) => n.props?.['data-token-provider'] === 'third')[0]),
      'settings.relays.tokenNotSupported',
    )
    assert.ok(!text.includes('$0.00'))
    assert.equal(
      rawFind(mini.current(), (n) => n.type === 'h3').length,
      0,
      'duplicate balance title removed',
    )
    assert.ok(!text.includes('settings.relays.hint'))
    // The inline Check-balance button is textual, not an icon action; keep it out of
    // the icon-only contract below (it has its own label and is asserted above).
    const iconButtons = rawFind(
      mini.current(),
      (n) => n.type === 'button' && n.props?.className !== 'dshh-relayQuery',
    )
    for (const button of iconButtons) {
      assert.ok(button.props['aria-label'])
      assert.ok(button.props.title)
      assert.ok(button.props['data-tooltip'])
      assert.equal(rawFind(button, (n) => n.type === 'svg').length, 1)
      assert.equal(textOf(button), '', 'button contains only an accessible SVG icon')
    }
    const button = rawFind(
      mini.current(),
      (n) => n.props?.['aria-label'] === 'settings.relays.query · Relay',
    )[0]
    button.props.onClick()
    assert.equal(
      rawFind(mini.current(), (n) => n.props?.['aria-label'] === 'settings.relays.query · Relay')[0]
        .props.disabled,
      true,
    )
    f.pending.shift().resolve(relayBalance())
    await settle()
    text = textOf(mini.current())
    assert.ok(text.includes('settings.relays.usedKey'))
    assert.ok(text.includes('settings.relays.unknownRemaining'))
    assert.ok(!text.includes('settings.relays.remaining'))
    assert.ok(text.includes('1.25'))
    const secret = () =>
      rawFind(mini.current(), (n) => n.props?.['data-secret-provider'] === 'relay')[0]
    const keyButton = (action) =>
      rawFind(
        mini.current(),
        (n) => n.props?.['aria-label'] === 'settings.relays.' + action + ' · Relay',
      )[0]
    assert.equal(textOf(secret()), '••••••••')
    assert.equal(secret().type, 'code')
    assert.equal(f.requests.filter((request) => request.method === 'provider-key').length, 0)
    keyButton('copyAddress').props.onClick()
    await settle()
    assert.equal(f.clipboardWrites.at(-1), 'https://example.test/')
    keyButton('copyKey').props.onClick()
    assert.equal(keyButton('copyKey').props.disabled, true)
    assert.equal(keyButton('copyKey').props['aria-busy'], true)
    f.pending.shift().resolve(keyPayload())
    await settle()
    assert.equal(f.clipboardWrites.at(-1), 'test-fixture-key-only')
    assert.equal(textOf(secret()), '••••••••', 'copying does not reveal key')
    assert.equal(
      rawFind(keyButton('copyKey'), (n) => n.props?.['data-relay-icon'] === 'check').length,
      1,
    )
    assert.ok(!keyButton('copyKey').props.title.includes('test-fixture'))
    keyButton('showKey').props.onClick()
    assert.equal(textOf(secret()), '••••••••')
    f.pending.shift().resolve(keyPayload())
    await settle()
    assert.equal(textOf(secret()), 'test-fixture-key-only')
    keyButton('hideKey').props.onClick()
    assert.equal(textOf(secret()), '••••••••')
    assert.deepEqual(f.directory.getSnapshot().secrets, {})
    keyButton('showKey').props.onClick()
    const blurred = f.pending.shift()
    f.dispatch('blur')
    blurred.resolve(keyPayload())
    await settle()
    assert.equal(textOf(secret()), '••••••••')
    assert.equal(f.windowStub.localStorage.getItem(key), null)
    const token = () =>
      rawFind(mini.current(), (n) => n.props?.['data-token-provider'] === 'relay')[0]
    assert.equal(textOf(token()), '••••••••')
    assert.equal(f.requests.filter((request) => request.method === 'provider-token').length, 0)
    keyButton('copyToken').props.onClick()
    assert.equal(keyButton('copyToken').props.disabled, true)
    f.pending.shift().resolve(tokenPayload())
    await settle()
    assert.equal(f.clipboardWrites.at(-1), 'test-fixture-web-token-only')
    assert.equal(textOf(token()), '••••••••')
    assert.equal(textOf(secret()), '••••••••')
    assert.equal(
      rawFind(keyButton('copyToken'), (n) => n.props?.['data-relay-icon'] === 'check').length,
      1,
    )
    keyButton('showToken').props.onClick()
    f.pending.shift().resolve(tokenPayload())
    await settle()
    assert.equal(textOf(token()), 'test-fixture-web-token-only')
    assert.equal(textOf(secret()), '••••••••')
    keyButton('hideToken').props.onClick()
    assert.equal(textOf(token()), '••••••••')
    assert.deepEqual(f.directory.getSnapshot().tokenSecrets, {})
    keyButton('copyToken').props.onClick()
    const tokenCopy = f.pending.shift()
    const copiedBeforeBlur = f.clipboardWrites.length
    f.dispatch('blur')
    tokenCopy.resolve(tokenPayload())
    await settle()
    assert.equal(f.clipboardWrites.length, copiedBeforeBlur, 'blur cancels pending token copies')
    assert.equal(f.windowStub.localStorage.getItem(key), null)
    mini.unmount()
    unmounted = true
    const before = f.requests.length
    await f.directory.query('third')
    assert.equal(f.requests.length, before)
  } finally {
    if (!unmounted) mini.unmount()
    f.dispose()
  }
})

test('Settings tabs are lazy, keyboard accessible and reset to General on close', async () => {
  const mini = createMiniReact()
  const f = relayFixture({ ReactImpl: mini.React })
  try {
    mini.mount(f.components['dsh-hud-pill'], f.dockProps)
    const gear = rawFind(mini.current(), (n) => n.type?.name === 'SettingsPill')[0]
    mini.unmount()
    mini.mount(gear.type, gear.props)
    const open = mini.current().props.onClick
    mini.unmount()
    mini.mount(f.components['dsh-hud-settings'], { t, directory: f.directory })
    open({ currentTarget: { isConnected: false } })
    const tab = (id) => rawFind(mini.current(), (n) => n.props?.id === 'dshh-settings-tab-' + id)[0]
    const hasRelays = () => rawFind(mini.current(), (n) => n.type?.name === 'RelayBalances').length
    assert.equal(tab('general').props.role, 'tab')
    assert.equal(tab('general').props['aria-selected'], true)
    assert.equal(tab('general').props.tabIndex, 0)
    assert.equal(tab('balances').props.tabIndex, -1)
    assert.equal(hasRelays(), 0)
    assert.equal(f.requests.length, 0, 'General does not mount relay queries')
    const focused = []
    f.documentStub.getElementById = (id) => ({ focus: () => focused.push(id) })
    let prevented = 0
    const key = (id, key) =>
      tab(id).props.onKeyDown({ key, preventDefault: () => prevented++, stopPropagation() {} })
    key('general', 'ArrowRight')
    assert.equal(tab('balances').props['aria-selected'], true)
    assert.equal(hasRelays(), 1)
    assert.equal(rawFind(mini.current(), (n) => n.type === 'footer').length, 0)
    assert.equal(rawFind(mini.current(), (n) => n.props?.['data-setting'] === 'showGit').length, 0)
    key('balances', 'Home')
    assert.equal(tab('general').props['aria-selected'], true)
    key('general', 'End')
    assert.equal(tab('packs').props['aria-selected'], true)
    assert.equal(rawFind(mini.current(), (n) => n.type?.name === 'ExpressionPacks').length, 1)
    assert.equal(hasRelays(), 0)
    key('packs', 'ArrowLeft')
    assert.equal(tab('balances').props['aria-selected'], true)
    key('balances', 'ArrowLeft')
    assert.equal(tab('general').props['aria-selected'], true)
    assert.equal(prevented, 5)
    assert.equal(focused.length, 5)
    tab('balances').props.onClick()
    const deactivate = f.directory.activate()
    f.pending.shift().resolve(f.list())
    await settle()
    const lateReveal = f.directory.reveal('relay')
    const lateKey = f.pending.shift()
    const lateTokenReveal = f.directory.revealToken('relay')
    const lateToken = f.pending.shift()
    tab('general').props.onClick()
    lateKey.resolve(keyPayload())
    lateToken.resolve(tokenPayload())
    await Promise.all([lateReveal, lateTokenReveal])
    assert.deepEqual(
      f.directory.getSnapshot().tokenSecrets,
      {},
      'switching tabs invalidates pending tokens',
    )
    assert.deepEqual(
      f.directory.getSnapshot().secrets,
      {},
      'switching tabs invalidates pending keys',
    )
    tab('balances').props.onClick()
    const reveal = f.directory.reveal('relay')
    f.pending.shift().resolve(keyPayload())
    await reveal
    assert.equal(f.directory.getSnapshot().secrets.relay.phase, 'revealed')
    const tokenReveal = f.directory.revealToken('relay')
    f.pending.shift().resolve(tokenPayload())
    await tokenReveal
    rawFind(mini.current(), (n) => n.props?.className === 'dshh-settingsClose')[0].props.onClick()
    assert.equal(mini.current(), null)
    assert.deepEqual(f.directory.getSnapshot().tokenSecrets, {}, 'closing clears visible tokens')
    assert.deepEqual(f.directory.getSnapshot().secrets, {}, 'closing clears visible keys')
    deactivate()
    open({ currentTarget: { isConnected: false } })
    assert.equal(tab('general').props['aria-selected'], true)
    assert.equal(hasRelays(), 0)
  } finally {
    mini.unmount()
    f.dispose()
  }
})

const keyPayload = (provider = 'relay') => ({
  ok: true,
  value: { available: true, provider, apiKey: 'test-fixture-key-only' },
})

test('API key reveal is explicit, transient and ignores delayed replies after hide, refresh and close', async () => {
  const f = relayFixture()
  let stop = f.directory.activate()
  try {
    f.pending.shift().resolve(f.list())
    await settle()
    assert.deepEqual(f.directory.getSnapshot().secrets, {})
    assert.equal(f.requests.filter((request) => request.method === 'provider-key').length, 0)
    let reveal = f.directory.reveal('relay')
    const delayed = f.pending.shift()
    await f.directory.reveal('relay')
    assert.equal(f.requests.filter((request) => request.method === 'provider-key').length, 1)
    f.directory.hide('relay')
    delayed.resolve(keyPayload())
    await reveal
    assert.deepEqual(f.directory.getSnapshot().secrets, {})
    reveal = f.directory.reveal('relay')
    f.pending.shift().resolve(keyPayload())
    await reveal
    assert.equal(f.directory.getSnapshot().secrets.relay.value, 'test-fixture-key-only')
    assert.equal(f.windowStub.localStorage.getItem(key), null)
    f.directory.hide('relay')
    assert.deepEqual(f.directory.getSnapshot().secrets, {})
    reveal = f.directory.reveal('relay')
    const oldKey = f.pending.shift()
    const refresh = f.directory.refresh()
    assert.deepEqual(f.directory.getSnapshot().secrets, {})
    f.pending.shift().resolve(f.list())
    await refresh
    oldKey.resolve(keyPayload())
    await reveal
    assert.deepEqual(f.directory.getSnapshot().secrets, {})
    reveal = f.directory.reveal('relay')
    const closedKey = f.pending.shift()
    stop()
    closedKey.resolve(keyPayload())
    await reveal
    assert.deepEqual(f.directory.getSnapshot().secrets, {})
    const count = f.requests.length
    await f.directory.reveal('relay')
    assert.equal(f.requests.length, count)
  } finally {
    stop()
    f.dispose()
  }
})

test('Key mismatch and failures never expose values; old host and missing settings have distinct states', async () => {
  const f = relayFixture()
  const stop = f.directory.activate()
  try {
    f.pending.shift().resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    await settle()
    assert.equal(f.directory.getSnapshot().phase, 'restartRequired')
    let refresh = f.directory.refresh()
    f.pending
      .shift()
      .resolve({ ok: true, value: { available: false, reason: 'settings-unavailable' } })
    await refresh
    assert.equal(f.directory.getSnapshot().phase, 'settingsUnavailable')
    refresh = f.directory.refresh()
    f.pending.shift().resolve({ ok: true, value: { available: false, reason: 'settings-failed' } })
    await refresh
    assert.equal(f.directory.getSnapshot().phase, 'error')
    refresh = f.directory.refresh()
    f.pending.shift().resolve(f.list())
    await refresh
    for (const [payload, phase] of [
      [keyPayload('other-relay'), 'error'],
      [{ ok: false, error: { details: { code: 'unknown-endpoint' } } }, 'restartRequired'],
      [{ ok: true, value: { available: false, reason: 'not-configured' } }, 'missing'],
    ]) {
      const reveal = f.directory.reveal('relay')
      f.pending.shift().resolve(payload)
      await reveal
      assert.equal(f.directory.getSnapshot().secrets.relay.phase, phase)
      assert.equal(f.directory.getSnapshot().secrets.relay.value, null)
    }
  } finally {
    stop()
    f.dispose()
  }
})

test('Masked API-key copy reads on explicit action only, copies real value without revealing or persisting, and reuses revealed value', async () => {
  const f = relayFixture()
  const stop = f.directory.activate()
  const written = []
  const writer = async (text) => {
    written.push(text)
  }
  try {
    f.pending.shift().resolve(f.list())
    await settle()
    const initialRequests = f.requests.length
    assert.deepEqual(f.directory.getSnapshot().copies, {})
    const copy = f.directory.copyKey('relay', writer)
    await f.directory.copyKey('relay', writer)
    assert.equal(f.requests.length, initialRequests + 1, 'deduplicates pending copies')
    assert.equal(f.directory.getSnapshot().copies.relay.key, 'loading')
    f.pending.shift().resolve(keyPayload())
    await copy
    assert.deepEqual(written, ['test-fixture-key-only'])
    assert.deepEqual(f.directory.getSnapshot().secrets, {})
    assert.equal(f.directory.getSnapshot().copies.relay.key, 'copied')
    assert.ok(!JSON.stringify(f.directory.getSnapshot()).includes('test-fixture-key-only'))
    assert.equal(f.windowStub.localStorage.getItem(key), null)
    const reveal = f.directory.reveal('relay')
    f.pending.shift().resolve(keyPayload())
    await reveal
    const afterReveal = f.requests.length
    await f.directory.copyKey('relay', writer)
    assert.equal(
      f.requests.length,
      afterReveal,
      'revealed value is copied without another credential request',
    )
    assert.equal(written.length, 2)
    await f.directory.copyAddress('relay', writer)
    assert.equal(written.at(-1), 'https://example.test/v1/private')
    assert.equal(f.directory.getSnapshot().providers[0].copyURL, written.at(-1))
    assert.ok(!written.at(-1).includes('secret'))
    assert.equal(f.directory.getSnapshot().copies.relay.address, 'copied')
  } finally {
    stop()
    f.dispose()
  }
})

test('Pending API-key copies are invalidated by hide, clear, refresh and deactivate before clipboard write', async () => {
  for (const cancel of ['hide', 'clear', 'refresh', 'deactivate']) {
    const f = relayFixture()
    const stop = f.directory.activate()
    const writes = []
    try {
      f.pending.shift().resolve(f.list())
      await settle()
      const copy = f.directory.copyKey('relay', async (value) => {
        writes.push(value)
      })
      const pending = f.pending.shift()
      if (cancel === 'hide') f.directory.hide('relay')
      if (cancel === 'clear') f.directory.clearSecrets()
      if (cancel === 'deactivate') stop()
      if (cancel === 'refresh') {
        const refresh = f.directory.refresh()
        f.pending.shift().resolve(f.list())
        await refresh
      }
      pending.resolve(keyPayload())
      await copy
      assert.deepEqual(writes, [], cancel + ' must prevent late clipboard writes')
      assert.deepEqual(f.directory.getSnapshot().copies, {})
      assert.deepEqual(f.directory.getSnapshot().secrets, {})
    } finally {
      stop()
      f.dispose()
    }
  }
})

test('Clipboard errors are explicit, retryable and contain no key; absent clipboard avoids credential read', async () => {
  const f = relayFixture()
  const stop = f.directory.activate()
  try {
    f.pending.shift().resolve(f.list())
    await settle()
    const before = f.requests.length
    await f.directory.copyKey('relay')
    assert.equal(f.requests.length, before)
    assert.equal(f.directory.getSnapshot().copies.relay.key, 'error')
    let copy = f.directory.copyKey('relay', async () => {
      throw new Error('secret-error-value')
    })
    f.pending.shift().resolve(keyPayload())
    await copy
    assert.equal(f.directory.getSnapshot().copies.relay.key, 'error')
    assert.ok(!JSON.stringify(f.directory.getSnapshot()).includes('secret-error-value'))
    assert.ok(!JSON.stringify(f.directory.getSnapshot()).includes('test-fixture-key-only'))
    const written = []
    copy = f.directory.copyKey('relay', async (value) => {
      written.push(value)
    })
    f.pending.shift().resolve(keyPayload('different-provider'))
    await copy
    assert.deepEqual(written, [])
    assert.equal(f.directory.getSnapshot().copies.relay.key, 'error')
    copy = f.directory.copyKey('relay', async (value) => {
      written.push(value)
    })
    f.pending.shift().resolve(keyPayload())
    await copy
    assert.equal(f.directory.getSnapshot().copies.relay.key, 'copied')
    assert.deepEqual(written, ['test-fixture-key-only'])
  } finally {
    stop()
    f.dispose()
  }
})

test('Closing after a clipboard write starts cannot restore cleared feedback when the browser finishes', async () => {
  const f = relayFixture()
  const stop = f.directory.activate()
  let finish
  try {
    f.pending.shift().resolve(f.list())
    await settle()
    const copy = f.directory.copyAddress(
      'relay',
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    assert.equal(f.directory.getSnapshot().copies.relay.address, 'loading')
    stop()
    finish()
    await copy
    assert.deepEqual(f.directory.getSnapshot().copies, {})
  } finally {
    stop()
    f.dispose()
  }
})

const tokenPayload = (provider = 'relay') => ({
  ok: true,
  value: { available: true, provider, accessToken: 'test-fixture-web-token-only' },
})

test('Web-token reveal and copy are separate from API keys and scoped to provider and field', async () => {
  const f = relayFixture()
  const stop = f.directory.activate()
  const writes = []
  try {
    f.pending.shift().resolve(f.list())
    await settle()
    assert.equal(f.requests.length, 1)
    const keyReveal = f.directory.reveal('relay')
    const tokenReveal = f.directory.revealToken('relay')
    await f.directory.revealToken('relay')
    assert.deepEqual(
      f.requests.slice(-2).map((request) => request.method),
      ['provider-key', 'provider-token'],
    )
    f.pending.shift().resolve(keyPayload())
    f.pending.shift().resolve(tokenPayload())
    await Promise.all([keyReveal, tokenReveal])
    assert.equal(f.directory.getSnapshot().secrets.relay.value, 'test-fixture-key-only')
    assert.equal(f.directory.getSnapshot().tokenSecrets.relay.value, 'test-fixture-web-token-only')
    const beforeCopy = f.requests.length
    await f.directory.copyToken('relay', async (value) => {
      writes.push(value)
    })
    await f.directory.copyKey('relay', async (value) => {
      writes.push(value)
    })
    assert.equal(f.requests.length, beforeCopy, 'each revealed field copies its own value')
    assert.deepEqual(writes, ['test-fixture-web-token-only', 'test-fixture-key-only'])
    f.directory.hideToken('relay')
    assert.deepEqual(f.directory.getSnapshot().tokenSecrets, {})
    assert.equal(f.directory.getSnapshot().secrets.relay.value, 'test-fixture-key-only')
    const copy = f.directory.copyToken('relay', async (value) => {
      writes.push(value)
    })
    f.pending.shift().resolve(tokenPayload())
    await copy
    assert.equal(writes.at(-1), 'test-fixture-web-token-only')
    assert.deepEqual(f.directory.getSnapshot().tokenSecrets, {}, 'masked copy must not reveal')
    const wrong = f.directory.revealToken('relay')
    f.pending.shift().resolve(keyPayload())
    await wrong
    assert.equal(
      f.directory.getSnapshot().tokenSecrets.relay.value,
      null,
      'apiKey field cannot masquerade as accessToken',
    )
    const mismatch = f.directory.revealToken('relay')
    f.pending.shift().resolve(tokenPayload('other'))
    await mismatch
    assert.equal(f.directory.getSnapshot().tokenSecrets.relay.value, null)
    assert.equal(f.windowStub.localStorage.getItem(key), null)
  } finally {
    stop()
    f.dispose()
  }
})

test('Token read and copy late replies cannot survive hide, clear, refresh or deactivate', async () => {
  for (const cancel of ['hide', 'clear', 'refresh', 'deactivate']) {
    const f = relayFixture()
    const stop = f.directory.activate()
    const writes = []
    try {
      f.pending.shift().resolve(f.list())
      await settle()
      const reveal = f.directory.revealToken('relay')
      const delayedReveal = f.pending.shift()
      const copy = f.directory.copyToken('relay', async (value) => {
        writes.push(value)
      })
      const delayedCopy = f.pending.shift()
      if (cancel === 'hide') f.directory.hideToken('relay')
      if (cancel === 'clear') f.directory.clearSecrets()
      if (cancel === 'deactivate') stop()
      if (cancel === 'refresh') {
        const refresh = f.directory.refresh()
        f.pending.shift().resolve(f.list())
        await refresh
      }
      delayedReveal.resolve(tokenPayload())
      delayedCopy.resolve(tokenPayload())
      await Promise.all([reveal, copy])
      assert.deepEqual(writes, [], cancel)
      assert.deepEqual(f.directory.getSnapshot().tokenSecrets, {})
      assert.deepEqual(f.directory.getSnapshot().copies, {})
    } finally {
      stop()
      f.dispose()
    }
  }
})

test('Token unavailable states do not fetch credentials; unsupported or failed replies remain safe and retryable', async () => {
  const f = relayFixture()
  const stop = f.directory.activate()
  try {
    f.pending.shift().resolve(
      f.list([
        { id: 'relay', token: { configured: false } },
        { id: 'none', token: null },
      ]),
    )
    await settle()
    const before = f.requests.length
    await f.directory.revealToken('relay')
    await f.directory.copyToken('relay', async () => {
      assert.fail('must not copy absent token')
    })
    await f.directory.revealToken('none')
    assert.equal(f.requests.length, before)
    assert.equal(f.directory.getSnapshot().tokenSecrets.relay.phase, 'missing')
    assert.equal(f.directory.getSnapshot().tokenSecrets.none.phase, 'unsupported')
    const refresh = f.directory.refresh()
    f.pending.shift().resolve(f.list())
    await refresh
    for (const [result, phase] of [
      [{ ok: true, value: { available: false, reason: 'not-supported' } }, 'unsupported'],
      [{ ok: true, value: { available: false, reason: 'not-configured' } }, 'missing'],
      [{ ok: false, error: { details: { code: 'unknown-endpoint' } } }, 'restartRequired'],
    ]) {
      const reveal = f.directory.revealToken('relay')
      f.pending.shift().resolve(result)
      await reveal
      assert.equal(f.directory.getSnapshot().tokenSecrets.relay.phase, phase)
      assert.equal(f.directory.getSnapshot().tokenSecrets.relay.value, null)
    }
    const failed = f.directory.copyToken('relay', async () => {
      throw new Error('fixture-secret-error')
    })
    f.pending.shift().resolve(tokenPayload())
    await failed
    assert.equal(f.directory.getSnapshot().copies.relay.token, 'error')
    assert.ok(!JSON.stringify(f.directory.getSnapshot()).includes('fixture-secret-error'))
    const retry = f.directory.revealToken('relay')
    f.pending.shift().resolve(tokenPayload())
    await retry
    assert.equal(f.directory.getSnapshot().tokenSecrets.relay.value, 'test-fixture-web-token-only')
    f.directory.clearSecrets()
    assert.deepEqual(f.directory.getSnapshot().tokenSecrets, {})
  } finally {
    stop()
    f.dispose()
  }
})
