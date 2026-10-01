import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  SharedValue,
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { COLORS, FONTS } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_H = 110;
const PAD_X = 8; // 양 끝 라벨이 잘리지 않을 만큼만 여백
const PAD_TOP = 14; // 최대값 라벨 영역
const PAD_BOTTOM = 26; // 리셋 마커 + 시간 축 라벨 영역
const BEEP_MS = 1000; // 1초마다 "띡"
const SWEEP_MS = 2000; // 스캔 헤드가 00시 → 23시를 한 번 훑는 시간 (BEEP_MS 배수)
const TRAIL_LEN = 120; // 밝게 남는 잔상 길이(px)
// 잔상 그라데이션: 헤드에서 멀수록 짧은 겹이 빠져 점점 흐려짐 (길이 비율, 불투명도)
const TRAIL_LAYERS: [number, number][] = [
  [1, 0.12],
  [0.75, 0.18],
  [0.5, 0.25],
  [0.3, 0.35],
  [0.15, 0.6],
];
const LABEL_EVERY = 2; // 시간 라벨 간격(시간)

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * 시간대별(0~23시) 사용량 꺾은선 그래프.
 * 심박 모니터처럼 스캔 헤드가 선을 따라 훑고, 1초마다 펄스 링이 퍼진다.
 */
