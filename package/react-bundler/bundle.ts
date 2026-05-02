import { stripFlowPlugin } from './strip-flow-plugin.ts'
import { reactSubmoduleResolvePlugin } from './react-submodule-resolve-plugin.ts'

console.log('Building ReactFabricMirror worklet...')
const res = await Bun.build({
  entrypoints: ['src/renderer/react/ReactFabricMirror.ts'],
  outdir: './src/renderer/react',
  naming: 'ReactFabricMirror.bundle.js',
  format: 'cjs',
  plugins: [reactSubmoduleResolvePlugin, stripFlowPlugin],
  external: [
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-reconciler',
    'react-native/Libraries/ReactPrivate/ReactNativePrivateInterface',
    'react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry',
    'react-native/src/private/webapis/dom/nodes/ReactNativeElement',
  ],
  banner: `
  var IS_REACT_ACT_ENVIRONMENT = false;
  var reportError = console.error;
  var MessageChannel = undefined;
  var __REACT_DEVTOOLS_GLOBAL_HOOK__ = undefined;
  var AbortController = undefined;

    `,
})
console.log('ReactFabricMirror worklet built.', res)
