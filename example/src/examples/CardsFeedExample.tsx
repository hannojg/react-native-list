import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
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
import { buildFeedCards } from "./cardsFeedData";
import type { FeedCard, FeedPollOption } from "./cardsFeedData";

type CardsFeedItemData = FeedCard & {
  isExpanded: boolean;
  isLiked: boolean;
  selectedOptionId: string | null;
};

type CardsFeedItem = ListItem<typeof cardsFeedItemType, CardsFeedItemData>;

const cardsFeedItemType = "cards-feed-card";

function getFeedPollVotes(
  optionId: string,
  selectedOptionId: string | null,
  votes: number,
) {
  "worklet";

  let nextVotes = votes;

  if (selectedOptionId === optionId) {
    nextVotes += 1;
  }

  return nextVotes;
}

function makeCardsFeedItems(cards: readonly FeedCard[]): CardsFeedItem[] {
  const rows: CardsFeedItem[] = [];

  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index]!;
    const row: CardsFeedItem = {
      key: card.id,
      type: cardsFeedItemType,
      data: {
        ...card,
        isExpanded: false,
        isLiked: false,
        selectedOptionId: null,
      },
    };

    rows.push(row);
  }

  return rows;
}

const horizontalEdgeInset = 16;
function getContentWidth(windowWidth: number) {
  let contentWidth = windowWidth - horizontalEdgeInset * 2;

  if (contentWidth > 560) {
    contentWidth = 560;
  }

  if (contentWidth < 220) {
    contentWidth = 220;
  }

  return contentWidth;
}

function renderFeedPlaceholder(contentWidth: number): React.ReactElement {
  "worklet";

  return (
    <View
      style={[
        styles.feedCard,
        {
          width: contentWidth,
        },
      ]}
    />
  );
}

function renderPollOption(
  option: FeedPollOption,
  item: CardsFeedItem,
  onSelectPollOption: (key: string, optionId: string) => void,
) {
  "worklet";

  const selectedOptionId = item.data.selectedOptionId;
  const isSelected = selectedOptionId === option.id;
  let optionStyle: StyleProp<ViewStyle> = styles.feedPollOption;

  if (isSelected) {
    optionStyle = [styles.feedPollOption, styles.feedPollOptionSelected];
  }

  return (
    <Pressable
      key={option.id}
      onPress={() => {
        if (isSelected) {
          return;
        }

        scheduleOnRN(onSelectPollOption, item.key, option.id);
      }}
      style={optionStyle}
    >
      <Text style={styles.feedPollOptionLabel}>{option.label}</Text>
      <Text style={styles.feedPollOptionVotes}>
        {getFeedPollVotes(option.id, selectedOptionId, option.votes)} votes
      </Text>
    </Pressable>
  );
}

