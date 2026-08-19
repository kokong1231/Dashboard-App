/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import ShortcutWidget from '../src/components/ShortcutWidget';
import { parseCombo } from '../src/components/Keycap';
import { SHORTCUT_PROGRAMS, TOTAL_SHORTCUT_COUNT } from '../src/constants/shortcuts';

test('단축키 위젯이 렌더링된다', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<ShortcutWidget />);
  });

  const json = JSON.stringify(tree!.toJSON());
  expect(json).toContain('한글');
  expect(json).toContain('Figma');
  expect(json).toContain('PPT');

  await ReactTestRenderer.act(() => {
    tree!.unmount();
  });
});

test('프로그램 3종 · 카테고리 · 단축키 데이터가 유효하다', () => {
  expect(SHORTCUT_PROGRAMS).toHaveLength(3);
  expect(TOTAL_SHORTCUT_COUNT).toBeGreaterThan(200);

  const ids = new Set<string>();
  SHORTCUT_PROGRAMS.forEach(program => {
    expect(program.categories.length).toBeGreaterThan(0);
    program.categories.forEach(category => {
      expect(ids.has(category.id)).toBe(false);
      ids.add(category.id);
      expect(category.items.length).toBeGreaterThan(0);
      category.items.forEach(item => {
        expect(item.keys.trim()).not.toBe('');
        expect(item.desc.trim()).not.toBe('');
      });
    });
  });
});

test('모든 단축키 조합이 하나 이상의 키캡으로 파싱된다', () => {
  SHORTCUT_PROGRAMS.forEach(program =>
    program.categories.forEach(category =>
      category.items.forEach(item => {
        const caps = parseCombo(item.keys).filter(t => t.type === 'key');
        expect(caps.length).toBeGreaterThan(0);
      }),
    ),
  );
});

test('조합 표기법(+ , /)이 올바르게 해석된다', () => {
  expect(parseCombo('Ctrl+N , T').map(t => t.type)).toEqual(['key', 'plus', 'key', 'then', 'key']);
  expect(parseCombo('Home / End').filter(t => t.type === 'key')).toHaveLength(2);
  expect(parseCombo('Ctrl+/').filter(t => t.type === 'key')).toHaveLength(2);
  expect(parseCombo('Space (누른 채)').some(t => t.type === 'note')).toBe(true);
});
