import React, { useEffect, useMemo, useRef } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
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
import type {
  ChatBenchmarkMessage,
  ChatBenchmarkReaction,
} from "./chatBenchmarkData";
import {
  areChatBenchmarkMessagesEqual,
  chatBenchmarkMessageCount,
  makeChatBenchmarkMessages,
} from "./chatBenchmarkData";

type ChatBenchmarkItem = ListItem<
  typeof chatBenchmarkItemType,
  ChatBenchmarkMessage
>;

const chatBenchmarkItemType = "chat-benchmark-message";
const chatBenchmarkItemHorizontalInset = 16;
const chatBenchmarkItemVerticalInset = 8;

function makeChatItems(
  messages: readonly ChatBenchmarkMessage[],
): ChatBenchmarkItem[] {
  const items: ChatBenchmarkItem[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const item: ChatBenchmarkItem = {
      key: message.id,
      type: chatBenchmarkItemType,
      data: message,
    };

    items.push(item);
  }

  return items;
}

function renderChatItem(
  item: ChatBenchmarkItem | undefined,
  contentWidth: number,
): React.ReactElement {
  "worklet";

  let authorText = "";
  let messageText = "";
  let timestampText = "";
  let reactions: readonly ChatBenchmarkReaction[] = [];
  let authorStyle: StyleProp<TextStyle> = [
    styles.chatAuthor,
    styles.chatAuthorHidden,
  ];
  let reactionsStyle: StyleProp<ViewStyle> = [
    styles.chatReactions,
    styles.chatReactionsHidden,
  ];
  let rowStyle: StyleProp<ViewStyle> = [
    styles.chatRow,
    styles.chatRowOther,
    {
      width: contentWidth,
    },
  ];
  let bubbleStyle: StyleProp<ViewStyle> = [
    styles.chatBubble,
    styles.chatBubbleOther,
  ];

  if (item != null) {
    messageText = item.data.message;
    timestampText = item.data.timestamp;
    reactions = item.data.reactions;

    if (item.data.isOwnMessage) {
      rowStyle = [
        styles.chatRow,
        styles.chatRowOwn,
        {
          width: contentWidth,
        },
      ];
      bubbleStyle = [styles.chatBubble, styles.chatBubbleOwn];
    } else {
      authorText = item.data.author;
      authorStyle = styles.chatAuthor;
    }

    if (item.data.reactions.length > 0) {
      reactionsStyle = styles.chatReactions;
    }
  }

  return (
    <View style={rowStyle}>
      <View style={bubbleStyle}>
        <Text style={authorStyle}>{authorText}</Text>
        <Text style={styles.chatMessage}>{messageText}</Text>
        <Text style={styles.chatMeta}>{timestampText}</Text>
      </View>
      <View style={reactionsStyle}>
        {renderChatReactionSlot("reaction-0", reactions, 0)}
        {renderChatReactionSlot("reaction-1", reactions, 1)}
        {renderChatReactionSlot("reaction-2", reactions, 2)}
      </View>
    </View>
  );
}

function renderChatReactionSlot(
  slotKey: string,
  reactions: readonly ChatBenchmarkReaction[],
  index: number,
) {
  "worklet";

  const reaction = reactions[index];
  let emojiText = "";
  let countText = "";
  let chipStyle: StyleProp<ViewStyle> = [
    styles.chatReactionChip,
    styles.chatReactionChipHidden,
  ];

  if (reaction != null) {
    emojiText = reaction.emoji;
    countText = String(reaction.count);
    chipStyle = styles.chatReactionChip;
  }

  return (
    <View key={slotKey} style={chipStyle}>
      <Text style={styles.chatReactionText}>{emojiText}</Text>
      <Text style={styles.chatReactionText}>{countText}</Text>
    </View>
  );
}

function makeChatRenderers(
  contentWidth: number,
): ListRenderers<ChatBenchmarkItem> {
  return {
    [chatBenchmarkItemType]: {
      renderItemWorklet: ({ item }) => {
        "worklet";

        return renderChatItem(item, contentWidth);
      },
    },
  };
}

function makeChatContentEqualByType(): ListContentEqualByType<ChatBenchmarkItem> {
  return {
    [chatBenchmarkItemType]: (oldItem, newItem) => {
      return areChatBenchmarkMessagesEqual(oldItem.data, newItem.data);
    },
  };
}

function replaceDataSourceData(
  dataSource: ListDataSource<ChatBenchmarkItem>,
  rows: readonly ChatBenchmarkItem[],
  animated: boolean,
) {
  dataSource.replaceData(rows, animated);
}

export function ChatBenchmarkExample(props: { onBack: () => void }) {
  const { width, height } = useWindowDimensions();
  const contentWidth = width - chatBenchmarkItemHorizontalInset * 2;
  const messages = useMemo(() => {
    return makeChatBenchmarkMessages();
  }, []);
  const rows = useMemo(() => {
    return makeChatItems(messages);
  }, [messages]);
  const renderersByType = useMemo(() => {
    return makeChatRenderers(contentWidth);
  }, [contentWidth]);
  const contentEqualByType = useMemo(() => {
    return makeChatContentEqualByType();
  }, []);
  const dataSource = useMemo(() => {
    return createListDataSource<ChatBenchmarkItem>({
      isContentEqualByType: contentEqualByType,
    });
  }, [contentEqualByType]);
  const layout = useLinearListLayout({
    topInset: 12,
    bottomInset: 20,
    itemSpacing: 0,
    itemHorizontalInset: chatBenchmarkItemHorizontalInset,
    itemVerticalInset: chatBenchmarkItemVerticalInset,
    iosConfig: {
      estimatedItemSize: {
        height: height / 4, // roughly three items in the viewport
      },
    },
  });
  const didHydrateDataSource = useRef(false);
  const listKey = "chat-benchmark-" + String(contentWidth);

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
        title="Chat benchmark"
        subtitle="10k measured chat rows with left/right bubbles and reaction chips."
        onBack={props.onBack}
      />

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {chatBenchmarkMessageCount} messages
        </Text>
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
