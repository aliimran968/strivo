import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  AppState,
  AppStateStatus,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { StrivoColors } from '@/constants/theme';
import { SubjectTag, TAG_CONFIG, TAG_LIST, DEFAULT_TAG } from '@/constants/tags';
import { saveGlobeItem, getGlobeItems, saveLastTag, getLastTag, getUserProfile, saveUserProfile, getReminderTime, saveReminderTime, clearUserSession, saveBackgroundSession, getBackgroundSession, clearBackgroundSession, GlobeItem } from '@/services/storage';
import { syncSessionToSupabase, getSessionsMerged } from '@/services/sessions';
import { getXPLevel, XP_LEVELS } from '@/constants/xp';
import { notifySessionComplete, scheduleDailyReminder } from '@/services/notifications';
import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

type SessionState = 'idle' | 'running' | 'paused' | 'completed' | 'broken';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_MINUTES = 120;
const DEFAULT_MINUTES = 25;

const CIRCLE_SIZE = 270;
const CIRCLE_CENTER = CIRCLE_SIZE / 2;
const CIRCLE_RADIUS = 100;
const CIRCLE_STROKE = 20;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
const THUMB_R = CIRCLE_STROKE / 2 + 5;

const MIN_ANGLE = (1 / MAX_MINUTES) * 2 * Math.PI;
const MAX_ANGLE = 2 * Math.PI;

// ─── Animated SVG component ───────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Worklet helpers ──────────────────────────────────────────────────────────

function rawAngleFrom(touchX: number, touchY: number): number {
  'worklet';
  const dx = touchX - CIRCLE_CENTER;
  const dy = touchY - CIRCLE_CENTER;
  let beta = Math.atan2(dx, -dy);
  if (beta < 0) beta += 2 * Math.PI;
  return beta;
}

function snapMins(rawMins: number): number {
  'worklet';
  if (rawMins < 3) return 1;
  return Math.max(5, Math.min(MAX_MINUTES, Math.round(rawMins / 5) * 5));
}

function triggerHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIDEBAR_W = 260;

// ─── Profile modal ────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDurationProfile(secs: number): string {
  if (secs === 0) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function profileDateKey(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function profileShiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return profileDateKey(date);
}

function fmtJoinedAt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;
}

