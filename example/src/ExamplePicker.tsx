import React from "react";
import { Button, Pressable, ScrollView, Text, View } from "react-native";
import { styles } from "./styles";
import type { ExampleCase, ExampleId } from "./types";

const exampleCases: ExampleCase[] = [
  {
    id: "update-lab",
    title: "List update lab",
    description:
      "The current mutation example with inserts, moves, reloads, and height updates.",
  },
  {
    id: "dynamic-text",
    title: "Dynamic text heights",
    description:
      "Generated text rows whose item width and height are measured from rendered content.",
  },
  {
    id: "dynamic-text-push-stress",
    title: "Dynamic height push stress",
    description:
      "Pushes a fresh dynamic-height list screen every 400ms to stress list creation.",
  },
];

export function ExamplePicker(props: {
  onSelectExample: (id: ExampleId) => void;
}) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.homeContent}>
        <Text style={styles.title}>Examples</Text>
        <Text style={styles.subtitle}>Choose a list scenario to run.</Text>
        <Button
          title="Hermes gc()"
          onPress={() => {
            const gc = globalThis?.gc;
            if (!gc) {
              return;
            }
            gc();
          }}
        />
        <View style={styles.exampleList}>
          {exampleCases.map((exampleCase) => {
            return (
              <ExampleCard
                key={exampleCase.id}
                exampleCase={exampleCase}
                onPress={() => {
                  props.onSelectExample(exampleCase.id);
                }}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function ExampleCard(props: { exampleCase: ExampleCase; onPress: () => void }) {
  return (
    <Pressable style={styles.exampleCard} onPress={props.onPress}>
      <Text style={styles.exampleCardTitle}>{props.exampleCase.title}</Text>
      <Text style={styles.exampleCardDescription}>
        {props.exampleCase.description}
      </Text>
    </Pressable>
  );
}