function renderFeedCard(
  item: CardsFeedItem,
  contentWidth: number,
  onToggleLike: (key: string) => void,
  onToggleExpand: (key: string) => void,
  onSelectPollOption: (key: string, optionId: string) => void,
): React.ReactElement {
  "worklet";

  let storyContent = null;
  let photoContent = null;
  let pollContent = null;
  let quoteContent = null;
  let eventContent = null;
  let expandedContent = null;
  let expandButton = null;
  let likeLabel = "Like";
  let likeCount = item.data.reactionCount;
  let likeButtonStyle: StyleProp<ViewStyle> = styles.feedButton;
  let likeButtonTextStyle = styles.feedButtonText;

  if (item.data.isLiked) {
    likeLabel = "Liked";
    likeCount += 1;
    likeButtonStyle = [styles.feedButton, styles.feedButtonActive];
    likeButtonTextStyle = styles.feedButtonTextActive;
  }

  if (item.data.kind === "story") {
    storyContent = (
      <>
        <View style={styles.feedCategoryChip}>
          <Text style={styles.feedCategoryChipText}>
            {item.data.categoryLabel}
          </Text>
        </View>
        <Text style={styles.feedSectionTitle}>{item.data.title}</Text>
        <Text style={styles.feedBody}>{item.data.body}</Text>
      </>
    );
  }

  if (item.data.kind === "photo") {
    photoContent = (
      <>
        <View
          style={[
            styles.feedMediaCard,
            {
              backgroundColor: item.data.accentColor,
              height: item.data.mediaHeight,
            },
          ]}
        >
          <Text style={styles.feedMediaLabel}>{item.data.mediaLabel}</Text>
          <Text style={styles.feedMediaTitle}>{item.data.title}</Text>
          <Text style={styles.feedMediaSubtitle}>
            {item.data.mediaSubtitle}
          </Text>
        </View>
        <Text style={styles.feedBody}>{item.data.body}</Text>
      </>
    );
  }

  if (item.data.kind === "poll") {
    pollContent = (
      <>
        <Text style={styles.feedSectionTitle}>{item.data.title}</Text>
        <Text style={styles.feedBody}>{item.data.body}</Text>
        <View style={styles.feedPollList}>
          {item.data.pollOptions.map((option) => {
            return renderPollOption(option, item, onSelectPollOption);
          })}
        </View>
      </>
    );
  }

  if (item.data.kind === "quote") {
    quoteContent = (
      <>
        <View
          style={[
            styles.feedQuoteCard,
            {
              borderLeftColor: item.data.accentColor,
            },
          ]}
        >
          <Text style={styles.feedQuoteText}>{item.data.quote}</Text>
          <Text style={styles.feedPersonMeta}>{item.data.source}</Text>
        </View>
        <Text style={styles.feedBody}>{item.data.body}</Text>
      </>
    );
  }

  if (item.data.kind === "event") {
    eventContent = (
      <>
        <View style={styles.feedEventBadgeRow}>
          <View style={styles.feedEventBadge}>
            <Text style={styles.feedEventBadgeText}>{item.data.highlight}</Text>
          </View>
          <View style={styles.feedCategoryChip}>
            <Text style={styles.feedCategoryChipText}>
              {item.data.attendeesLabel}
            </Text>
          </View>
        </View>
        <Text style={styles.feedSectionTitle}>{item.data.title}</Text>
        <Text style={styles.feedBody}>{item.data.body}</Text>
        <Text style={styles.feedPersonMeta}>{item.data.location}</Text>
      </>
    );
  }

  if (item.data.kind !== "poll" && item.data.isExpanded) {
    expandedContent = (
      <Text style={styles.feedExpandedBody}>{item.data.expandedBody}</Text>
    );
  }

  if (item.data.kind !== "poll") {
    let expandLabel = "Expand";

    if (item.data.isExpanded) {
      expandLabel = "Collapse";
    }

    expandButton = (
      <Pressable
        onPress={() => {
          scheduleOnRN(onToggleExpand, item.key);
        }}
        style={styles.feedButton}
      >
        <Text style={styles.feedButtonText}>{expandLabel}</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.feedCard,
        {
          width: contentWidth,
        },
      ]}
    >
      <View style={styles.feedHeader}>
        <View
          style={[
            styles.feedAvatar,
            {
              backgroundColor: item.data.accentColor,
            },
          ]}
        >
          <Text style={styles.feedAvatarText}>
            {item.data.author.slice(0, 1)}
          </Text>
        </View>
        <View style={styles.feedPersonCopy}>
          <Text style={styles.feedPersonName}>{item.data.author}</Text>
          <Text style={styles.feedPersonMeta}>{item.data.timestampLabel}</Text>
        </View>
        <View style={styles.feedKindBadge}>
          <Text style={styles.feedKindBadgeText}>{item.data.kind}</Text>
        </View>
      </View>

      {storyContent}
      {photoContent}
      {pollContent}
      {quoteContent}
      {eventContent}
      {expandedContent}

      <View style={styles.feedActionRow}>
        <Pressable
          onPress={() => {
            scheduleOnRN(onToggleLike, item.key);
          }}
          style={likeButtonStyle}
        >
          <Text style={likeButtonTextStyle}>
            {likeLabel} - {likeCount}
          </Text>
        </Pressable>
        <Text style={styles.feedPersonMeta}>
          {item.data.commentCount} comments
        </Text>
        {expandButton}
      </View>
    </View>
  );
}

