import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrendsScreen() {
  const [stats, setStats]           = useState<Stats>(() => computeStats([]));
  const [sessions, setSessions]     = useState<GlobeItem[]>([]);
  const [selectedTag, setSelectedTag] = useState<'All' | SubjectTag>('All');

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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <StatCard label="Total focus time" value={fmtDuration(totalSecs)} />

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
                ? 'No sessions yet. Complete your first focus session to see your history.'
                : `No ${selectedTag} sessions yet.`}
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
