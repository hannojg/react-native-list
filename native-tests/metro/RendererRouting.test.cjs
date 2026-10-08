const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const { getReactNativeListMetroConfig } = require('../../package/metro-config')

const proxyPath = path.resolve(
  __dirname,
  '../../package/metro/RendererProxyThreadSwitch.js'
)
const proxySource = fs.readFileSync(proxyPath, 'utf8')
const reactNativePath = require.resolve('react-native/package.json')
const reactNativeDirectory = path.dirname(reactNativePath)

function loadProxy(runtimeKind, rootRenderer) {
  const imports = []
  const commands = []
  const runtimeGlobal = {
    __RUNTIME_KIND: runtimeKind,
    nativeFabricUIManager: {
      dispatchCommand(node, command, args) {
        commands.push({ node, command, args })
      },
    },
  }
  const context = {
    global: runtimeGlobal,
    module: { exports: {} },
    require(name) {
      imports.push(name)
      if (name === 'react-native/Libraries/ReactNative/RendererProxy') {
        assert.equal(
          runtimeKind,
          1,
          'The UI runtime imported RN’s main renderer'
        )
        return rootRenderer
      }
      if (
        name ===
        'react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactFabricPublicInstance'
      ) {
        return {
          getNativeTagFromPublicInstance(handle) {
            return handle.__nativeTag
          },
          getNodeFromPublicInstance(handle) {
            const instanceHandle = handle.__internalInstanceHandle
            return context.module.exports.getNodeFromInternalInstanceHandle(
              instanceHandle
            )
          },
        }
      }
      throw new Error(`Unexpected import: ${name}`)
    },
  }
  vm.runInNewContext(proxySource, context, { filename: proxyPath })
  return { proxy: context.module.exports, imports, commands }
}

test('Metro routes native commands, public refs, and DOM internals through the runtime proxy', () => {
  const consumers = [
    'Libraries/Utilities/codegenNativeCommands.js',
    'Libraries/ReactNative/ReactFabricPublicInstance/ReactFabricPublicInstance.js',
    'Libraries/Components/TextInput/TextInputState.js',
    'src/private/webapis/dom/nodes/internals/NodeInternals.js',
  ]
  const config = getReactNativeListMetroConfig({ resolver: {} })
  for (const consumer of consumers) {
    const context = {
      originModulePath: path.join(reactNativeDirectory, consumer),
      resolveRequest() {
        assert.fail(`Renderer import escaped the runtime proxy: ${consumer}`)
      },
    }
    const result = config.resolver.resolveRequest(
      context,
      '../ReactNative/RendererProxy',
      'android'
    )
    assert.equal(result.filePath, proxyPath)
  }
})

test('Metro leaves the proxy’s main-runtime renderer import untouched', () => {
  const original = { type: 'sourceFile', filePath: 'original-renderer.js' }
  const config = getReactNativeListMetroConfig({ resolver: {} })
  const context = {
    originModulePath: proxyPath,
    resolveRequest() {
      return original
    },
  }
  const result = config.resolver.resolveRequest(
    context,
    'react-native/Libraries/ReactNative/RendererProxy',
    'ios'
  )
  assert.equal(result, original)
})

test('UI native commands target the current Fabric node without importing the main renderer', () => {
  const runtime = loadProxy(2)
  const node = { tag: 1000001 }
  const handle = { __internalInstanceHandle: { stateNode: { node } } }
  const args = [true]
  runtime.proxy.dispatchCommand(handle, 'setPressed', args)
  assert.deepEqual(runtime.commands, [{ node, command: 'setPressed', args }])
  const importedMainRenderer = runtime.imports.includes(
    'react-native/Libraries/ReactNative/RendererProxy'
  )
  assert.equal(importedMainRenderer, false)

  const clonedNode = { tag: 1000001, revision: 2 }
  handle.__internalInstanceHandle.stateNode.node = clonedNode
  runtime.proxy.dispatchCommand(handle, 'setPressed', args)
  assert.equal(runtime.commands[1].node, clonedNode)
})

test('UI native commands do nothing for an unmounted ref', () => {
  const runtime = loadProxy(2)
  const handle = { __internalInstanceHandle: { stateNode: null } }
  runtime.proxy.dispatchCommand(handle, 'setPressed', [])
  assert.equal(runtime.commands.length, 0)
})

test('UI ref lookup returns native tags without loading RN’s renderer', () => {
  const runtime = loadProxy(2)
  const handle = { __nativeTag: 1000001 }
  const refTag = runtime.proxy.findNodeHandle(handle)
  const numericTag = runtime.proxy.findNodeHandle(1000001)
  const nullTag = runtime.proxy.findNodeHandle(null)
  const undefinedTag = runtime.proxy.findNodeHandle(undefined)
  const importedMainRenderer = runtime.imports.includes(
    'react-native/Libraries/ReactNative/RendererProxy'
  )
  assert.equal(refTag, 1000001)
  assert.equal(numericTag, 1000001)
  assert.equal(nullTag, null)
  assert.equal(undefinedTag, null)
  assert.equal(importedMainRenderer, false)
})

test('The main runtime keeps RN’s command dispatch and loads its renderer lazily', () => {
  const commands = []
  const renderer = {
    dispatchCommand(...args) {
      commands.push(args)
    },
  }
  const runtime = loadProxy(1, renderer)
  assert.equal(runtime.imports.length, 0)
  const handle = { root: true }
  const args = [true]
  runtime.proxy.dispatchCommand(handle, 'setPressed', args)
  runtime.proxy.dispatchCommand(handle, 'setPressed', args)
  assert.deepEqual(commands, [
    [handle, 'setPressed', args],
    [handle, 'setPressed', args],
  ])
  assert.equal(runtime.imports.length, 1)
  assert.equal(runtime.commands.length, 0)
})
