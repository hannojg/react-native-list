import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import {
  LegendList,
  type LegendListRenderItemProps,
  useRecyclingState,
} from "@legendapp/list/react-native";
import { ExampleHeader } from "../components";
import { styles } from "../styles";
import { buildFeedCards } from "./cardsFeedData";
import type { FeedCard, FeedPollOption } from "./cardsFeedData";

function keyExtractor(item: FeedCard) {
  return item.id;
}

function getFeedPollVotes(
  optionId: string,
  selectedOptionId: string | null,
  votes: number,
) {
  let nextVotes = votes;

  if (selectedOptionId === optionId) {
    nextVotes += 1;
  }

  return nextVotes;
}

function renderPollOption(
  option: FeedPollOption,
  selectedOptionId: string | null,
  setSelectedOptionId: (optionId: string) => void,
) {
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

        setSelectedOptionId(option.id);
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

function LegendFeedCardItem(props: LegendListRenderItemProps<FeedCard>) {
  const item = props.item;
  const [isExpanded, setExpanded] = useRecyclingState(false);
  const [isLiked, setLiked] = useRecyclingState(false);
  const [selectedOptionId, setSelectedOptionId] = useRecyclingState<
    string | null
  >(null);
  let storyContent = null;
  let photoContent = null;
  let pollContent = null;
  let quoteContent = null;
  let eventContent = null;
  let expandedContent = null;
  let expandButton = null;
  let likeLabel = "Like";
  let likeCount = item.reactionCount;
  let likeButtonStyle: StyleProp<ViewStyle> = styles.feedButton;
  let likeButtonTextStyle = styles.feedButtonText;

  if (isLiked) {
    likeLabel = "Liked";
    likeCount += 1;
    likeButtonStyle = [styles.feedButton, styles.feedButtonActive];
    likeButtonTextStyle = styles.feedButtonTextActive;
  }

  if (item.kind === "story") {
    storyContent = (
      <>
        <View style={styles.feedCategoryChip}>
          <Text style={styles.feedCategoryChipText}>{item.categoryLabel}</Text>
        </View>
        <Text style={styles.feedSectionTitle}>{item.title}</Text>
        <Text style={styles.feedBody}>{item.body}</Text>
      </>
    );
  }

  if (item.kind === "photo") {
    photoContent = (
      <>
        <View
          style={[
            styles.feedMediaCard,
            {
              backgroundColor: item.accentColor,
              height: item.mediaHeight,
            },
          ]}
        >
          <Text style={styles.feedMediaLabel}>{item.mediaLabel}</Text>
          <Text style={styles.feedMediaTitle}>{item.title}</Text>
          <Text style={styles.feedMediaSubtitle}>{item.mediaSubtitle}</Text>
        </View>
        <Text style={styles.feedBody}>{item.body}</Text>
      </>
    );
  }

  if (item.kind === "poll") {
    pollContent = (
      <>
        <Text style={styles.feedSectionTitle}>{item.title}</Text>
        <Text style={styles.feedBody}>{item.body}</Text>
        <View style={styles.feedPollList}>
          {item.pollOptions.map((option) => {
            return renderPollOption(
              option,
              selectedOptionId,
              setSelectedOptionId,
            );
          })}
        </View>
      </>
    );
  }

  if (item.kind === "quote") {
    quoteContent = (
      <>
        <View
          style={[
            styles.feedQuoteCard,
            {
              borderLeftColor: item.accentColor,
            },
          ]}
        >
          <Text style={styles.feedQuoteText}>{item.quote}</Text>
          <Text style={styles.feedPersonMeta}>{item.source}</Text>
        </View>
        <Text style={styles.feedBody}>{item.body}</Text>
      </>
    );
  }

  if (item.kind === "event") {
    eventContent = (
      <>
        <View style={styles.feedEventBadgeRow}>
          <View style={styles.feedEventBadge}>
            <Text style={styles.feedEventBadgeText}>{item.highlight}</Text>
          </View>
          <View style={styles.feedCategoryChip}>
            <Text style={styles.feedCategoryChipText}>
              {item.attendeesLabel}
            </Text>
          </View>
        </View>
        <Text style={styles.feedSectionTitle}>{item.title}</Text>
        <Text style={styles.feedBody}>{item.body}</Text>
        <Text style={styles.feedPersonMeta}>{item.location}</Text>
      </>
    );
  }

  if (item.kind !== "poll" && isExpanded) {
    expandedContent = (
      <Text style={styles.feedExpandedBody}>{item.expandedBody}</Text>
    );
  }

  if (item.kind !== "poll") {
    let expandLabel = "Expand";

    if (isExpanded) {
      expandLabel = "Collapse";
    }

    expandButton = (
      <Pressable
        onPress={() => {
          setExpanded((current) => {
            return !current;
          });
        }}
        style={styles.feedButton}
      >
        <Text style={styles.feedButtonText}>{expandLabel}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.feedCard}>
      <View style={styles.feedHeader}>
        <View
          style={[
            styles.feedAvatar,
            {
              backgroundColor: item.accentColor,
            },
          ]}
        >
          <Text style={styles.feedAvatarText}>{item.author.slice(0, 1)}</Text>
        </View>
        <View style={styles.feedPersonCopy}>
          <Text style={styles.feedPersonName}>{item.author}</Text>
          <Text style={styles.feedPersonMeta}>{item.timestampLabel}</Text>
        </View>
        <View style={styles.feedKindBadge}>
          <Text style={styles.feedKindBadgeText}>{item.kind}</Text>
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
            setLiked((current) => {
              return !current;
            });
          }}
          style={likeButtonStyle}
        >
          <Text style={likeButtonTextStyle}>
            {likeLabel} - {likeCount}
          </Text>
        </Pressable>
        <Text style={styles.feedPersonMeta}>{item.commentCount} comments</Text>
        {expandButton}
      </View>
    </View>
  );
}

function renderItem(props: LegendListRenderItemProps<FeedCard>) {
  return <LegendFeedCardItem {...props} />;
}

export function LegendListCardsFeedExample(props: { onBack: () => void }) {
  const feed = useMemo(() => {
    return buildFeedCards();
  }, []);

  return (
    <View style={styles.root}>
      <ExampleHeader
        title="Legend List cards feed"
        subtitle="Mixed feed cards with stories, media, polls, quotes, and events."
        onBack={props.onBack}
      />

      <View style={styles.summary}>
        <Text style={styles.summaryText}>{feed.length} cards</Text>
        <Text style={styles.summaryText}>Legend List</Text>
      </View>

      <LegendList
        contentContainerStyle={styles.feedListContent}
        data={feed}
        estimatedItemSize={286}
        keyExtractor={keyExtractor}
        recycleItems
        renderItem={renderItem}
        style={{
          flex: 1,
        }}
      />
    </View>
  );
}
