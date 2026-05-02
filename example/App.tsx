import React from "react";
import {
  View,
  Text,
  useWindowDimensions,
  Image,
  Pressable,
  StyleSheet,
} from "react-native";
import { List } from "react-native-list";
import "react-native-list/src/privateGlobals"

export default function App() {
  const { height, width } = useWindowDimensions();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <List
        style={{
          flex: 1,
          // TODO: is this really needed?
          height,
          width,
        }}
        renderItemWorklet={(itemInfo) => {
          "worklet";

          return (
            <View style={styles.item}>
              <Pressable
                style={{
                  flex: 1,
                }}
                collapsable={false}
                onPressIn={() => {
                  "worklet";
                  globalThis.log("onPressIn item with id ", itemInfo?.index);
                }}
                onPress={() => {
                  "worklet";
                  globalThis.log("onPress item with id ", itemInfo?.index);
                }}
              >
                <Text>{itemInfo?.index != null ? `Item #${itemInfo.index}` : ""}</Text>
                <Image
                  source={{
                    uri: "https://reactnative.dev/img/tiny_logo.png",
                  }}
                  onLoadEnd={() => {
                    "worklet";
                    globalThis.log(`Image loaded for item id ${itemInfo?.index}`);
                  }}
                  style={{ width: 50, height: 50 }}
                />
              </Pressable>
            </View>
          );
        }}
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
});