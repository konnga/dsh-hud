/** Expression-pack management inside the real HUD settings overlay. */
import React from 'react'
import { h } from '../shared.js'
import type { Translate } from '../shared.js'
import { EXPRESSION_ACTIONS, EXPRESSION_LIMITS } from '../../shared/expression-packs.js'
import type {
  ExpressionAction,
  ExpressionDraft,
  ExpressionPackSummary,
} from '../../shared/expression-packs.js'
import type { ExpressionPackStore } from '../expression-packs.js'
import {
  ExpressionPackError,
  expressionErrorCode,
  expressionImageBytes,
  decodeExpressionImage,
} from '../expression-packs.js'

export interface ExpressionPacksProps {
  store?: ExpressionPackStore
  t: Translate
  onSelect?: (skin: string) => void | Promise<void>
}
interface Editor {
  draft: ExpressionDraft
  id?: string
  revision?: string
}
export function emptyExpressionDraft(): ExpressionDraft {
  return {
    manifest: {
      schemaVersion: 1,
      name: '',
      author: '',
      version: '1.0.0',
      fallback: 'thinking',
      actions: { thinking: '' },
    },
    files: {},
  }
}
function copyDraft(draft: ExpressionDraft): ExpressionDraft {
  return {
    manifest: { ...draft.manifest, actions: { ...draft.manifest.actions } },
    files: { ...draft.files },
  }
}
export function guessExpressionAction(name: string): ExpressionAction | undefined {
  var key = name
    .replace(/\.[^.]*$/, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  return EXPRESSION_ACTIONS.find(function (action) {
    return action === key
  })
}
function fileData(file: File): Promise<string> {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader()
    reader.onerror = function () {
      reject(new ExpressionPackError('file-read-failed'))
    }
    reader.onload = function () {
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new ExpressionPackError('file-read-failed'))
    }
    reader.readAsDataURL(file)
  })
}
/** Local reading/decode never persists or enables a pack. */
export async function addExpressionFiles(
  draft: ExpressionDraft,
  files: File[],
  action?: ExpressionAction,
): Promise<ExpressionDraft> {
  if (!files.length) return draft
  if (files.length > EXPRESSION_LIMITS.maxFiles || (action && files.length !== 1))
    throw new ExpressionPackError('too-many-files')
  var next = copyDraft(draft)
  // Replacing an action may free an old file only if no other action references it.
  if (action) {
    var old = next.manifest.actions[action]
    if (
      old &&
      Object.entries(next.manifest.actions).filter(function ([, value]) {
        return value === old
      }).length === 1
    )
      delete next.files[old]
  }
  if (Object.keys(next.files).length + files.length > EXPRESSION_LIMITS.maxFiles)
    throw new ExpressionPackError('too-many-files')
  var total = Object.values(next.files).reduce(function (sum, value) {
    return sum + expressionImageBytes(value)
  }, 0)
  if (
    files.some(function (file) {
      return file.size > EXPRESSION_LIMITS.maxFileBytes
    })
  )
    throw new ExpressionPackError('file-too-large')
  if (
    total +
      files.reduce(function (sum, file) {
        return sum + file.size
      }, 0) >
    EXPRESSION_LIMITS.maxPackBytes
  )
    throw new ExpressionPackError('pack-too-large')
  for (var index = 0; index < files.length; index++) {
    var file = files[index]
    if (!/\.(png|webp)$/i.test(file.name)) throw new ExpressionPackError('invalid-image')
    var data = await fileData(file)
    expressionImageBytes(data)
    await decodeExpressionImage(data)
    var extension = data.startsWith('data:image/png;') ? 'png' : 'webp'
    var serial = Object.keys(next.files).length + 1
    var path = 'images/image-' + serial + '.' + extension
    while (Object.prototype.hasOwnProperty.call(next.files, path)) {
      serial++
      path = 'images/image-' + serial + '.' + extension
    }
    next.files[path] = data
    var mapped = action || guessExpressionAction(file.name)
    if (!mapped && files.length === 1 && !next.manifest.actions.thinking) mapped = 'thinking'
    if (mapped && (action || !next.manifest.actions[mapped])) next.manifest.actions[mapped] = path
  }
  return next
}
export function expressionErrorKey(code: string): string {
  var known = [
    'invalid-image',
    'animated-image',
    'image-too-large',
    'file-too-large',
    'pack-too-large',
    'zip-too-large',
    'too-many-files',
    'invalid-pack',
    'unsupported-version',
    'invalid-metadata',
    'missing-thinking',
    'missing-image',
    'file-read-failed',
    'decode-unavailable',
    'busy',
    'expression-invalid',
    'expression-conflict',
    'expression-not-found',
    'expression-unavailable',
    'expression-storage-failed',
    'expression-disposed',
    'unknown-endpoint',
  ]
  return 'packs.error.' + (known.includes(code) ? code : 'request-failed')
}
export function downloadExpressionZip(result: { base64: string; name: string }): void {
  var binary = atob(result.base64)
  var bytes = new Uint8Array(binary.length)
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  var url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
  try {
    var link = document.createElement('a')
    link.href = url
    link.download = result.name.replace(/[\\/\x00-\x1f]/g, '_')
    link.click()
  } finally {
    setTimeout(function () {
      URL.revokeObjectURL(url)
    }, 0)
  }
}
export function ExpressionPacks(props: ExpressionPacksProps): React.ReactElement {
  var t = props.t
  var store = props.store
  var state = React.useState(function () {
    return store?.getSnapshot()
  })
  var editorState = React.useState<Editor | null>(null)
  var editor = editorState[0]
  var setEditor = editorState[1]
  var busyState = React.useState(false)
  var busy = busyState[0] || Boolean(state[0]?.busy)
  var messageState = React.useState('')
  var errorState = React.useState('')
  var previewState = React.useState<ExpressionAction>('thinking')
  var confirmState = React.useState<ExpressionPackSummary | null>(null)
  var duplicateState = React.useState(false)
  var operation = React.useRef(0)
  var alive = React.useRef(false)
  React.useEffect(
    function () {
      alive.current = true
      state[1](store?.getSnapshot())
      var unsubscribe = store?.subscribe(function () {
        state[1](store!.getSnapshot())
      })
      void store?.refresh()
      return function () {
        alive.current = false
        operation.current++
        unsubscribe?.()
      }
    },
    [store],
  )
  async function perform(task: () => Promise<void>): Promise<void> {
    if (busy) return
    var ticket = ++operation.current
    busyState[1](true)
    errorState[1]('')
    messageState[1]('')
    try {
      await task()
    } catch (error) {
      if (alive.current && ticket === operation.current)
        errorState[1](expressionErrorKey(expressionErrorCode(error)))
    } finally {
      if (alive.current && ticket === operation.current) busyState[1](false)
    }
  }
  function current(ticket: number): boolean {
    return alive.current && ticket === operation.current
  }
  function editDraft(draft: ExpressionDraft): void {
    if (!editor) return
    setEditor({ ...editor, draft })
    duplicateState[1](false)
    messageState[1]('')
  }
  function begin(draft: ExpressionDraft, id?: string, revision?: string): void {
    setEditor({ draft: copyDraft(draft), id, revision })
    previewState[1]('thinking')
    duplicateState[1](false)
    confirmState[1](null)
  }
  function openPack(pack: ExpressionPackSummary): void {
    void perform(async function () {
      var ticket = operation.current
      var loaded = await store!.get(pack.id)
      if (current(ticket)) begin(loaded, loaded.id, loaded.revision)
    })
  }
  function selectFiles(
    event: React.ChangeEvent<HTMLInputElement>,
    action?: ExpressionAction,
  ): void {
    var files = Array.from(event.currentTarget.files || [])
    event.currentTarget.value = ''
    if (!files.length) return
    var initial = editor?.draft || emptyExpressionDraft()
    void perform(async function () {
      var ticket = operation.current
      var draft = await addExpressionFiles(initial, files, action)
      if (current(ticket)) {
        if (editor) editDraft(draft)
        else begin(draft)
        if (action) previewState[1](action)
      }
    })
  }
  function importZip(event: React.ChangeEvent<HTMLInputElement>): void {
    var file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    void perform(async function () {
      var ticket = operation.current
      if (file!.size > EXPRESSION_LIMITS.maxZipBytes) throw new ExpressionPackError('zip-too-large')
      var data = await fileData(file!)
      var draft = await store!.previewZip(data.slice(data.indexOf(',') + 1))
      if (current(ticket)) {
        begin(draft)
        messageState[1]('packs.importPreview')
      }
    })
  }
  function save(asNew = false): void {
    if (!editor || !store) return
    void perform(async function () {
      var ticket = operation.current
      var draft = copyDraft(editor!.draft)
      draft.manifest.name = draft.manifest.name.trim()
      draft.manifest.version = draft.manifest.version.trim()
      var pack = await store!.save(
        draft,
        asNew ? undefined : editor!.id,
        asNew ? undefined : editor!.revision,
      )
      if (current(ticket)) {
        begin(pack, pack.id, pack.revision)
        messageState[1]('packs.saved')
      }
    })
  }
  var snapshot = state[0]
  var packs = snapshot?.catalog.packs || []
  var selected = snapshot?.catalog.selectedSkin
  var phase = !store ? 'unsupported' : snapshot?.phase || 'idle'
  var disabled = !store || phase === 'unsupported' || phase === 'restartRequired' || busy
  function button(
    label: string,
    action: () => void,
    extra: Record<string, unknown> = {},
  ): React.ReactElement {
    return h('button', { type: 'button', disabled, onClick: action, ...extra }, t(label))
  }
  function upload(
    label: string,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
    zip = false,
    single = false,
  ): React.ReactElement {
    return h(
      'label',
      { className: 'dshh-packUpload' },
      h('span', {}, t(label)),
      h('input', {
        type: 'file',
        accept: zip ? '.zip,application/zip' : '.png,.webp,image/png,image/webp',
        multiple: !zip && !single,
        disabled,
        onChange,
        'aria-label': t(label),
      }),
    )
  }
  function status(): React.ReactElement | null {
    var error = errorState[0] || (snapshot?.errorCode ? expressionErrorKey(snapshot.errorCode) : '')
    if (phase === 'restartRequired') error = 'packs.restartRequired'
    else if (phase === 'unsupported') error = 'packs.unsupported'
    return h(
      'div',
      { className: 'dshh-packStatus', role: 'status', 'aria-live': 'polite', 'aria-atomic': true },
      error ? h('p', { className: 'dshh-packError' }, t(error)) : null,
      busy || phase === 'loading' ? h('p', {}, t('packs.loading')) : null,
      messageState[0] ? h('p', {}, t(messageState[0])) : null,
    )
  }
  var content: React.ReactElement
  var editorFooter: React.ReactElement | null = null
  if (!editor) {
    content = h(
      'div',
      { className: 'dshh-packLibrary' },
      h(
        'div',
        { className: 'dshh-packToolbar' },
        button('packs.new', function () {
          begin(emptyExpressionDraft())
        }),
        upload('packs.fromImages', function (event) {
          selectFiles(event)
        }),
        upload('packs.import', importZip, true),
        button(
          'packs.refresh',
          function () {
            void store?.refresh()
          },
          { disabled: busy || !store },
        ),
      ),
      packs.length === 0 && phase === 'ready'
        ? h('p', { className: 'dshh-packEmpty' }, t('packs.empty'))
        : null,
      h(
        'ul',
        { className: 'dshh-packList' },
        packs.map(function (pack) {
          var active = selected === pack.id
          return h(
            'li',
            { key: pack.id, className: 'dshh-packCard', 'data-selected': active ? '' : undefined },
            h(
              'div',
              { className: 'dshh-packCardTitle' },
              h('strong', {}, pack.name),
              active ? h('span', { className: 'dshh-packBadge' }, t('packs.selected')) : null,
            ),
            h(
              'p',
              { className: 'dshh-packMeta' },
              String(pack.actionCount) +
                ' / 30 · ' +
                pack.version +
                (pack.author ? ' · ' + pack.author : ''),
            ),
            h(
              'div',
              { className: 'dshh-packToolbar' },
              button(
                'packs.use',
                function () {
                  void perform(async function () {
                    await props.onSelect?.(pack.id)
                  })
                },
                { disabled: disabled || active || !props.onSelect },
              ),
              button('packs.edit', function () {
                openPack(pack)
              }),
              button('packs.export', function () {
                void perform(async function () {
                  var ticket = operation.current
                  var result = await store!.exportZip(pack.id)
                  if (current(ticket)) downloadExpressionZip(result)
                })
              }),
              button('packs.delete', function () {
                confirmState[1](pack)
              }),
            ),
            confirmState[0]?.id === pack.id
              ? h(
                  'div',
                  { className: 'dshh-packConfirm', role: 'alert' },
                  h('p', {}, t(active ? 'packs.deleteSelected' : 'packs.deleteConfirm')),
                  button('packs.confirmDelete', function () {
                    void perform(async function () {
                      var ticket = operation.current
                      await store!.remove(pack.id, pack.revision)
                      if (current(ticket)) confirmState[1](null)
                    })
                  }),
                  button('packs.cancel', function () {
                    confirmState[1](null)
                  }),
                )
              : null,
          )
        }),
      ),
    )
  } else {
    var draft = editor.draft
    var files = Object.keys(draft.files)
    var action = previewState[0]
    var explicit = draft.manifest.actions[action]
    var source = draft.files[explicit || draft.manifest.actions.thinking]
    var duplicate = packs.find(function (pack) {
      return pack.id !== editor!.id && pack.name.trim() === draft.manifest.name.trim()
    })
    function field(key: 'name' | 'author' | 'version', maxLength: number): React.ReactElement {
      return h(
        'label',
        { className: 'dshh-packField' },
        h('span', {}, t('packs.' + key)),
        h('input', {
          type: 'text',
          value: draft.manifest[key] || '',
          maxLength,
          disabled: busy,
          onChange: function (event: React.ChangeEvent<HTMLInputElement>) {
            editDraft({
              ...draft,
              manifest: { ...draft.manifest, [key]: event.currentTarget.value },
            })
          },
        }),
      )
    }
    content = h(
      'div',
      { className: 'dshh-packEditor' },
      h(
        'div',
        { className: 'dshh-packToolbar' },
        button('packs.back', function () {
          setEditor(null)
          errorState[1]('')
          messageState[1]('')
        }),
        h('strong', {}, t(editor.id ? 'packs.editing' : 'packs.creating')),
      ),
      h(
        'div',
        { className: 'dshh-packFields' },
        field('name', 80),
        field('author', 120),
        field('version', 40),
      ),
      h(
        'div',
        { className: 'dshh-packToolbar' },
        upload('packs.addImages', function (event) {
          selectFiles(event)
        }),
        button('packs.cleanUnused', function () {
          var used = new Set(Object.values(draft.manifest.actions))
          var kept = Object.fromEntries(
            Object.entries(draft.files).filter(function ([path]) {
              return used.has(path)
            }),
          )
          editDraft({ ...draft, files: kept })
        }),
      ),
      duplicate
        ? h(
            'div',
            { className: 'dshh-packConfirm' },
            h('p', {}, t('packs.duplicate')),
            button('packs.editExisting', function () {
              openPack(duplicate!)
            }),
            h(
              'label',
              {},
              h('input', {
                type: 'checkbox',
                checked: duplicateState[0],
                disabled: busy,
                onChange: function (event: React.ChangeEvent<HTMLInputElement>) {
                  duplicateState[1](event.currentTarget.checked)
                },
              }),
              t('packs.allowDuplicate'),
            ),
          )
        : null,
      h(
        'section',
        { className: 'dshh-packPreview', 'aria-label': t('packs.preview') },
        h(
          'div',
          { className: 'dshh-packLarge' },
          source
            ? h('img', { src: source, width: 192, height: 192, alt: t('packs.action.' + action) })
            : h('p', {}, t('packs.noImage')),
        ),
        h(
          'div',
          { className: 'dshh-packPreviewCopy' },
          h('strong', {}, t('packs.action.' + action)),
          h('p', {}, t(explicit ? 'packs.custom' : 'packs.fallback')),
          h('p', {}, t('packs.previewSize')),
          h(
            'div',
            { className: 'dshh-packSamples' },
            ['light', 'dark'].map(function (tone) {
              return h(
                'div',
                {
                  key: tone,
                  className: 'dshh-packSample dshh-packSample-' + tone,
                  'aria-label': t('packs.' + tone),
                },
                source
                  ? h('img', {
                      src: source,
                      width: 56,
                      height: 56,
                      alt: t('packs.action.' + action),
                    })
                  : null,
              )
            }),
          ),
        ),
      ),
      h(
        'div',
        { className: 'dshh-packActions', 'aria-label': t('packs.actions') },
        EXPRESSION_ACTIONS.map(function (item) {
          var mapped = draft.manifest.actions[item]
          var image = draft.files[mapped || draft.manifest.actions.thinking]
          return h(
            'div',
            {
              key: item,
              className: 'dshh-packAction',
              'data-current': item === action ? '' : undefined,
            },
            h(
              'button',
              {
                type: 'button',
                className: 'dshh-packThumb',
                onClick: function () {
                  previewState[1](item)
                },
                'aria-label': t('packs.preview') + ' · ' + t('packs.action.' + item),
                'aria-pressed': item === action,
              },
              image
                ? h('img', { src: image, width: 56, height: 56, alt: '', loading: 'lazy' })
                : h('span', {}, '—'),
            ),
            h(
              'div',
              { className: 'dshh-packActionControls' },
              h('label', { htmlFor: 'dshh-pack-action-' + item }, t('packs.action.' + item)),
              h(
                'span',
                { className: 'dshh-packMeta' },
                t(mapped ? 'packs.custom' : 'packs.fallback'),
              ),
              h(
                'span',
                { className: 'dshh-selectWrap' },
                h(
                  'select',
                  {
                    id: 'dshh-pack-action-' + item,
                    value: mapped || '',
                    disabled: busy,
                    onChange: function (event: React.ChangeEvent<HTMLSelectElement>) {
                      var actions = { ...draft.manifest.actions }
                      var value = event.currentTarget.value
                      if (value) actions[item] = value
                      else if (item !== 'thinking') delete actions[item]
                      else actions.thinking = ''
                      editDraft({ ...draft, manifest: { ...draft.manifest, actions } })
                    },
                  },
                  h(
                    'option',
                    { value: '', disabled: item === 'thinking' && Boolean(mapped) },
                    t(item === 'thinking' ? 'packs.chooseThinking' : 'packs.useFallback'),
                  ),
                  files.map(function (file) {
                    return h('option', { key: file, value: file }, file)
                  }),
                ),
              ),
              h(
                'div',
                { className: 'dshh-packActionButtons' },
                upload(
                  'packs.replace',
                  function (event) {
                    selectFiles(event, item)
                  },
                  false,
                  true,
                ),
                item !== 'thinking' && mapped
                  ? button('packs.clear', function () {
                      var actions = { ...draft.manifest.actions }
                      delete actions[item]
                      editDraft({ ...draft, manifest: { ...draft.manifest, actions } })
                    })
                  : null,
              ),
            ),
          )
        }),
      ),
    )
    editorFooter = h(
      'footer',
      { className: 'dshh-packEditorFooter' },
      (function () {
        var mapped = Object.values(draft.manifest.actions).filter(Boolean).length
        return h(
          'div',
          { className: 'dshh-packProgress' },
          h(
            'span',
            { className: 'dshh-packProgressCount' },
            h('strong', {}, String(mapped)),
            ' / 30',
          ),
          h('span', { className: 'dshh-packProgressMeta' }, t('packs.mapped')),
          h(
            'span',
            {
              className: 'dshh-packProgressBar',
              role: 'progressbar',
              'aria-valuemin': 0,
              'aria-valuemax': 30,
              'aria-valuenow': mapped,
              'aria-label': t('packs.mapped'),
            },
            h('span', { style: { width: (mapped / 30) * 100 + '%' } }),
          ),
        )
      })(),
      h(
        'div',
        { className: 'dshh-packEditorActions' },
        editor.id
          ? button(
              'packs.saveNew',
              function () {
                save(true)
              },
              {
                className: 'dshh-packSecondary',
                disabled:
                  disabled ||
                  !draft.manifest.name.trim() ||
                  !draft.manifest.actions.thinking ||
                  Boolean(duplicate && !duplicateState[0]),
              },
            )
          : null,
        button(
          editor.id ? 'packs.save' : duplicate ? 'packs.saveNew' : 'packs.save',
          function () {
            save()
          },
          {
            className: 'dshh-packPrimary',
            disabled:
              disabled ||
              !draft.manifest.name.trim() ||
              !draft.manifest.version.trim() ||
              !draft.manifest.actions.thinking ||
              Boolean(duplicate && !duplicateState[0]),
          },
        ),
      ),
    )
  }
  return h(
    'section',
    {
      className: 'dshh-packs',
      'aria-busy': busy || phase === 'loading',
      'data-dsh-hud': 'expression-packs',
    },
    status(),
    h('div', { className: 'dshh-packBody' }, content),
    editorFooter,
  )
}
