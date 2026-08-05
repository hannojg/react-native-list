export type FeedPollOption = {
  id: string;
  label: string;
  votes: number;
};

export type FeedCardBase = {
  accentColor: string;
  author: string;
  body: string;
  commentCount: number;
  expandedBody: string;
  id: string;
  reactionCount: number;
  timestampLabel: string;
  title: string;
};

export type FeedCard =
  | (FeedCardBase & {
      categoryLabel: string;
      kind: "story";
    })
  | (FeedCardBase & {
      kind: "photo";
      mediaHeight: number;
      mediaLabel: string;
      mediaSubtitle: string;
    })
  | (FeedCardBase & {
      kind: "poll";
      pollOptions: FeedPollOption[];
      totalVotes: number;
    })
  | (FeedCardBase & {
      kind: "quote";
      quote: string;
      source: string;
    })
  | (FeedCardBase & {
      attendeesLabel: string;
      highlight: string;
      kind: "event";
      location: string;
    });

const feedAuthors = [
  "Avery Chen",
  "Jordan Kim",
  "Morgan Patel",
  "Nina Brooks",
  "Sam Rivera",
  "Quinn Foster",
] as const;

const feedTitles = [
  "Release Notes",
  "Feed QA",
  "Bench Snapshot",
  "Launch Debrief",
  "Design Review",
  "Support Pulse",
] as const;

const feedBodies = [
  "Shipped the new measurement overlay and tightened the scroll anchor behavior on dynamic rows.",
  "Testing the revised card feed with image-heavy posts and swipe actions. The recycled cells now preserve interaction state cleanly.",
  "Pinned a new benchmark result comparing cold render time and steady-state scroll under mixed row heights.",
  "Documented the fallback path for variable-size rows so the list holds position while content streams in.",
  "Refined the card composition to keep avatars, actions, and media blocks stable as cells recycle.",
  "Captured another batch of reports from long-session scrolling and queued follow-up fixture cases for edge paths.",
] as const;

const feedAccentColors = [
  "#d7e8f8",
  "#f7e7bc",
  "#f1d7dd",
  "#d8e0f6",
  "#d9ebd6",
  "#e8dbf5",
] as const;

const feedCategoryLabels = [
  "Engineering",
  "Design",
  "Operations",
  "Launch",
  "Research",
  "Support",
] as const;

const feedMediaLabels = [
  "Preview Board",
  "Field Photo",
  "Snapshot",
  "Moodboard",
  "Run Capture",
  "Launch Still",
] as const;

const feedMediaSubtitles = [
  "Tall image block to vary the measured height.",
  "A media-heavy row that recycles differently than text-only posts.",
  "The preview area helps make the feed visually heterogeneous.",
  "Use this shape to show a post that is mostly image and only partly text.",
] as const;

const feedQuoteLines = [
  "The point of this feed is not just to look polished. It should make mixed templates obvious enough that virtualization work is visible.",
  "A good feed example carries text-only posts, oversized media, quote cards, and interactive polls in the same viewport.",
  "If every post has the same structure, the feed hides exactly the variation a list library needs to handle well.",
  "Heterogeneous templates are where estimate quality, recycling, and in-place updates become visible.",
] as const;

const feedEventLocations = [
  "Pier 19",
  "Studio 4",
  "Archive Hall",
  "Workshop East",
  "Skyline Room",
  "North Commons",
] as const;

const feedHighlights = [
  "Starts soon",
  "Pinned update",
  "RSVP open",
  "Schedule change",
  "Limited seats",
  "Live now",
] as const;

const feedPollLabels = [
  [
    "Keep reactions inline",
    "Collapse older cards faster",
    "Ship the new media card",
  ],
  [
    "More height variance",
    "Faster scroll-to-end",
    "Better sticky header backdrop",
  ],
  ["Auto-play previews", "Expandable threads", "Pinned composer card"],
] as const;

function createSeededRandom(seed: number) {
  let current = seed >>> 0;

  return () => {
    current = (current * 1664525 + 1013904223) >>> 0;
    return current / 0x100000000;
  };
}

function pickOne<T>(values: readonly T[], random: () => number) {
  const nextValue = random();
  const nextIndexValue = nextValue * values.length;
  const nextIndex = Math.floor(nextIndexValue);
  return values[nextIndex]!;
}

function makeTimestampLabel(index: number) {
  if (index < 5) {
    return "Now";
  }

  const minuteValue = 6 + (index % 45);
  const minuteText = String(minuteValue);
  return minuteText + "m";
}

