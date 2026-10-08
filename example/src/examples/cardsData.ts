export type Card = {
  authorName: string;
  avatarUrl: string;
  body: string;
  expandedBody: string;
  id: string;
  timestamp: string;
  title: string;
};

const cardsRandomNames = [
  "Alex Thompson",
  "Jordan Lee",
  "Sam Parker",
  "Taylor Kim",
  "Morgan Chen",
  "Riley Zhang",
  "Casey Williams",
  "Quinn Anderson",
  "Blake Martinez",
  "Avery Rodriguez",
  "Drew Campbell",
  "Jamie Foster",
  "Skylar Patel",
  "Charlie Wright",
  "Sage Mitchell",
  "River Johnson",
  "Phoenix Garcia",
  "Jordan Taylor",
  "Reese Cooper",
  "Morgan Bailey",
] as const;

const cardsLoremSentences = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa.",
  "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit.",
  "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.",
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa.",
  "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit.",
  "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.",
] as const;

function makeSentenceCount(index: number) {
  return ((index * 7919) % 12) + 1;
}

function makeBody(sentenceCount: number) {
  let body = "";

  for (let index = 0; index < sentenceCount; index += 1) {
    const sentenceIndex = index % cardsLoremSentences.length;
    const sentence = cardsLoremSentences[sentenceIndex]!;

    if (body.length > 0) {
      body += " ";
    }

    body += sentence;
  }

  return body;
}

function makeTimestamp(index: number) {
  const hourValue = Math.max(1, index % 24);
  return String(hourValue) + "h ago";
}

function makeAvatarUrl(index: number) {
  const avatarIndex = (index % 20) + 1;
  return "https://i.pravatar.cc/150?img=" + String(avatarIndex);
}

function makeCard(index: number): Card {
  const nameIndex = index % cardsRandomNames.length;
  const sentenceCount = makeSentenceCount(index);
  const body = makeBody(sentenceCount);
  const id = String(index);

  return {
    authorName: cardsRandomNames[nameIndex]!,
    avatarUrl: makeAvatarUrl(index),
    body,
    expandedBody: body,
    id,
    timestamp: makeTimestamp(index),
    title: "Item #" + id,
  };
}

export function buildCards(count = 1000) {
  const cards: Card[] = [];

  for (let index = 0; index < count; index += 1) {
    const card = makeCard(index);
    cards.push(card);
  }

  return cards;
}
