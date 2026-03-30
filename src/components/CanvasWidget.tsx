import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import Svg, { Path } from 'react-native-svg';
import GlowBox from './GlowBox';
import { COLORS, FONTS, SPACING } from '@/theme';

// ── Constants ─────────────────────────────────────────────────────────────────

const SOCKET_URL = 'https://socket.jihun.site';
const MY_WHO = 'kj';
const PARTNER_WHO = 'ohs';
const BATCH_SIZE = 15;
const BATCH_INTERVAL_MS = 80;
const AFK_TIMEOUT_MS = 20 * 60 * 1000;
const PEN_WIDTH = 3;
const PEN_COLOR = COLORS.primaryLighter; // #C77DFF

// ── Types ─────────────────────────────────────────────────────────────────────

type EventType = 'drawReset' | 'drawing' | 'live' | 'wait';

interface NPoint { x: number; y: number; }

interface BroadcastMsg {
  who: string;
  eventType: EventType;
  data?: any;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Server protocol: all events use 'message' with { key: 'broadcast', ...payload }
function emitBroadcast(socket: Socket | null, payload: BroadcastMsg) {
  socket?.emit('message', { key: 'broadcast', ...payload });
}

function toSvgPath(pts: NPoint[], sw: number, sh: number): string {
  if (pts.length === 0) return '';
  return (
    `M${(pts[0].x * sw).toFixed(1)},${(pts[0].y * sh).toFixed(1)}` +
    pts.slice(1).map(p => ` L${(p.x * sw).toFixed(1)},${(p.y * sh).toFixed(1)}`).join('')
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CanvasWidget() {
  // Socket
  const socketRef = useRef<Socket | null>(null);

  // Canvas size (stored in ref for PanResponder closures)
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Drawing paths (normalized NPoint[][] — denormalized at render time)
  const localPathsRef = useRef<NPoint[][]>([]);
  const localCurrentRef = useRef<NPoint[]>([]);
  const remotePathsRef = useRef<NPoint[][]>([]);
  const remoteInProgressRef = useRef<Map<string, NPoint[]>>(new Map());

  // Batching
  const batchBufferRef = useRef<NPoint[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const strokeIdRef = useRef('');

  // AFK
  const lastTouchRef = useRef(Date.now());
  const myStatusRef = useRef<'live' | 'wait'>('live');

  // UI state
  const [connected, setConnected] = useState(false);
  const [myStatus, setMyStatus] = useState<'live' | 'wait'>('live');
  const [partnerStatus, setPartnerStatus] = useState<'live' | 'wait' | 'unknown'>('unknown');
  const [, setTick] = useState(0);

  useEffect(() => { myStatusRef.current = myStatus; }, [myStatus]);

  // ── Socket setup ────────────────────────────────────────────────────────────

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      emitBroadcast(socket, { who: MY_WHO, eventType: myStatusRef.current, data: null });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('message', (raw: { key: string } & BroadcastMsg) => {
      if (raw.key !== 'broadcast') return;
      const msg: BroadcastMsg = raw;
      if (msg.who !== PARTNER_WHO) return;

      if (msg.eventType === 'live') {
        setPartnerStatus('live');
      } else if (msg.eventType === 'wait') {
        setPartnerStatus('wait');
      } else if (msg.eventType === 'drawing' && msg.data) {
        const { strokeId, points, isEnd } = msg.data as {
          strokeId: string;
          points: NPoint[];
          isEnd: boolean;
        };
        const existing = remoteInProgressRef.current.get(strokeId) ?? [];
        const updated = [...existing, ...(points ?? [])];
        if (isEnd) {
          remoteInProgressRef.current.delete(strokeId);
          if (updated.length > 0) remotePathsRef.current.push(updated);
        } else {
          remoteInProgressRef.current.set(strokeId, updated);
        }
        setTick(t => t + 1);
      } else if (msg.eventType === 'drawReset') {
        remotePathsRef.current = [];
        remoteInProgressRef.current.clear();
        localPathsRef.current = [];
        localCurrentRef.current = [];
        setTick(t => t + 1);
      }
    });

    return () => { socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── AFK timer ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const iv = setInterval(() => {
      if (myStatusRef.current === 'live' && Date.now() - lastTouchRef.current >= AFK_TIMEOUT_MS) {
        myStatusRef.current = 'wait';
        setMyStatus('wait');
        emitBroadcast(socketRef.current, { who: MY_WHO, eventType: 'wait', data: null });
      }
    }, 60_000);
    return () => clearInterval(iv);
  }, []);

  // ── AppState ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        if (myStatusRef.current === 'live') {
          myStatusRef.current = 'wait';
          setMyStatus('wait');
          emitBroadcast(socketRef.current, { who: MY_WHO, eventType: 'wait', data: null });
        }
      } else {
        lastTouchRef.current = Date.now();
        myStatusRef.current = 'live';
        setMyStatus('live');
        emitBroadcast(socketRef.current, { who: MY_WHO, eventType: 'live', data: null });
      }
    });
    return () => sub.remove();
  }, []);

  // ── Button handlers ─────────────────────────────────────────────────────────

  function handleReset() {
    localPathsRef.current = [];
    localCurrentRef.current = [];
    remotePathsRef.current = [];
    remoteInProgressRef.current.clear();
    setTick(t => t + 1);
    emitBroadcast(socketRef.current, { who: MY_WHO, eventType: 'drawReset', data: null });
  }

  function handleSetLive() {
    lastTouchRef.current = Date.now();
    myStatusRef.current = 'live';
    setMyStatus('live');
    emitBroadcast(socketRef.current, { who: MY_WHO, eventType: 'live', data: null });
  }

  function handleSetWait() {
    myStatusRef.current = 'wait';
    setMyStatus('wait');
    emitBroadcast(socketRef.current, { who: MY_WHO, eventType: 'wait', data: null });
  }

  // ── PanResponder ────────────────────────────────────────────────────────────

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: e => {
        lastTouchRef.current = Date.now();
        if (myStatusRef.current === 'wait') {
          myStatusRef.current = 'live';
          setMyStatus('live');
          emitBroadcast(socketRef.current, { who: MY_WHO, eventType: 'live', data: null });
        }
        const { locationX, locationY } = e.nativeEvent;
        const { width: sw, height: sh } = canvasSizeRef.current;
        if (!sw || !sh) return;
        const pt: NPoint = { x: locationX / sw, y: locationY / sh };
        strokeIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localCurrentRef.current = [pt];
        setTick(t => t + 1);
      },

      onPanResponderMove: e => {
        lastTouchRef.current = Date.now();
        const { locationX, locationY } = e.nativeEvent;
        const { width: sw, height: sh } = canvasSizeRef.current;
        if (!sw || !sh) return;
        const pt: NPoint = { x: locationX / sw, y: locationY / sh };
        localCurrentRef.current.push(pt);
        batchBufferRef.current.push(pt);

        if (batchBufferRef.current.length >= BATCH_SIZE) {
          if (batchTimerRef.current) { clearTimeout(batchTimerRef.current); batchTimerRef.current = null; }
          const pts = batchBufferRef.current.splice(0);
          emitBroadcast(socketRef.current, {
            who: MY_WHO, eventType: 'drawing',
            data: { strokeId: strokeIdRef.current, points: pts, isEnd: false },
          });
        } else if (!batchTimerRef.current) {
          batchTimerRef.current = setTimeout(() => {
            batchTimerRef.current = null;
            if (batchBufferRef.current.length > 0) {
              const pts = batchBufferRef.current.splice(0);
              emitBroadcast(socketRef.current, {
                who: MY_WHO, eventType: 'drawing',
                data: { strokeId: strokeIdRef.current, points: pts, isEnd: false },
              });
            }
          }, BATCH_INTERVAL_MS);
        }
        setTick(t => t + 1);
      },

      onPanResponderRelease: () => {
        if (batchTimerRef.current) { clearTimeout(batchTimerRef.current); batchTimerRef.current = null; }
        const pts = batchBufferRef.current.splice(0);
        if (strokeIdRef.current) {
          emitBroadcast(socketRef.current, {
            who: MY_WHO, eventType: 'drawing',
            data: { strokeId: strokeIdRef.current, points: pts, isEnd: true },
          });
        }
        if (localCurrentRef.current.length > 0) {
          localPathsRef.current.push([...localCurrentRef.current]);
          localCurrentRef.current = [];
        }
        setTick(t => t + 1);
      },

      onPanResponderTerminate: () => {
        if (localCurrentRef.current.length > 0) {
          localPathsRef.current.push([...localCurrentRef.current]);
          localCurrentRef.current = [];
        }
        setTick(t => t + 1);
      },
    })
  ).current;

  // ── Render ──────────────────────────────────────────────────────────────────

  const { width: sw, height: sh } = canvasSize;

  const isEmpty =
    localPathsRef.current.length === 0 &&
    remotePathsRef.current.length === 0 &&
    localCurrentRef.current.length === 0 &&
    remoteInProgressRef.current.size === 0;

  const partnerColor = partnerStatus === 'live' ? COLORS.info : COLORS.textHint;
  const partnerLabel = partnerStatus === 'live' ? 'LIVE' : partnerStatus === 'wait' ? 'AFK' : '---';

  return (
    <GlowBox noPadding style={styles.box}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.titleAccent} />
        <Text style={styles.titleText}>CANVAS</Text>
        <View style={[styles.connDot, { backgroundColor: connected ? COLORS.success : COLORS.error }]} />
        <Text style={[styles.partnerText, { color: partnerColor }]}>
          {`OHS::${partnerLabel}`}
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={[styles.myStatusText, { color: myStatus === 'live' ? COLORS.primaryLight : COLORS.amber }]}>
          {`ME::${myStatus === 'live' ? 'LIVE' : 'AFK'}`}
        </Text>
      </View>

      {/* ── Canvas area ── */}
      <View
        style={styles.canvas}
        onLayout={e => {
          const { width: lw, height: lh } = e.nativeEvent.layout;
          canvasSizeRef.current = { width: lw, height: lh };
          setCanvasSize({ width: lw, height: lh });
        }}
        {...panResponder.panHandlers}>

        {sw > 0 && sh > 0 && (
          <Svg width={sw} height={sh} style={StyleSheet.absoluteFill}>
            {remotePathsRef.current.map((pts, i) => (
              <Path
                key={`r-${i}`}
                d={toSvgPath(pts, sw, sh)}
                stroke={PEN_COLOR}
                strokeWidth={PEN_WIDTH}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {Array.from(remoteInProgressRef.current.entries()).map(([sid, pts]) => (
              <Path
                key={`ri-${sid}`}
                d={toSvgPath(pts, sw, sh)}
                stroke={PEN_COLOR}
                strokeWidth={PEN_WIDTH}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {localPathsRef.current.map((pts, i) => (
              <Path
                key={`l-${i}`}
                d={toSvgPath(pts, sw, sh)}
                stroke={PEN_COLOR}
                strokeWidth={PEN_WIDTH}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {localCurrentRef.current.length > 1 && (
              <Path
                d={toSvgPath(localCurrentRef.current, sw, sh)}
                stroke={PEN_COLOR}
                strokeWidth={PEN_WIDTH}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
        )}

        {isEmpty && (
          <View style={styles.hint} pointerEvents="none">
            <Text style={styles.hintText}>
              {connected ? 'touch to draw' : 'connecting...'}
            </Text>
          </View>
        )}
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Toolbar ── */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={handleReset}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.btnText, { color: COLORS.error }]}>RST</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          onPress={myStatus === 'live' ? handleSetWait : handleSetLive}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.btnText, { color: myStatus === 'live' ? COLORS.amber : COLORS.primaryLight }]}>
            {myStatus === 'live' ? '자리비움' : 'LIVE'}
          </Text>
        </TouchableOpacity>
      </View>
    </GlowBox>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  box: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: SPACING.sm,
  },
  titleAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: COLORS.primaryLight,
  },
  titleText: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  connDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  partnerText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  myStatusText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },

  canvas: {
    flex: 1,
    backgroundColor: 'rgba(123,47,190,0.03)',
    overflow: 'hidden',
  },
  hint: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintText: {
    fontFamily: FONTS.mono,
    color: COLORS.textDisabled,
    fontSize: 11,
    letterSpacing: 1,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.surfaceElevated,
  },
  btnText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