function ProfileModal({
  visible,
  onClose,
  userName,
  onNameSaved,
  xp,
  coins,
  joinedAt,
  sessions,
}: {
  visible: boolean;
  onClose: () => void;
  userName: string;
  onNameSaved: (newName: string) => void | Promise<void>;
  xp: number;
  coins: number;
  joinedAt: string | null;
  sessions: GlobeItem[];
}) {
  const insets = useSafeAreaInsets();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState('');

  // Reset edit state each time the modal opens
  useEffect(() => {
    if (visible) setEditingName(false);
  }, [visible]);

  const stats = useMemo(() => {
    let totalSecs = 0;
    const byDay = new Set<string>();
    for (const s of sessions) {
      totalSecs += s.durationSecs;
      byDay.add(profileDateKey(new Date(s.completedAt)));
    }
    let cursor = profileDateKey(new Date());
    if (!byDay.has(cursor)) cursor = profileShiftKey(cursor, -1);
    let streak = 0;
    while (byDay.has(cursor)) {
      streak++;
      cursor = profileShiftKey(cursor, -1);
    }
    return { totalSecs, sessionCount: sessions.length, streak };
  }, [sessions]);

  const level = getXPLevel(xp);
  const progress = level.maxXP === Infinity
    ? 1
    : Math.max(0, Math.min(1, (xp - level.minXP) / (level.maxXP - level.minXP)));
  const nextTitle = level.maxXP === Infinity ? null : XP_LEVELS[level.level]?.title ?? null;
  const xpRightLabel = level.maxXP === Infinity ? `${xp}` : `${xp} / ${level.maxXP}`;
  const xpSubtext = level.maxXP === Infinity
    ? 'Max level reached'
    : `${Math.max(0, level.maxXP - xp)} XP to ${nextTitle ?? '—'}`;

  const initial = (userName || '?').trim().charAt(0).toUpperCase() || '?';

  function startEditing() {
    setNameInput(userName || '');
    setEditingName(true);
  }

  function cancelEditing() {
    setEditingName(false);
  }

  async function saveEditing() {
    const trimmed = nameInput.trim();
    setEditingName(false);
    if (!trimmed) return;
    await onNameSaved(trimmed);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[profileStyles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={profileStyles.topBar}>
          <Text style={profileStyles.topBarLabel}>PROFILE</Text>
          <Pressable onPress={onClose} hitSlop={12} style={profileStyles.closeBtn}>
            <Text style={profileStyles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={profileStyles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={profileStyles.avatarBlock}>
            <View style={profileStyles.avatar}>
              <Text style={profileStyles.avatarInitial}>{initial}</Text>
            </View>
            <Text style={profileStyles.profileName}>{userName || 'Hello'}</Text>
            <Text style={profileStyles.profileLevelTitle}>
              {level.title} · Level {level.level}
            </Text>
          </View>

          {/* XP bar */}
          <View style={profileStyles.xpBlock}>
            <View style={profileStyles.xpHeader}>
              <Text style={profileStyles.xpLabel}>XP</Text>
              <Text style={profileStyles.xpCount}>{xpRightLabel}</Text>
            </View>
            <View style={profileStyles.xpTrack}>
              <View style={[profileStyles.xpFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={profileStyles.xpSubtext}>{xpSubtext}</Text>
          </View>

          <View style={profileStyles.divider} />

          {/* Coins */}
          <View style={profileStyles.coinRow}>
            <Text style={profileStyles.coinLabel}>COINS</Text>
            <View style={profileStyles.coinValueWrap}>
              <View style={profileStyles.coinDot}>
                <Text style={profileStyles.coinDotText}>c</Text>
              </View>
              <Text style={profileStyles.coinValue}>{coins}</Text>
            </View>
          </View>

          <View style={profileStyles.divider} />

          {/* Stats grid */}
          <View style={profileStyles.statsGrid}>
            <View style={profileStyles.statCell}>
              <Text style={profileStyles.statLabel}>Total focus time</Text>
              <Text style={profileStyles.statValue}>{fmtDurationProfile(stats.totalSecs)}</Text>
            </View>
            <View style={profileStyles.statCell}>
              <Text style={profileStyles.statLabel}>Sessions</Text>
              <Text style={profileStyles.statValue}>{stats.sessionCount}</Text>
            </View>
            <View style={profileStyles.statCell}>
              <Text style={profileStyles.statLabel}>Streak</Text>
              <Text style={profileStyles.statValue}>
                {stats.streak > 0 ? `${stats.streak} 🔥` : '—'}
              </Text>
            </View>
            <View style={profileStyles.statCell}>
              <Text style={profileStyles.statLabel}>Member since</Text>
              <Text style={profileStyles.statValue}>{fmtJoinedAt(joinedAt)}</Text>
            </View>
          </View>

          <View style={profileStyles.divider} />

          {/* Edit name */}
          <View style={profileStyles.editNameBlock}>
            {editingName ? (
              <>
                <TextInput
                  style={profileStyles.editInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={saveEditing}
                />
                <View style={profileStyles.editBtnRow}>
                  <Pressable onPress={cancelEditing} hitSlop={8}>
                    <Text style={profileStyles.editCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={saveEditing}
                    style={profileStyles.editSaveBtn}
                    hitSlop={8}
                  >
                    <Text style={profileStyles.editSaveText}>Save</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Pressable onPress={startEditing} hitSlop={8} style={profileStyles.editPrompt}>
                <Text style={profileStyles.editPromptText}>Edit name →</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FocusScreen() {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [selectedTag, setSelectedTag] = useState<SubjectTag>(DEFAULT_TAG);
  const [pendingTag, setPendingTag] = useState<SubjectTag>(DEFAULT_TAG);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [displayMinutes, setDisplayMinutes] = useState(DEFAULT_MINUTES);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_MINUTES * 60);
  const [globeCount, setGlobeCount] = useState(0);
  const [userName, setUserName] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [reminderHour, setReminderHour] = useState(9);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [profileOpen, setProfileOpen]         = useState(false);
  const [profileSessions, setProfileSessions] = useState<GlobeItem[]>([]);
  const [userXP, setUserXP]                   = useState(0);
  const [userCoins, setUserCoins]             = useState(0);
  const [joinedAt, setJoinedAt]               = useState<string | null>(null);

  const insets = useSafeAreaInsets();
  const sidebarX = useSharedValue(SIDEBAR_W);
  const backdropOpacity = useSharedValue(0);

  const sidebarAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sidebarX.value }],
  }));
  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sessionStateRef = useRef<SessionState>('idle');
  // Ref keeps the tag current inside the interval/timer closure
  const selectedTagRef = useRef<SubjectTag>(DEFAULT_TAG);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalDurationRef = useRef(DEFAULT_MINUTES * 60);
  const timeLeftRef = useRef(DEFAULT_MINUTES * 60);

  // Slider shared values
  const minutesShared = useSharedValue(DEFAULT_MINUTES);
  const continuousAngle = useSharedValue((DEFAULT_MINUTES / MAX_MINUTES) * MAX_ANGLE);
  const prevRawAngle = useSharedValue(0);

  // ── Circular slider gesture ─────────────────────────────────────────────────

  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      'worklet';
      const beta = rawAngleFrom(e.x, e.y);
      prevRawAngle.value = beta;
      const angle = beta < MIN_ANGLE ? MAX_ANGLE : beta;
      const clamped = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, angle));
      continuousAngle.value = clamped;
      const mins = snapMins((clamped / MAX_ANGLE) * MAX_MINUTES);
      minutesShared.value = mins;
      runOnJS(setDisplayMinutes)(mins);
    })
    .onUpdate((e) => {
      'worklet';
      const newBeta = rawAngleFrom(e.x, e.y);
      let delta = newBeta - prevRawAngle.value;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      prevRawAngle.value = newBeta;
      const clamped = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, continuousAngle.value + delta));
      continuousAngle.value = clamped;
      const newMins = snapMins((clamped / MAX_ANGLE) * MAX_MINUTES);
      if (newMins !== minutesShared.value) {
        minutesShared.value = newMins;
        runOnJS(setDisplayMinutes)(newMins);
        runOnJS(triggerHaptic)();
      }
    });

  // ── Animated SVG props ──────────────────────────────────────────────────────

  const fillArcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - minutesShared.value / MAX_MINUTES),
  }));

  const thumbProps = useAnimatedProps(() => {
    const beta = (minutesShared.value / MAX_MINUTES) * 2 * Math.PI;
    return {
      cx: CIRCLE_CENTER + CIRCLE_RADIUS * Math.sin(beta),
      cy: CIRCLE_CENTER - CIRCLE_RADIUS * Math.cos(beta),
    };
  });

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const [items, lastTag, profile, reminder] = await Promise.all([
        getGlobeItems(), getLastTag(), getUserProfile(), getReminderTime(),
      ]);

      setGlobeCount(items.length);
      if (lastTag) {
        setSelectedTag(lastTag);
        setPendingTag(lastTag);
        selectedTagRef.current = lastTag;
      }
      setReminderHour(reminder.hour);
      setReminderMinute(reminder.minute);

      let name = profile?.name ?? '';

      if (!name) {
        // Local cache empty — fetch from Supabase (handles session-restored logins)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: row } = await supabase
            .from('profiles')
            .select('name, tags')
            .eq('id', user.id)
            .single();
          if (row?.name) {
            name = row.name as string;
            await saveUserProfile({
              name,
              tags: ((row.tags as string[]) ?? []) as SubjectTag[],
            });
          }
        }
      }

      if (name) setUserName(name);
      setUserXP(profile?.xp ?? 0);
      setUserCoins(profile?.coins ?? 0);
      scheduleDailyReminder(reminder.hour, reminder.minute, name);
      await restoreIfNeeded();
    }
    load();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const current = sessionStateRef.current;
      if (nextState === 'background' && (current === 'running' || current === 'paused')) {
        void saveBackgroundSession({
          timeRemaining: timeLeftRef.current,
          selectedTag: selectedTagRef.current,
          totalDuration: totalDurationRef.current,
          pausedAt: Date.now(),
          wasPaused: current === 'paused',
        });
        if (current === 'running') clearTimer();
      } else if (nextState === 'active') {
        void restoreIfNeeded();
      }
    });
    return () => sub.remove();
  }, []);

  // ── Background session restore ───────────────────────────────────────────────

  async function restoreIfNeeded() {
    const saved = await getBackgroundSession();
    if (!saved) return;
    await clearBackgroundSession();

    selectedTagRef.current = saved.selectedTag;
    totalDurationRef.current = saved.totalDuration;
    setSelectedTag(saved.selectedTag);

    if (saved.wasPaused) {
      timeLeftRef.current = saved.timeRemaining;
      setTimeLeft(saved.timeRemaining);
      sessionStateRef.current = 'paused';
      setSessionState('paused');
      return;
    }

    const elapsed = Math.floor((Date.now() - saved.pausedAt) / 1000);
    const remaining = saved.timeRemaining - elapsed;

    if (remaining <= 0) {
      sessionStateRef.current = 'completed';
      setSessionState('completed');
      const bgItem = {
        id: Date.now().toString(),
        tag: saved.selectedTag,
        durationSecs: saved.totalDuration,
        completedAt: new Date().toISOString(),
      };
      await saveGlobeItem(bgItem);
      void syncSessionToSupabase(bgItem);
      void notifySessionComplete();
      const items = await getGlobeItems();
      setGlobeCount(items.length);
    } else {
      timeLeftRef.current = remaining;
      setTimeLeft(remaining);
      sessionStateRef.current = 'running';
      setSessionState('running');
      startCountdown(remaining, handleCompleted);
    }
  }

  // ── Timer helpers ────────────────────────────────────────────────────────────

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startCountdown(from: number, onComplete: () => void) {
    let remaining = from;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      timeLeftRef.current = remaining;
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        onComplete();
      }
    }, 1000);
  }

  // ── Session handlers ─────────────────────────────────────────────────────────

  function handleStartPress() {
    setPendingTag(selectedTag);
    setSheetVisible(true);
  }

  function handleBeginSession() {
    const tag = pendingTag;
    selectedTagRef.current = tag;
    setSelectedTag(tag);
    setSheetVisible(false);
    beginSession();
    void saveLastTag(tag);
  }

  function beginSession() {
    const totalSecs = displayMinutes * 60;
    totalDurationRef.current = totalSecs;
    timeLeftRef.current = totalSecs;
    setTimeLeft(totalSecs);
    sessionStateRef.current = 'running';
    setSessionState('running');
    startCountdown(totalSecs, handleCompleted);
  }

  function handlePause() {
    clearTimer();
    sessionStateRef.current = 'paused';
    setSessionState('paused');
  }

  function handleResume() {
    sessionStateRef.current = 'running';
    setSessionState('running');
    startCountdown(timeLeftRef.current, handleCompleted);
  }

  function handleEndEarly() {
    clearTimer();
    handleBroken();
  }

  // Only called when countdown reaches zero naturally
  async function handleCompleted() {
    sessionStateRef.current = 'completed';
    setSessionState('completed');

    const completedItem = {
      id: Date.now().toString(),
      tag: selectedTagRef.current,
      durationSecs: totalDurationRef.current,
      completedAt: new Date().toISOString(),
    };
    await saveGlobeItem(completedItem);
    void syncSessionToSupabase(completedItem);
    void notifySessionComplete();

    const items = await getGlobeItems();
    setGlobeCount(items.length);

    // ── Earn XP + coins: 1 per minute focused ──────────────────────────────
    const minsEarned = Math.max(1, Math.floor(totalDurationRef.current / 60));
    const existing = await getUserProfile();
    const newXP    = (existing?.xp    ?? 0) + minsEarned;
    const newCoins = (existing?.coins ?? 0) + minsEarned;
    await saveUserProfile({
      name:      existing?.name      ?? '',
      tags:      existing?.tags      ?? [],
      xp:        newXP,
      coins:     newCoins,
      joinedAt:  existing?.joinedAt,
    });
    setUserXP(newXP);
    setUserCoins(newCoins);
    // Sync to Supabase (best-effort, ignore errors)
    supabase.auth.getUser()
      .then(({ data: { user } }) => {
        if (!user) return;
        void supabase.from('profiles').update({ xp: newXP, coins: newCoins }).eq('id', user.id);
      })
      .catch(() => {});
  }

  async function handleSaveReminder() {
    await saveReminderTime({ hour: reminderHour, minute: reminderMinute });
    await scheduleDailyReminder(reminderHour, reminderMinute, userName);
    setSettingsVisible(false);
  }

  function openSidebar() {
    setSidebarOpen(true);
    sidebarX.value = withTiming(0, { duration: 280 });
    backdropOpacity.value = withTiming(1, { duration: 280 });
  }

  function closeSidebar() {
    sidebarX.value = withTiming(SIDEBAR_W, { duration: 220 });
    backdropOpacity.value = withTiming(0, { duration: 220 });
    setTimeout(() => setSidebarOpen(false), 225);
  }

  async function openProfile() {
    closeSidebar();
    const profile = await getUserProfile();
    setUserXP(profile?.xp ?? 0);
    setUserCoins(profile?.coins ?? 0);
    let ja = profile?.joinedAt ?? null;
    if (!ja) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        ja = user?.created_at ?? null;
      } catch {
        // offline — leave null
      }
    }
    setJoinedAt(ja);
    const items = await getSessionsMerged();
    setProfileSessions(items);
    setProfileOpen(true);
  }

  async function handleProfileNameSaved(newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setUserName(trimmed);
    const existing = await getUserProfile();
    await saveUserProfile({
      name: trimmed,
      tags: existing?.tags ?? [],
      xp: existing?.xp,
      coins: existing?.coins,
      joinedAt: existing?.joinedAt,
    });
    supabase.auth.getUser()
      .then(({ data: { user } }) => {
        if (!user) return;
        void supabase.from('profiles').update({ name: trimmed }).eq('id', user.id);
      })
      .catch(() => {});
  }

  async function doLogOut() {
    closeSidebar();
    clearTimer();
    await supabase.auth.signOut();
    await clearUserSession();
    setTimeout(() => router.replace('/onboarding'), 240);
  }

  function handleLogOut() {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', style: 'destructive', onPress: doLogOut },
      ],
    );
  }

  function handleBroken() {
    clearTimer();
    sessionStateRef.current = 'broken';
    setSessionState('broken');
  }

  function handleReset() {
    const secs = displayMinutes * 60;
    timeLeftRef.current = secs;
    setTimeLeft(secs);
    sessionStateRef.current = 'idle';
    setSessionState('idle');
  }

  // ── Derived flags ────────────────────────────────────────────────────────────

  const isIdle = sessionState === 'idle';
  const isRunning = sessionState === 'running';
  const isPaused = sessionState === 'paused';
  const isCompleted = sessionState === 'completed';
  const isBroken = sessionState === 'broken';

  const statusMessages: Record<SessionState, string> = {
    idle: '',
    running: 'Stay focused…',
    paused: 'Paused',
    completed: 'Session complete!',
    broken: 'Session ended early — no item earned',
  };

  const activeTag = TAG_CONFIG[selectedTag] ?? TAG_CONFIG[DEFAULT_TAG];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.wordmark}>STRIVO</Text>
          {userName ? <Text style={styles.greeting}>Ready, {userName}.</Text> : null}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setSettingsVisible(true)} activeOpacity={0.7}>
            <Ionicons name="settings-outline" size={19} color={StrivoColors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.globeBtn}
            onPress={() => router.navigate('/(tabs)/explore')}
          >
            <Text style={styles.globeEmoji}>📚</Text>
            {globeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{globeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={openSidebar} activeOpacity={0.7}>
            <Ionicons name="menu" size={24} color={StrivoColors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* XP / Coins strip */}
      <View style={styles.xpStrip}>
        <Text style={styles.xpStripLeft}>
          ⚡ {userXP} XP · {getXPLevel(userXP).title}
          {getXPLevel(userXP).maxXP !== Infinity
            ? `  (${getXPLevel(userXP).maxXP - userXP} to next)`
            : ''}
        </Text>
        <Text style={styles.xpStripRight}>🪙 {userCoins}</Text>
      </View>

      {/* ── IDLE: arc slider only ── */}
      {isIdle && (
        <View style={styles.sliderSection}>
          <View style={styles.pickerContainer}>
            <GestureDetector gesture={panGesture}>
              <View style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}>
                <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
                  <G transform={`rotate(-90, ${CIRCLE_CENTER}, ${CIRCLE_CENTER})`}>
                    <Circle
                      cx={CIRCLE_CENTER}
                      cy={CIRCLE_CENTER}
                      r={CIRCLE_RADIUS}
                      stroke={StrivoColors.border}
                      strokeWidth={CIRCLE_STROKE}
                      fill="none"
                      strokeOpacity={0.8}
                    />
                    <AnimatedCircle
                      cx={CIRCLE_CENTER}
                      cy={CIRCLE_CENTER}
                      r={CIRCLE_RADIUS}
                      stroke={StrivoColors.accent}
                      strokeWidth={CIRCLE_STROKE}
                      fill="none"
                      strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                      strokeLinecap="round"
                      animatedProps={fillArcProps}
                    />
                  </G>
                  <AnimatedCircle
                    r={THUMB_R}
                    fill={StrivoColors.accent}
                    stroke={StrivoColors.bg}
                    strokeWidth={3}
                    animatedProps={thumbProps}
                  />
                </Svg>
              </View>
            </GestureDetector>

            <View style={styles.circleCenter} pointerEvents="none">
              <Text style={styles.circleMins}>{displayMinutes}</Text>
              <Text style={styles.circleMinLabel}>min</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── ACTIVE / COMPLETED / BROKEN: timer + tag pill ── */}
      {!isIdle && (
        <View style={styles.sessionSection}>
          <Text
            style={[
              styles.timer,
              isBroken && { color: StrivoColors.broken },
              isCompleted && { color: StrivoColors.accent },
              isPaused && { color: StrivoColors.textMuted },
            ]}
          >
            {isCompleted ? '✓' : formatTime(timeLeft)}
          </Text>

          {/* Subtle tag pill — only during running/paused */}
          {(isRunning || isPaused) && (
            <View style={[styles.tagPill, isPaused && styles.tagPillMuted]}>
              <Text style={styles.tagPillEmoji}>{activeTag.emoji}</Text>
              <Text style={styles.tagPillLabel}>{activeTag.label}</Text>
            </View>
          )}

          <Text
            style={[
              styles.statusText,
              isBroken && { color: StrivoColors.broken },
              isCompleted && { color: StrivoColors.accent },
            ]}
          >
            {statusMessages[sessionState]}
          </Text>
        </View>
      )}

      {/* ── CTA buttons ── */}
      <View style={styles.ctaArea}>
        {isIdle && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleStartPress} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Start Focus</Text>
          </TouchableOpacity>
        )}

        {isRunning && (
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={handlePause} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.destructiveBtn}
              onPress={handleEndEarly}
              activeOpacity={0.8}
            >
              <Text style={styles.destructiveBtnText}>End Session</Text>
            </TouchableOpacity>
          </>
        )}

        {isPaused && (
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleResume} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.destructiveBtn}
              onPress={handleEndEarly}
              activeOpacity={0.8}
            >
              <Text style={styles.destructiveBtnText}>End Session</Text>
            </TouchableOpacity>
          </>
        )}

        {isCompleted && (
          <>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.navigate('/(tabs)/explore')}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>View Your Globe</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.textLink} onPress={handleReset} activeOpacity={0.7}>
              <Text style={styles.textLinkText}>Start new session</Text>
            </TouchableOpacity>
          </>
        )}

        {isBroken && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleReset} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Settings: daily reminder ── */}
      <Modal
        visible={settingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetDismissArea}
            activeOpacity={1}
            onPress={() => setSettingsVisible(false)}
          />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Daily reminder</Text>

            <View style={styles.timePicker}>
              <View style={styles.timeUnit}>
                <TouchableOpacity onPress={() => setReminderHour((h) => (h + 23) % 24)} activeOpacity={0.6}>
                  <Text style={styles.timeArrow}>▲</Text>
                </TouchableOpacity>
                <Text style={styles.timeDigit}>{String(reminderHour).padStart(2, '0')}</Text>
                <TouchableOpacity onPress={() => setReminderHour((h) => (h + 1) % 24)} activeOpacity={0.6}>
                  <Text style={styles.timeArrow}>▼</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.timeColon}>:</Text>
              <View style={styles.timeUnit}>
                <TouchableOpacity onPress={() => setReminderMinute((m) => (m + 55) % 60)} activeOpacity={0.6}>
                  <Text style={styles.timeArrow}>▲</Text>
                </TouchableOpacity>
                <Text style={styles.timeDigit}>{String(reminderMinute).padStart(2, '0')}</Text>
                <TouchableOpacity onPress={() => setReminderMinute((m) => (m + 5) % 60)} activeOpacity={0.6}>
                  <Text style={styles.timeArrow}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, styles.sheetCta]}
              onPress={handleSaveReminder}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Sidebar ── */}
      <Modal
        visible={sidebarOpen}
        transparent
        animationType="none"
        onRequestClose={closeSidebar}
      >
        <View style={styles.sidebarModal}>
          <Animated.View style={[StyleSheet.absoluteFillObject, styles.sidebarBackdrop, backdropAnimStyle]} />
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={closeSidebar}
          />
          <Animated.View style={[styles.sidebarPanel, sidebarAnimStyle]}>
            <View style={[styles.sidebarTop, { paddingTop: insets.top + 24 }]}>
              <TouchableOpacity onPress={openProfile} activeOpacity={0.7}>
                <Text style={styles.sidebarName}>{userName || 'Hello'}</Text>
              </TouchableOpacity>
              <View style={styles.sidebarTagRow}>
                <Text style={styles.sidebarTagEmoji}>{(TAG_CONFIG[selectedTag] ?? TAG_CONFIG[DEFAULT_TAG]).emoji}</Text>
                <Text style={styles.sidebarTagLabel}>{(TAG_CONFIG[selectedTag] ?? TAG_CONFIG[DEFAULT_TAG]).label}</Text>
              </View>
            </View>

            <View style={styles.sidebarDivider} />

            <TouchableOpacity style={styles.sidebarRow} onPress={handleLogOut} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={18} color={StrivoColors.textMuted} />
              <Text style={styles.sidebarRowText}>Log Out</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* ── Profile modal ── */}
      <ProfileModal
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        userName={userName}
        onNameSaved={handleProfileNameSaved}
        xp={userXP}
        coins={userCoins}
        joinedAt={joinedAt}
        sessions={profileSessions}
      />

      {/* ── Tag selection bottom sheet ── */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetDismissArea}
            activeOpacity={1}
            onPress={() => setSheetVisible(false)}
          />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>What are you focusing on?</Text>

            {TAG_LIST.map((tag) => {
              const { emoji, label } = TAG_CONFIG[tag];
              const isSelected = pendingTag === tag;
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.sheetRow, isSelected && styles.sheetRowSelected]}
                  onPress={() => setPendingTag(tag)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.sheetRowEmoji}>{emoji}</Text>
                  <Text style={[styles.sheetRowLabel, isSelected && styles.sheetRowLabelSelected]}>
                    {label}
                  </Text>
                  {isSelected && <View style={styles.sheetRowDot} />}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.primaryBtn, styles.sheetCta]}
              onPress={handleBeginSession}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Begin Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: StrivoColors.bg,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  wordmark: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 5,
    color: StrivoColors.accent,
    fontFamily: 'serif',
  },
  greeting: {
    fontSize: 12,
    color: StrivoColors.textMuted,
    letterSpacing: 0.3,
    marginTop: 1,
  },
  xpStrip: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: StrivoColors.bgCard,
    marginBottom: 6,
  },
  xpStripLeft: {
    fontSize: 11,
    color: StrivoColors.textMuted,
    letterSpacing: 0.2,
    opacity: 0.85,
  },
  xpStripRight: {
    fontSize: 12,
    color: StrivoColors.accent,
    letterSpacing: 0.2,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 8,
  },
  globeBtn: {
    padding: 8,
  },
  globeEmoji: {
    fontSize: 22,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: StrivoColors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: StrivoColors.bg,
  },

  // ── Slider section ──────────────────────────────────────────────────────────
  sliderSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerContainer: {
    position: 'relative',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleMins: {
    fontSize: 56,
    fontWeight: '200',
    color: StrivoColors.text,
    fontFamily: 'serif',
    lineHeight: 62,
  },
  circleMinLabel: {
    fontSize: 15,
    color: StrivoColors.textMuted,
    letterSpacing: 1,
  },

  // ── Session section ─────────────────────────────────────────────────────────
  sessionSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  timer: {
    fontSize: 72,
    fontWeight: '200',
    letterSpacing: 3,
    color: StrivoColors.text,
    fontFamily: 'serif',
    fontVariant: ['tabular-nums'],
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: StrivoColors.bgCard,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: StrivoColors.border,
  },
  tagPillMuted: {
    opacity: 0.45,
  },
  tagPillEmoji: {
    fontSize: 15,
  },
  tagPillLabel: {
    fontSize: 13,
    color: StrivoColors.textMuted,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  statusText: {
    fontSize: 14,
    color: StrivoColors.textMuted,
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // ── CTA area ────────────────────────────────────────────────────────────────
  ctaArea: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
  },
  primaryBtn: {
    backgroundColor: StrivoColors.accent,
    paddingVertical: 17,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: StrivoColors.bg,
    letterSpacing: 0.4,
  },
  destructiveBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5A2020',
    backgroundColor: '#2A1010',
  },
  destructiveBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#C47070',
    letterSpacing: 0.3,
  },
  textLink: {
    paddingVertical: 6,
  },
  textLinkText: {
    fontSize: 14,
    color: StrivoColors.textMuted,
    textDecorationLine: 'underline',
  },

  // ── Tag selection sheet ─────────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetDismissArea: {
    flex: 1,
  },
  sheetCard: {
    backgroundColor: '#1E1509',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 44,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: StrivoColors.border,
    alignSelf: 'center',
    marginBottom: 22,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: StrivoColors.textMuted,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
    gap: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sheetRowSelected: {
    backgroundColor: StrivoColors.bgCardHighlight,
    borderColor: StrivoColors.border,
  },
  sheetRowEmoji: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
  },
  sheetRowLabel: {
    flex: 1,
    fontSize: 16,
    color: StrivoColors.textMuted,
    fontWeight: '500',
  },
  sheetRowLabelSelected: {
    color: StrivoColors.text,
    fontWeight: '600',
  },
  sheetRowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: StrivoColors.accent,
  },
  sheetCta: {
    marginTop: 8,
  },

  // ── Time picker ─────────────────────────────────────────────────────────────
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  timeUnit: {
    alignItems: 'center',
    gap: 8,
  },
  timeArrow: {
    fontSize: 18,
    color: StrivoColors.textMuted,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  timeDigit: {
    fontSize: 48,
    fontWeight: '200',
    color: StrivoColors.text,
    fontFamily: 'serif',
    letterSpacing: 2,
    minWidth: 64,
    textAlign: 'center',
  },
  timeColon: {
    fontSize: 40,
    fontWeight: '200',
    color: StrivoColors.textMuted,
    marginBottom: 8,
  },

  // ── Sidebar ─────────────────────────────────────────────────────────────────
  sidebarModal: {
    flex: 1,
  },
  sidebarBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sidebarPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: SIDEBAR_W,
    backgroundColor: '#100B04',
    borderLeftWidth: 1,
    borderLeftColor: StrivoColors.border,
  },
  sidebarTop: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 8,
  },
  sidebarName: {
    fontSize: 22,
    fontWeight: '600',
    color: StrivoColors.text,
    fontFamily: 'serif',
    letterSpacing: 0.3,
  },
  sidebarTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sidebarTagEmoji: {
    fontSize: 15,
  },
  sidebarTagLabel: {
    fontSize: 13,
    color: StrivoColors.accent,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: StrivoColors.border,
    marginHorizontal: 24,
    marginBottom: 8,
  },
  sidebarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  sidebarRowText: {
    fontSize: 15,
    color: StrivoColors.textMuted,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

});

