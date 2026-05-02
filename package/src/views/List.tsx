import React, { useRef } from "react";
import { UiListHostComponent } from "./UiListHostComponent";
import { callback } from "react-native-nitro-modules";
import { scheduleOnUI } from "react-native-worklets";
import { renderSyncWorklet, uiListModuleBoxed } from "../renderer/RenderHelper";
import { View, ViewStyle } from "react-native";

export interface ListProps {
    renderItemWorklet: (itemInfo?: {
        index: number;
        data?: any;
    }) => React.ReactElement;
    style?: ViewStyle;
}

export function List({renderItemWorklet, style}: ListProps) {
    let isSetup = useRef(false);

    return (
        <UiListHostComponent
        style={style}
        hybridRef={callback((ref) => {
          if (isSetup.current) return;
          isSetup.current = true;

          console.log("hybrid ref received!");
          scheduleOnUI(() => {
            "worklet";

            global.log(
              "Setting makeNativeViewCallback on UiListView on",
              typeof ref.setMakeNativeViewCallback
            );

            const tagToArrayPosition: Record<number, number> = {};
            const tagToItemId: Record<number, number> = {};
            let nextItemId = 0; // TODO: this might needs to become a mutable, let's see
            const elementsRendered: React.ReactElement[] = [];

            const uiListModuleUnboxed = uiListModuleBoxed.unbox();

            // TODO: can we enable this somehow as a prop?
            ref.setMakeNativeViewCallback(uiListModuleUnboxed, () => {
              const ref = global.React.createRef();
              const itemId = nextItemId++;
              const newElement = renderItemWorklet(undefined);
              const newElementWithKey = global.React.cloneElement(newElement, {
                // by creating the views with a key, we can later just update this view specifically
                key: "itemid-" + itemId,
                // ref needed to get native react tag after rendering later
                ref,
                // important so the native layer can find this view
                collapsable: false,
              });

              const newLength = elementsRendered.push(newElementWithKey);
              const currentIndex = newLength - 1;

              // We have to render n-items in a single view:
              const ParentContainer = <View>{elementsRendered}</View>;

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
              tagToItemId[tag] = itemId;

              // cause a sync render to create the actual native view
              const start = performance.now();
              renderSyncWorklet();
              global.log("renderSync took ", performance.now() - start, "ms");

              return tag;
            });

            ref.setUpdateViewCallback(
              uiListModuleUnboxed,
              (reactTag: number, index: number) => {
                global.log(
                  `[JS] Update view callback called for tag ${reactTag} at index ${index}`,
                  tagToArrayPosition
                );

                const itemId = tagToItemId[reactTag];
                if (itemId == null) {
                  throw new Error("No itemId for tag " + reactTag);
                }

                // "Rerender the element"
                const newElement = renderItemWorklet({
                    index,
                    data: null, // TODO
                });
                const newElementWithKey = global.React.cloneElement(newElement, {
                  key: "itemid-" + itemId,
                  collapsable: false, // important so the native layer can find this view
                });

                // Update the new element in the global array
                const position = tagToArrayPosition[reactTag];
                if (position == null) {
                  throw new Error("No position for tag " + reactTag);
                }
                elementsRendered[position] = newElementWithKey;

                // TODO: can we unify this following part?

                // Update the parent container
                const ParentContainer = <View>{elementsRendered}</View>;

                global.Render(ParentContainer, () => {
                  global._log("Update Render complete");
                });

                // Cause a sync render to update the actual native view
                const start = performance.now();
                renderSyncWorklet();
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
    )
}