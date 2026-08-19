/**
 * @format
 */

import { searchShortcuts } from '../src/utils/shortcutSearch';

test('빈 검색어는 빈 배열을 반환한다', () => {
  expect(searchShortcuts('hwp', '')).toEqual([]);
  expect(searchShortcuts('hwp', '   ')).toEqual([]);
});

test('설명(desc)에 검색어가 포함된 항목을 찾는다', () => {
  const results = searchShortcuts('hwp', '저장');
  expect(results.length).toBeGreaterThan(0);
  results.forEach(r => {
    expect(r.programId).toBe('hwp');
    expect(r.keys.toLowerCase().includes('저장') || r.desc.includes('저장')).toBe(true);
  });
});

test('단축키 표기(keys)에 검색어가 포함된 항목을 찾는다', () => {
  const results = searchShortcuts('hwp', 'Ctrl+F');
  expect(results.some(r => r.keys.includes('Ctrl+F'))).toBe(true);
});

test('대소문자를 구분하지 않는다', () => {
  const upper = searchShortcuts('hwp', 'CTRL+F');
  const lower = searchShortcuts('hwp', 'ctrl+f');
  expect(upper).toEqual(lower);
  expect(upper.length).toBeGreaterThan(0);
});

test('지정한 프로그램 범위 밖의 결과는 포함하지 않는다', () => {
  const results = searchShortcuts('hwp', 'Ctrl+B');
  expect(results.every(r => r.programId === 'hwp')).toBe(true);
  const figmaResults = searchShortcuts('figma', 'Ctrl+B');
  expect(figmaResults.every(r => r.programId === 'figma')).toBe(true);
});
