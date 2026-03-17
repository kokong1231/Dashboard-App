import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import PulseText from './PulseText';
import { COLORS, FONTS, SPACING } from '@/theme';

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[styles.value, valueColor ? { color: valueColor } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({ text }: { text: string }) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

export default function WeatherWidget() {
  const { data, isLoading, error, fetch, lastFetched } = useWeatherStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const lastSyncStr = lastFetched
    ? new Date(lastFetched).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

  if (isLoading && !data) {
    return (
      <GlowBox title="◈ WEATHER_SYS" style={styles.box}>
        <PulseText style={styles.loading} duration={600}>
          {'> ACQUIRING DATA...'}
        </PulseText>
      </GlowBox>
    );
  }

  if (error && !data) {
    return (
      <GlowBox title="◈ WEATHER_SYS" style={styles.box}>
        <Text style={styles.error}>{`> ERR: ${error}`}</Text>
        <TouchableOpacity
          onPress={() => useWeatherStore.setState({ lastFetched: null })}
          style={styles.retryBtn}>
          <Text style={styles.retryText}>[RETRY]</Text>
        </TouchableOpacity>
      </GlowBox>
    );
  }

  if (!data) {
    return (
      <GlowBox title="◈ WEATHER_SYS" style={styles.box}>
        <Text style={styles.dimText}>{'> NO DATA'}</Text>
      </GlowBox>
    );
  }

  const { current, hourly, daily, location } = data;
  const condLabel = weatherCodeToLabel(current.weather_code);
  const weatherEmoji = weatherCodeToEmoji(current.weather_code);
  const windDir = windDegToDir(current.wind_direction_10m);

  // Next 6 hours forecast
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

  // 7-day daily forecast
  const weekForecast = daily.time.map((dateStr, i) => {
    const d = new Date(dateStr);
    const dayName = DAY_NAMES[d.getDay()];
    const isToday = i === 0;
    return {
      dayName: isToday ? 'TODAY' : dayName,
      dateStr,
      emoji: weatherCodeToEmoji(daily.weather_code[i]),
      max: daily.temperature_2m_max[i],
      min: daily.temperature_2m_min[i],
      precip: daily.precipitation_probability_max[i] ?? 0,
      isToday,
    };
  });

  return (
    <GlowBox title="◈ WEATHER_SYS" titleRight={isLoading ? 'UPDATING...' : undefined} style={styles.box}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <View style={styles.heroRow}>
          <Text style={styles.emoji}>{weatherEmoji}</Text>
          <Text style={styles.condLabel}>{condLabel}</Text>
        </View>

        <Divider />

        {/* ── Current stats ── */}
        <Row label="LOC:" value={`${location.city}, ${location.country}`} />
        <Row label="TEMP:" value={formatTemp(current.temperature_2m)} valueColor={COLORS.greenBright} />
        <Row label="FEEL:" value={formatTemp(current.apparent_temperature)} />
        <Row label="HMDT:" value={`${current.relative_humidity_2m}%`} />
        <Row label="WIND:" value={`${formatWind(current.wind_speed_10m)} ${windDir}`} />
        <Row
          label="UV:"
          value={`${current.uv_index.toFixed(1)} [${uvIndexLabel(current.uv_index)}]`}
          valueColor={
            current.uv_index >= 8 ? COLORS.red :
            current.uv_index >= 6 ? COLORS.amber :
            COLORS.green
          }
        />

        {/* ── Hourly forecast ── */}
        {forecastSlice.length > 0 && (
          <>
            <Divider />
            <SectionTitle text={`NEXT ${forecastSlice.length}H ─────────────`} />
            {/* Header */}
            <View style={styles.hourlyHeader}>
              <Text style={styles.hourlyColTime}>TIME</Text>
              <Text style={styles.hourlyColTemp}>TEMP</Text>
              <Text style={styles.hourlyColPrecip}>RAIN</Text>
            </View>
            {forecastSlice.map((f, i) => {
              const hh = String(new Date(f.time).getHours()).padStart(2, '0');
              return (
                <View key={i} style={styles.hourlyRow}>
                  <Text style={styles.hourlyColTime}>{hh}:00</Text>
                  <Text style={[styles.hourlyColTemp, { color: COLORS.greenBright }]}>
                    {formatTemp(f.temp)}
                  </Text>
                  <Text style={[styles.hourlyColPrecip, {
                    color: (f.precip ?? 0) >= 60 ? COLORS.cyan : COLORS.greenDim,
                  }]}>
                    {`${f.precip ?? 0}%`}
                  </Text>
                </View>
              );
            })}
          </>
        )}

        {/* ── Weekly forecast ── */}
        {weekForecast.length > 0 && (
          <>
            <Divider />
            <SectionTitle text="WEEKLY ─────────────────────" />
            {/* Header */}
            <View style={styles.weekHeader}>
              <Text style={styles.weekColDay}>DAY</Text>
              <Text style={styles.weekColEmoji}> </Text>
              <Text style={styles.weekColHigh}>HIGH</Text>
              <Text style={styles.weekColLow}>LOW</Text>
              <Text style={styles.weekColRain}>RAIN</Text>
            </View>
            {weekForecast.map((f, i) => (
              <View
                key={i}
                style={[styles.weekRow, f.isToday && styles.weekRowToday]}>
                <Text style={[styles.weekColDay, f.isToday && styles.weekDayToday]}>
                  {f.dayName}
                </Text>
                <Text style={styles.weekColEmoji}>{f.emoji}</Text>
                <Text style={[styles.weekColHigh, { color: COLORS.red }]}>
                  {formatTemp(f.max)}
                </Text>
                <Text style={[styles.weekColLow, { color: COLORS.cyan }]}>
                  {formatTemp(f.min)}
                </Text>
                <Text style={[styles.weekColRain, {
                  color: f.precip >= 60 ? COLORS.cyan : COLORS.greenDim,
                }]}>
                  {`${f.precip}%`}
                </Text>
              </View>
            ))}
          </>
        )}

        <Divider />
        <Text style={styles.sync}>{`SYNC: ${lastSyncStr}`}</Text>
        <View style={{ height: SPACING.sm }} />
      </ScrollView>
    </GlowBox>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },
  loading: { fontFamily: FONTS.mono, color: COLORS.amber, fontSize: FONTS.sizes.sm },
  error:   { fontFamily: FONTS.mono, color: COLORS.red,   fontSize: FONTS.sizes.sm, marginBottom: SPACING.sm },
  retryBtn: { borderWidth: 1, borderColor: COLORS.amber, paddingHorizontal: SPACING.sm, paddingVertical: 3, alignSelf: 'flex-start' },
  retryText: { fontFamily: FONTS.mono, color: COLORS.amber, fontSize: FONTS.sizes.xs },
  dimText:   { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: FONTS.sizes.sm },

  heroRow: { alignItems: 'center', paddingVertical: SPACING.xs },
  emoji:   { fontSize: 40, textAlign: 'center', marginBottom: 4 },
  condLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.greenBright,
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: '700',
  },

  divider: { height: 1, backgroundColor: COLORS.greenFaint, marginVertical: 5, opacity: 0.6 },

  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 2, paddingRight: 2 },
  label: { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: FONTS.sizes.xs, letterSpacing: 1, width: 52 },
  value: { fontFamily: FONTS.mono, color: COLORS.green, fontSize: FONTS.sizes.xs, letterSpacing: 0.5, flex: 1, textAlign: 'right' },

  sectionTitle: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 1,
    marginBottom: 4,
  },

  // ── Hourly ──
  hourlyHeader: { flexDirection: 'row', marginBottom: 2 },
  hourlyRow:    { flexDirection: 'row', marginVertical: 1 },
  hourlyColTime: {
    fontFamily: FONTS.mono, color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs, width: 40, letterSpacing: 0.5,
  },
  hourlyColTemp: {
    fontFamily: FONTS.mono, color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs, flex: 1, textAlign: 'center',
  },
  hourlyColPrecip: {
    fontFamily: FONTS.mono, color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs, width: 34, textAlign: 'right',
  },

  // ── Weekly ──
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greenFaint,
    paddingBottom: 2,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: 2,
  },
  weekRowToday: {
    backgroundColor: 'rgba(0,255,65,0.07)',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.greenBright,
  },
  weekColDay: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs,
    width: 40,
    letterSpacing: 0.5,
  },
  weekDayToday: { color: COLORS.greenBright, fontWeight: '700' },
  weekColEmoji: {
    fontSize: 14,
    width: 22,
    textAlign: 'center',
  },
  weekColHigh: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    flex: 1,
    textAlign: 'right',
    letterSpacing: 0.3,
  },
  weekColLow: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    flex: 1,
    textAlign: 'right',
    letterSpacing: 0.3,
  },
  weekColRain: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    width: 34,
    textAlign: 'right',
    letterSpacing: 0.3,
  },

  sync: { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: FONTS.sizes.xs, letterSpacing: 1 },
});
