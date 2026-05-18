import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  createListDataSource,
  List,
  useLinearListLayout,
} from "react-native-list";
import type {
  ListDataSource,
  ListItem,
  ListRenderers,
} from "react-native-list";
import "react-native-list/src/privateGlobals";

type DebugRowItem = ListItem<
  "row",
  {
    label: string;
    color: string;
    note: string;
  }
>;

const ROW_WIDTH = 320;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#d8d8d8",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#171717",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#5f6368",
  },
  toolbar: {
    maxHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#d8d8d8",
  },
  toolbarContent: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  button: {
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#1f6feb",
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#d8d8d8",
  },
  summaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4b5563",
  },
  row: {
    justifyContent: "center",
    width: ROW_WIDTH,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#8a8a8a",
  },
  rowTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#171717",
  },
  rowText: {
    marginTop: 4,
    fontSize: 14,
    color: "#333333",
  },
  rowMeta: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#555555",
  },
});

const initialRows: DebugRowItem[] = [
  makeRow("a", 64, "#d4e4ff", "short baseline row"),
  makeRow("b", 168, "#ffe0c2", "tall row to remove at index 1"),
  makeRow("c", 96, "#d7f7df", "medium row after the tall row"),
  makeRow("d", 132, "#f2dcff", "another variable-height row"),
  makeRow("e", 72, "#fff3a8", "short row near the end"),
  makeRow("f", 184, "#ffd7df", "tall tail row"),
];

function makeReloadRows(seed: number): DebugRowItem[] {
  const seedText = String(seed);

  if (seed % 2 === 0) {
    return [
      makeRow(
        "reload-a-" + seedText,
        220,
        "#e9f7ef",
        "reloadData tall first row",
      ),
      makeRow(
        "reload-b-" + seedText,
        88,
        "#fdebd0",
        "reloadData short second row",
      ),
      makeRow(
        "reload-c-" + seedText,
        148,
        "#ebdef0",
        "reloadData medium third row",
      ),
      makeRow(
        "reload-d-" + seedText,
        64,
        "#d6eaf8",
        "reloadData short tail row",
      ),
    ];
  }

  return [
    makeRow(
      "reload-e-" + seedText,
      76,
      "#fcf3cf",
      "reloadData alternate short row",
    ),
    makeRow(
      "reload-f-" + seedText,
      196,
      "#fadbd8",
      "reloadData alternate tall row",
    ),
    makeRow(
      "reload-g-" + seedText,
      116,
      "#d5f5e3",
      "reloadData alternate medium row",
    ),
    makeRow(
      "reload-h-" + seedText,
      176,
      "#d6eaf8",
      "reloadData alternate tall row",
    ),
    makeRow(
      "reload-i-" + seedText,
      92,
      "#f5eef8",
      "reloadData alternate tail row",
    ),
  ];
}

const renderers: ListRenderers<DebugRowItem> = {
  row: {
    renderItemWorklet: ({ item, index }) => {
      "worklet";

      const height = item?.height ?? 96;
      const backgroundColor = item?.data.color ?? "#f0f0f0";

      return (
        <Pressable style={[styles.row, { height, backgroundColor }]} onPress={() => {
          globalThis.log("Pressed: " + item?.key);
        }}>
          <Text style={styles.rowTitle}>
            {index}: {item?.data.label}
          </Text>
          <Text style={styles.rowText}>{item?.data.note}</Text>
          <Text style={styles.rowMeta}>height {height}</Text>
        </Pressable>
      );
    },
  },
};

function makeRow(
  id: string,
  height: number,
  color: string,
  note: string,
): DebugRowItem {
  return {
    key: id,
    type: "row",
    width: ROW_WIDTH,
    height,
    data: {
      label: "row " + id,
      color,
      note,
    },
  };
}

function cloneRows(rows: readonly DebugRowItem[]) {
  return rows.map((row) => {
    return {
      ...row,
      data: {
        ...row.data,
      },
    };
  });
}

function replaceRow(
  rows: readonly DebugRowItem[],
  index: number,
  nextRow: DebugRowItem,
) {
  const nextRows = rows.slice();
  nextRows[index] = nextRow;
  return nextRows;
}

function replaceDataSourceData(
  dataSource: ListDataSource<DebugRowItem>,
  rows: readonly DebugRowItem[],
  animated: boolean,
) {
  dataSource.replaceData(rows, animated);
}

