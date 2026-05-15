import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Animated as RNAnimated,
  Modal,
  Pressable,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, G, Defs, ClipPath } from 'react-native-svg';

import { StrivoColors } from '@/constants/theme';
import { SubjectTag, TAG_CONFIG } from '@/constants/tags';
import { getUserProfile, GlobeItem } from '@/services/storage';
import { getSessionsMerged } from '@/services/sessions';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_VISIBLE = 20;
const IC          = '#C4A472';
const IS          = 1.5;

// AnimatedG used only for the drop-in Y offset on new items
const AnimatedG = Animated.createAnimatedComponent(G);

// ─── Seeded pseudo-random ─────────────────────────────────────────────────────

function seededVal(seed: string, salt: number): number {
  let h = (salt * 2654435761) >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h ^ seed.charCodeAt(i), 2654435761)) >>> 0;
  }
  return h / 0xffffffff;
}

// ─── Item placement — collision-aware batch ───────────────────────────────────

const MIN_DIST = 44; // one full tap-target diameter (px)

function buildItemPositions(
  ids: string[],
  maxR: number,
): Map<string, { x: number; y: number }> {
  const placed: Array<{ x: number; y: number }> = [];
  const result = new Map<string, { x: number; y: number }>();

  for (const id of ids) {
    let bestPos: { x: number; y: number } | null = null;
    let bestMinDist = -1;

    for (let attempt = 0; attempt < 30; attempt++) {
      const r     = Math.sqrt(seededVal(id, attempt * 2 + 1)) * maxR;
      const theta = seededVal(id, attempt * 2 + 2) * 2 * Math.PI;
      const rawX  = r * Math.cos(theta);
      const rawY  = r * Math.sin(theta) + maxR * 0.14;

      const dist = Math.sqrt(rawX * rawX + rawY * rawY);
      const x = dist > maxR ? (rawX * maxR) / dist : rawX;
      const y = dist > maxR ? (rawY * maxR) / dist : rawY;

      let minDist = Infinity;
      for (const p of placed) {
        const d = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
        if (d < minDist) minDist = d;
      }

      if (placed.length === 0 || minDist >= MIN_DIST) {
        bestPos = { x, y };
        break;
      }

      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestPos = { x, y };
      }
    }

    const pos = bestPos!;
    result.set(id, pos);
    placed.push(pos);
  }

  return result;
}

// ─── Arc path helper ──────────────────────────────────────────────────────────

function arcPath(cx: number, cy: number, r: number, sDeg: number, eDeg: number): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x1  = cx + r * Math.cos(rad(sDeg));
  const y1  = cy + r * Math.sin(rad(sDeg));
  const x2  = cx + r * Math.cos(rad(eDeg));
  const y2  = cy + r * Math.sin(rad(eDeg));
  return `M ${x1},${y1} A ${r},${r} 0 0 1 ${x2},${y2}`;
}

// ─── SVG icons (centred at 0,0) ───────────────────────────────────────────────

