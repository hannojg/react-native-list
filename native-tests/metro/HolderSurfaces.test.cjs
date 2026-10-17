const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const filename = path.resolve(__dirname, '../../package/src/views/List.tsx')
const source = fs.readFileSync(filename, 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
}).outputText

// Exercise the actual List callbacks, not a duplicate holder-store implementation.
// Native mounting is deliberately mocked; the example still needs real-device checks.
function mountList(options = {}) {
  const effects = []
  const roots = new Map()
  const registered = new Set()
  const renders = []
  const disposed = []
  let nextTag = 100
  let callbacks
  const react = {
    useCallback: (value) => value,
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useEffect: (effect) => effects.push(effect),
    createRef: () => ({ current: null }),
    cloneElement: (element, props) => ({ ...element, props: { ...element.props, ...props } }),
  }
  const renderer = {
    reactRender(surfaceId, element) {
      renders.push(surfaceId)
      roots.set(surfaceId, element)
      const ref = element.props.children.props.ref
      if (ref && ref.current == null) ref.current = { __nativeTag: nextTag++ }
    },
    disposeReactRoot(surfaceId) {
      assert.equal(registered.has(surfaceId), true, 'Unregistered before React cleanup')
      disposed.push(surfaceId)
      options.onDispose?.(surfaceId, callbacks)
      roots.delete(surfaceId)
    },
  }
  const native = {
    setListCallbacks(_module, create, update, dispose) { callbacks = { create, update, dispose } },
    setDataSource() {},
    setLayout() {},
    disposeRendererSurface() {
      const ids = roots.keys()
      const surfaces = Array.from(ids)
      for (const surfaceId of surfaces) callbacks.dispose(surfaceId)
    },
  }
  const imports = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { View: 'View' },
    'react-native-nitro-modules': {
      callback: (fn) => fn,
      NitroModules: { box: (value) => ({ unbox: () => value }) },
    },
    'react-native-worklets': {
      createShareable: (_runtime, value) => ({ isHost: true, value }),
      scheduleOnUI: (fn) => fn(),
      UIRuntimeId: 2,
    },
    '../ListDataSource': {
      getNativeListDataSource: (value) => value,
      addListDataSourceMutationListener: () => () => {},
    },
    '../ListLayout': { createLinearListLayout: () => ({ release() {}, __nativeLayout: {} }) },
    '../hooks/useChangeEffect': { useChangeEffect() {} },
    '../renderer/fabric/RenderHelper': {
      completeRootSyncWorklet() {},
      registerManagedSurfaceWorklet: (id) => registered.add(id),
      unregisterManagedSurfaceWorklet: (id) => registered.delete(id),
      uiListModuleBoxed: { unbox: () => ({}) },
    },
    '../renderer/react/ReactFabricRenderer': { getReactFabricRenderer: () => renderer },
    './UiListHostComponent': { UiListHostComponent: 'Host' },
  }
  const module = { exports: {} }
  const context = vm.createContext({
    module, exports: module.exports, React: react,
    require(name) {
      const exists = Object.hasOwn(imports, name)
      assert.ok(exists, `Unexpected import: ${name}`)
      return imports[name]
    },
  })
  vm.runInContext(compiled, context, { filename })
  const renderers = { row: { renderItemWorklet: ({ item }) => ({ type: 'Row', props: { text: item?.key } }) } }
  const host = module.exports.List({ dataSource: {}, renderers })
  host.props.hybridRef(native)
  const effectResults = effects.map((effect) => effect())
  const cleanups = effectResults.filter(Boolean)
  return { roots, registered, renders, disposed, callbacks, unmount: () => cleanups.forEach((fn) => fn()) }
}

test('creating and rebinding more than 20 holders submits only the selected root', () => {
  const list = mountList()
  const tags = []
  for (let id = 1; id <= 64; id++) {
    const before = list.renders.length
    const tag = list.callbacks.create('row', id)
    tags.push(tag)
    const submitted = list.renders.slice(before)
    assert.deepEqual(submitted, [id])
  }
  const sibling = list.roots.get(1)
  list.renders.length = 0
  list.callbacks.update(tags[31], { type: 'row', key: 'replacement' }, 500)
  assert.deepEqual(list.renders, [32])
  const unchanged = list.roots.get(1)
  const updated = list.roots.get(32)
  assert.equal(unchanged, sibling)
  assert.equal(updated.props.children.props.text, 'replacement')
  assert.equal(list.roots.size, 64)
})

test('retiring one holder unmounts only its root and removes its tag lookup', () => {
  const list = mountList()
  const first = list.callbacks.create('row', 1)
  const second = list.callbacks.create('row', 2)
  const retired = list.callbacks.dispose(1)
  const repeated = list.callbacks.dispose(1)
  assert.equal(retired, true)
  assert.equal(repeated, false)
  assert.deepEqual(list.disposed, [1])
  assert.throws(() => list.callbacks.update(first, { type: 'row', key: 'old' }, 0), /No reactKey/)
  const rebound = list.callbacks.update(second, { type: 'row', key: 'live' }, 1)
  const registered = list.registered.has(2)
  assert.equal(rebound, true)
  assert.equal(registered, true)
})

test('list teardown unmounts every retained root and can repeat', () => {
  const list = mountList()
  for (let id = 1; id <= 40; id++) list.callbacks.create('row', id)
  list.unmount()
  assert.equal(list.disposed.length, 40)
  assert.equal(list.registered.size, 0)
  assert.equal(list.roots.size, 0)
  list.unmount()
  assert.equal(list.disposed.length, 40)
  assert.throws(() => list.callbacks.create('row', 41), /disposed/)
})

test('retired holders can be replaced repeatedly without retaining their roots', () => {
  const list = mountList()
  for (let id = 1; id <= 80; id++) {
    const tag = list.callbacks.create('row', id)
    list.callbacks.update(tag, { type: 'row', key: 'same-item' }, 0)
    list.callbacks.dispose(id)
    assert.equal(list.roots.size, 0)
    assert.equal(list.registered.size, 0)
  }
  assert.equal(list.disposed.length, 80)
})

test('retirement cannot re-enter the same root while React is unmounting it', () => {
  const list = mountList({
    onDispose(surfaceId, callbacks) {
      const repeated = callbacks.dispose(surfaceId)
      assert.equal(repeated, false)
    },
  })
  list.callbacks.create('row', 1)
  list.callbacks.dispose(1)
  assert.deepEqual(list.disposed, [1])
  assert.equal(list.registered.size, 0)
})

test('failed React cleanup still unregisters the retired surface', () => {
  const list = mountList({ onDispose() { throw new Error('cleanup failed') } })
  list.callbacks.create('row', 1)
  assert.throws(() => list.callbacks.dispose(1), /cleanup failed/)
  assert.equal(list.registered.size, 0)
  const repeated = list.callbacks.dispose(1)
  assert.equal(repeated, false)
})