export default function App() {
  const { height, width } = useWindowDimensions();
  const [rows, setRows] = useState(() => cloneRows(initialRows));
  const [version, setVersion] = useState(0);
  const dataSource = useMemo(() => {
    return createListDataSource<DebugRowItem>({
      isContentEqualByType: {
        row: (oldItem, newItem) => {
          if (oldItem.data.label !== newItem.data.label) {
            return false;
          }
          if (oldItem.data.note !== newItem.data.note) {
            return false;
          }
          if (oldItem.data.color !== newItem.data.color) {
            return false;
          }
          return true;
        },
      },
    });
  }, []);
  const layoutConfig = useMemo(() => {
    return {
      topInset: 16,
      bottomInset: 16,
      itemSpacing: 10,
    };
  }, []);
  const layout = useLinearListLayout(layoutConfig);
  const didHydrateDataSource = useRef(false);

  useEffect(() => {
    if (didHydrateDataSource.current) {
      return;
    }

    didHydrateDataSource.current = true;
    replaceDataSourceData(dataSource, rows, false);
  }, [dataSource, rows]);

  function commitRows(nextRows: DebugRowItem[], mutateDataSource: () => void) {
    mutateDataSource();
    setRows(nextRows);
    setVersion((currentVersion) => {
      return currentVersion + 1;
    });
  }

  function removeTallRow() {
    const targetIndex = rows.findIndex((row) => {
      return row.key === "b";
    });
    if (targetIndex === -1) {
      return;
    }

    const nextRows = rows.filter((row) => {
      return row.key !== "b";
    });
    commitRows(nextRows, () => {
      dataSource.removeItem(targetIndex);
    });
  }

  function insertTallRow() {
    const insertIndex = Math.min(1, rows.length);
    const versionText = String(version);
    const insertedRow = makeRow(
      "insert-" + versionText,
      176,
      "#c8f2ff",
      "inserted tall row at index 1",
    );
    const nextRows = rows.slice();
    nextRows.splice(insertIndex, 0, insertedRow);
    commitRows(nextRows, () => {
      dataSource.insertItem(insertIndex, insertedRow);
    });
  }

  function toggleMiddleHeight() {
    const targetIndex = Math.min(2, rows.length - 1);
    if (targetIndex < 0) {
      return;
    }

    const currentRow = rows[targetIndex];
    const isTall = currentRow.height > 120;
    let nextHeight = 188;
    if (isTall) {
      nextHeight = 72;
    }
    const nextHeightText = String(nextHeight);
    const nextRow: DebugRowItem = {
      ...currentRow,
      height: nextHeight,
      data: {
        ...currentRow.data,
        note: "updated height to " + nextHeightText,
      },
    };
    const nextRows = replaceRow(rows, targetIndex, nextRow);
    commitRows(nextRows, () => {
      dataSource.updateItem(targetIndex, nextRow);
    });
  }

  function moveFirstToEnd() {
    if (rows.length < 2) {
      return;
    }

    const nextRows = rows.slice();
    const firstRow = nextRows.shift();
    if (firstRow == null) {
      return;
    }

    nextRows.push(firstRow);
    const toIndex = nextRows.length - 1;
    commitRows(nextRows, () => {
      dataSource.moveItem(0, toIndex);
    });
  }

  function replaceAnimated() {
    const nextRows = cloneRows(rows).reverse();
    replaceDataSourceData(dataSource, nextRows, true);
    setRows(nextRows);
    setVersion((currentVersion) => {
      return currentVersion + 1;
    });
  }

  function replace(animated: boolean) {
    const nextVersion = version + 1;
    const nextRows = makeReloadRows(nextVersion);
    replaceDataSourceData(dataSource, nextRows, animated);
    setRows(nextRows);
    setVersion(nextVersion);
  }

  function resetRows() {
    const nextRows = cloneRows(initialRows);
    replaceDataSourceData(dataSource, nextRows, false);
    setRows(nextRows);
    setVersion((currentVersion) => {
      return currentVersion + 1;
    });
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>List update lab</Text>
        <Text style={styles.subtitle}>
          Exercise inserts, reloads, moves, and height updates.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.toolbar}
        contentContainerStyle={styles.toolbarContent}
      >
        <DebugButton label="Remove tall" onPress={removeTallRow} />
        <DebugButton label="Insert tall" onPress={insertTallRow} />
        <DebugButton label="Toggle height" onPress={toggleMiddleHeight} />
        <DebugButton label="Move first" onPress={moveFirstToEnd} />
        <DebugButton label="Reverse animated" onPress={replaceAnimated} />
        <DebugButton label="Reload data" onPress={() => replace(false)} />
        <DebugButton label="Reload data (animated)" onPress={() => replace(true)} />
        <DebugButton label="Reset" onPress={resetRows} />
      </ScrollView>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>{rows.length} rows</Text>
        <Text style={styles.summaryText}>version {version}</Text>
      </View>

      <List
        dataSource={dataSource}
        layout={layout}
        renderers={renderers}
        style={{
          height: height - 148,
          width,
        }}
      />
    </View>
  );
}

function DebugButton(props: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={props.onPress}>
      <Text style={styles.buttonText}>{props.label}</Text>
    </Pressable>
  );
}
