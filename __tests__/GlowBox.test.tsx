/**
 * @format
 */

import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import GlowBox from '../src/components/GlowBox';

test('headerExtra는 타이틀 바에 렌더링된다', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <GlowBox title="제목" titleRight="10" headerExtra={<Text testID="extra">EXTRA</Text>}>
        <Text>내용</Text>
      </GlowBox>,
    );
  });

  expect(tree!.root.findByProps({ testID: 'extra' })).toBeTruthy();
});
