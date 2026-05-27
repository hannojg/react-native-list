# React Native List

High-performance list primitives for React Native.

## Installation

> [!WARNING]
> Using this library requires you to use [react-native-worklets **bundle mode**](https://docs.swmansion.com/react-native-worklets/docs/bundleMode/setup).
> Please follow the setup instructions of it first, and make sure your app works before using react-native-list!

```sh
bun add react-native-list
```

## Development

First clone init the submodules:

```sh
git submodule update --init --recursive
```

Regenerate native Nitro specs after changing files in `src/specs` or `nitro.json`:

```sh
bun specs
```

Run TypeScript checks:

```sh
bun run typecheck
```
