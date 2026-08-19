/**
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useShortcutStore } from '../src/store/useShortcutStore';

beforeEach(async () => {
  useShortcutStore.setState({ favorites: [], recentSearches: [] });
  await AsyncStorage.clear();
});

test('즐겨찾기에 없는 id를 토글하면 추가된다', () => {
  useShortcutStore.getState().toggleFavorite('hwp:hwp-file:0');
  expect(useShortcutStore.getState().favorites).toEqual(['hwp:hwp-file:0']);
  expect(useShortcutStore.getState().isFavorite('hwp:hwp-file:0')).toBe(true);
});

test('즐겨찾기에 있는 id를 다시 토글하면 제거된다', () => {
  useShortcutStore.getState().toggleFavorite('hwp:hwp-file:0');
  useShortcutStore.getState().toggleFavorite('hwp:hwp-file:0');
  expect(useShortcutStore.getState().favorites).toEqual([]);
  expect(useShortcutStore.getState().isFavorite('hwp:hwp-file:0')).toBe(false);
});

test('최근 검색은 가장 최근 항목이 맨 앞에 온다', () => {
  useShortcutStore.getState().addRecentSearch('a');
  useShortcutStore.getState().addRecentSearch('b');
  expect(useShortcutStore.getState().recentSearches).toEqual(['b', 'a']);
});

test('이미 있는 id를 다시 검색하면 중복 없이 맨 앞으로 이동한다', () => {
  useShortcutStore.getState().addRecentSearch('a');
  useShortcutStore.getState().addRecentSearch('b');
  useShortcutStore.getState().addRecentSearch('a');
  expect(useShortcutStore.getState().recentSearches).toEqual(['a', 'b']);
});

test('최근 검색은 최대 6개까지만 유지된다', () => {
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach(id =>
    useShortcutStore.getState().addRecentSearch(id),
  );
  expect(useShortcutStore.getState().recentSearches).toEqual(['g', 'f', 'e', 'd', 'c', 'b']);
});