function makeFeedRenderers(
  contentWidth: number,
  onToggleLike: (key: string) => void,
  onToggleExpand: (key: string) => void,
  onSelectPollOption: (key: string, optionId: string) => void,
): ListRenderers<CardsFeedItem> {
  return {
    [cardsFeedItemType]: {
      renderItemWorklet: ({ item }) => {
        "worklet";

        if (item == null) {
          return renderFeedPlaceholder(contentWidth);
        }

        return renderFeedCard(
          item,
          contentWidth,
          onToggleLike,
          onToggleExpand,
          onSelectPollOption,
        );
      },
    },
  };
}

function makeFeedContentEqualByType(): ListContentEqualByType<CardsFeedItem> {
  return {
    [cardsFeedItemType]: (oldItem, newItem) => {
      if (oldItem.data.id !== newItem.data.id) {
        return false;
      }
      if (oldItem.data.isExpanded !== newItem.data.isExpanded) {
        return false;
      }
      if (oldItem.data.isLiked !== newItem.data.isLiked) {
        return false;
      }
      if (oldItem.data.selectedOptionId !== newItem.data.selectedOptionId) {
        return false;
      }
      return true;
    },
  };
}

function replaceDataSourceData(
  dataSource: ListDataSource<CardsFeedItem>,
  rows: readonly CardsFeedItem[],
  animated: boolean,
) {
  dataSource.replaceData(rows, animated);
}

export function CardsFeedExample(props: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const contentWidth = getContentWidth(width);
  const cards = useMemo(() => {
    return buildFeedCards();
  }, []);
  const initialRows = useMemo(() => {
    return makeCardsFeedItems(cards);
  }, [cards]);
  const [rows, setRows] = useState(initialRows);
  const rowsRef = useRef(rows);
  const contentEqualByType = useMemo(() => {
    return makeFeedContentEqualByType();
  }, []);
  const dataSource = useMemo(() => {
    return createListDataSource<CardsFeedItem>({
      isContentEqualByType: contentEqualByType,
    });
  }, [contentEqualByType]);

  const updateRow = useCallback(
    (
      key: string,
      updateData: (data: CardsFeedItemData) => CardsFeedItemData,
    ) => {
      const currentRows = rowsRef.current;
      const rowIndex = currentRows.findIndex((row) => {
        return row.key === key;
      });

      if (rowIndex === -1) {
        throw new Error("Missing cards feed row " + key);
      }

      const currentRow = currentRows[rowIndex]!;
      const nextRows = currentRows.slice();
      const nextRow = {
        ...currentRow,
        data: updateData(currentRow.data),
      };

      nextRows[rowIndex] = nextRow;
      rowsRef.current = nextRows;
      dataSource.updateItem(rowIndex, nextRow);
      setRows(nextRows);
    },
    [dataSource],
  );

  const toggleLike = useCallback(
    (key: string) => {
      updateRow(key, (data) => {
        return {
          ...data,
          isLiked: !data.isLiked,
        };
      });
    },
    [updateRow],
  );

  const toggleExpand = useCallback(
    (key: string) => {
      updateRow(key, (data) => {
        return {
          ...data,
          isExpanded: !data.isExpanded,
        };
      });
    },
    [updateRow],
  );

  const selectPollOption = useCallback(
    (key: string, optionId: string) => {
      updateRow(key, (data) => {
        return {
          ...data,
          selectedOptionId: optionId,
        };
      });
    },
    [updateRow],
  );

  const renderersByType = useMemo(() => {
    return makeFeedRenderers(
      contentWidth,
      toggleLike,
      toggleExpand,
      selectPollOption,
    );
  }, [contentWidth, selectPollOption, toggleExpand, toggleLike]);
  const layoutConfig = useMemo(() => {
    return {
      topInset: 16,
      bottomInset: 24,
      itemSpacing: 12,
      itemHorizontalInset: horizontalEdgeInset,
      iosConfig: {
        estimatedItemSize: {
          height: Dimensions.get("window").height / 3,
        },
      },
    };
  }, []);
  const layout = useLinearListLayout(layoutConfig);
  const didHydrateDataSource = useRef(false);
  const listKey = "cards-feed-" + String(contentWidth);

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
        title="Cards feed"
        subtitle="Mixed feed cards with stories, media, polls, quotes, and events."
        onBack={props.onBack}
      />

      <View style={styles.summary}>
        <Text style={styles.summaryText}>{rows.length} cards</Text>
        <Text style={styles.summaryText}>react-native-list</Text>
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