export default function HourlyPulseChart({
  hourly,
  resetHours,
  currentHour,
}: {
  hourly: number[];
  resetHours: Set<number>;
  currentHour: number;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const plotW = Math.max(0, width - PAD_X * 2);
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + plotH;
  const maxVal = Math.max(...hourly, 1);

  const geom = useMemo(() => {
    const xs = hourly.map((_, h) => PAD_X + (plotW * h) / 23);
    const ys = hourly.map(v => baseY - (Math.max(0, v) / maxVal) * plotH);
    // 누적 호 길이: 스캔 헤드 위치와 잔상(dash) 위치를 일치시키기 위함
    const cum = [0];
    for (let i = 1; i < xs.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
    }
    const line = xs
      .map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`)
      .join(' ');
    const area = `${line} L${xs[xs.length - 1].toFixed(1)},${baseY} L${xs[0].toFixed(
      1,
    )},${baseY} Z`;
    return { xs, ys, cum, total: cum[cum.length - 1], line, area };
  }, [hourly, plotW, plotH, baseY, maxVal]);

  // ── 애니메이션 ──
  const sweep = useSharedValue(0);
  const beep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }),
      -1,
      false,
    );
    beep.value = withRepeat(
      withTiming(1, { duration: BEEP_MS, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(sweep);
      cancelAnimation(beep);
    };
  }, [sweep, beep]);

  const { xs, ys, cum, total } = geom;

  // 호 길이 s 지점의 좌표
  const headPos = (s: number) => {
    'worklet';
    for (let i = 1; i < cum.length; i++) {
      if (s <= cum[i]) {
        const seg = cum[i] - cum[i - 1];
        const t = seg > 0 ? (s - cum[i - 1]) / seg : 0;
        return { x: xs[i - 1] + (xs[i] - xs[i - 1]) * t, y: ys[i - 1] + (ys[i] - ys[i - 1]) * t };
      }
    }
    return { x: xs[xs.length - 1], y: ys[ys.length - 1] };
  };

  const headProps = useAnimatedProps(() => {
    const p = headPos(sweep.value * total);
    const flash = Math.pow(1 - beep.value, 3); // 매 초 시작에 번쩍
    return { cx: p.x, cy: p.y, r: 2.5 + flash * 2.5, opacity: 0.7 + flash * 0.3 };
  });

  const ringProps = useAnimatedProps(() => {
    const p = headPos(sweep.value * total);
    return { cx: p.x, cy: p.y, r: 3 + beep.value * 11, opacity: 0.9 * (1 - beep.value) };
  });

  let peakHour = -1;
  hourly.forEach((v, h) => {
    if (v > 0 && (peakHour < 0 || v > hourly[peakHour])) peakHour = h;
  });

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={CHART_H}>
          {/* 수평 그리드: 0 / 50% / 100% */}
          {[0, 0.5, 1].map(f => (
            <Line
              key={`h${f}`}
              x1={PAD_X}
              x2={PAD_X + plotW}
              y1={baseY - plotH * f}
              y2={baseY - plotH * f}
              stroke={COLORS.greenFaint}
              strokeWidth={1}
              strokeDasharray={f === 0 ? undefined : '2 3'}
            />
          ))}
          <SvgText
            x={PAD_X}
            y={PAD_TOP - 4}
            fill={COLORS.greenDim}
            fontSize={8}
            fontFamily={FONTS.mono}
          >
            {`MAX ${Math.round(maxVal)}%p`}
          </SvgText>

          {/* 수직 그리드: 매 시간 + 라벨 */}
          {xs.map((x, h) => {
            const major = h % LABEL_EVERY === 0 || h === 23;
            const isNow = h === currentHour;
            return (
              <React.Fragment key={`v${h}`}>
                <Line
                  x1={x}
                  x2={x}
                  y1={PAD_TOP}
                  y2={baseY + (major ? 3 : 1.5)}
                  stroke={isNow ? COLORS.amber : COLORS.greenFaint}
                  strokeWidth={1}
                  strokeOpacity={isNow ? 0.8 : major ? 0.9 : 0.45}
                  strokeDasharray={isNow ? '3 2' : undefined}
                />
                {(major || isNow) && (
                  <SvgText
                    x={x}
                    y={CHART_H - 2}
                    fill={isNow ? COLORS.amber : COLORS.greenDim}
                    fontSize={isNow ? 9 : 8}
                    fontWeight={isNow ? '700' : '400'}
                    fontFamily={FONTS.mono}
                    textAnchor={h === 0 ? 'start' : h === 23 ? 'end' : 'middle'}
                  >
                    {String(h).padStart(2, '0')}
                  </SvgText>
                )}
                {resetHours.has(h) && (
                  <SvgText
                    x={x}
                    y={baseY + 12}
                    fill={COLORS.cyan}
                    fontSize={8}
                    fontFamily={FONTS.mono}
                    textAnchor="middle"
                  >
                    {'▲'}
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}

          {/* 기본 선 + 영역 */}
          <Defs>
            <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={COLORS.green} stopOpacity={0.35} />
              <Stop offset="1" stopColor={COLORS.green} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={geom.area} fill="url(#areaGrad)" />
          <Path
            d={geom.line}
            stroke={COLORS.greenDim}
            strokeWidth={1.2}
            strokeOpacity={0.7}
            fill="none"
            strokeLinejoin="round"
          />

          {/* 각 시간대 꼭짓점 */}
          {xs.map((x, h) =>
            hourly[h] > 0 ? (
              <Circle key={`p${h}`} cx={x} cy={ys[h]} r={1.8} fill={COLORS.green} />
            ) : null,
          )}

          {/* 피크 값 */}
          {peakHour >= 0 && (
            <SvgText
              x={xs[peakHour]}
              y={ys[peakHour] - 4}
              fill={COLORS.amber}
              fontSize={8}
              fontFamily={FONTS.mono}
              textAnchor={peakHour === 0 ? 'start' : peakHour === 23 ? 'end' : 'middle'}
            >
              {`${Math.round(hourly[peakHour])}`}
            </SvgText>
          )}

          {/* 심박 스캔: 밝은 잔상 + 헤드 + 1초 펄스 링 */}
          {TRAIL_LAYERS.map(([ratio, opacity]) => (
            <TrailLayer
              key={ratio}
              d={geom.line}
              total={total}
              len={TRAIL_LEN * ratio}
              opacity={opacity}
              sweep={sweep}
            />
          ))}
          <AnimatedCircle
            fill="none"
            stroke={COLORS.greenBright}
            strokeWidth={1.2}
            animatedProps={ringProps}
          />
          <AnimatedCircle fill={COLORS.white} animatedProps={headProps} />
        </Svg>
      )}
    </View>
  );
}

/** 헤드에서 끝나는 길이 len의 잔상 한 겹. 여러 겹을 포개 그라데이션을 만든다. */
function TrailLayer({
  d,
  total,
  len,
  opacity,
  sweep,
}: {
  d: string;
  total: number;
  len: number;
  opacity: number;
  sweep: SharedValue<number>;
}) {
  const props = useAnimatedProps(() => ({ strokeDashoffset: len - sweep.value * total }));
  return (
    <AnimatedPath
      d={d}
      stroke={COLORS.greenBright}
      strokeWidth={2.2}
      strokeOpacity={opacity}
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeDasharray={`${len} ${total + len}`}
      animatedProps={props}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', height: CHART_H, marginBottom: 4 },
});
