import React, { useEffect } from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { useWeatherStore } from '@/store/useWeatherStore';
import { useNewsStore } from '@/store/useNewsStore';
import { useNotionStore } from '@/store/useNotionStore';
import { useGitStore } from '@/store/useGitStore';
import { useCommunityStore } from '@/store/useCommunityStore';
import MatrixBackground from '@/components/MatrixBackground';
import HeaderBar from '@/components/HeaderBar';
import WeatherWidget from '@/components/WeatherWidget';
import CalendarWidget from '@/components/CalendarWidget';
import NotionWidget from '@/components/NotionWidget';
import NewsWidget from '@/components/NewsWidget';
import SysMonitorWidget from '@/components/SysMonitorWidget';
import GitPushToast from '@/components/GitPushToast';
import { COLORS, SPACING } from '@/theme';
import { useInterval } from '@/hooks/useInterval';

export default function DashboardScreen() {
  const fetchWeather = useWeatherStore(s => s.fetch);
  const fetchNews = useNewsStore(s => s.fetch);
  const fetchNotion = useNotionStore(s => s.fetch);
  const loadGit          = useGitStore(s => s.load);
  const loadGitActions   = useGitStore(s => s.loadActions);
  const gitActions       = useGitStore(s => s.actions);
  const fetchCommunity   = useCommunityStore(s => s.fetch);

  // Adaptive polling interval: 10s when a run is in-progress, 30s otherwise
  const hasRunning = gitActions.some(a => a.status === 'in_progress');
  const actionsInterval = hasRunning ? 10000 : 30000;

  // Initial fetch
  useEffect(() => {
    fetchWeather();
    fetchNews();
    fetchNotion();
    loadGit();
    loadGitActions();
    fetchCommunity();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push events: every 10 s — cheap thanks to ETag (304 costs 0 rate-limit)
  useInterval(() => {
    fetchWeather();
    fetchNews();
    fetchNotion();
    loadGit();
  }, 10000);

  // Workflow runs: adaptive — 10s when in_progress, 30s otherwise
  useInterval(loadGitActions, actionsInterval);

  return (
    <View style={styles.root}>
      <StatusBar
        hidden
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* Scanline overlay */}
      <View style={styles.scanlines} pointerEvents="none" />

      <Animated.View entering={FadeIn.duration(800)} style={styles.content}>
        {/* Header with Matrix rain clipped to header area only */}
        <View style={styles.headerWrapper}>
          <MatrixBackground containerHeight={48} />
          <HeaderBar />
        </View>

        <View style={styles.columns}>
          {/* Left: Weather + Calendar */}
          <Animated.View entering={SlideInLeft.duration(600).delay(200)} style={styles.colLeft}>
            <View style={styles.leftStack}>
              <View style={styles.weatherArea}>
                <WeatherWidget />
              </View>
              <View style={styles.calendarArea}>
                <CalendarWidget />
              </View>
            </View>
          </Animated.View>

          {/* Center: Notion */}
          <Animated.View entering={FadeInUp.duration(600).delay(400)} style={styles.colCenter}>
            <NotionWidget />
          </Animated.View>

          {/* Right: News + SysMonitor */}
          <Animated.View entering={SlideInRight.duration(600).delay(200)} style={styles.colRight}>
            <View style={styles.rightStack}>
              <View style={styles.newsArea}>
                <NewsWidget />
              </View>
              <View style={styles.sysArea}>
                <SysMonitorWidget />
              </View>
            </View>
          </Animated.View>
        </View>
      </Animated.View>

      <GitPushToast />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    opacity: 0.04,
  },
  content: {
    flex: 1,
  },
  columns: {
    flex: 1,
    flexDirection: 'row',
    padding: SPACING.xs,
    gap: SPACING.xs,
  },
  headerWrapper: {
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 255, 65, 0.03)',
  },
  colLeft: { flex: 22 },
  colCenter: { flex: 38 },
  colRight: { flex: 28 },

  // Left column stack
  leftStack: { flex: 1, gap: SPACING.xs },
  weatherArea: { flex: 6 },
  calendarArea: { flex: 4 },

  // Right column stack
  rightStack: { flex: 1, gap: SPACING.xs },
  newsArea: { flex: 6 },
  sysArea: { flex: 4 },
});
