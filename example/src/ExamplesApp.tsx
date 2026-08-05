import React, { useCallback, useEffect, useRef, useState } from "react";
import { NavigationContainer, useFocusEffect } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { ExampleHeader } from "./components";
import { ExamplePicker } from "./ExamplePicker";
import { CardsFeedExample } from "./examples/CardsFeedExample";
import { ChatBenchmarkExample } from "./examples/ChatBenchmarkExample";
import { DynamicTextHeightsExample } from "./examples/DynamicTextHeightsExample";
import { LegendListCardsFeedExample } from "./examples/LegendListCardsFeedExample";
import { LegendListChatBenchmarkExample } from "./examples/LegendListChatBenchmarkExample";
import { LegendListCardsExample } from "./examples/LegendListCardsExample";
import { ListUpdateLabExample } from "./examples/ListUpdateLabExample";
import { CardsExample } from "./examples/CardsExample";
import { styles } from "./styles";
import type { ExampleId } from "./types";

type ExamplesStackParamList = {
  Examples: undefined;
  ListUpdateLab: undefined;
  DynamicTextHeights: DynamicTextHeightsRouteParams | undefined;
  DynamicTextHeightsPushStress: undefined;
  ChatBenchmark: undefined;
  LegendListChatBenchmark: undefined;
  CardsFeed: undefined;
  LegendListCardsFeed: undefined;
  Cards: undefined;
  LegendListCards: undefined;
};

type DynamicTextHeightsRouteParams = {
  popAfterDelay?: boolean;
  instance?: number;
};

type ExamplePickerScreenProps = NativeStackScreenProps<
  ExamplesStackParamList,
  "Examples"
>;

type ListUpdateLabScreenProps = NativeStackScreenProps<
  ExamplesStackParamList,
  "ListUpdateLab"
>;

type DynamicTextHeightsScreenProps = NativeStackScreenProps<
  ExamplesStackParamList,
  "DynamicTextHeights"
>;

type DynamicTextHeightsPushStressScreenProps = NativeStackScreenProps<
  ExamplesStackParamList,
  "DynamicTextHeightsPushStress"
>;

type ChatBenchmarkScreenProps = NativeStackScreenProps<
  ExamplesStackParamList,
  "ChatBenchmark"
>;

type LegendListChatBenchmarkScreenProps = NativeStackScreenProps<
  ExamplesStackParamList,
  "LegendListChatBenchmark"
>;

type CardsFeedScreenProps = NativeStackScreenProps<
  ExamplesStackParamList,
  "CardsFeed"
>;

type LegendListCardsFeedScreenProps = NativeStackScreenProps<
  ExamplesStackParamList,
  "LegendListCardsFeed"
>;

type CardsScreenProps = NativeStackScreenProps<ExamplesStackParamList, "Cards">;

type LegendListCardsScreenProps = NativeStackScreenProps<
  ExamplesStackParamList,
  "LegendListCards"
>;

const Stack = createNativeStackNavigator<ExamplesStackParamList>();

const screenOptions: NativeStackNavigationOptions = {
  headerShown: false,
};

function ExamplePickerScreen(props: ExamplePickerScreenProps) {
  function selectExample(exampleId: ExampleId) {
    if (exampleId === "update-lab") {
      props.navigation.navigate("ListUpdateLab");
      return;
    }

    if (exampleId === "dynamic-text-push-stress") {
      props.navigation.navigate("DynamicTextHeightsPushStress");
      return;
    }

    if (exampleId === "chat-benchmark") {
      props.navigation.navigate("ChatBenchmark");
      return;
    }

    if (exampleId === "legend-list-chat-benchmark") {
      props.navigation.navigate("LegendListChatBenchmark");
      return;
    }

    if (exampleId === "cards-feed") {
      props.navigation.navigate("CardsFeed");
      return;
    }

    if (exampleId === "legend-list-cards-feed") {
      props.navigation.navigate("LegendListCardsFeed");
      return;
    }

    if (exampleId === "cards") {
      props.navigation.navigate("Cards");
      return;
    }

    if (exampleId === "legend-list-cards") {
      props.navigation.navigate("LegendListCards");
      return;
    }

    props.navigation.navigate("DynamicTextHeights");
  }

  return <ExamplePicker onSelectExample={selectExample} />;
}

function ListUpdateLabScreen(props: ListUpdateLabScreenProps) {
  function goBack() {
    props.navigation.goBack();
  }

  return <ListUpdateLabExample onBack={goBack} />;
}

