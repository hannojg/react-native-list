import React from "react";
import { View, Text, useWindowDimensions, Image, Pressable, StyleSheet } from "react-native";
import { scheduleOnUI } from "react-native-worklets";
import {
  setup,
  UiList,
  uiListModule,
  uiManagerHelper,
} from "react-native-nitro-list";
import { callback, NitroModules } from "react-native-nitro-modules";

setup();

let isSetup = false;

// TODO: in bundle mode i can't move this to an import, as it would try
// to import the whole file, which tries to use NitroModules., which will
// crash as nitro modules can't init.
// Either I have to fix this, _or_, actually create NitroModules on the UI runtime.
const uiListModuleBoxed = NitroModules.box(uiListModule);
const capturedOnJS = global.nativeFabricUIManager;
const uiManagerHelperBoxed = NitroModules.box(uiManagerHelper);

function renderSync() {
  "worklet";
  const uiManagerHelperUnboxed = uiManagerHelperBoxed.unbox();
  uiManagerHelperUnboxed.renderSync(capturedOnJS);
}

export default function App() {
  const { height, width } = useWindowDimensions();
  const [count, setCount] = React.useState(0);
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <UiList
        style={{
          flex: 1,
          height,
          width,
        }}
        hybridRef={callback((ref) => {
          if (isSetup) return;
          isSetup = true;

          console.log("hybrid ref received!");
          scheduleOnUI(() => {
            "worklet";

            global.log(
              "Setting makeNativeViewCallback on UiListView on",
              typeof ref.setMakeNativeViewCallback
            );

            const tagToArrayPosition: Record<number, number> = {};
            global.tagToArrayPosition = tagToArrayPosition;
            const tagToItemId: Record<number, number> = {};
            global.tagToItemId = tagToItemId;

            const uiListModuleUnboxed = uiListModuleBoxed.unbox();

            // TODO: can we enable this somehow as a prop?
            ref.setMakeNativeViewCallback(uiListModuleUnboxed, () => {
              "worklet";

              const ref = global.React.createRef();
              global.itemId = (global.itemId ?? 0) + 1;
              const NewElement = (
                <View
                  key={"itemid-" + global.itemId}
                  ref={ref}
                  collapsable={false}
                  style={styles.item}
                >
                  <Pressable
                    style={{
                      flex: 1,
                    }}
                    collapsable={false}
                    onPressIn={() => {
                      "worklet"
                      global.log("onPressIn item with id ", global.itemId);
                    }}
                    onPress={() => {
                      "worklet"
                      global.log("onPress item with id ", global.itemId);
                    }}
                  >
                    <Text>Test</Text>
                    <Image
                      source={{
                        uri: "https://reactnative.dev/img/tiny_logo.png",
                      }}
                      onLoadEnd={() => {
                        "worklet"
                        global.log(`Image loaded for item id ${global.itemId}`)
                      }}
                      style={{ width: 50, height: 50 }}
                    />
                  </Pressable>
                </View>
              );

              if (global.elementsRendered == null) {
                global.elementsRendered = [];
              }
              const newLength = global.elementsRendered.push(NewElement);
              const currentIndex = newLength - 1;

              const ParentContainer = <View>{global.elementsRendered}</View>;

              // global.log("Render result:");
              // global.log(ParentContainer.props.children);

              global.Render(ParentContainer, () => {
                global._log("Render complete");
              });

              if (ref.current == null) {
                throw new Error("Ref is null after render");
              }

              // const shadowNode = ref.current.node; // jsi::Object NativeState ShadowNodeWrapper
              global.log("Ref current:", Object.keys(ref.current));
              const tag = ref.current.__nativeTag;
              global.log("Ref current nativeTag: ", tag);
              tagToArrayPosition[tag] = currentIndex;
              tagToItemId[tag] = global.itemId;

              // cause a sync render to create the actual native view
              const start = performance.now();
              renderSync();
              global.log("renderSync took ", performance.now() - start, "ms");

              return tag;
            });

            ref.setUpdateViewCallback(
              uiListModuleUnboxed,
              (reactTag: number, index: number) => {
                "worklet";
                global.log(
                  `[JS] Update view callback called for tag ${reactTag} at index ${index}`,
                  tagToArrayPosition
                );

                const itemId = tagToItemId[reactTag];
                if (itemId == null) {
                  throw new Error("No itemId for tag " + reactTag);
                }

                // "Rerender the element"
                const NewElement = (
                  <View
                    key={"itemid-" + itemId}
                    collapsable={false}
                    style={styles.item}
                  >
                    <Pressable
                      collapsable={false}
                      style={{
                        flex: 1,
                      }}
                      onPressIn={() => {
                        global.log("onPressIn item with index", index);
                      }}
                      onPress={() => {
                        global.log("onPress item with index", index);
                      }}
                    >
                      <Text>Item #{index}</Text>
                      <Image
                        source={{
                          uri: "https://reactnative.dev/img/tiny_logo.png",
                        }}
                        onLoadEnd={() => {
                          "worklet"
                          global.log(`Image loaded for item id ${global.itemId}, index ${index}`)
                        }}
                        style={{ width: 50, height: 50 }}
                      />
                    </Pressable>
                  </View>
                );

                // Update the new element in the global array
                const position = tagToArrayPosition[reactTag];
                if (position == null) {
                  throw new Error("No position for tag " + reactTag);
                }
                global.elementsRendered[position] = NewElement;

                // Update the parent container
                const ParentContainer = <View>{global.elementsRendered}</View>;

                global.Render(ParentContainer, () => {
                  global._log("Update Render complete");
                });

                // Cause a sync render to update the actual native view
                const start = performance.now();
                renderSync();
                global.log(
                  "Update renderSync took ",
                  performance.now() - start,
                  "ms"
                );

                return true;
              }
            );
          });
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    width: 100,
    height: 100,
    backgroundColor: "red",
  },
})

// import { View, Text } from "react-native";
// import { scheduleOnUI } from "react-native-worklets";
// import { setup } from "react-native-nitro-list";
  
// setup();

// scheduleOnUI(() => {
//   "worklet";
//   global._log("View2: " + View);
// })

// export default function App() {
//   return (
//     <View
//       style={{
//         flex: 1,
//         alignItems: "center",
//         justifyContent: "center",
//       }}
//     >
//       <Text>Test</Text>
//     </View>
//   );
// }
