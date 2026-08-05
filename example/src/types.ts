export type ExampleId =
  | "update-lab"
  | "dynamic-text"
  | "dynamic-text-push-stress"
  | "chat-benchmark"
  | "legend-list-chat-benchmark"
  | "cards-feed"
  | "legend-list-cards-feed"
  | "cards"
  | "legend-list-cards";

export type ExampleCase = {
  id: ExampleId;
  title: string;
  description: string;
};
