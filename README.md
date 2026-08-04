# React Native List

High-performance list for React Native.

- 📱 True native [`UICollectionView`](https://developer.apple.com/documentation/uikit/uicollectionview) on iOS
- 🤖 True native [`RecyclerView`](https://developer.android.com/develop/ui/views/layout/recyclerview) on android
- 🔄 Synchronous rendering of react components using "worklet" function components
- 🐎 Platform native animations out of the box for list item transitions
- 📉 Low memory usage due to true native view recycling

https://github.com/user-attachments/assets/4a2684bf-7337-45e0-bb17-ee7b8a382943

## Installation

> [!WARNING]
> Using this library requires you to use [react-native-worklets **bundle mode**](https://docs.swmansion.com/react-native-worklets/docs/bundleMode/setup).
>
> - Please follow [the setup instructions of it first](https://docs.swmansion.com/react-native-worklets/docs/bundleMode/setup), and make sure your app works before using react-native-list!
> - You need at least version 0.10.0!

Once that's out of the way, you can start with the regular setup of the library:

```sh
bun add react-native-list@alpha
```

### Configuring Metro

Simply wrap your config with `getReactNativeListMetroConfig` in `metro.config.js`:

```js
const { getDefaultConfig } = require("expo/metro-config");
const {
  getBundleModeMetroConfig,
} = require("react-native-worklets/bundleMode");
const {
  getReactNativeListMetroConfig,
} = require("react-native-list/metro-config");

let config = getDefaultConfig(__dirname);
config = getBundleModeMetroConfig(config);
// ⚠️ Make sure to apply this _after_ the bundle mode metro config:
config = getReactNativeListMetroConfig(config);
module.exports = config;
```

> [!NOTE]
> If you're using expo you need to make sure to enable inline requires in your metro config:
>
> ```js
> const config = {
>   transformer: {
>     getTransformOptions: async () => ({
>       transform: {
>         // Bundle mode only works with inline support
>         // See: https://github.com/software-mansion/react-native-reanimated/issues/8904
>         inlineRequires: true,
>       },
>     }),
>   },
> };
> ```
>
> If you don't see a `metro.config.js` in your project, see [expo's documentation on modifying metro](https://docs.expo.dev/guides/customizing-metro/).

## Simple example

```tsx
import {  List, useLinearListLayout, useListDataSource } from "react-native-list";
import type { ListItem, ListRenderer } from "react-native-list";

type TextItem = ListItem<
  // The type of your list item
  "text",
  // The data shape for that list item:
  {
    text: string;
  }
>;

type ImageItem = ...

type Items = TextItem | ImageItem

// Provide render functions for your item types:
const renderers: ListRenderer<Items> = {
  text: {
    renderItemWorklet: ({ item }) => {
      "worklet"; // 👀 Note: our render function is a worklet!

      return (
        // Though being in a worklet, you can use any component you like in here
        <View
          style={{
            justifyContent: "center",
            paddingHorizontal: 16,
            backgroundColor: "#f6f8fa",
          }}
        >
          // Note: there are two phases: 1. View creation (without data), 2. binding data to the views
          //       that's why item.data can be undefined because the native list is requesting to
          //       create the view hierarchy, but without any data yet.
          <Text>{item.data?.text}</Text>
        </View>
      );
    },
  },
  image: ...
};

export function ExampleList() {
  const dataSource = useListDataSource<Items>({
    data: [...],
  });
  const layout = useLinearListLayout({
    itemSpacing: 8,
  });

  return (
    <List
      dataSource={dataSource}
      layout={layout}
      renderers={renderers}
      style={{
        flex: 1,
      }}
    />
  );
}
```

## API

XXXX TODO

## Benchmark

> Scrolling as fast as possible. Release build. iPhone 13 Pro.

https://github.com/user-attachments/assets/aa7c2c41-b7ac-4d8b-9eb1-fd8b2feda4de

|           | Legend List | react-native-list |
| --------- | ----------- | ----------------- |
| FPS       | 60          | 60                |
| Memory    | 86.89mb     | 86.88mb           |
| Total CPU | 144.69%     | 185.93%           |
| Can blank | yes         | no                |

Performance difference is best described as this:

- With react-native-list you will never get a blank. However, instead, you could see UI thread drop frames if your item rendering is too heavy.
- With Legend List you may see blanks, however, its way less likely you will drop frames on the UI thread (instead your JS thread might be fully busy, but you won't really get to notice that on the UIs performance)

## Known performance pitfalls

- For iOS when using dynamically sized items, try to use `iosConfig.estimatedItemSize` to roughly specify how many items will be visible in the view port. This can help a lot with performance.
- When specifying sizes for items use `useLinearListLayout({})` inset configs. Avoid setting a width in the styles that exceed the actual available view port width.
- If you can, always provide item sizes upfront. With that the performance will be unbeatable.
- In your item render function, when you have no item data yet it is tempting to return early with `null` or just an empty `<View />`. However, this is super bad for performance. There are two phases for native lists. First is view creation, where you're expected to create the view hierarchy for your item - just not with any data yet (so that any data could be bind to it). The second phase is actually binding data to the view. This will result in a simple "update props" operation on the native side instead of needing to create a new view hierarchy. Example:

❌ **Bad**:

```jsx
renderItemWorklet: ({ item }) => {
  "worklet";
  if (item == null) return <View />
  return (
    <View>
      <Image src={item.image}>
      <Text>{item.userName}</Text>
    </View>
  )
```

✅ **Good**:

```jsx
renderItemWorklet: ({ item }) => {
  "worklet";
  return (
    <View>
      <Image src={item?.image}>
      <Text>{item?.userName ?? ""}</Text>
    </View>
  )
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
