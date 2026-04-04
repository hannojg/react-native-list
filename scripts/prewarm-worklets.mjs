import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { transformFileSync } from '@babel/core'

const require = createRequire(import.meta.url)

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const exampleRoot = path.join(repoRoot, 'example')
const exampleBabelConfig = path.join(exampleRoot, 'babel.config.js')
const workspacePackageRoot = path.join(repoRoot, 'package')
const rootWorkletsPackageJsonPath = path.join(
  repoRoot,
  'node_modules',
  'react-native-worklets',
  'package.json'
)
const rootWorkletsRoot = path.dirname(rootWorkletsPackageJsonPath)

const requestedPlatforms = process.argv.includes('--platform')
  ? [process.argv[process.argv.indexOf('--platform') + 1]]
  : ['ios', 'android']

function collectFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath))
      continue
    }
    if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      files.push(fullPath)
    }
  }
  return files
}

function maybeWorkletFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  return (
    source.includes("'worklet'") ||
    source.includes('"worklet"') ||
    source.includes('scheduleOnUI(') ||
    source.includes('runOnUI(')
  )
}

const filesToTransform = new Set([path.join(exampleRoot, 'App.tsx')])
for (const filePath of collectFiles(path.join(workspacePackageRoot, 'src'))) {
  if (maybeWorkletFile(filePath)) {
    filesToTransform.add(filePath)
  }
}
for (const filePath of collectFiles(path.join(rootWorkletsRoot, 'src'))) {
  if (maybeWorkletFile(filePath)) {
    filesToTransform.add(filePath)
  }
}

const workletsDir = path.join(rootWorkletsRoot, '.worklets')

// Temporary workaround for bundle-mode preview:
// Metro resolves `react-native-worklets/.worklets/<hash>.js` during graph
// construction, but the files are normally emitted as a side-effect of Babel
// transforms during that same bundle pass. On cold builds this means Metro can
// try to resolve a chunk before it exists. Prewarming forces Babel to emit the
// generated worklet modules ahead of Metro for both dev and release callers.
fs.mkdirSync(workletsDir, { recursive: true })

for (const platform of requestedPlatforms) {
  for (const isDev of [true, false]) {
    for (const filePath of filesToTransform) {
      transformFileSync(filePath, {
        cwd: exampleRoot,
        filename: filePath,
        configFile: exampleBabelConfig,
        babelrc: false,
        caller: {
          name: 'metro',
          bundler: 'metro',
          platform,
          isServer: false,
          isReactServer: false,
          baseUrl: '',
          routerRoot: 'app',
          isDev,
          engine: 'hermes',
          projectRoot: exampleRoot,
          isNodeModule: filePath.includes(`${path.sep}node_modules${path.sep}`),
          isHMREnabled: isDev,
          metroSourceType: 'module',
          supportsStaticESM: true,
        },
      })
    }
  }
}

console.log(
  `[prewarm-worklets] generated bundle-mode worklets for ${requestedPlatforms.join(', ')} from ${filesToTransform.size} files`
)
