import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '@/theme';

// Claude가 생성한 애니메이션 HTML 조각을 격리된 WebView에서 재생.
// CSP로 모든 외부 요청을 차단하고, 첫 로드 이후의 내비게이션도 막는다.
function wrapFragment(fragment: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:;">
<style>
html,body{margin:0;height:100%;background:#000;color:${COLORS.green};font-family:monospace;overflow:hidden;-webkit-user-select:none;user-select:none}
#stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
#stage>svg{width:100%;height:100%}
body:after{content:'';position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 1px,transparent 1px 3px)}
</style></head><body><div id="stage">${fragment}</div></body></html>`;
}

function BriefAnimationStage({ html }: { html: string }) {
  const source = useMemo(() => ({ html: wrapFragment(html) }), [html]);

  return (
    <View style={styles.wrap}>
      <WebView
        source={source}
        originWhitelist={['about:*', 'data:*']}
        onShouldStartLoadWithRequest={req =>
          req.url.startsWith('about:') || req.url.startsWith('data:')
        }
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        style={styles.webview}
      />
      {/* 무대 테두리 모서리 장식 */}
      <View style={[styles.corner, styles.tl]} pointerEvents="none" />
      <View style={[styles.corner, styles.tr]} pointerEvents="none" />
      <View style={[styles.corner, styles.bl]} pointerEvents="none" />
      <View style={[styles.corner, styles.br]} pointerEvents="none" />
    </View>
  );
}

export default memo(BriefAnimationStage);

const C = 8;
const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.borderDim,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  webview: { flex: 1, backgroundColor: COLORS.background },
  corner: { position: 'absolute', width: C, height: C, borderColor: COLORS.greenBright },
  tl: { top: 0, left: 0, borderTopWidth: 1, borderLeftWidth: 1 },
  tr: { top: 0, right: 0, borderTopWidth: 1, borderRightWidth: 1 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 1, borderLeftWidth: 1 },
  br: { bottom: 0, right: 0, borderBottomWidth: 1, borderRightWidth: 1 },
});
