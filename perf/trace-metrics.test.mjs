import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const source = new URL('./android/src/main/java/com/hannojg/list/perf/tests/TraceMetrics.kt', import.meta.url);
const text = await readFile(source, 'utf8');
const templates = [...text.matchAll(/val query = """([\s\S]*?)"""\.trimIndent\(\)/g)];
const queries = templates.map((match) => {
  return match[1].replaceAll('${captureInfo.targetPackageName}', 'test.app');
});

test('CPU SQL clips each thread to the measured interval and excludes other processes', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE slice(ts INTEGER, dur INTEGER, name TEXT);
      CREATE TABLE process(upid INTEGER, name TEXT);
      CREATE TABLE thread(utid INTEGER, tid INTEGER, name TEXT, upid INTEGER);
      CREATE TABLE sched(ts INTEGER, dur INTEGER, utid INTEGER);
      INSERT INTO slice VALUES(100,100,'ListInteraction');
      INSERT INTO process VALUES(1,'test.app'),(2,'other.app');
      INSERT INTO thread VALUES(1,11,'main',1),(2,12,'worker',1),(3,13,'other',2);
      INSERT INTO sched VALUES(90,40,1),(140,20,1),(180,30,2),(100,100,3),(200,20,1);
    `);
    const statement = database.prepare(queries[0]);
    const rows = statement.all();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].tid, 11);
    assert.equal(rows[0].ms, 50 / 1_000_000);
    assert.equal(rows[1].ms, 20 / 1_000_000);
  } finally { database.close(); }
});

test('frame SQL keeps drops separate and excludes unknown classifications from the jank denominator', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE slice(ts INTEGER, dur INTEGER, name TEXT);
      CREATE TABLE process(upid INTEGER, name TEXT);
      CREATE TABLE actual_frame_timeline_slice(ts INTEGER, dur INTEGER, upid INTEGER, present_type TEXT, jank_type TEXT);
      INSERT INTO slice VALUES(100,100,'ListInteraction');
      INSERT INTO process VALUES(1,'test.app'),(2,'other.app');
      INSERT INTO actual_frame_timeline_slice VALUES
        (110,5,1,'On-time Present','None'),
        (120,5,1,'Late Present','App Deadline Missed'),
        (130,5,1,'Dropped Frame','Dropped Frame'),
        (140,5,1,'Early Present','Unknown Jank'),
        (145,5,1,'Late Present','App Deadline Missed, Unknown Jank'),
        (210,5,1,'Late Present','App Deadline Missed'),
        (150,5,2,'Late Present','App Deadline Missed');
    `);
    const statement = database.prepare(queries[1]);
    const row = statement.get();
    assert.equal(row.frames, 4);
    assert.equal(row.classified, 2);
    assert.equal(row.janky, 1);
    assert.equal(row.dropped, 1);
    assert.equal(row.elapsedNs, 100);
  } finally { database.close(); }
});