function LaptopIcon() {
  return (
    <G>
      <Path d="M -7,-6 L 7,-6 L 7,0 L -7,0 Z"
        stroke={IC} strokeWidth={IS} fill="none" strokeLinejoin="round" />
      <Path d="M -9,0 L 9,0 L 7,4.5 L -7,4.5 Z"
        stroke={IC} strokeWidth={IS} fill="none" strokeLinejoin="round" />
      <Path d="M -5,2 L 5,2" stroke={IC} strokeWidth={0.9} strokeLinecap="round" />
    </G>
  );
}
function PencilIcon() {
  return (
    <G>
      <Path d="M -2.5,-8 L 2.5,-8 L 2.5,5.5 L 0,8.5 L -2.5,5.5 Z"
        stroke={IC} strokeWidth={IS} fill="none" strokeLinejoin="round" />
      <Path d="M -2.5,-5.5 L 2.5,-5.5" stroke={IC} strokeWidth={IS} />
    </G>
  );
}
function QuillIcon() {
  return (
    <G>
      <Path d="M 0,-9 C 7,-4 7,4 0,9 C -7,4 -7,-4 0,-9 Z"
        stroke={IC} strokeWidth={IS} fill="none" />
      <Path d="M 0,9 L 0,12" stroke={IC} strokeWidth={IS} strokeLinecap="round" />
      <Path d="M 0,-8 L 0,8" stroke={IC} strokeWidth={0.85} strokeDasharray="2 1.8" />
    </G>
  );
}
function BookIcon() {
  return (
    <G>
      <Path d="M -7,5.5 L -7,-5 Q -3.5,-7 0,-5 L 0,5.5 Z"
        stroke={IC} strokeWidth={IS} fill="none" strokeLinejoin="round" />
      <Path d="M 7,5.5 L 7,-5 Q 3.5,-7 0,-5 L 0,5.5 Z"
        stroke={IC} strokeWidth={IS} fill="none" strokeLinejoin="round" />
      <Path d="M 0,-5 L 0,5.5" stroke={IC} strokeWidth={IS} />
    </G>
  );
}
function RulerIcon() {
  return (
    <G transform="rotate(45)">
      <Path d="M -8.5,-2.5 L 8.5,-2.5 L 8.5,2.5 L -8.5,2.5 Z"
        stroke={IC} strokeWidth={IS} fill="none" strokeLinejoin="round" />
      <Path d="M -5.5,-2.5 L -5.5,0"   stroke={IC} strokeWidth={IS} />
      <Path d="M -1.5,-2.5 L -1.5,1.5" stroke={IC} strokeWidth={IS} />
      <Path d="M  2.5,-2.5 L  2.5,0"   stroke={IC} strokeWidth={IS} />
      <Path d="M  6,-2.5 L  6,1.5"     stroke={IC} strokeWidth={IS} />
    </G>
  );
}
function LanternIcon() {
  return (
    <G>
      <Path d="M -2,-8 Q -2,-11.5 0,-11.5 Q 2,-11.5 2,-8"
        stroke={IC} strokeWidth={IS} fill="none" strokeLinecap="round" />
      <Path d="M -4,-8 L 4,-8 L 4,-5.5 L -4,-5.5 Z"
        stroke={IC} strokeWidth={IS} fill="none" strokeLinejoin="round" />
      <Path d="M -4.5,-5.5 L 4.5,-5.5 L 4.5,5.5 L -4.5,5.5 Z"
        stroke={IC} strokeWidth={IS} fill="none" strokeLinejoin="round" />
      <Path d="M -4,5.5 L 4,5.5 L 4,8 L -4,8 Z"
        stroke={IC} strokeWidth={IS} fill="none" strokeLinejoin="round" />
      <Path d="M -4.5,0 L 4.5,0"  stroke={IC} strokeWidth={0.85} />
      <Path d="M 0,-5.5 L 0,5.5"  stroke={IC} strokeWidth={0.85} />
    </G>
  );
}

const TAG_ICONS: Record<SubjectTag, React.ComponentType> = {
  Coding: LaptopIcon, Design: PencilIcon, Writing: QuillIcon,
  Reading: BookIcon,  Maths:  RulerIcon,  Other:   LanternIcon,
};

// ─── Opacity for aging items ──────────────────────────────────────────────────

function itemOpacity(idx: number, total: number): number {
  if (total <= 12) return 1;
  const fadeAfter = 10;
  if (idx < fadeAfter) return 1;
  const t = (idx - fadeAfter) / Math.max(1, total - fadeAfter);
  return Math.max(0.22, 1 - t * 0.78);
}

// ─── Globe item ───────────────────────────────────────────────────────────────
//
// Position is ALWAYS set via a static SVG transform string on the outer G.
// This guarantees the icon renders at the correct (x,y) in all cases.
//
// For new items only: an inner AnimatedG handles a translateY drop offset
// (springs from -(maxR+22) → 0). The outer G's clipPath hides the icon while
// it's above the dome and reveals it as it enters the glass.
//
// For existing items: plain inner G, zero overhead.

