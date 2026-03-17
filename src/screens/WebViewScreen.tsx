import React, { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '@/theme';

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
      toValue: 0.75,
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
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.75}
        >
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {isLoading && <View style={styles.loadingDot} />}
        </View>

        <TouchableOpacity
          onPress={() => webViewRef.current?.reload()}
          style={styles.reloadBtn}
          activeOpacity={0.75}
        >
          <Text style={styles.reloadText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        {isLoading && <Animated.View style={[styles.progressFill, { width: progressWidth }]} />}
      </View>

      {/* URL bar */}
      <View style={styles.urlBar}>
        <Text style={styles.urlText} numberOfLines={1}>
          {currentUrl}
        </Text>
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
    ...SHADOWS.header,
  },
  backBtn: {
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.primary,
    flexShrink: 0,
  },
  backText: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.primaryLighter,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  title: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    flex: 1,
  },
  loadingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primaryLight,
    flexShrink: 0,
  },
  reloadBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reloadText: {
    fontFamily: FONTS.sans,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.lg,
  },
  progressTrack: {
    height: 2,
    backgroundColor: COLORS.divider,
  },
  progressFill: {
    height: 2,
    backgroundColor: COLORS.primaryLight,
  },
  urlBar: {
    height: 26,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  urlText: {
    fontFamily: FONTS.mono,
    color: COLORS.textHint,
    fontSize: 11,
  },
  webView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
