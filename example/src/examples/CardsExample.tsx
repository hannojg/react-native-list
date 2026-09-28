import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Image,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { scheduleOnRN } from "react-native-worklets";
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
import { buildCards } from "./cardsData";
import type { Card } from "./cardsData";

type CardsHeaderItem = ListItem<typeof cardsHeaderItemType, {}>;

type CardsCardData = Card & {
  isExpanded: boolean;
};

type CardsCardItem = ListItem<typeof cardsCardItemType, CardsCardData>;

type CardsItem = CardsHeaderItem | CardsCardItem;

const cardsHeaderItemType = "cards-header";
const cardsCardItemType = "cards-card";
const cardsEstimatedItemLength = Dimensions.get("window").height / 4;

function makeCardsRows(cards: readonly Card[]): CardsItem[] {
  const headerItem: CardsHeaderItem = {
    key: "cards-header",
    type: cardsHeaderItemType,
    data: {},
  };
  const rows: CardsItem[] = [headerItem];

  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index]!;
    const row: CardsCardItem = {
      key: card.id,
      type: cardsCardItemType,
      data: {
        ...card,
        isExpanded: false,
      },
    };

    rows.push(row);
  }

  return rows;
}

function renderCardsHeader(contentWidth: number): React.ReactElement {
  "worklet";

  return (
    <View
      style={{
        alignItems: "center",
        width: contentWidth,
        paddingVertical: 8,
      }}
    >
      <View style={styles.cardsHeaderBlock} />
    </View>
  );
}

function renderCard(
  item: CardsCardItem | undefined,
  contentWidth: number,
  onToggleExpanded: (key: string) => void,
): React.ReactElement {
  "worklet";

  let authorName = "";
  let itemId = "";
  let timestamp = "";
  let title = "";
  let body = "";
  let expandedBody = "";
  let avatarSource = {};

  if (item != null) {
    authorName = item.data.authorName;
    itemId = item.data.id;
    timestamp = item.data.timestamp;
    title = item.data.title;
    body = item.data.body;
    avatarSource = {
      uri: item.data.avatarUrl,
    };

    if (item.data.isExpanded) {
      expandedBody = item.data.expandedBody;
    }
  }

  return (
    <View
      style={[
        styles.cardsItemOuter,
        {
          width: contentWidth,
        },
      ]}
    >
      {/* <Pressable
        onPress={() => {
          if (item == null) {
            return;
          }

          scheduleOnRN(onToggleExpanded, item.key);
        }}
      > */}
      <View style={styles.cardsItemContainer}>
        <View style={styles.cardsHeaderContainer}>
          <Image source={avatarSource} style={styles.cardsAvatar} />
          <View style={styles.cardsHeaderText}>
            <Text style={styles.cardsAuthorName}>
              {authorName} {itemId}
            </Text>
            <Text style={styles.cardsTimestamp}>{timestamp}</Text>
          </View>
        </View>

        <Text style={styles.cardsItemTitle}>{title}</Text>
        <Text style={styles.cardsItemBody}>
          {body}
          {expandedBody}
        </Text>
        <View style={styles.cardsItemFooter}>
          <Text style={styles.cardsFooterText}>💗 42</Text>
          <Text style={styles.cardsFooterText}>💬 12</Text>
          <Text style={styles.cardsFooterText}>🔁 8</Text>
        </View>
      </View>
      {/* </Pressable> */}
    </View>
  );
}

function makeCardsRenderers(
  contentWidth: number,
  onToggleExpanded: (key: string) => void,
): ListRenderers<CardsItem> {
  return {
    [cardsHeaderItemType]: {
      renderItemWorklet: () => {
        "worklet";

        return renderCardsHeader(contentWidth);
      },
    },
    [cardsCardItemType]: {
      renderItemWorklet: ({ item }) => {
        "worklet";

        return renderCard(item, contentWidth, onToggleExpanded);
      },
    },
  };
}

function makeCardsContentEqualByType(): ListContentEqualByType<CardsItem> {
  return {
    [cardsHeaderItemType]: () => {
      return true;
    },
    [cardsCardItemType]: (oldItem, newItem) => {
      if (oldItem.data.id !== newItem.data.id) {
        return false;
      }

      if (oldItem.data.isExpanded !== newItem.data.isExpanded) {
        return false;
      }

      return true;
    },
  };
}

function replaceDataSourceData(
  dataSource: ListDataSource<CardsItem>,
  rows: readonly CardsItem[],
  animated: boolean,
) {
  dataSource.replaceData(rows, animated);
}

export function CardsExample(props: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const contentWidth = width;
  const cards = useMemo(() => {
    return buildCards();
  }, []);
  const initialRows = useMemo(() => {
    return makeCardsRows(cards);
  }, [cards]);
  const [rows, setRows] = useState(initialRows);
  const rowsRef = useRef(rows);
  const contentEqualByType = useMemo(() => {
    return makeCardsContentEqualByType();
  }, []);
  const dataSource = useMemo(() => {
    return createListDataSource<CardsItem>({
      isContentEqualByType: contentEqualByType,
    });
  }, [contentEqualByType]);
  const toggleExpanded = useCallback(
    (key: string) => {
      const currentRows = rowsRef.current;
      const rowIndex = currentRows.findIndex((row) => {
        return row.key === key;
      });

      if (rowIndex === -1) {
        throw new Error("Missing card row " + key);
      }

      const currentRow = currentRows[rowIndex]!;

      if (currentRow.type !== cardsCardItemType) {
        throw new Error("Expected card row " + key);
      }

      const nextRows = currentRows.slice();
      const nextRow: CardsCardItem = {
        ...currentRow,
        data: {
          ...currentRow.data,
          isExpanded: !currentRow.data.isExpanded,
        },
      };

      nextRows[rowIndex] = nextRow;
      rowsRef.current = nextRows;
      dataSource.updateItem(rowIndex, nextRow);
      setRows(nextRows);
    },
    [dataSource],
  );
  const renderersByType = useMemo(() => {
    return makeCardsRenderers(contentWidth, toggleExpanded);
  }, [contentWidth, toggleExpanded]);
  const layoutConfig = useMemo(() => {
    return {
      topInset: 0,
      bottomInset: 0,
      itemSpacing: 0,
      iosConfig: {
        estimatedItemSize: {
          height: cardsEstimatedItemLength,
        },
      },
    };
  }, []);
  const layout = useLinearListLayout(layoutConfig);
  const didHydrateDataSource = useRef(false);
  const listKey = "cards-" + String(contentWidth);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

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
        title="Cards"
        subtitle="1k expandable card rows based on the Legend List cards example."
        onBack={props.onBack}
      />

      <View style={styles.summary}>
        <Text style={styles.summaryText}>{cards.length} cards</Text>
        <Text style={styles.summaryText}>react-native-list</Text>
      </View>

      <List
        key={listKey}
        dataSource={dataSource}
        layout={layout}
        renderers={renderersByType}
        style={styles.cardsListBackground}
      />
    </View>
  );
}
