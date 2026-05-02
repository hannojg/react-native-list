# react-bundler

The core architectural piece is that we basically run react / react-reconciler on a seperate thread/runtime.
For that we need to bundle:

- react
- react-reconciler
- the Fabric config for react-reconciler

into one JS file that can be loaded in the runtime.

The "entry point" to that bundle is `./src/renderer/react/ReactFabricMirror.ts`.
The output of the bundler is `./src/renderer/react/ReactFabricMirror.bundle.js`.

There are some special things we have to do to make this bundle work:

- we bundle with bun because its awesome and fast. However, we have to strip any flow types as this doesn't play well with bun (see: `stip-flow-plugin.ts`)

- we don't want bun to include the source code of `react`/`react-reconciler` manually into our bundle file. As we are running in bundle mode, we
  want those modules to be actually required from the same place. Otherwise we'd ship two copies of react and react-reconciler in our bundle, which
  is not what we want. To achieve this, we use the `external` option of bun to mark those modules as external dependencies. This way, bun will not
  include their code in the bundle, but will instead require them at runtime.

- some internal react / react-native files we can't import as they are, as we kind of need to "patch" them to work on a seperate runtime. For that,
  we have some `./shims` files that `./react-submodule-resolve-plugin.ts` will resolve to instead of the original files.
  - We don't want any react devtools code to run in our seperate runtime. This code is build with the assumption of just runtime and stuff starts
    to fall badly apart if its included in our seperate runtime.
  - ReactFiberConfigFabric.js is something _we'd like to reuse_, however, last time i checked it was including too much stuff that was breaking too much… That's basically the main reason why we have to reimplement `ReactFabricMirror.ts`. I could see a future where either we overcome the limitations, _or_ in react provide a more minimal config which we can reuse without having to reimplement it ourselves.

- The problem is that `ReactFabric-*.js` in react-native is not isolated in react-native, but it's really generated in `facebook/react`. It's using/importing internal react code that we don't have access to from the npm packages. Hence, we need to build our `ReactFabricMirror.ts` also against the source code of react. That's why there is a `third_party/react/packages` folder in our repo, which is a git submodule of the react repository. This way we can import the internal files we need to import from react, and then we can use our `react-submodule-resolve-plugin.ts`.