function DynamicTextHeightsScreen(props: DynamicTextHeightsScreenProps) {
  const routeParams = props.route.params;
  let shouldPopAfterDelay = false;
  let currentInstance = 1;

  if (routeParams != null) {
    shouldPopAfterDelay = routeParams.popAfterDelay === true;

    if (routeParams.instance != null) {
      currentInstance = routeParams.instance;
    }
  }

  function goBack() {
    props.navigation.goBack();
  }

  useEffect(() => {
    if (!shouldPopAfterDelay) {
      return;
    }

    function popCurrentInstance() {
      props.navigation.goBack();
    }

    const popDelayMs = 400;
    const timeout = setTimeout(popCurrentInstance, popDelayMs);

    return () => {
      clearTimeout(timeout);
    };
  }, [props.navigation, shouldPopAfterDelay]);

  let title = "Dynamic text heights";
  let subtitle =
    "Rows omit item width and height; the native list measures each rendered text row.";

  if (shouldPopAfterDelay) {
    const currentInstanceText = String(currentInstance);

    title = "Dynamic height push stress";
    subtitle =
      "Instance " +
      currentInstanceText +
      "; pops back after 400ms so the loop can push another fresh list.";
  }

  return (
    <DynamicTextHeightsExample
      onBack={goBack}
      title={title}
      subtitle={subtitle}
    />
  );
}

function DynamicTextHeightsPushStressScreen(
  props: DynamicTextHeightsPushStressScreenProps,
) {
  const nextInstanceRef = useRef(1);
  const [latestInstance, setLatestInstance] = useState(0);

  function goBack() {
    props.navigation.goBack();
  }

  const pushNextDynamicScreenOnFocus = useCallback(() => {
    function pushNextDynamicScreen() {
      const nextInstance = nextInstanceRef.current;
      nextInstanceRef.current = nextInstance + 1;
      setLatestInstance(nextInstance);

      const params: DynamicTextHeightsRouteParams = {
        popAfterDelay: true,
        instance: nextInstance,
      };

      props.navigation.push("DynamicTextHeights", params);
    }

    const pushDelayMs = 400;
    const timeout = setTimeout(pushNextDynamicScreen, pushDelayMs);

    return () => {
      clearTimeout(timeout);
    };
  }, [props.navigation]);

  useFocusEffect(pushNextDynamicScreenOnFocus);

  let latestInstanceText = "Starting";

  if (latestInstance > 0) {
    latestInstanceText = "Last pushed instance " + String(latestInstance);
  }

  return (
    <View style={styles.root}>
      <ExampleHeader
        title="Dynamic height push stress"
        subtitle="Pushes a dynamic-height list, waits 400ms, pops back here, then repeats."
        onBack={goBack}
      />
      <View style={styles.summary}>
        <Text style={styles.summaryText}>{latestInstanceText}</Text>
        <Text style={styles.summaryText}>Looping</Text>
      </View>
    </View>
  );
}

function ChatBenchmarkScreen(props: ChatBenchmarkScreenProps) {
  function goBack() {
    props.navigation.goBack();
  }

  return <ChatBenchmarkExample onBack={goBack} />;
}

function LegendListChatBenchmarkScreen(
  props: LegendListChatBenchmarkScreenProps,
) {
  function goBack() {
    props.navigation.goBack();
  }

  return <LegendListChatBenchmarkExample onBack={goBack} />;
}

function CardsFeedScreen(props: CardsFeedScreenProps) {
  function goBack() {
    props.navigation.goBack();
  }

  return <CardsFeedExample onBack={goBack} />;
}

function LegendListCardsFeedScreen(props: LegendListCardsFeedScreenProps) {
  function goBack() {
    props.navigation.goBack();
  }

  return <LegendListCardsFeedExample onBack={goBack} />;
}

function CardsScreen(props: CardsScreenProps) {
  function goBack() {
    props.navigation.goBack();
  }

  return <CardsExample onBack={goBack} />;
}

function LegendListCardsScreen(props: LegendListCardsScreenProps) {
  function goBack() {
    props.navigation.goBack();
  }

  return <LegendListCardsExample onBack={goBack} />;
}

export function ExamplesApp() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Examples"
        screenOptions={screenOptions}
      >
        <Stack.Screen name="Examples" component={ExamplePickerScreen} />
        <Stack.Screen name="ListUpdateLab" component={ListUpdateLabScreen} />
        <Stack.Screen
          name="DynamicTextHeights"
          component={DynamicTextHeightsScreen}
        />
        <Stack.Screen
          name="DynamicTextHeightsPushStress"
          component={DynamicTextHeightsPushStressScreen}
        />
        <Stack.Screen name="ChatBenchmark" component={ChatBenchmarkScreen} />
        <Stack.Screen
          name="LegendListChatBenchmark"
          component={LegendListChatBenchmarkScreen}
        />
        <Stack.Screen name="CardsFeed" component={CardsFeedScreen} />
        <Stack.Screen
          name="LegendListCardsFeed"
          component={LegendListCardsFeedScreen}
        />
        <Stack.Screen name="Cards" component={CardsScreen} />
        <Stack.Screen
          name="LegendListCards"
          component={LegendListCardsScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