function makeBaseFeedCard(index: number, accentColor: string): FeedCardBase {
  const cardNumber = index + 1;
  const authorIndex = index % feedAuthors.length;
  const titleIndex = index % feedTitles.length;
  const firstBodyIndex = index % feedBodies.length;
  const secondBodyIndex = (index + 2) % feedBodies.length;
  const firstExpandedIndex = (index + 1) % feedBodies.length;
  const secondExpandedIndex = (index + 3) % feedBodies.length;
  const thirdExpandedIndex = (index + 4) % feedBodies.length;
  const commentCount = 6 + ((index * 5) % 19);
  const reactionCount = 18 + ((index * 7) % 29);

  return {
    accentColor,
    author: feedAuthors[authorIndex]!,
    body: feedBodies[firstBodyIndex]! + " " + feedBodies[secondBodyIndex]!,
    commentCount,
    expandedBody:
      feedBodies[firstExpandedIndex]! +
      " " +
      feedBodies[secondExpandedIndex]! +
      " " +
      feedBodies[thirdExpandedIndex]!,
    id: "feed-" + String(cardNumber),
    reactionCount,
    timestampLabel: makeTimestampLabel(index),
    title: feedTitles[titleIndex]!,
  };
}

function makePollOptions(baseId: string, index: number): FeedPollOption[] {
  const optionSetIndex = index % feedPollLabels.length;
  const optionSet = feedPollLabels[optionSetIndex]!;
  const pollOptions: FeedPollOption[] = [];

  for (let optionIndex = 0; optionIndex < optionSet.length; optionIndex += 1) {
    const optionNumber = optionIndex + 1;
    const voteOffset = (index * 3) % 11;
    const votes = 18 + optionIndex * 9 + voteOffset;
    const option: FeedPollOption = {
      id: baseId + "-option-" + String(optionNumber),
      label: optionSet[optionIndex]!,
      votes,
    };

    pollOptions.push(option);
  }

  return pollOptions;
}

function getTotalVotes(pollOptions: readonly FeedPollOption[]) {
  let totalVotes = 0;

  for (let index = 0; index < pollOptions.length; index += 1) {
    totalVotes += pollOptions[index]!.votes;
  }

  return totalVotes;
}

function makeFeedCard(index: number, random: () => number): FeedCard {
  const kindIndex = index % 5;
  const accentColor = pickOne(feedAccentColors, random);
  const base = makeBaseFeedCard(index, accentColor);

  if (kindIndex === 0) {
    const categoryIndex = index % feedCategoryLabels.length;
    return {
      ...base,
      categoryLabel: feedCategoryLabels[categoryIndex]!,
      kind: "story",
    };
  }

  if (kindIndex === 1) {
    const mediaHeights = [180, 220, 280, 340] as const;
    const mediaHeightIndex = index % mediaHeights.length;
    const mediaLabelIndex = index % feedMediaLabels.length;
    const mediaSubtitleIndex = index % feedMediaSubtitles.length;

    return {
      ...base,
      kind: "photo",
      mediaHeight: mediaHeights[mediaHeightIndex]!,
      mediaLabel: feedMediaLabels[mediaLabelIndex]!,
      mediaSubtitle: feedMediaSubtitles[mediaSubtitleIndex]!,
    };
  }

  if (kindIndex === 2) {
    const pollOptions = makePollOptions(base.id, index);
    const totalVotes = getTotalVotes(pollOptions);

    return {
      ...base,
      kind: "poll",
      pollOptions,
      totalVotes,
    };
  }

  if (kindIndex === 3) {
    const quoteIndex = index % feedQuoteLines.length;

    return {
      ...base,
      kind: "quote",
      quote: feedQuoteLines[quoteIndex]!,
      source: base.author + " - Weekly review",
    };
  }

  const attendeeCount = 12 + ((index * 4) % 38);
  const highlightIndex = index % feedHighlights.length;
  const locationIndex = index % feedEventLocations.length;

  return {
    ...base,
    attendeesLabel: String(attendeeCount) + " attendees",
    highlight: feedHighlights[highlightIndex]!,
    kind: "event",
    location: feedEventLocations[locationIndex]!,
  };
}

export function buildFeedCards(count = 84) {
  const random = createSeededRandom(4311);
  const feedCards: FeedCard[] = [];

  for (let index = 0; index < count; index += 1) {
    const feedCard = makeFeedCard(index, random);
    feedCards.push(feedCard);
  }

  return feedCards;
}
