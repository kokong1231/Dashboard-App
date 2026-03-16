import React, { useEffect } from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useWeatherStore } from '@/store/useWeatherStore';
import { useNewsStore } from '@/store/useNewsStore';
import { useNotionStore } from '@/store/useNotionStore';
import MatrixBackground from '@/components/MatrixBackground';
import HeaderBar from '@/components/HeaderBar';
import WeatherWidget from '@/components/WeatherWidget';
import CalendarWidget from '@/components/CalendarWidget';
import NotionWidget from '@/components/NotionWidget';
import NewsWidget from '@/components/NewsWidget';
import SysMonitorWidget from '@/components/SysMonitorWidget';
import { COLORS, SPACING } from '@/theme';
import { useInterval } from '@/hooks/useInterval';

export default function DashboardScreen() {
  const fetchWeather = useWeatherStore(s => s.fetch);
  const fetchNews = useNewsStore(s => s.fetch);
  const fetchNotion = useNotionStore(s => s.fetch);

  // Initial fetch
  useEffect(() => {
    fetchWeather();
    fetchNews();
    fetchNotion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background refresh every 60s (stores skip if data is still fresh)
  useInterval(() => {
    fetchWeather();
    fetchNews();
    fetchNotion();
  }, 60000);

  return (
    <View style={styles.root}>
      <StatusBar
        hidden
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <MatrixBackground />

      {/* Scanline overlay */}
      <View style={styles.scanlines} pointerEvents="none" />

      <Animatable.View animation="fadeIn" duration={800} style={styles.content}>
        <HeaderBar />

        <View style={styles.columns}>
          {/* Left: Weather + Calendar */}
          <Animatable.View animation="slideInLeft" duration={600} delay={200} style={styles.colLeft}>
            <View style={styles.leftStack}>
              <View style={styles.weatherArea}>
                <WeatherWidget />
              </View>
              <View style={styles.calendarArea}>
                <CalendarWidget />
              </View>
            </View>
          </Animatable.View>

          {/* Center: Notion */}
          <Animatable.View animation="fadeInUp" duration={600} delay={400} style={styles.colCenter}>
            <NotionWidget />
          </Animatable.View>

          {/* Right: News + SysMonitor */}
          <Animatable.View animation="slideInRight" duration={600} delay={200} style={styles.colRight}>
            <View style={styles.rightStack}>
              <View style={styles.newsArea}>
                <NewsWidget />
              </View>
              <View style={styles.sysArea}>
                <SysMonitorWidget />
              </View>
            </View>
          </Animatable.View>
        </View>
      </Animatable.View>
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
