import React, { useEffect, useMemo, useRef } from "react";
import { Dimensions, Text, useWindowDimensions, View } from "react-native";
import {
  createListDataSource,
  List,
  useLinearListLayout,
} from "react-native-list";
import type {
  ListContentEqualByType,
  ListDataSource,
  ListItem,
  ListRenderers,
} from "react-native-list";
import { ExampleHeader } from "../components";
import { styles } from "../styles";

type DynamicTextItem = ListItem<
  typeof dynamicTextItemType,
  {
    title: string;
    body: string;
    sentenceCount: number;
    accentColor: string;
    backgroundColor: string;
  }
>;

type DynamicTextVariant = {
  body: string;
  sentenceCount: number;
  accentColor: string;
  backgroundColor: string;
};

type DynamicTextConfig = {
  rowCount: number;
  variantCount: number;
};

const dynamicTextItemType = "dynamic-text";

const dynamicTextConfig: DynamicTextConfig = {
  rowCount: 10000,
  variantCount: 80,
};

const loremSentences = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "Integer vitae augue sed libero laoreet interdum.",
  "Praesent tempor lectus at sem dignissim, sit amet posuere orci porta.",
  "Curabitur efficitur metus vitae orci facilisis, a aliquam risus luctus.",
  "Nunc gravida velit non lorem pulvinar, vitae bibendum lacus varius.",
  "Aliquam erat volutpat, sed fermentum ipsum sed est cursus commodo.",
  "Vestibulum ante ipsum primis in faucibus orci luctus et ultrices.",
  "Donec gravida nibh ac mi sagittis, vel consequat ipsum feugiat.",
  "Suspendisse potenti, morbi porta lectus non libero luctus pretium.",
  "Maecenas finibus odio quis augue tristique, in vehicula velit blandit.",
  "Etiam ultricies orci non mi lacinia, at rhoncus lectus hendrerit.",
  "Sed luctus justo nec lectus cursus, sed pharetra erat consequat.",
];

const dynamicRowColors = [
  "#eef6ff",
  "#f0f8ed",
  "#fff4df",
  "#f7f0ff",
  "#ffeef2",
  "#ecfbf8",
];

const dynamicAccentColors = [
  "#1f6feb",
  "#2f7d32",
  "#b15f00",
  "#7450b4",
  "#c93552",
  "#00796b",
];

const minimumSentenceCount = 1;
const sentenceCountRange = 18;

function replaceDataSourceData(
  dataSource: ListDataSource<DynamicTextItem>,
  rows: readonly DynamicTextItem[],
  animated: boolean,
) {
  dataSource.replaceData(rows, animated);
}

function makeLorem(seed: number, sentenceCount: number) {
  let text = "";

  for (let index = 0; index < sentenceCount; index += 1) {
    const sentenceIndex = (seed + index * 3) % loremSentences.length;
    const sentence = loremSentences[sentenceIndex];

    if (text.length > 0) {
      text += " ";
    }

    text += sentence;
  }

  return text;
}

function makeSentenceCount(index: number) {
  const offset = (index * 7) % sentenceCountRange;
  return minimumSentenceCount + offset;
}

function makeDynamicVariants(count: number): DynamicTextVariant[] {
  const variants: DynamicTextVariant[] = [];

  for (let index = 0; index < count; index += 1) {
    const variantNumber = index + 1;
    const sentenceCount = makeSentenceCount(index);
    const colorIndex = index % dynamicRowColors.length;
    const accentIndex = index % dynamicAccentColors.length;
    const variant: DynamicTextVariant = {
      body: makeLorem(index, sentenceCount),
      sentenceCount,
      accentColor: dynamicAccentColors[accentIndex],
      backgroundColor: dynamicRowColors[colorIndex],
    };

    variants.push(variant);
  }

  return variants;
}

function makeDynamicRows(
  rowCount: number,
  variants: readonly DynamicTextVariant[],
): DynamicTextItem[] {
  const rows: DynamicTextItem[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const rowNumber = index + 1;
    const variantIndex = index % variants.length;
    const variant = variants[variantIndex];
    const key = "dynamic-text-" + String(rowNumber);
    const row: DynamicTextItem = {
      key,
      type: dynamicTextItemType,
      data: {
        title: "Generated text row " + String(rowNumber),
        body: variant.body,
        sentenceCount: variant.sentenceCount,
        accentColor: variant.accentColor,
        backgroundColor: variant.backgroundColor,
      },
    };

    rows.push(row);
  }

  return rows;
}

