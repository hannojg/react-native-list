import React, { memo, useMemo } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { LegendList, useRecyclingState } from "@legendapp/list/react-native";
import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import { ExampleHeader } from "../components";
import { styles } from "../styles";
import { buildCards } from "./cardsData";
import type { Card } from "./cardsData";

const cardsEstimatedItemLength = 400;
const cardsDrawDistance = 250;

function keyExtractor(item: Card) {
  return item.id;
}

const LegendCard = memo(function LegendCard(
  props: LegendListRenderItemProps<Card>,
) {
  const item = props.item;
  const [isExpanded, setExpanded] = useRecyclingState(false);
  let expandedBody = null;

  if (isExpanded) {
    expandedBody = item.expandedBody;
  }

  return (
    <View style={styles.cardsItemOuter}>
      <Pressable
        onPress={() => {
          setExpanded((current) => {
            return !current;
          });
        }}
      >
        <View style={styles.cardsItemContainer}>
          <View style={styles.cardsHeaderContainer}>
            <Image
              source={{
                uri: item.avatarUrl,
              }}
              style={styles.cardsAvatar}
            />
            <View style={styles.cardsHeaderText}>
              <Text style={styles.cardsAuthorName}>
                {item.authorName} {item.id}
              </Text>
              <Text style={styles.cardsTimestamp}>{item.timestamp}</Text>
            </View>
          </View>

          <Text style={styles.cardsItemTitle}>{item.title}</Text>
          <Text style={styles.cardsItemBody}>
            {item.body}
            {expandedBody}
          </Text>
          <View style={styles.cardsItemFooter}>
            <Text style={styles.cardsFooterText}>💗 42</Text>
            <Text style={styles.cardsFooterText}>💬 12</Text>
            <Text style={styles.cardsFooterText}>🔁 8</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
});

function renderItem(props: LegendListRenderItemProps<Card>) {
  return <LegendCard {...props} />;
}

function ListHeaderComponent() {
  return <View />;
}

export function LegendListCardsExample(props: { onBack: () => void }) {
  const cards = useMemo(() => {
    return buildCards();
  }, []);

  return (
    <View style={styles.root}>
      <ExampleHeader
        title="Legend List cards"
        subtitle="1k expandable card rows based on the Legend List cards example."
        onBack={props.onBack}
      />

      <View style={styles.summary}>
        <Text style={styles.summaryText}>{cards.length} cards</Text>
        <Text style={styles.summaryText}>Legend List</Text>
      </View>

      <LegendList
        data={cards}
        drawDistance={cardsDrawDistance}
        estimatedItemSize={cardsEstimatedItemLength}
        estimatedHeaderSize={116}
        extraData={{
          recycleState: true,
        }}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListHeaderComponentStyle={styles.cardsLegendListHeader}
        recycleItems
        renderItem={renderItem}
        style={styles.cardsListBackground}
      />
    </View>
  );
}
