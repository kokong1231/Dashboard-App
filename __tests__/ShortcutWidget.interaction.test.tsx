/**
 * @format
 */

import React from 'react';
import { Modal } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import ShortcutWidget from '../src/components/ShortcutWidget';
import { getShortcutId, SHORTCUT_PROGRAMS } from '../src/constants/shortcuts';
import { useShortcutStore } from '../src/store/useShortcutStore';

const firstProgram = SHORTCUT_PROGRAMS[0];
const firstCategory = firstProgram.categories[0];
const firstItemId = getShortcutId(firstProgram.id, firstCategory.id, 0);

beforeEach(() => {
  useShortcutStore.setState({ favorites: [], recentSearches: [] });
});

async function renderWidget() {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<ShortcutWidget />);
  });

  // onLayout never fires in react-test-renderer, so drive the pager's
  // width manually to mount the (width-gated) program pages.
  await ReactTestRenderer.act(() => {
    tree!.root
      .findByProps({ testID: 'shortcut-pager' })
      .props.onLayout({ nativeEvent: { layout: { width: 300, height: 400 } } });
  });

  return tree!;
}

test('검색 버튼을 누르면 검색 모달이 열린다', async () => {
  const tree = await renderWidget();

  expect(tree.root.findByType(Modal).props.visible).toBe(false);

  await ReactTestRenderer.act(() => {
    tree.root.findByProps({ testID: 'shortcut-search-button' }).props.onPress();
  });

  expect(tree.root.findByType(Modal).props.visible).toBe(true);

  await ReactTestRenderer.act(() => {
    tree.unmount();
  });
});

test('별표를 누르면 즐겨찾기 스토어에 해당 id가 추가/제거된다', async () => {
  const tree = await renderWidget();

  await ReactTestRenderer.act(() => {
    tree.root.findAllByProps({ testID: `shortcut-star-${firstItemId}` })[0].props.onPress();
  });
  expect(useShortcutStore.getState().favorites).toContain(firstItemId);

  await ReactTestRenderer.act(() => {
    tree.root.findAllByProps({ testID: `shortcut-star-${firstItemId}` })[0].props.onPress();
  });
  expect(useShortcutStore.getState().favorites).not.toContain(firstItemId);

  await ReactTestRenderer.act(() => {
    tree.unmount();
  });
});

test('즐겨찾기가 있으면 즐겨찾기 카테고리가 상단에 표시된다', async () => {
  useShortcutStore.setState({ favorites: [firstItemId], recentSearches: [] });

  const tree = await renderWidget();

  expect(
    tree.root.findAllByProps({ testID: 'shortcut-category-favorites' }).length,
  ).toBeGreaterThan(0);

  await ReactTestRenderer.act(() => {
    tree.unmount();
  });
});

test('즐겨찾기가 없으면 즐겨찾기 카테고리가 표시되지 않는다', async () => {
  const tree = await renderWidget();

  expect(tree.root.findAllByProps({ testID: 'shortcut-category-favorites' })).toHaveLength(0);

  await ReactTestRenderer.act(() => {
    tree.unmount();
  });
});
