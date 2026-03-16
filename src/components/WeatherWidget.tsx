import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Animatable from 'react-native-animatable';
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
import { COLORS, FONTS, SPACING } from '@/theme';

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
        <Animatable.Text
          animation="flash"
          iterationCount="infinite"
          duration={1200}
          style={styles.loading}>
          {'> ACQUIRING DATA...'}
        </Animatable.Text>
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

  const { current, hourly, location } = data;
  const condLabel = weatherCodeToLabel(current.weather_code);
  const weatherEmoji = weatherCodeToEmoji(current.weather_code);
  const windDir = windDegToDir(current.wind_direction_10m);

  // Get next 6 hours of forecast
  const now = new Date();
  const nowH = now.getHours();
  const forecastSlice = hourly.time
    .map((t, i) => ({ time: t, temp: hourly.temperature_2m[i], precip: hourly.precipitation_probability[i] }))
    .filter(item => {
      const h = new Date(item.time).getHours();
      return h > nowH && h <= nowH + 6;
    })
    .slice(0, 6);

  return (
    <GlowBox title="◈ WEATHER_SYS" titleRight={isLoading ? 'UPDATING...' : undefined} style={styles.box}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Emoji + condition */}
        <View style={styles.heroRow}>
          <Text style={styles.emoji}>{weatherEmoji}</Text>
          <Text style={styles.condLabel}>{condLabel}</Text>
        </View>

        <Divider />

        {/* Stats rows */}
        <Row label="LOC:" value={`${location.city}, ${location.country}`} />
        <Row
          label="TEMP:"
          value={formatTemp(current.temperature_2m)}
          valueColor={COLORS.greenBright}
        />
        <Row label="FEEL:" value={formatTemp(current.apparent_temperature)} />
        <Row label="HMDT:" value={`${current.relative_humidity_2m}%`} />
        <Row label="WIND:" value={`${formatWind(current.wind_speed_10m)} ${windDir}`} />
        <Row
          label="UV:"
          value={`${current.uv_index.toFixed(1)} [${uvIndexLabel(current.uv_index)}]`}
          valueColor={
            current.uv_index >= 8
              ? COLORS.red
              : current.uv_index >= 6
              ? COLORS.amber
              : COLORS.green
          }
        />

        {forecastSlice.length > 0 && (
          <>
            <Divider />
            <Text style={styles.sectionTitle}>{`FORECAST +${forecastSlice.length}H`}</Text>
            {forecastSlice.map((f, i) => {
              const hh = String(new Date(f.time).getHours()).padStart(2, '0');
              return (
                <View key={i} style={styles.forecastRow}>
                  <Text style={styles.forecastTime}>{hh}:00</Text>
                  <Text style={styles.forecastTemp}>{formatTemp(f.temp)}</Text>
                  <Text style={styles.forecastPrecip}>{f.precip ?? 0}%</Text>
                </View>
              );
            })}
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
  error: { fontFamily: FONTS.mono, color: COLORS.red, fontSize: FONTS.sizes.sm, marginBottom: SPACING.sm },
  retryBtn: { borderWidth: 1, borderColor: COLORS.amber, paddingHorizontal: SPACING.sm, paddingVertical: 3, alignSelf: 'flex-start' },
  retryText: { fontFamily: FONTS.mono, color: COLORS.amber, fontSize: FONTS.sizes.xs },
  dimText: { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: FONTS.sizes.sm },

  // Hero weather display
  heroRow: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  emoji: {
    fontSize: 44,
    textAlign: 'center',
    marginBottom: 4,
  },
  condLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.greenBright,
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: '700',
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.greenFaint,
    marginVertical: 5,
    opacity: 0.6,
  },

  // Data rows — fixed label width prevents clipping
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
    paddingRight: 2,
  },
  label: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 1,
    width: 52,
  },
  value: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'right',
  },

  sectionTitle: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 1,
    marginBottom: 3,
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 1,
    paddingRight: 2,
  },
  forecastTime: { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: FONTS.sizes.xs, width: 38 },
  forecastTemp: { fontFamily: FONTS.mono, color: COLORS.green, fontSize: FONTS.sizes.xs, flex: 1, textAlign: 'center' },
  forecastPrecip: { fontFamily: FONTS.mono, color: COLORS.cyan, fontSize: FONTS.sizes.xs, width: 32, textAlign: 'right' },
  sync: { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: FONTS.sizes.xs, letterSpacing: 1 },
});
