import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import type { CalendarEventReadable } from 'react-native-calendar-events';
import { COLORS, FONTS, SPACING } from '@/theme';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date}  ${time}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dow = DOW[new Date(y, m - 1, d).getDay()];
  return `${dateKey}  [${dow}]`;
}

/** Returns inclusive end date key (adjusts exclusive all-day end). */
function getInclusiveEndDate(ev: CalendarEventReadable): Date | null {
  if (!ev.endDate) return null;
  const d = new Date(ev.endDate);
  if (ev.allDay) {
    d.setDate(d.getDate() - 1); // exclusive next-day → inclusive last day
  } else if (
    d.getHours() === 0 && d.getMinutes() === 0 &&
    d.getSeconds() === 0 && d.getMilliseconds() === 0
  ) {
    d.setDate(d.getDate() - 1); // local-midnight end = previous day
  }
  return d;
}

/** Number of calendar days the event spans (1 = single day). */
function spanDays(ev: CalendarEventReadable): number {
  const endDate = getInclusiveEndDate(ev);
  if (!endDate) return 1;
  const start = new Date(ev.startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

/** Which day of the span is `dateKey` (1-based), or 0 if not applicable. */
function spanDayIndex(ev: CalendarEventReadable, dateKey: string): number {
  const startKey = fmtDate(ev.startDate);
  const [sy, sm, sd] = startKey.split('-').map(Number);
  const [dy, dm, dd] = dateKey.split('-').map(Number);
  const startD = new Date(sy, sm - 1, sd);
  const thisD  = new Date(dy, dm - 1, dd);
  return Math.round((thisD.getTime() - startD.getTime()) / 86400000) + 1;
}

// Android returns calendar color as an ARGB int or hex string
function resolveCalendarColor(event: CalendarEventReadable): string {
  const c = event.calendar?.color;
  if (!c) return COLORS.green;
  if (typeof c === 'number') {
    // ARGB int → '#RRGGBB'
    return `#${((c >>> 0) & 0xffffff).toString(16).padStart(6, '0')}`;
  }
  return String(c);
}

function fmtAlarm(alarm: { date: string | number }): string {
  if (typeof alarm.date === 'number') {
    if (alarm.date === 0) return '이벤트 시작 시';
    const mins = Math.abs(Math.round(alarm.date));
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}시간 ${m}분 전` : `${h}시간 전`;
    }
    return `${mins}분 전`;
  }
  return fmtDateTime(String(alarm.date));
}

// ── InfoRow ───────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  iconColor,
  multiline = false,
}: {
  icon: string;
  label: string;
  value: string;
  iconColor?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoIcon, iconColor ? { color: iconColor } : undefined]}>
        {icon}
      </Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={multiline ? 0 : 3}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ── EventDetailModal ──────────────────────────────────────────────────────────

interface DetailProps {
  event: CalendarEventReadable | null;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: DetailProps) {
  if (!event) return null;
  const calColor = resolveCalendarColor(event);

  const days = spanDays(event);
  const endDate = getInclusiveEndDate(event);

  let timeValue: string;
  if (event.allDay) {
    if (days <= 1) {
      timeValue = '종일';
    } else {
      timeValue = `${fmtDate(event.startDate)}  ~  ${endDate ? fmtDate(endDate.toISOString()) : '?'}\n기간  ${days}일`;
    }
  } else if (days > 1) {
    timeValue =
      `${fmtDateTime(event.startDate)}\n` +
      `~ ${endDate ? fmtDateTime(endDate.toISOString()) : '?'}\n` +
      `기간  ${days}일`;
  } else {
    timeValue = `${fmtDateTime(event.startDate)}  →  ${event.endDate ? fmtTime(event.endDate) : '--:--'}`;
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          activeOpacity={1}
        />
        <View style={styles.detailCard}>

          {/* Title header */}
          <View style={styles.detailHeader}>
            <View style={[styles.calColorDot, { backgroundColor: calColor }]} />
            <Text style={styles.detailTitle} numberOfLines={2}>{event.title}</Text>
          </View>

          <View style={styles.divider} />

          <ScrollView
            style={styles.detailBody}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: SPACING.xs }}>

            {event.calendar?.title && (
              <InfoRow
                icon="▣"
                label="캘린더"
                value={event.calendar.title}
                iconColor={calColor}
              />
            )}

            <InfoRow icon="◷" label="시간" value={timeValue} />

            {!!event.location && (
              <InfoRow icon="◎" label="위치" value={event.location} />
            )}

            {!!event.notes && (
              <InfoRow icon="◈" label="메모" value={event.notes} multiline />
            )}

            {event.alarms && event.alarms.length > 0 && (
              <InfoRow
                icon="◉"
                label="알람"
                value={event.alarms.map(a => fmtAlarm(a)).join(',  ')}
              />
            )}
          </ScrollView>

          <View style={styles.divider} />
          <TouchableOpacity style={styles.modalFooterBtn} onPress={onClose}>
            <Text style={styles.modalFooterBtnText}>[ CLOSE ]</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

// ── EventListModal ────────────────────────────────────────────────────────────

interface ListProps {
  dateKey: string | null;
  events: CalendarEventReadable[];
  onClose: () => void;
}

export function EventListModal({ dateKey, events, onClose }: ListProps) {
  const [detailEvent, setDetailEvent] = useState<CalendarEventReadable | null>(null);

  return (
    <>
      <Modal
        transparent
        animationType="none"
        visible={!!dateKey}
        onRequestClose={onClose}>
        <Animatable.View animation="fadeIn" duration={200} style={styles.overlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={onClose}
            activeOpacity={1}
          />
          <Animatable.View animation="slideInUp" duration={300} style={styles.listCard}>

            {/* Header */}
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderDate}>
                {dateKey ? fmtDateKey(dateKey) : ''}
              </Text>
              <Text style={styles.listHeaderCount}>
                {events.length} EVENT{events.length !== 1 ? 'S' : ''}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Event list */}
            <ScrollView
              style={styles.listBody}
              showsVerticalScrollIndicator={false}>
              {events.length === 0 ? (
                <Text style={styles.emptyText}>일정 없음</Text>
              ) : (
                events.map((ev, i) => {
                  const color    = resolveCalendarColor(ev);
                  const days     = spanDays(ev);
                  const dayIdx   = dateKey ? spanDayIndex(ev, dateKey) : 1;
                  const isCont   = dayIdx > 1;
                  const endDate  = getInclusiveEndDate(ev);

                  let timeLabel: string;
                  if (ev.allDay) {
                    if (days <= 1) {
                      timeLabel = '종일';
                    } else {
                      timeLabel = `종일  ·  ${fmtDate(ev.startDate)} ~ ${endDate ? fmtDate(endDate.toISOString()) : '?'}  (${days}일)`;
                    }
                  } else {
                    timeLabel = `${fmtTime(ev.startDate)} – ${ev.endDate ? fmtTime(ev.endDate) : '--:--'}`;
                    if (days > 1) {
                      timeLabel += `  ·  ${days}일`;
                    }
                  }

                  return (
                    <TouchableOpacity
                      key={ev.id ?? i}
                      style={styles.eventRow}
                      onPress={() => setDetailEvent(ev)}
                      activeOpacity={0.7}>
                      <View style={[styles.eventColorBar, { backgroundColor: color }]} />
                      <View style={styles.eventRowBody}>
                        {/* Continuation badge */}
                        {isCont && (
                          <View style={styles.contBadgeRow}>
                            <View style={[styles.contBadge, { borderColor: color }]}>
                              <Text style={[styles.contBadgeText, { color }]}>
                                {`${dayIdx} / ${days}일차`}
                              </Text>
                            </View>
                          </View>
                        )}
                        <Text style={styles.eventRowTitle} numberOfLines={1}>
                          {ev.title}
                        </Text>
                        <Text style={styles.eventRowTime}>{timeLabel}</Text>
                        {ev.calendar?.title && (
                          <Text style={styles.eventRowCal}>{ev.calendar.title}</Text>
                        )}
                      </View>
                      <Text style={styles.eventChevron}>›</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.divider} />
            <TouchableOpacity style={styles.modalFooterBtn} onPress={onClose}>
              <Text style={styles.modalFooterBtnText}>[ CLOSE ]</Text>
            </TouchableOpacity>

          </Animatable.View>
        </Animatable.View>
      </Modal>

      {/* Detail modal stacked on top */}
      <EventDetailModal
        event={detailEvent}
        onClose={() => setDetailEvent(null)}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.greenFaint,
  },
  modalFooterBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  modalFooterBtnText: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 2,
  },

  // ── List card
  listCard: {
    width: 460,
    maxHeight: '72%',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 16,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    backgroundColor: 'rgba(0, 255, 65, 0.05)',
  },
  listHeaderDate: {
    fontFamily: FONTS.mono,
    color: COLORS.greenBright,
    fontSize: FONTS.sizes.sm,
    letterSpacing: 1,
    fontWeight: '700',
  },
  listHeaderCount: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 1,
  },
  listBody: {
    maxHeight: 360,
  },
  emptyText: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },

  // Event row
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greenFaint,
    minHeight: 56,
  },
  eventColorBar: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: SPACING.sm,
  },
  eventRowBody: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingRight: SPACING.xs,
  },
  eventRowTitle: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  eventRowTime: {
    fontFamily: FONTS.mono,
    color: COLORS.cyan,
    fontSize: FONTS.sizes.xs,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  eventRowCal: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs - 1,
    marginTop: 2,
  },
  contBadgeRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  contBadge: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  contBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs - 2,
    letterSpacing: 0.5,
  },
  eventChevron: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.lg,
    paddingHorizontal: SPACING.sm,
  },

  // ── Detail card
  detailCard: {
    width: 460,
    maxHeight: '78%',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.sm,
    backgroundColor: 'rgba(0, 255, 65, 0.05)',
    gap: SPACING.xs,
  },
  calColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    flexShrink: 0,
  },
  detailTitle: {
    flex: 1,
    fontFamily: FONTS.mono,
    color: COLORS.greenBright,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: FONTS.sizes.md + 6,
  },
  detailBody: {
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
    maxHeight: 380,
  },

  // InfoRow
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm + 2,
  },
  infoIcon: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: FONTS.sizes.sm,
    width: 22,
    textAlign: 'center',
    marginRight: SPACING.xs,
    marginTop: 1,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs - 1,
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  infoValue: {
    fontFamily: FONTS.mono,
    color: COLORS.white,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 0.3,
    lineHeight: FONTS.sizes.xs + 6,
  },
});