// ─── Profile modal styles ────────────────────────────────────────────────────

const profileStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1208',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2A1A0A',
  },
  topBarLabel: {
    fontSize: 13,
    color: '#4A3318',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#C9933A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#1A1208',
    fontWeight: '700',
    lineHeight: 16,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // Avatar
  avatarBlock: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#C9933A',
    backgroundColor: '#2E1C0A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarInitial: {
    fontSize: 26,
    color: '#C9933A',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  profileName: {
    fontSize: 20,
    color: '#F0E6D3',
    fontFamily: 'serif',
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  profileLevelTitle: {
    fontSize: 12,
    color: '#C9933A',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },

  // XP
  xpBlock: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  xpLabel: {
    fontSize: 11,
    color: '#6B5030',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  xpCount: {
    fontSize: 13,
    color: '#F0E6D3',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  xpTrack: {
    height: 4,
    backgroundColor: '#2E1C0A',
    borderRadius: 2,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#C9933A',
    borderRadius: 2,
  },
  xpSubtext: {
    fontSize: 11,
    color: '#6B5030',
    letterSpacing: 0.4,
    marginTop: 6,
    textAlign: 'right',
  },

  divider: {
    height: 1,
    backgroundColor: '#2A1A0A',
    marginHorizontal: 20,
  },

  // Coins
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  coinLabel: {
    fontSize: 11,
    color: '#6B5030',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  coinValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coinDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#C9933A',
    alignItems: 'center',
 