import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';
import { createListDataSource, List, useLinearListLayout } from 'react-native-list';
import type { ListItem, ListRenderers } from 'react-native-list';
import { makeChatBenchmarkMessages } from './benchmark-fixture';
import type { ChatBenchmarkMessage } from './benchmark-fixture';
import 'react-native-list/src/privateGlobals';

type Item = ListItem<'message', ChatBenchmarkMessage>;
type Snapshot = { first: number; last: number; offset: number; viewport: number; thermal: number };
const probe = requireNativeModule<{
  beginMount(): Promise<void>;
  waitForMount(): Promise<Snapshot>;
  waitForUnmount(): Promise<void>;
  snapshot(): Promise<Snapshot>;
}>('ListBenchmark');

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 60, paddingBottom: 34, backgroundColor: '#fff' },
  controls: { flexDirection: 'row', gap: 12, padding: 12 },
  button: { padding: 12, backgroundColor: '#dff5e7' },
  status: { height: 42, fontSize: 10, paddingHorizontal: 12 },
  row: { padding: 12 },
  own: { alignItems: 'flex-end' },
  other: { alignItems: 'flex-start' },
  bubble: { maxWidth: '78%', padding: 10, backgroundColor: '#eef2ff', borderRadius: 8 },
  author: { fontSize: 12, fontWeight: '700' },
  message: { fontSize: 15, lineHeight: 20 },
  meta: { fontSize: 11, marginTop: 5 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
});

function BenchmarkList({ rows }: { rows: Item[] }) {
  const { width, height } = useWindowDimensions();
  const dataSource = useMemo(() => {
    return createListDataSource<Item>();
  }, []);
  const layout = useLinearListLayout({
    topInset: 0,
    bottomInset: 0,
    iosConfig: { estimatedItemSize: { height: height / 4 } },
  });
  const renderers = useMemo<ListRenderers<Item>>(() => {
    return {
      message: {
        renderItemWorklet: ({ item, index }) => {
          'worklet';
          const message = item?.data;
          const own = message?.isOwnMessage === true;
          const alignment = own ? styles.own : styles.other;
          const identifier = 'perf-row-' + index;
          return (
            <View testID={identifier} style={[styles.row, alignment, { width }]}>
              <View style={styles.bubble}>
                <Text style={styles.author} allowFontScaling={false}>{message?.author ?? ''}</Text>
                <Text style={styles.message} allowFontScaling={false}>{message?.message ?? ''}</Text>
                <Text style={styles.meta} allowFontScaling={false}>{message?.timestamp ?? ''}</Text>
              </View>
              <View style={styles.reactions}>
                {message?.reactions.map((reaction) => {
                  return <Text key={reaction.emoji} allowFontScaling={false}>{reaction.emoji} {reaction.count}</Text>;
                })}
              </View>
            </View>
          );
        },
      },
    };
  }, [width]);

  useEffect(() => {
    dataSource.replaceData(rows, false);
    return () => {
      dataSource.release();
    };
  }, [dataSource, rows]);

  return <List dataSource={dataSource} layout={layout} renderers={renderers} style={{ flex: 1 }} />;
}

export default function BenchmarkApp() {
  const rows = useMemo(() => {
    const messages = makeChatBenchmarkMessages();
    return messages.map((data): Item => {
      return { key: data.id, type: 'message', data };
    });
  }, []);
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState('ready');
  const [report, setReport] = useState('{}');

  async function reset() {
    setState('resetting');
    setMounted(false);
    try {
      await probe.waitForUnmount();
      setReport('{}');
      setState('ready');
    } catch (error) {
      const message = String(error);
      setReport(message);
      setState('failed');
    }
  }

  async function mount() {
    setState('mounting');
    try {
      await probe.beginMount();
      setMounted(true);
      const snapshot = await probe.waitForMount();
      const json = JSON.stringify(snapshot);
      setReport(json);
      setState('mounted');
    } catch (error) {
      const message = String(error);
      setReport(message);
      setState('failed');
    }
  }

  async function inspect() {
    try {
      const snapshot = await probe.snapshot();
      const json = JSON.stringify(snapshot);
      setReport(json);
      setState('inspected');
    } catch (error) {
      const message = String(error);
      setReport(message);
      setState('failed');
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.controls}>
        <Pressable testID="perf-reset" accessibilityRole="button" onPress={reset} style={styles.button}>
          <Text>Reset</Text>
        </Pressable>
        <Pressable testID="perf-mount" accessibilityRole="button" onPress={mount} disabled={mounted} style={styles.button}>
          <Text>Mount list</Text>
        </Pressable>
        <Pressable testID="perf-inspect" accessibilityRole="button" onPress={inspect} style={styles.button}>
          <Text>Inspect</Text>
        </Pressable>
      </View>
      <Text testID={'perf-' + state} accessibilityLabel={report} style={styles.status}>{report}</Text>
      {mounted ? <BenchmarkList rows={rows} /> : null}
    </View>
  );
}
