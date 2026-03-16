import React, { useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { COLORS, FONTS, SPACING } from '@/theme';
import BlinkCursor from '@/components/BlinkCursor';

type Props = NativeStackScreenProps<RootStackParamList, 'WebView'>;

export default function WebViewScreen({ route, navigation }: Props) {
  const { url, title } = route.params;
  const [loadProgress] = useState(new Animated.Value(0));
  const [isLoading, setIsLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState(url);
  const webViewRef = useRef<WebView>(null);

  const onLoadStart = () => {
    setIsLoading(true);
    loadProgress.setValue(0);
    Animated.timing(loadProgress, {
      toValue: 0.7,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  };

  const onLoadEnd = () => {
    Animated.timing(loadProgress, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setIsLoading(false);
      loadProgress.setValue(0);
    });
  };

  const progressWidth = loadProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.root}>
      {/* Terminal header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'[ ← BACK ]'}</Text>
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <Text style={styles.prompt}>&gt; </Text>
          <Text style={styles.title} numberOfLines={1}>{title.toUpperCase()}</Text>
          {isLoading && <BlinkCursor char="_" size={FONTS.sizes.sm} />}
        </View>
        <TouchableOpacity onPress={() => webViewRef.current?.reload()} style={styles.reloadBtn}>
          <Text style={styles.reloadText}>{'[↻]'}</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      {isLoading && (
        <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
      )}

      {/* URL bar */}
      <View style={styles.urlBar}>
        <Text style={styles.urlText} numberOfLines={1}>{currentUrl}</Text>
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webView}
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onNavigationStateChange={state => setCurrentUrl(state.url)}
        allowsBackForwardNavigationGestures
        mixedContentMode="always"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    backgroundColor: 'rgba(0, 255, 65, 0.03)',
  },
  backBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.borderDim,
  },
  backText: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 1,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.sm,
  },
  prompt: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.sm,
  },
  title: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: FONTS.sizes.sm,
    flex: 1,
    letterSpacing: 1,
  },
  reloadBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  reloadText: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.sm,
  },
  progressBar: {
    height: 2,
    backgroundColor: COLORS.green,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  urlBar: {
    height: 24,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 65, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greenFaint,
  },
  urlText: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  webView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
