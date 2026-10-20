/** 浏览器半用例：image（6 条）。共享设施见 client-harness.mjs。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  IMAGE_PAIR_VALUE,
  chipsOf,
  findAll,
  findByAttr,
  mountBinaryDiff,
  mountTurnImages,
  textOf,
} from './client-harness.mjs'

test('图片预览：二进制改动画出两侧的图、尺寸变化与字节数，并按当前页签发请求', async () => {
  const { store, calls, tree } = await mountBinaryDiff(IMAGE_PAIR_VALUE)
  assert.equal(
    store.getSnapshot().diff.data.worktree.binary,
    true,
    '前提：git 把这条改动报成二进制',
  )

  const images = findAll(tree(), (node) => node && node.type === 'img')
  assert.equal(images.length, 2, '并排两张：索引那一版 + 工作区这一版')
  assert.match(
    images[0].props.src,
    /^data:image\/png;base64,/,
    '图直接用数据 URL 画，不落盘也不外链',
  )

  const text = textOf(tree())
  assert.ok(
    text.includes('image.beforeWorktree') && text.includes('image.afterWorktree'),
    `两侧各有标签，实际 ${text}`,
  )
  assert.ok(text.includes('image.dimsChanged'), '尺寸变了要一眼看到')
  assert.ok(
    text.includes('w=1024 h=768') && text.includes('w=1024 h=512'),
    `尺寸文案要带具体数字，实际 ${text}`,
  )
  assert.ok(text.includes('2.0 KB → 1.0 KB'), `字节变化也要报，实际 ${text}`)

  // 预热的两次就是全部请求：组件命中缓存后不该再发（也没发成别的键）。
  const imageCalls = calls.filter((entry) => entry.endpoint === 'image')
  assert.deepEqual(
    imageCalls.map((entry) => entry.args.side),
    ['worktree', 'index'],
    '两个页签各一份缓存，键里必须带侧',
  )

  // 切到「已暂存」：页签换侧后仍然有图（用的是那一侧的缓存）。
  store.setDiffSide('index')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(
    findAll(tree(), (node) => node && node.type === 'img').length,
    2,
    '换侧后照画，不该掉回"读取图片…"',
  )
})

test('图片预览：认不出的二进制退回原来那句话，并说清是哪一种', async () => {
  const notImage = await mountBinaryDiff({
    repo: '/Users/me/project',
    path: 'cat.png',
    origPath: null,
    side: 'worktree',
    sha: null,
    before: { kind: 'missing' },
    after: { kind: 'not-image', bytes: 4096 },
  })
  assert.equal(
    findAll(notImage.tree(), (node) => node && node.type === 'img').length,
    0,
    '不是图就不该画图',
  )
  assert.ok(
    textOf(notImage.tree()).includes('image.notImage'),
    `要说清"不是可预览的图片"，实际 ${textOf(notImage.tree())}`,
  )

  const tooLarge = await mountBinaryDiff({
    repo: '/Users/me/project',
    path: 'cat.png',
    origPath: null,
    side: 'worktree',
    sha: null,
    before: { kind: 'image', mime: 'image/png', bytes: 100, width: 8, height: 8, base64: 'AAAA' },
    after: { kind: 'too-large', bytes: 9_000_000, limit: 4 * 1024 * 1024 },
  })
  const text = textOf(tooLarge.tree())
  assert.ok(text.includes('image.tooLarge'), `超上限要说清上限，实际 ${text}`)
  assert.ok(
    text.includes('limit=4') && text.includes('size=9.00 MB'),
    `要带上上限与真实大小，实际 ${text}`,
  )
  assert.equal(
    findAll(tooLarge.tree(), (node) => node && node.type === 'img').length,
    1,
    '另一侧仍然画得出来',
  )
})

test('图片预览：缩放按钮看得见、点得动；适应宽度 / 100% / 150% / 200% 封顶', async () => {
  const { store, tree } = await mountBinaryDiff(IMAGE_PAIR_VALUE)
  // 缩放控件是一组带 key 的子元素（children 是数组），所以用 findAll 而不是 findByAttr。
  const zoomBtn = (key) =>
    findAll(tree(), (node) => node.props && node.props['data-dsh-hud'] === key)[0]
  const images = () => findAll(tree(), (node) => node && node.type === 'img')
  const settle = () => new Promise((resolve) => setImmediate(resolve))

  assert.ok(zoomBtn('image-zoom'), '要有一排看得见、点的着的缩放控件（内置那个藏在悬停感应带里）')
  assert.ok(textOf(tree()).includes('image.fitWidth'), '默认状态是"适应宽度"')
  assert.equal(images()[0].props.style, undefined, '适应宽度交给 CSS（max-width:100%），不写死宽度')

  // 从适应宽度按 ＋ → 100%（固有宽 1024）：按固有像素算，不用等图片加载。
  zoomBtn('image-zoom-in').props.onClick()
  await settle()
  assert.equal(store.getSnapshot().diff.zoom, 1, '缩放档位住在 store 里（换个文件也记得）')
  assert.equal(images()[0].props.style.width, '1024px')
  assert.equal(images()[0].props.style.maxWidth, 'none')
  assert.ok(textOf(tree()).includes('image.zoomValue'), '数值按钮显示百分比')

  zoomBtn('image-zoom-in').props.onClick()
  await settle()
  assert.equal(images()[0].props.style.width, '1536px', '150%')

  zoomBtn('image-zoom-in').props.onClick()
  await settle()
  assert.equal(images()[0].props.style.width, '2048px', '200%')

  zoomBtn('image-zoom-in').props.onClick()
  await settle()
  assert.equal(images()[0].props.style.width, '2048px', '200% 封顶，再按没反应')

  zoomBtn('image-zoom-out').props.onClick()
  await settle()
  assert.equal(images()[0].props.style.width, '1536px', '－ 回到 150%')

  // 点数值按钮 = 回到适应宽度。
  zoomBtn('image-zoom-value').props.onClick()
  await settle()
  assert.equal(store.getSnapshot().diff.zoom, null)
  assert.equal(images()[0].props.style, undefined, '回到适应宽度')
  assert.ok(textOf(tree()).includes('image.fitWidth'))

  // 记住：定到 100% 后关掉再打开，还是 100%（与"自动换行"一样落盘）。
  zoomBtn('image-zoom-in').props.onClick()
  await settle()
  store.closeDiff()
  await store.openDiff({ file: 'cat.png', path: 'cat.png' })
  assert.equal(store.getSnapshot().diff.zoom, 1, '重新打开还记住缩放档位')
})

test('轮尾图片条：只列本轮的图（确定档 + 命令旁听档），点缩略图走内置预览，⇄ 进 hud 看前后对比', async () => {
  const { store, tree, opened } = await mountTurnImages({ turn: 3 })

  assert.ok(findByAttr(tree, 'turn-images'), '本轮动过图就该有这条')
  const chips = chipsOf(tree)
  assert.deepEqual(
    chips.map((chip) => chip.props['data-file']),
    ['assets/from-script.png', 'assets/cat.png'],
    '两档都收、最近的在前，且同一个文件只算一次：src/a.ts 不是图，assets/old*.png 属于第 2 轮',
  )
  assert.deepEqual(
    chips.map((chip) => chip.props['data-tier']),
    ['possible', 'confirmed'],
    '命令旁听来的标 ◐，写文件工具改的算确定',
  )
  assert.equal(findAll(tree, (node) => node && node.type === 'img').length, 2, '两张都画出缩略图')
  assert.ok(textOf(tree).includes('turnImages.title'), `标题要说"本轮"，实际 ${textOf(tree)}`)

  // 点缩略图 = 内置预览（槽位给的 openFile），这正是"点了就能看图"。
  const open = findAll(
    chips[0],
    (node) =>
      node.props &&
      typeof node.props.className === 'string' &&
      node.props.className.includes('dshh-imgstripOpen'),
  )[0]
  assert.ok(open, '缩略图必须是个按钮')
  assert.ok(
    open.props.title.includes('assets/from-script.png') &&
      open.props.title.includes('session.possibleTitle'),
    `◐ 的悬停要说清是命令旁观来的、并给出那条命令，实际 ${open.props.title}`,
  )
  open.props.onClick()
  assert.deepEqual(opened, ['assets/from-script.png'])

  // ⇄ 才进 hud 面板看前后两张。
  const compare = findAll(
    chips[0],
    (node) => node.props && node.props['data-dsh-hud'] === 'turn-image-compare',
  )[0]
  compare.props.onClick()
  const snapshot = store.getSnapshot()
  assert.equal(snapshot.panelOpen, true, '对比要打开 hud 面板')
  assert.equal(snapshot.diff.file, 'assets/from-script.png', '并且落在同一个文件的差异上')
})

test('轮尾图片条：这一轮没动过图就不渲染，不给每条轮尾留空壳', async () => {
  const { tree } = await mountTurnImages({ turn: 9 })
  assert.equal(findByAttr(tree, 'turn-images'), null, '整条不渲染')
  assert.equal(chipsOf(tree).length, 0)
})

test('轮尾图片条：拿不到回合号时退回"本会话"，而不是整条消失', async () => {
  const { tree } = await mountTurnImages(undefined)
  assert.ok(findByAttr(tree, 'turn-images'), '形状变了也要能显示')
  assert.ok(
    textOf(tree).includes('turnImages.titleSession'),
    `标题该说"本会话"，实际 ${textOf(tree)}`,
  )
  assert.deepEqual(
    chipsOf(tree)
      .map((chip) => chip.props['data-file'])
      .sort(),
    ['assets/cat.png', 'assets/from-script.png', 'assets/old-guess.png', 'assets/old.png'],
  )
})
