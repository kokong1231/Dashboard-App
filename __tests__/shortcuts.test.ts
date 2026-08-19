/**
 * @format
 */

import {
  getShortcutId,
  SHORTCUT_INDEX,
  SHORTCUT_INDEX_BY_ID,
  SHORTCUT_PROGRAMS,
  TOTAL_SHORTCUT_COUNT,
} from '../src/constants/shortcuts';

test('SHORTCUT_INDEX는 전체 단축키 개수만큼 항목을 갖는다', () => {
  expect(SHORTCUT_INDEX).toHaveLength(TOTAL_SHORTCUT_COUNT);
});

test('SHORTCUT_INDEX의 id는 모두 고유하다', () => {
  const ids = new Set(SHORTCUT_INDEX.map(entry => entry.id));
  expect(ids.size).toBe(SHORTCUT_INDEX.length);
});

test('getShortcutId는 프로그램/카테고리/인덱스로 SHORTCUT_INDEX와 동일한 id를 만든다', () => {
  const first = SHORTCUT_PROGRAMS[0];
  const firstCategory = first.categories[0];
  const id = getShortcutId(first.id, firstCategory.id, 0);

  expect(SHORTCUT_INDEX[0].id).toBe(id);
  expect(SHORTCUT_INDEX[0].keys).toBe(firstCategory.items[0].keys);
  expect(SHORTCUT_INDEX[0].desc).toBe(firstCategory.items[0].desc);
});

test('SHORTCUT_INDEX_BY_ID로 id 기준 즉시 조회할 수 있다', () => {
  const sample = SHORTCUT_INDEX[10];
  expect(SHORTCUT_INDEX_BY_ID[sample.id]).toEqual(sample);
});

test('각 항목은 원본 프로그램 인덱스를 갖고 있다', () => {
  const pptEntry = SHORTCUT_INDEX.find(entry => entry.programId === 'ppt');
  const pptIndex = SHORTCUT_PROGRAMS.findIndex(p => p.id === 'ppt');
  expect(pptEntry?.programIndex).toBe(pptIndex);
});
