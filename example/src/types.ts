export type ExampleId =
  | "update-lab"
  | "dynamic-text"
  | "dynamic-text-push-stress";

export type ExampleCase = {
  id: ExampleId;
  title: string;
  description: string;
};
