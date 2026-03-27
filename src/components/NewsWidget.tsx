import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import GlowBox from './GlowBox';
import CanvasPage from './CanvasPage';

export default function NewsWidget() {
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });

  return (
    <GlowBox title="◈ CANVAS::DRAW" style={styles.box} noPadding>
      <View
        style={{ flex: 1 }}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) setPanelSize({ width, height });
        }}>
        {panelSize.width > 0 && (
          <CanvasPage width={panelSize.width} height={panelSize.height} />
        )}
      </View>
    </GlowBox>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },
});
