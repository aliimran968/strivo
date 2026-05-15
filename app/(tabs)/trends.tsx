import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { StrivoColors } from '@/constants/theme';
import { SubjectTag, TAG_CONFIG, TAG_LIST } from '@/constants/tags';
import { GlobeItem } from '@/services/storage';
import { getSessionsMerged } from '@/services/sessions';

// ─── Tag filter list ──────────────────────────────────────────────────────────

const FILTER_TAGS: Array<'All' | SubjectTag> = ['All', ...TAG_LIST];

// ─── Date helpers (local time) ────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function todayKey(): string {
  return localDateKey(new Date());
}

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function getLast7Days(): { key: string; label: string }[] {
  const today = todayKey();
  return Array.from({ length: 7 }, (_, i) => {
    const key = shiftKey(today, i - 6);
    const [y, mo, d] = key.split('-').map(Number);
    return { key, label: DAY_NAMES[new Date(y, mo - 1, d).getDay()] };
  });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

type Stats = {
  totalSecs: number;
  longestSecs: number;
  streak: number;
  mostUsedTag: string | null;
  last7: { label: string; minutes: number }[];
};

function computeStats(items: GlobeItem[]): Stats {
  const emptyLast7 = getLast7Days().map(({ label }) => ({ label, minutes: 0 }));

  if (items.length === 0) {
    return { totalSecs: 0, longestSecs: 0, streak: 0, mostUsedTag: null, last7: emptyLast7 };
  }

  let totalSecs = 0;
  let longestSecs = 0;
  const tagCounts: Record<string, number> = {};
  const secsByDay: Record<string, number> = {};

  for (const item of items) {
    totalSecs += item.durationSecs;
    if (item.durationSecs > longestSecs) longestSecs = item.durationSecs;
    tagCounts[item.tag] = (tagCounts[item.tag] ?? 0) + 1;
    const key = localDateKey(new Date(item.completedAt));
    secsByDay[key] = (secsByDay[key] ?? 0) + item.durationSecs;
  }

  const mostUsedTag =
    Object.entries(tagCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  // Streak: walk back from today (or yesterday if today has no session)
  const dateSet = new Set(Object.keys(secsByDay));
  let cursor = todayKey();
  if (!dateSet.has(cursor)) cursor = shiftKey(cursor, -1);
  let streak = 0;
  while (dateSet.has(cursor)) {
    streak++;
    cursor = shiftKey(cursor, -1);
  }

  const last7 = getLast7Days().map(({ key, label }) => ({
    label,
    minutes: Math.round((secsByDay[key] ?? 0) / 60),
  }));

  return { totalSecs, longestSecs, streak, mostUsedTag, last7 };
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  if (secs === 0) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtSessionDate(iso: string): string {
  const d = new Date(iso);
  const todayStr = localDateKey(new Date());
  const yesterdayStr = shiftKey(todayStr, -1);
  const dStr = localDateKey(d);
  if (dStr === todayStr) return 'Today';
  if (dStr === yesterdayStr) return 'Yesterday';
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

function niceMax(val: number): number {
  if (val === 0) return 60;
  const step = val <= 30 ? 10 : val <= 90 ? 15 : val <= 180 ? 30 : 60;
  return Math.ceil(val / step) * step;
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

const PAD_L = 34;
const PAD_R = 6;
const PAD_T = 6;
const PAD_B = 26;
const CHART_H = 172;

function BarChart({ data }: { data: { label: string; minutes: number }[] }) {
  const { width: screenW } = useWindowDimensions();
  // card has paddingHorizontal 18, scroll has padding 16 → 2*(16+18) = 68
  const svgW = screenW - 68;
  const contentW = svgW - PAD_L - PAD_R;
  const contentH = CHART_H - PAD_T - PAD_B;
  const baseline = PAD_T + contentH;
  const maxMin = niceMax(Math.max(...data.map((d) => d.minutes)));
  const slotW = contentW / data.length;
  const barW = Math.max(8, slotW * 0.48);

  return (
    <Svg width={svgW} height={CHART_H}>
      {/* Gridlines + y-axis labels */}
      {([0, 0.5, 1] as const).map((t) => {
        const y = PAD_T + contentH * (1 - t);
        const label = String(Math.round(maxMin * t));
        return (
          <React.Fragment key={t}>
            <Line
              x1={PAD_L} y1={y} x2={svgW - PAD_R} y2={y}
              stroke={StrivoColors.border}
              strokeWidth={t === 0 ? 1.5 : 0.6}
              strokeDasharray={t === 0 ? undefined : '3 5'}
            />
            <SvgText
              x={PAD_L - 4} y={y + 4}
              fontSize={9}
              fill={StrivoColors.textMuted}
              textAnchor="end"
            >
              {label}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Bars + x-axis labels */}
      {data.map((d, i) => {
        const barH = maxMin > 0 ? (d.minutes / maxMin) * contentH : 0;
        const bx = PAD_L + i * slotW + (slotW - barW) / 2;
        const isToday = i === data.length - 1;
        return (
          <React.Fragment key={i}>
            {barH > 0 ? (
              <Rect
                x={bx} y={baseline - barH} width={barW} height={barH}
                rx={3}
                fill={isToday ? StrivoColors.accent : StrivoColors.accentDim}
                opacity={isToday ? 1 : 0.65}
              />
            ) : (
              <Rect
                x={bx} y={baseline - 3} width={barW} height={3}
                rx={1.5}
                fill={StrivoColors.border}
              />
            )}
            <SvgText
              x={bx + barW / 2} y={CHART_H - 7}
              fontSize={10}
              fill={isToday ? StrivoColors.accent : StrivoColors.textMuted}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  half,
}: {
  label: string;
  value: string;
  sub?: string;
  half?: boolean;
}) {
  return (
    <View style={[styles.card, half && styles.cardHalf]}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={styles.cardSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Calendar format helpers ─────────────────────────────────────────────────

function fmtDayHeader(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number);
  return `${d} ${SHORT_MONTHS[m - 1]}`;
}

function fmtTimeOfDay(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const min = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`;
}

// ─── Focus Calendar Modal ────────────────────────────────────────────────────

const MIN_CAL        = { year: 2026, month: 3 }; // April 2026 (month 0-indexed)
const CAL_SHEET_H    = 420;

function fmtDurationSheet(secs: number): string {
  const totalMins = Math.max(0, Math.round(secs / 60));
  if (totalMins < 60) return `${totalMins} min`;
  const hrs  = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

function fmtSheetDate(iso: string): string {
  const d   = new Date(iso);
  const key = localDateKey(d);
  return `${fmtDayHeader(key)} ${d.getFullYear()} · ${fmtTimeOfDay(iso)}`;
}

const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const CAL_DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type CalMonth = { year: number; month: number };

function FocusCalendarModal({
  visible,
  onClose,
  sessions,
}: {
  visible: boolean;
  onClose: () => void;
  sessions: GlobeItem[];
}) {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [calMonth, setCalMonth] = useState<CalMonth>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [selectedDate,   setSelectedDate]   = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<GlobeItem | null>(null);

  // Sheet animation values — same pattern as the globe session sheet in explore.tsx
  const sheetY               = useRef(new RNAnimated.Value(CAL_SHEET_H)).current;
  const sheetBackdropOpacity = useRef(new RNAnimated.Value(0)).current;

  function openSheet(session: GlobeItem) {
    setSelectedSession(session);
    sheetY.setValue(CAL_SHEET_H);
    sheetBackdropOpacity.setValue(0);
    RNAnimated.parallel([
      RNAnimated.timing(sheetY,               { toValue: 0, duration: 320, useNativeDriver: true }),
      RNAnimated.timing(sheetBackdropOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  }

  function closeSheet() {
    RNAnimated.parallel([
      RNAnimated.timing(sheetY,               { toValue: CAL_SHEET_H, duration: 240, useNativeDriver: true }),
      RNAnimated.timing(sheetBackdropOpacity, { toValue: 0,           duration: 240, useNativeDriver: true }),
    ]).start(() => setSelectedSession(null));
  }

  // Reset to current month + clear all selections each time the modal opens
  useEffect(() => {
    if (visible) {
      const n = new Date();
      setCalMonth({ year: n.getFullYear(), month: n.getMonth() });
      setSelectedDate(null);
      setSelectedSession(null);
      sheetY.setValue(CAL_SHEET_H);
      sheetBackdropOpacity.setValue(0);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear selection when the user navigates to a different month
  useEffect(() => {
    setSelectedDate(null);
  }, [calMonth.year, calMonth.month]);

  const maxCal: CalMonth = { year: now.getFullYear(), month: now.getMonth() };
  const canGoBack =
    calMonth.year > MIN_CAL.year ||
    (calMonth.year === MIN_CAL.year && calMonth.month > MIN_CAL.month);
  const canGoForward =
    calMonth.year < maxCal.year ||
    (calMonth.year === maxCal.year && calMonth.month < maxCal.month);

  function goBack() {
    if (!canGoBack) return;
    setCalMonth((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 },
    );
  }

  function goForward() {
    if (!canGoForward) return;
    setCalMonth((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 },
    );
  }

  // Build set of date keys that have at least one session
  const activeDays = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) set.add(localDateKey(new Date(s.completedAt)));
    return set;
  }, [sessions]);

  // Group sessions by date key, sorted oldest→newest within each day
  const daySessionsMap = useMemo(() => {
    const map = new Map<string, GlobeItem[]>();
    for (const s of sessions) {
      const key = localDateKey(new Date(s.completedAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
    }
    return map;
  }, [sessions]);

  const todayStr = localDateKey(new Date());
  const { year, month } = calMonth;
  const firstDow = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const day = i - firstDow + 1;
    const inMonth = day >= 1 && day <= daysInMonth;
    const dateKey = inMonth
      ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : null;
    return {
      day,
      inMonth,
      dateKey,
      hasSession: dateKey ? activeDays.has(dateKey) : false,
      isToday: dateKey === todayStr,
      isFuture: dateKey ? dateKey > todayStr : false,
    };
  });

  const daySessions: GlobeItem[] = selectedDate
    ? (daySessionsMap.get(selectedDate) ?? [])
    : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[calStyles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

        {/* Pinned header */}
        <View style={calStyles.header}>
          <Text style={calStyles.headerTitle}>Focus calendar</Text>
          <Pressable style={calStyles.closeBtn} onPress={onClose} hitSlop={12}>
            <Text style={calStyles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* Scrollable body — calendar + optional session list */}
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Month navigation */}
          <View style={calStyles.monthNav}>
            <Pressable
              onPress={goBack}
              hitSlop={16}
              style={[calStyles.navBtn, !canGoBack && calStyles.navBtnDisabled]}
            >
              <Text style={[calStyles.navBtnText, !canGoBack && calStyles.navBtnTextDisabled]}>
                ‹
              </Text>
            </Pressable>
            <Text style={calStyles.monthLabel}>
              {LONG_MONTHS[month]} {year}
            </Text>
            <Pressable
              onPress={goForward}
              hitSlop={16}
              style={[calStyles.navBtn, !canGoForward && calStyles.navBtnDisabled]}
            >
              <Text style={[calStyles.navBtnText, !canGoForward && calStyles.navBtnTextDisabled]}>
                ›
              </Text>
            </Pressable>
          </View>

          {/* Day-of-week headers */}
          <View style={calStyles.dayHeaders}>
            {CAL_DAY_HEADERS.map((d, i) => (
              <View key={i} style={calStyles.dayHeaderCell}>
                <Text style={calStyles.dayHeaderText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={calStyles.grid}>
            {cells.map((cell, i) => (
              <View key={i} style={calStyles.cell}>
                {cell.inMonth ? (
                  cell.hasSession && !cell.isFuture ? (
                    // Tappable — has sessions, not in the future
                    <Pressable
                      onPress={() =>
                        setSelectedDate((prev) =>
                          prev === cell.dateKey ? null : cell.dateKey,
                        )
                      }
                      style={calStyles.cellPressable}
                    >
                      <View
                        style={[
                          calStyles.cellNumWrap,
                          selectedDate === cell.dateKey && calStyles.cellNumWrapSelected,
                        ]}
                      >
                        <Text
                          style={[
                            calStyles.cellNum,
                            cell.isToday && calStyles.cellNumToday,
                            selectedDate === cell.dateKey && calStyles.cellNumSelected,
                          ]}
                        >
                          {cell.day}
                        </Text>
                      </View>
                      <View style={[calStyles.dot, calStyles.dotActive]} />
                    </Pressable>
                  ) : (
                    // Non-tappable — no sessions or future date
                    <>
                      <View style={calStyles.cellNumWrap}>
                        <Text
                          style={[
                            calStyles.cellNum,
                            cell.isToday  && calStyles.cellNumToday,
                            cell.isFuture && calStyles.cellNumFuture,
                          ]}
                        >
                          {cell.day}
                        </Text>
                      </View>
                      <View style={[calStyles.dot, calStyles.dotHidden]} />
                    </>
                  )
                ) : null}
              </View>
            ))}
          </View>

          {/* Day session list — shown when a date is selected */}
          {selectedDate !== null && (
            <>
              <View style={calStyles.sessionDivider} />
              <View style={calStyles.sessionListHead}>
                <Text style={calStyles.sessionListDate}>
                  {fmtDayHeader(selectedDate)}
                </Text>
              </View>
              {daySessions.length === 0 ? (
                <Text style={calStyles.calEmptyText}>No sessions on this day.</Text>
              ) : (
                daySessions.map((s, idx) => (
                  <Pressable
                    key={s.id}
                    onPress={() => openSheet(s)}
                    style={[
                      calStyles.calRow,
                      idx < daySessions.length - 1 && calStyles.calRowBorder,
                    ]}
                  >
                    <View style={calStyles.calRowLeft}>
                      <Text style={calStyles.calRowEmoji}>
                        {TAG_CONFIG[s.tag as SubjectTag]?.emoji ?? '🕯️'}
                      </Text>
                      <Text style={calStyles.calRowTag}>{s.tag}</Text>
                    </View>
                    <Text style={calStyles.calRowTime}>
                      {fmtTimeOfDay(s.completedAt)}
                    </Text>
                    <Text style={calStyles.calRowDuration}>
                      {fmtDuration(s.durationSecs)}
                    </Text>
                  </Pressable>
                ))
              )}
            </>
          )}

        </ScrollView>

        {/* ── Session detail sheet — floats above the calendar ──────────── */}
        {selectedSession && (
          <>
            {/* Darkening backdrop — visual only, no touch interception */}
            <RNAnimated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                calStyles.sheetBackdrop,
                { opacity: sheetBackdropOpacity },
              ]}
            />
            {/* Tap-outside-to-dismiss layer */}
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={closeSheet}
            />
            {/* The sheet itself */}
            <RNAnimated.View
              style={[calStyles.sheet, { transform: [{ translateY: sheetY }] }]}
            >
              <View style={calStyles.sheetHandle} />
              <ScrollView
                contentContainerStyle={calStyles.sheetScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={calStyles.sheetEmoji}>
                  {(TAG_CONFIG[selectedSession.tag as SubjectTag] ?? TAG_CONFIG.Other).emoji}
                </Text>
                <Text style={calStyles.sheetTagName}>
                  {(TAG_CONFIG[selectedSession.tag as SubjectTag] ?? TAG_CONFIG.Other).label}
                </Text>

                <View style={calStyles.sheetDivider} />

                <Text style={calStyles.sheetLabel}>Duration</Text>
                <Text style={calStyles.sheetValue}>
                  {fmtDurationSheet(selectedSession.durationSecs)}
                </Text>

                <View style={{ height: 18 }} />

                <Text style={calStyles.sheetLabel}>Completed</Text>
                <Text style={calStyles.sheetValue}>
                  {fmtSheetDate(selectedSession.completedAt)}
                </Text>
              </ScrollView>
            </RNAnimated.View>
          </>
        )}

      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrendsScreen() {
  const [stats, setStats]             = useState<Stats>(() => computeStats([]));
  const [sessions, setSessions]       = useState<GlobeItem[]>([]);
  const [selectedTag, setSelectedTag] = useState<'All' | SubjectTag>('All');
  const [calendarOpen, setCalendarOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSessionsMerged().then((items) => {
        setStats(computeStats(items));
        setSessions([...items].reverse()); // newest first
      });
    }, []),
  );

  const { totalSecs, longestSecs, streak, mostUsedTag, last7 } = stats;
  const tagDisplay = mostUsedTag
    ? `${TAG_CONFIG[mostUsedTag as keyof typeof TAG_CONFIG]?.emoji ?? ''} ${mostUsedTag}`
    : '—';

  const filteredSessions = selectedTag === 'All'
    ? sessions
    : sessions.filter((s) => s.tag === selectedTag);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trends</Text>
      </View>
      <FocusCalendarModal
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        sessions={sessions}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Pressable onPress={() => setCalendarOpen(true)}>
          <StatCard label="Total focus time" value={fmtDuration(totalSecs)} />
        </Pressable>

        <View style={styles.row}>
          <StatCard
            label="Current streak"
            value={streak === 0 ? '—' : `${streak}`}
            sub={streak > 0 ? (streak === 1 ? 'day streak' : 'day streak') : undefined}
            half
          />
          <StatCard label="Longest session" value={fmtDuration(longestSecs)} half />
        </View>

        <StatCard label="Most used tag" value={tagDisplay} />

        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Last 7 days</Text>
          <Text style={styles.chartSub}>minutes per day</Text>
          <BarChart data={last7} />
        </View>

        {/* ── History ─────────────────────────────────────────────────────── */}
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>History</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
            style={styles.pillsScroll}
          >
            {FILTER_TAGS.map((tag) => {
              const active = selectedTag === tag;
              const label = tag === 'All'
                ? 'All'
                : `${TAG_CONFIG[tag].emoji} ${tag}`;
              return (
                <Pressable
                  key={tag}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setSelectedTag(tag)}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {filteredSessions.length === 0 ? (
            <Text style={styles.emptyText}>
              {sessions.length === 0
                ? 'Nothing here yet — finish your first focus session and it will appear right here.'
                : `No ${selectedTag} sessions logged yet — keep going!`}
            </Text>
          ) : (
            filteredSessions.map((session, idx) => (
              <View
                key={session.id}
                style={[
                  styles.sessionRow,
                  idx < filteredSessions.length - 1 && styles.sessionRowBorder,
                ]}
              >
                <Text style={styles.sessionEmoji}>
                  {TAG_CONFIG[session.tag as SubjectTag]?.emoji ?? '🕯️'}
                </Text>
                <View style={styles.sessionMeta}>
                  <Text style={styles.sessionTag}>{session.tag}</Text>
                  <Text style={styles.sessionDate}>{fmtSessionDate(session.completedAt)}</Text>
                </View>
                <Text style={styles.sessionDuration}>{fmtDuration(session.durationSecs)}</Text>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: StrivoColors.bg,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: StrivoColors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: StrivoColors.text,
    fontFamily: 'serif',
    letterSpacing: 0.5,
  },
  scroll: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    backgroundColor: StrivoColors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: StrivoColors.border,
    padding: 18,
    gap: 4,
  },
  cardHalf: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 11,
    color: StrivoColors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: 34,
    fontWeight: '300',
    color: StrivoColors.text,
    fontFamily: 'serif',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  cardSub: {
    fontSize: 12,
    color: StrivoColors.textMuted,
    letterSpacing: 0.3,
  },
  chartCard: {
    backgroundColor: StrivoColors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: StrivoColors.border,
    paddingTop: 18,
    paddingBottom: 10,
    paddingHorizontal: 18,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: StrivoColors.text,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  chartSub: {
    fontSize: 10,
    color: StrivoColors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  historyCard: {
    backgroundColor: StrivoColors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: StrivoColors.border,
    paddingTop: 18,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: StrivoColors.text,
    letterSpacing: 0.4,
    marginBottom: 12,
    paddingHorizontal: 18,
  },
  pillsScroll: {
    marginBottom: 14,
  },
  pillsRow: {
    paddingHorizontal: 18,
    gap: 8,
    flexDirection: 'row',
  },
  pill: {
    borderWidth: 1,
    borderColor: StrivoColors.accent,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillActive: {
    backgroundColor: StrivoColors.accent,
  },
  pillText: {
    fontSize: 13,
    color: StrivoColors.accent,
    letterSpacing: 0.2,
  },
  pillTextActive: {
    color: '#1A1208',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    color: StrivoColors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    lineHeight: 20,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 12,
  },
  sessionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#2a1e0e',
  },
  sessionEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  sessionMeta: {
    flex: 1,
    gap: 2,
  },
  sessionTag: {
    fontSize: 14,
    color: StrivoColors.text,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  sessionDate: {
    fontSize: 11,
    color: StrivoColors.textMuted,
    letterSpacing: 0.2,
  },
  sessionDuration: {
    fontSize: 14,
    color: StrivoColors.accent,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});

// ─── Calendar modal styles ────────────────────────────────────────────────────

const calStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1208',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3D2E1A',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#F0E6D3',
    fontFamily: 'serif',
    letterSpacing: 0.4,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#9A8A72',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F0E6D3',
    fontFamily: 'serif',
    letterSpacing: 0.3,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.25,
  },
  navBtnText: {
    fontSize: 28,
    color: '#C9933A',
    lineHeight: 32,
  },
  navBtnTextDisabled: {
    color: '#9A8A72',
  },
  dayHeaders: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  dayHeaderCell: {
    width: `${100 / 7}%` as unknown as number,
    alignItems: 'center',
    paddingVertical: 6,
  },
  dayHeaderText: {
    fontSize: 11,
    color: '#8A6020',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  cell: {
    width: `${100 / 7}%` as unknown as number,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cellNumWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellNumWrapSelected: {
    backgroundColor: '#C9933A',
  },
  cellNum: {
    fontSize: 15,
    color: '#F0E6D3',
    fontWeight: '400',
  },
  cellNumToday: {
    color: '#C9933A',
    fontWeight: '700',
  },
  cellNumFuture: {
    color: '#9A8A72',
    opacity: 0.45,
  },
  cellNumSelected: {
    color: '#1A1208',
    fontWeight: '700',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#C9933A',
  },
  dotHidden: {
    backgroundColor: 'transparent',
  },
  sessionDivider: {
    height: 1,
    backgroundColor: '#3D2E1A',
    marginTop: 8,
  },
  sessionListHead: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  sessionListDate: {
    fontSize: 13,
    color: '#8A6020',
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  calEmptyText: {
    fontSize: 13,
    color: '#9A8A72',
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 0,
  },
  calRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#2a1e0e',
  },
  calRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calRowEmoji: {
    fontSize: 18,
    width: 26,
    textAlign: 'center',
  },
  calRowTag: {
    fontSize: 14,
    color: '#F0E6D3',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  calRowTime: {
    fontSize: 13,
    color: '#9A8A72',
    letterSpacing: 0.2,
    marginRight: 16,
  },
  calRowDuration: {
    fontSize: 14,
    color: '#C9933A',
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // ── Session detail sheet (matches globe sheet in explore.tsx) ─────────────
  sheetBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: CAL_SHEET_H,
    backgroundColor: '#1A1208',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 24,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 18,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C9933A',
    marginBottom: 18,
  },
  sheetScrollContent: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  sheetEmoji: {
    fontSize: 48,
    textAlign: 'center',
    marginTop: 4,
  },
  sheetTagName: {
    color: '#C9933A',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'serif',
  },
  sheetDivider: {
    width: '70%',
    height: 1,
    backgroundColor: '#C9933A',
    opacity: 0.3,
    marginTop: 18,
    marginBottom: 22,
  },
  sheetLabel: {
    color: '#F0E6D3',
    opacity: 0.5,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },
  sheetValue: {
    color: '#F0E6D3',
    fontSize: 17,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.3,
    alignSelf: 'flex-start',
  },
});
