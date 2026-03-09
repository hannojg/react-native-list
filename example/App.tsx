import React from "react";
import {
  View,
  Text,
  useWindowDimensions,
  Image,
  Pressable,
  StyleSheet,
} from "react-native";
import {
  setup,
  UiList,
} from "react-native-nitro-list";

setup();

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
        renderItem={(item, index) => (
          <Pressable
            collapsable={false}
            style={styles.item}
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
                "worklet";
                global.log(`Image loaded for item id index ${index}`);
              }}
              style={{ width: 50, height: 50 }}
            />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    width: 100,
    height: 80,
    backgroundColor: "red",
  },
});