function renderDynamicRow(
  item: DynamicTextItem,
  contentWidth: number,
): React.ReactElement {
  "worklet";

  return (
    <View
      style={[
        styles.dynamicRow,
        {
          width: contentWidth,
          backgroundColor: item.data.backgroundColor,
        },
      ]}
    >
      <View style={styles.dynamicHeader}>
        <View
          style={[
            styles.dynamicAccent,
            {
              backgroundColor: item.data.accentColor,
            },
          ]}
        />
        <Text style={styles.dynamicTitle}>{item.data.title}</Text>
      </View>
      <Text style={styles.dynamicBody}>{item.data.body}</Text>
      <Text style={styles.dynamicMeta}>
        {item.data.sentenceCount} generated sentences
      </Text>
    </View>
  );
}

function makeDynamicRenderers(
  contentWidth: number,
): ListRenderers<DynamicTextItem> {
  return {
    [dynamicTextItemType]: {
      renderItemWorklet: ({ item }) => {
        "worklet";

        if (item == null) {
          return (
            <View
              style={{
                width: contentWidth,
              }}
            />
          );
        }
        return renderDynamicRow(item, contentWidth);
      },
    },
  };
}

function makeDynamicContentEqualByType(): ListContentEqualByType<DynamicTextItem> {
  return {
    [dynamicTextItemType]: (oldItem, newItem) => {
      if (oldItem.data.title !== newItem.data.title) {
        return false;
      }
      if (oldItem.data.body !== newItem.data.body) {
        return false;
      }
      if (oldItem.data.sentenceCount !== newItem.data.sentenceCount) {
        return false;
      }
      if (oldItem.data.accentColor !== newItem.data.accentColor) {
        return false;
      }
      if (oldItem.data.backgroundColor !== newItem.data.backgroundColor) {
        return false;
      }
      return true;
    },
  };
}

function getContentWidth(windowWidth: number) {
  let contentWidth = windowWidth - 32;

  if (contentWidth > 560) {
    contentWidth = 560;
  }

  if (contentWidth < 220) {
    contentWidth = 220;
  }

  return contentWidth;
}

export function DynamicTextHeightsExample(props: {
  onBack: () => void;
  title: string;
  subtitle: string;
}) {
  const { width } = useWindowDimensions();
  const contentWidth = getContentWidth(width);
  const variants = useMemo(() => {
    return makeDynamicVariants(dynamicTextConfig.variantCount);
  }, []);
  const rows = useMemo(() => {
    return makeDynamicRows(dynamicTextConfig.rowCount, variants);
  }, [variants]);
  const renderersByType = useMemo(() => {
    return makeDynamicRenderers(contentWidth);
  }, [contentWidth]);
  const contentEqualByType = useMemo(() => {
    return makeDynamicContentEqualByType();
  }, []);
  const dataSource = useMemo(() => {
    return createListDataSource<DynamicTextItem>({
      isContentEqualByType: contentEqualByType,
    });
  }, [contentEqualByType]);
  const layoutConfig = useMemo(() => {
    return {
      topInset: 16,
      bottomInset: 24,
      itemSpacing: 12,
      iosConfig: {
        estimatedItemSize: {
          // roughly two items in the viewport
          height: Dimensions.get("window").height / 2,
        },
      },
    };
  }, []);
  const layout = useLinearListLayout(layoutConfig);
  const didHydrateDataSource = useRef(false);
  const listKey = "dynamic-text-" + String(contentWidth);

  useEffect(() => {
    if (didHydrateDataSource.current) {
      return;
    }

    didHydrateDataSource.current = true;
    replaceDataSourceData(dataSource, rows, false);
  }, [dataSource, rows]);

  useEffect(() => {
    return () => {
      dataSource.release();
    };
  }, [dataSource]);

  return (
    <View style={styles.root}>
      <ExampleHeader
        title={props.title}
        subtitle={props.subtitle}
        onBack={props.onBack}
      />

      <View style={styles.summary}>
        <Text style={styles.summaryText}>{rows.length} rows</Text>
        <Text style={styles.summaryText}>
          {variants.length} measured variants
        </Text>
      </View>

      <List
        key={listKey}
        dataSource={dataSource}
        layout={layout}
        renderers={renderersByType}
        style={{
          flex: 1,
        }}
      />
    </View>
  );
}