type ItemProps = {
  item: GlobeItem;
  idx: number;
  totalItems: number;
  isNew: boolean;
  cx: number;
  cy: number;
  maxR: number;
  pos: { x: number; y: number };
};

// SVG is visual only — no touch handling here. Item taps are handled by an
// absolutely-positioned <Pressable> overlay rendered alongside the SVG in the
// enlarged view (see GlobeScreen). react-native-svg's onPress on <G> proved
// unreliable on some RN versions.
function GlobeItemDot({ item, idx, totalItems, isNew, cx, cy, maxR, pos }: ItemProps) {
  const Icon = TAG_ICONS[item.tag as SubjectTag] ?? LanternIcon;
  const alpha = itemOpacity(idx, totalItems);

  // Drop offset in the inner G's local coordinate space (0 = at rest)
  const dropOffset = useSharedValue(isNew ? -(maxR + 22) : 0);

  useEffect(() => {
    if (!isNew) return;
    dropOffset.value = withSpring(0, { damping: 14, stiffness: 120, mass: 0.9 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only animates the Y offset; X is fixed at 0 (position handled by outer G)
  const animProps = useAnimatedProps(() => ({
    translateY: dropOffset.value,
  }));

  // Outer G: static transform places icon at correct SVG coordinate.
  // clipPath applied here so the dome clips the drop animation correctly.
  return (
    <G
      transform={`translate(${cx + pos.x},${cy + pos.y})`}
      opacity={alpha}
    >
      {isNew ? (
        <AnimatedG animatedProps={animProps}>
          <Icon />
        </AnimatedG>
      ) : (
        <Icon />
      )}
    </G>
  );
}

// ─── Snow shimmer (RN Animated, native driver only) ──────────────────────────
//
// Native-driver-only snow drift overlay. Rendered OUTSIDE the SVG as
// absolute-positioned Animated.View dots, clipped to the dome's interior
// via a circular borderRadius + overflow:hidden wrapper.
//
// Do NOT replace this with react-native-svg's AnimatedCircle — that combo with
// Reanimated crashed on iPhone XR. RN Animated + plain Views is the safe path.

type SnowDotState = {
  translateY: RNAnimated.Value;
  translateX: RNAnimated.Value;
  opacity:    RNAnimated.Value;
  startX:     number;
  yDrift:     number;
  xDrift:     number;
  duration:   number;
  delay:      number;
};

function SnowShimmer({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const dotsRef = useRef<SnowDotState[] | null>(null);
  if (dotsRef.current === null) {
    dotsRef.current = Array.from({ length: 6 }, () => ({
      translateY: new RNAnimated.Value(0),
      translateX: new RNAnimated.Value(0),
      opacity:    new RNAnimated.Value(1),
      // Spawn across the middle 60% of the dome width (avoids the dome edges
      // where the circular clip cuts off most of the bounding box).
      startX:   r * 0.4 + Math.random() * r * 1.2,
      yDrift:   40 + Math.random() * 30,         // 40 – 70 px
      xDrift:   (Math.random() - 0.5) * 20,      // -10 – +10 px
      duration: 2500 + Math.random() * 1500,     // 2500 – 4000 ms
      delay:    Math.random() * 1800,            // staggered start
    }));
  }
  const dots = dotsRef.current;

  useEffect(() => {
    const animations = dots.map((d) => {
      const loop = RNAnimated.loop(
        RNAnimated.parallel([
          RNAnimated.timing(d.translateY, {
            toValue: d.yDrift,
            duration: d.duration,
            useNativeDriver: true,
          }),
          RNAnimated.timing(d.translateX, {
            toValue: d.xDrift,
            duration: d.duration,
            useNativeDriver: true,
          }),
          RNAnimated.sequence([
            RNAnimated.timing(d.opacity, {
              toValue: 0.2,
              duration: d.duration / 2,
              useNativeDriver: true,
            }),
            RNAnimated.timing(d.opacity, {
              toValue: 1,
              duration: d.duration / 2,
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
      const delayed = RNAnimated.sequence([RNAnimated.delay(d.delay), loop]);
      delayed.start();
      return delayed;
    });

    return () => {
      animations.forEach((a) => a.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cx - r,
        top: cy - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        overflow: 'hidden',
      }}
    >
      {dots.map((d, i) => (
        <RNAnimated.View
          key={i}
          style={{
            position: 'absolute',
            left: d.startX,
            top: 0,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: 'rgba(255,255,255,0.55)',
            opacity: d.opacity,
            transform: [
              { translateX: d.translateX },
              { translateY: d.translateY },
            ],
          }}
        />
      ))}
    </View>
  );
}

// ─── Reusable globe SVG ──────────────────────────────────────────────────────

type GlobeSvgProps = {
  svgW:       number;
  svgH:       number;
  cx:         number;
  cy:         number;
  globeR:     number;
  baseY:      number;
  itemMaxR:   number;
  items:      GlobeItem[];
  newItemIds: Set<string>;
  positions:  Map<string, { x: number; y: number }>;
};

function GlobeSvg({
  svgW, svgH, cx, cy, globeR, baseY, itemMaxR, items, newItemIds, positions,
}: GlobeSvgProps) {
  return (
    <Svg width={svgW} height={svgH}>

      <Defs>
        <ClipPath id="domeClip">
          <Circle cx={cx} cy={cy} r={globeR - 6} />
        </ClipPath>
      </Defs>

      {/* Interior fill */}
      <Circle cx={cx} cy={cy} r={globeR - 6} fill="#120C05" />

      {/* Ground plane */}
      <Ellipse
        cx={cx} cy={cy + globeR * 0.70}
        rx={globeR * 0.54} ry={globeR * 0.085}
        fill="#2B1C0B" clipPath="url(#domeClip)"
      />

      {/* Session items */}
      {items.map((item, idx) => (
        <GlobeItemDot
          key={item.id}
          item={item}
          idx={idx}
          totalItems={items.length}
          isNew={newItemIds.has(item.id)}
          cx={cx}
          cy={cy}
          maxR={itemMaxR}
          pos={positions.get(item.id) ?? { x: 0, y: 0 }}
        />
      ))}

      {/* Glass dome — drawn on top of items */}
      <Circle cx={cx} cy={cy} r={globeR}
        fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth={10} />
      <Circle cx={cx} cy={cy} r={globeR - 6}
        fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth={4} />
      <Path d={arcPath(cx, cy, globeR - 3, 200, 272)}
        fill="none" stroke="rgba(255,255,255,0.36)" strokeWidth={5} strokeLinecap="round" />
      <Path d={arcPath(cx, cy, globeR - 3, 218, 248)}
        fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={3} strokeLinecap="round" />

      {/* Stand */}
      <Ellipse cx={cx} cy={baseY} rx={globeR * 0.36} ry={7}
        fill="#1C1207" stroke={StrivoColors.border} strokeWidth={1} />
      <Path
        d={`M ${cx - 19},${baseY} L ${cx + 19},${baseY} L ${cx + 23},${baseY + 28} L ${cx - 23},${baseY + 28} Z`}
        fill="#221508" stroke={StrivoColors.border} strokeWidth={1} strokeLinejoin="round"
      />
      <Path
        d={`M ${cx - 52},${baseY + 28} L ${cx + 52},${baseY + 28} L ${cx + 52},${baseY + 48} Q ${cx + 52},${baseY + 53} ${cx + 44},${baseY + 53} L ${cx - 44},${baseY + 53} Q ${cx - 52},${baseY + 53} ${cx - 52},${baseY + 48} Z`}
        fill="#2A1C0A" stroke={StrivoColors.border} strokeWidth={1} strokeLinejoin="round"
      />
      <Path d={`M ${cx - 49},${baseY + 31} L ${cx + 49},${baseY + 31}`}
        stroke="#4A3020" strokeWidth={1} strokeLinecap="round" />
      <Path d={`M ${cx - 45},${baseY + 36} L ${cx + 45},${baseY + 36}`}
        stroke="#3A2515" strokeWidth={0.7} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const totalMins = Math.max(0, Math.round(secs / 60));
  if (totalMins < 60) {
    return `${totalMins} minute${totalMins === 1 ? '' : 's'}`;
  }
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS   = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function formatCompletedDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const SHEET_HEIGHT     = 420;
const DOUBLE_TAP_MS    = 300;

export default function GlobeScreen() {
  const [items, setItems]                 = useState<GlobeItem[]>([]);
  const [userName, setUserName]           = useState('');
  const [newItemIds, setNewItemIds]       = useState<Set<string>>(new Set());
  const [globeOpen, setGlobeOpen]         = useState(false);
  const [selectedItem, setSelectedItem]   = useState<GlobeItem | null>(null);
  const { width: screenWidth }            = useWindowDimensions();

  const prevItemIds = useRef<Set<string>>(new Set());
  const hasLoaded   = useRef(false);
  const lastTapRef  = useRef<number>(0);

  // ── Animated values for enlarged view + sheet (RN Animated, native driver) ──
  const backdropOpacity      = useRef(new RNAnimated.Value(0)).current;
  const globeScale           = useRef(new RNAnimated.Value(0.6)).current;
  const globeOpacity         = useRef(new RNAnimated.Value(0)).current;
  const sheetY               = useRef(new RNAnimated.Value(SHEET_HEIGHT)).current;
  const sheetBackdropOpacity = useRef(new RNAnimated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      Promise.all([getSessionsMerged(), getUserProfile()]).then(([data, profile]) => {
        const newItems = [...data].reverse().slice(0, MAX_VISIBLE);

        const isFirstLoad = !hasLoaded.current;
        hasLoaded.current = true;

        const newlyAdded: Set<string> = isFirstLoad
          ? new Set()
          : new Set(
              newItems.filter((i) => !prevItemIds.current.has(i.id)).map((i) => i.id),
            );

        prevItemIds.current = new Set(newItems.map((i) => i.id));
        setNewItemIds(newlyAdded);
        setItems(newItems);
        console.log('[Globe] items:', newItems);
        if (profile?.name) setUserName(profile.name);
      });
    }, []),
  );

  // Small globe geometry (existing, unchanged)
  const GLOBE_R    = Math.min(screenWidth * 0.41, 138);
  const SVG_W      = screenWidth - 24;
  const CX         = SVG_W / 2;
  const CY         = GLOBE_R + 18;
  const BASE_Y     = CY + GLOBE_R;
  const SVG_H      = BASE_Y + 58;
  const ITEM_MAX_R = GLOBE_R - 26;

  // ── Enlarged globe geometry — fits a (LARGE_W × LARGE_W) square ─────────────
  const LARGE_W           = screenWidth - 40;
  const LARGE_GLOBE_R     = Math.min(260, Math.max(80, (LARGE_W - 90) / 2));
  const LARGE_CONTENT_H   = 2 * LARGE_GLOBE_R + 76;
  const LARGE_Y_OFFSET    = Math.max(0, (LARGE_W - LARGE_CONTENT_H) / 2);
  const LARGE_CX          = LARGE_W / 2;
  const LARGE_CY          = LARGE_Y_OFFSET + LARGE_GLOBE_R + 18;
  const LARGE_BASE_Y      = LARGE_CY + LARGE_GLOBE_R;
  const LARGE_ITEM_MAX_R  = LARGE_GLOBE_R - 26;

  const itemIds        = useMemo(() => items.map((i) => i.id), [items]);
  const smallPositions = useMemo(() => buildItemPositions(itemIds, ITEM_MAX_R),       [itemIds, ITEM_MAX_R]);
  const largePositions = useMemo(() => buildItemPositions(itemIds, LARGE_ITEM_MAX_R), [itemIds, LARGE_ITEM_MAX_R]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleGlobeTap() {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      openGlobe();
    } else {
      lastTapRef.current = now;
    }
  }

  function openGlobe() {
    setGlobeOpen(true);
    backdropOpacity.setValue(0);
    globeScale.setValue(0.6);
    globeOpacity.setValue(0);
    RNAnimated.parallel([
      RNAnimated.timing(backdropOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      RNAnimated.timing(globeScale,      { toValue: 1, duration: 280, useNativeDriver: true }),
      RNAnimated.timing(globeOpacity,    { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }

  function closeGlobe() {
    RNAnimated.parallel([
      RNAnimated.timing(backdropOpacity, { toValue: 0,   duration: 220, useNativeDriver: true }),
      RNAnimated.timing(globeScale,      { toValue: 0.6, duration: 220, useNativeDriver: true }),
      RNAnimated.timing(globeOpacity,    { toValue: 0,   duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setSelectedItem(null);
      setGlobeOpen(false);
    });
  }

  function handleItemPress(item: GlobeItem) {
    setSelectedItem(item);
    sheetY.setValue(SHEET_HEIGHT);
    sheetBackdropOpacity.setValue(0);
    RNAnimated.parallel([
      RNAnimated.timing(sheetY,               { toValue: 0, duration: 320, useNativeDriver: true }),
      RNAnimated.timing(sheetBackdropOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  }

  function closeSheet() {
    RNAnimated.parallel([
      RNAnimated.timing(sheetY,               { toValue: SHEET_HEIGHT, duration: 240, useNativeDriver: true }),
      RNAnimated.timing(sheetBackdropOpacity, { toValue: 0,            duration: 240, useNativeDriver: true }),
    ]).start(() => {
      setSelectedItem(null);
    });
  }

  // Empty set passed to enlarged GlobeSvg so its items don't re-trigger the
  // drop-in spring animation (those animations only belong to the small globe).
  const emptyNewIds = useRef<Set<string>>(new Set()).current;

  const hasItems = items.length > 0;
  const caption  = [
    userName || null,
    `${items.length} ${items.length === 1 ? 'session' : 'sessions'}`,
  ].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Globe</Text>
      </View>

      <View style={styles.content}>
        <Pressable onPress={handleGlobeTap}>
          <View style={{ position: 'relative', width: SVG_W, height: SVG_H }}>
            <GlobeSvg
              svgW={SVG_W}
              svgH={SVG_H}
              cx={CX}
              cy={CY}
              globeR={GLOBE_R}
              baseY={BASE_Y}
              itemMaxR={ITEM_MAX_R}
              items={items}
              newItemIds={newItemIds}
              positions={smallPositions}
            />

            {/* Native-driver snow shimmer — overlay inside the dome interior */}
            <SnowShimmer cx={CX} cy={CY} r={GLOBE_R - 6} />
          </View>
        </Pressable>

        <Text style={styles.caption}>{caption}</Text>

        {!hasItems && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyTitle}>Your globe awaits</Text>
            <Text style={styles.emptyBody}>
              Complete your first focus session on the Focus tab{'\n'}and watch it come to life.
            </Text>
          </View>
        )}
      </View>

      {/* ── Enlarged globe modal + session detail sheet ───────────────────── */}
      <Modal
        visible={globeOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => (selectedItem ? closeSheet() : closeGlobe())}
      >
        <View style={styles.modalRoot}>
          {/* Layer 1: visual backdrop ONLY — pointerEvents:none so it never
              intercepts touches. */}
          <RNAnimated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              styles.bigBackdrop,
              { opacity: backdropOpacity },
            ]}
          />

          {/* Layer 2: full-screen dismiss area, BEHIND the globe. Taps that
              don't land on a globe item bubble down to here and close the
              enlarged view. Using Pressable (modern, more predictable than
              TouchableWithoutFeedback for this kind of layered hit-testing). */}
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={closeGlobe}
          />

          {/* Layer 3: enlarged globe ON TOP — centered, scaled in.
              SVG is visual only. Item taps are caught by the Pressable
              overlay rendered on top of the SVG, positioned using the same
              seeded item layout (itemPos) so each Pressable sits exactly on
              its visible icon. */}
          <View style={styles.bigGlobeContainer} pointerEvents="box-none">
            <RNAnimated.View
              style={{
                width: LARGE_W,
                height: LARGE_W,
                transform: [{ scale: globeScale }],
                opacity: globeOpacity,
              }}
            >
              <GlobeSvg
                svgW={LARGE_W}
                svgH={LARGE_W}
                cx={LARGE_CX}
                cy={LARGE_CY}
                globeR={LARGE_GLOBE_R}
                baseY={LARGE_BASE_Y}
                itemMaxR={LARGE_ITEM_MAX_R}
                items={items}
                newItemIds={emptyNewIds}
                positions={largePositions}
              />

              {/* Absolute-positioned tap targets — one per item.
                  Uses the SAME seeded itemPos() as the SVG, scaled to
                  LARGE_ITEM_MAX_R, so each Pressable sits centered on its
                  visible icon. box-none on the wrapper lets empty space
                  fall through to the dome (and ultimately to the dismiss
                  Pressable). */}
              <View
                style={StyleSheet.absoluteFill}
                pointerEvents="box-none"
              >
                {items.map((item) => {
                  const pos = largePositions.get(item.id) ?? { x: 0, y: 0 };
                  const x = LARGE_CX + pos.x;
                  const y = LARGE_CY + pos.y;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => handleItemPress(item)}
                      style={{
                        position: 'absolute',
                        left: x - 22,
                        top: y - 22,
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: 'transparent',
                      }}
                    />
                  );
                })}
              </View>
            </RNAnimated.View>
          </View>

          {/* ── Session detail sheet ──────────────────────────────────── */}
          {selectedItem && (
            <>
              {/* Visual sheet backdrop — non-interactive */}
              <RNAnimated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  styles.sheetBackdrop,
                  { opacity: sheetBackdropOpacity },
                ]}
              />
              {/* Tappable dismiss layer behind the sheet */}
              <Pressable
                style={StyleSheet.absoluteFillObject}
                onPress={closeSheet}
              />

              <RNAnimated.View
                style={[
                  styles.sheet,
                  { transform: [{ translateY: sheetY }] },
                ]}
              >
                <View style={styles.sheetHandle} />
                <ScrollView
                  contentContainerStyle={styles.sheetScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.sheetEmoji}>
                    {(TAG_CONFIG[selectedItem.tag as SubjectTag] ?? TAG_CONFIG.Other).emoji}
                  </Text>
                  <Text style={styles.sheetTagName}>
                    {(TAG_CONFIG[selectedItem.tag as SubjectTag] ?? TAG_CONFIG.Other).label}
                  </Text>

                  <View style={styles.sheetDivider} />

                  <Text style={styles.sheetLabel}>Duration</Text>
                  <Text style={styles.sheetValue}>
                    {formatDuration(selectedItem.durationSecs)}
                  </Text>

                  <View style={{ height: 18 }} />

                  <Text style={styles.sheetLabel}>Completed</Text>
                  <Text style={styles.sheetValue}>
                    {formatCompletedDate(selectedItem.completedAt)}
                  </Text>
                </ScrollView>
              </RNAnimated.View>
            </>
          )}
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
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 28,
    paddingHorizontal: 12,
  },
  caption: {
    marginTop: 18,
    fontSize: 14,
    color: StrivoColors.textMuted,
    letterSpacing: 0.4,
  },
  emptyHint: {
    marginTop: 28,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: StrivoColors.text,
    fontFamily: 'serif',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: StrivoColors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },

  // ── Enlarged globe modal ──────────────────────────────────────────────────
  modalRoot: {
    flex: 1,
  },
  bigBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  bigGlobeContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Detail sheet ──────────────────────────────────────────────────────────
  sheetBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_HEIGHT,
    backgroundColor: StrivoColors.bg,
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
    backgroundColor: StrivoColors.accent,
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
    color: StrivoColors.accent,
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
    backgroundColor: StrivoColors.accent,
    opacity: 0.3,
    marginTop: 18,
    marginBottom: 22,
  },
  sheetLabel: {
    color: StrivoColors.text,
    opacity: 0.5,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },
  sheetValue: {
    color: StrivoColors.text,
    fontSize: 17,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.3,
    alignSelf: 'flex-start',
  },
});
