import React, { useMemo } from 'react'
import {
  View,
  Text,
  useWindowDimensions,
  Image,
  Pressable,
  StyleSheet,
} from 'react-native'
import { List, useLinearListLayout, useListDataSource } from 'react-native-list'
import type { ListItem, ListRenderers } from 'react-native-list'
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

type TextRowItem = ListItem<'text', {
  title: string
}>

type ImageRowItem = ListItem<'image', {
  title: string
  imageUri: string
}> 
type RowItem = TextRowItem | ImageRowItem

const renderers: ListRenderers<RowItem> = {
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
            <Text>{item?.data.title}</Text>
          </Pressable>
        </View>
      )
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
            <Text>{item?.data.title}</Text>
            <Image
              source={{
                uri: item?.data.imageUri,
              }}
              onLoadEnd={() => {
                globalThis.log('Image loaded for item ', item?.key)
              }}
              style={styles.image}
            />
          </Pressable>
        </View>
      )
    },
  },
}

export default function App() {
  const { height, width } = useWindowDimensions()

  const data = useMemo<RowItem[]>(() => {
    const items: RowItem[] = []
    for (let index = 0; index < 1000; index++) {
      if (index % 5 === 0) {
        items.push({
          key: String(index),
          type: 'image',
          width: 140,
          height: 140,
          data: {
            title: `Item #${index}`,
            imageUri: 'https://reactnative.dev/img/tiny_logo.png',
          },
        })
        continue
      }

      items.push({
        key: String(index),
        type: 'text',
        width: 140,
        height: 80,
        data: {
          title: `Item #${index}`,
        },
      })
    }
    return items
  }, [])

  const dataSource = useListDataSource<RowItem>({
    data,
  })

  const layout = useLinearListLayout()

  return (
    <View style={styles.root}>
      <List
        dataSource={dataSource}
        layout={layout}
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
