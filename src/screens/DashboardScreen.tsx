import React, { useEffect } from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { useWeatherStore } from '@/store/useWeatherStore';
import { useNewsStore } from '@/store/useNewsStore';
import { useNotionStore } from '@/store/useNotionStore';
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

  useEffect(() => {
    fetchWeather();
    fetchNews();
    fetchNotion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInterval(() => {
    fetchWeather();
    fetchNews();
    fetchNotion();
  }, 30000);

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <Animated.View entering={FadeIn.duration(600)} style={styles.content}>
        <HeaderBar />

        <View style={styles.columns}>
          {/* Left: Weather + Calendar */}
          <Animated.View entering={SlideInLeft.duration(500).delay(150)} style={styles.colLeft}>
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
          <Animated.View entering={FadeInUp.duration(500).delay(300)} style={styles.colCenter}>
            <NotionWidget />
          </Animated.View>

          {/* Right: News + SysMonitor */}
          <Animated.View entering={SlideInRight.duration(500).delay(150)} style={styles.colRight}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  content: {
    flex: 1,
  },
  columns: {
    flex: 1,
    flexDirection: 'row',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  colLeft: { flex: 22 },
  colCenter: { flex: 38 },
  colRight: { flex: 28 },

  leftStack: { flex: 1, gap: SPACING.sm },
  weatherArea: { flex: 6 },
  calendarArea: { flex: 4 },

  rightStack: { flex: 1, gap: SPACING.sm },
  newsArea: { flex: 6 },
  sysArea: { flex: 4 },
});
