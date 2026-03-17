import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useWeatherStore } from '@/store/useWeatherStore';
import {
  formatTemp,
  formatWind,
  uvIndexLabel,
  weatherCodeToEmoji,
  weatherCodeToLabel,
  windDegToDir,
} from '@/utils/formatters';
import GlowBox from './GlowBox';
import { COLORS, FONTS, RADIUS, SPACING } from '@/theme';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function StatChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <View style={styles.sectionLabelRow}>
      <View style={styles.sectionLabelDot} />
      <Text style={styles.sectionLabelText}>{text}</Text>
      <View style={styles.sectionLabelLine} />
    </View>
  );
}

export default function WeatherWidget() {
  const { data, isLoading, error, fetch, lastFetched } = useWeatherStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const lastSyncStr = lastFetched
    ? new Date(lastFetched).toLocaleTimeString('ko-KR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--:--';

  if (isLoading && !data) {
    return (
      <GlowBox title="날씨" style={styles.box}>
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primaryLight} size="small" />
          <Text style={styles.loadingText}>날씨 불러오는 중...</Text>
        </View>
      </GlowBox>
    );
  }

  if (error && !data) {
    return (
      <GlowBox title="날씨" style={styles.box}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          onPress={() => useWeatherStore.setState({ lastFetched: null })}
          style={styles.retryBtn}
        >
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </GlowBox>
    );
  }

  if (!data) {
    return (
      <GlowBox title="날씨" style={styles.box}>
        <Text style={styles.hintText}>데이터 없음</Text>
      </GlowBox>
    );
  }

  const { current, hourly, daily, location } = data;
  const condLabel = weatherCodeToLabel(current.weather_code);
  const weatherEmoji = weatherCodeToEmoji(current.weather_code);
  const windDir = windDegToDir(current.wind_direction_10m);

  const nowH = new Date().getHours();
  const forecastSlice = hourly.time
    .map((t, i) => ({
      time: t,
      temp: hourly.temperature_2m[i],
      precip: hourly.precipitation_probability[i],
    }))
    .filter(item => {
      const h = new Date(item.time).getHours();
      return h > nowH && h <= nowH + 6;
    })
    .slice(0, 6);

  const weekForecast = daily.time.map((dateStr, i) => {
    const d = new Date(dateStr);
    return {
      dayName: i === 0 ? '오늘' : DAY_NAMES[d.getDay()],
      emoji: weatherCodeToEmoji(daily.weather_code[i]),
      max: daily.temperature_2m_max[i],
      min: daily.temperature_2m_min[i],
      precip: daily.precipitation_probability_max[i] ?? 0,
      isToday: i === 0,
    };
  });

  const uvColor =
    current.uv_index >= 8 ? COLORS.error : current.uv_index >= 6 ? COLORS.warning : COLORS.success;

  return (
    <GlowBox title="날씨" titleRight={isLoading ? '업데이트 중' : undefined} style={styles.box}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>{weatherEmoji}</Text>
          <View style={styles.heroInfo}>
            <Text style={styles.heroTemp}>{formatTemp(current.temperature_2m)}</Text>
            <Text style={styles.heroLabel}>{condLabel}</Text>
            <Text style={styles.heroLocation}>
              {location.city}, {location.country}
            </Text>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatChip label="체감" value={formatTemp(current.apparent_temperature)} />
          <StatChip label="습도" value={`${current.relative_humidity_2m}%`} color={COLORS.info} />
          <StatChip label="바람" value={`${formatWind(current.wind_speed_10m)} ${windDir}`} />
          <StatChip
            label="자외선"
            value={`${current.uv_index.toFixed(1)} (${uvIndexLabel(current.uv_index)})`}
            color={uvColor}
          />
        </View>

        {/* Hourly forecast */}
        {forecastSlice.length > 0 && (
          <View style={styles.section}>
            <SectionLabel text={`향후 ${forecastSlice.length}시간`} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.hourlyScroll}
            >
              {forecastSlice.map((f, i) => {
                const hh = String(new Date(f.time).getHours()).padStart(2, '0');
                return (
                  <View key={i} style={styles.hourlyCard}>
                    <Text style={styles.hourlyTime}>{hh}:00</Text>
                    <Text style={styles.hourlyTemp}>{formatTemp(f.temp)}</Text>
                    <Text
                      style={[
                        styles.hourlyPrecip,
                        {
                          color: (f.precip ?? 0) >= 60 ? COLORS.info : COLORS.textHint,
                        },
                      ]}
                    >
                      {`${f.precip ?? 0}%`}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Weekly forecast */}
        {weekForecast.length > 0 && (
          <View style={styles.section}>
            <SectionLabel text="주간 예보" />
            {weekForecast.map((f, i) => (
              <View key={i} style={[styles.weekRow, f.isToday && styles.weekRowToday]}>
                <Text style={[styles.weekDay, f.isToday && styles.weekDayToday]}>{f.dayName}</Text>
                <Text style={styles.weekEmoji}>{f.emoji}</Text>
                <View style={styles.weekTemps}>
                  <Text style={[styles.weekTemp, { color: COLORS.error }]}>
                    {formatTemp(f.max)}
                  </Text>
                  <Text style={styles.weekTempSep}>/</Text>
                  <Text style={[styles.weekTemp, { color: COLORS.info }]}>{formatTemp(f.min)}</Text>
                </View>
                <Text
                  style={[
                    styles.weekPrecip,
                    {
                      color: f.precip >= 60 ? COLORS.info : COLORS.textHint,
                    },
                  ]}
                >
                  {`${f.precip}%`}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.syncText}>마지막 업데이트 {lastSyncStr}</Text>
        <View style={{ height: SPACING.sm }} />
      </ScrollView>
    </GlowBox>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  loadingText: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: FONTS.sizes.sm,
    marginTop: SPACING.sm,
  },
  errorText: {
    fontFamily: FONTS.sans,
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
    marginBottom: SPACING.sm,
  },
  retryBtn: {
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignSelf: 'flex-start',
  },
  retryText: {
    fontFamily: FONTS.sans,
    color: COLORS.primaryLighter,
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  hintText: { fontFamily: FONTS.sans, color: COLORS.textHint, fontSize: FONTS.sizes.sm },

  // Hero card
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  heroEmoji: { fontSize: 46 },
  heroInfo: { flex: 1 },
  heroTemp: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  heroLabel: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  heroLocation: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textHint,
    marginTop: 2,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  statChip: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  statLabel: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: COLORS.textHint,
    marginBottom: 2,
  },
  statValue: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  // Section label
  section: { marginBottom: SPACING.md },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  sectionLabelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primaryLight,
  },
  sectionLabelText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  sectionLabelLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.divider,
  },

  // Hourly
  hourlyScroll: { marginHorizontal: -SPACING.xs },
  hourlyCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginHorizontal: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.divider,
    minWidth: 56,
  },
  hourlyTime: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: COLORS.textHint,
    marginBottom: 3,
  },
  hourlyTemp: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: 3,
  },
  hourlyPrecip: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    fontWeight: '500',
  },

  // Weekly
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: 3,
  },
  weekRowToday: {
    backgroundColor: COLORS.primarySurface,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  weekDay: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    width: 38,
    fontWeight: '500',
  },
  weekDayToday: {
    color: COLORS.primaryLighter,
    fontWeight: '700',
  },
  weekEmoji: { fontSize: 16, width: 24, textAlign: 'center' },
  weekTemps: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  weekTemp: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  weekTempSep: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textHint,
  },
  weekPrecip: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.xs,
    width: 34,
    textAlign: 'right',
    fontWeight: '500',
  },

  syncText: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: 11,
    textAlign: 'right',
  },
});
