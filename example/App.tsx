import React, { useMemo, useRef } from 'react'
import {
  View,
  Text,
  useWindowDimensions,
  Image,
  Pressable,
  StyleSheet,
} from 'react-native'
import { List, ListRef, ListRenderer } from 'react-native-list'
import type { AnyMap } from 'react-native-nitro-modules'
import 'react-native-list/src/privateGlobals'

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  textItem: {
    width: 140,
    height: 80,
    backgroundColor: 'red',
  },
  imageItem: {
    width: 140,
    height: 140,
    backgroundColor: 'red',
  },
  image: {
    width: 50,
    height: 50,
  },
})


type RowType = 'text' | 'image'
type RowItem = AnyMap & {
  id: string
  type: RowType
  title: string
}

const renderers: Record<RowType, ListRenderer<RowItem, RowType>> = {
  text: {
    renderItemWorklet: ({ item, index }) => {
      'worklet'

      return (
        <View style={styles.textItem}>
          <Pressable
            collapsable={false}
            onPress={() => {
              globalThis.log('Pressed text item ', index)
            }}
          >
            <Text>{item?.title}</Text>
          </Pressable>
        </View>
      )
    },
    isContentEqualWorklet: (oldItem, newItem) => {
      'worklet'

      return oldItem.title === newItem.title
    },
  },
  image: {
    renderItemWorklet: ({ item, index }) => {
      'worklet'

      return (
        <View style={styles.imageItem}>
          <Pressable
            collapsable={false}
            onPress={() => {
              globalThis.log('Pressed image item ', index)
            }}
          >
            <Text>{item?.title}</Text>
            <Image
              source={{
                uri: 'https://reactnative.dev/img/tiny_logo.png',
              }}
              onLoadEnd={() => {
                globalThis.log('Image loaded for item ', item?.id)
              }}
              style={styles.image}
            />
          </Pressable>
        </View>
      )
    },
    isContentEqualWorklet: (oldItem, newItem) => {
      'worklet'

      return oldItem.title === newItem.title
    },
  },
}

export default function App() {
  const listRef = useRef<ListRef<RowItem>>(null)
  const { height, width } = useWindowDimensions()

  const data = useMemo<RowItem[]>(() => {
    const items: RowItem[] = []
    for (let index = 0; index < 1000; index++) {
      const type: RowType = index % 5 === 0 ? 'image' : 'text'
      items.push({
        id: String(index),
        type,
        title: `Item #${index}`,
      })
    }
    return items
  }, [])

  return (
    <View style={styles.root}>
      <List
        ref={listRef}
        data={data}
        keyExtractor={(item) => {
          return item.id
        }}
        getItemType={(item) => {
          return item.type
        }}
        getItemSize={() => {
          return {
            width: 140,
          }
        }}
        renderers={renderers}
        style={{
          flex: 1,
          height,
          width,
        }}
      />
    </View>
  )
}
