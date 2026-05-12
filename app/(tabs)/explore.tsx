import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Animated as RNAnimated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, G, Defs, ClipPath } from 'react-native-svg';

import { StrivoColors } from '@/constants/theme';
import { SubjectTag } from '@/constants/tags';
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

// ─── Item position ────────────────────────────────────────────────────────────

function itemPos(id: string, maxR: number): { x: number; y: number } {
  const r     = Math.sqrt(seededVal(id, 1)) * maxR;
  const theta = seededVal(id, 2) * 2 * Math.PI;
  const x     = r * Math.cos(theta);
  const y     = r * Math.sin(theta) + maxR * 0.14;
  const dist  = Math.sqrt(x * x + y * y);
  if (dist > maxR) { const sc = maxR / dist; return { x: x * sc, y: y * sc }; }
  return { x, y };
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
};

function GlobeItemDot({ item, idx, totalItems, isNew, cx, cy, maxR }: ItemProps) {
  const pos  = itemPos(item.id, maxR);
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GlobeScreen() {
  const [items, setItems]           = useState<GlobeItem[]>([]);
  const [userName, setUserName]     = useState('');
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const { width: screenWidth }      = useWindowDimensions();

  const prevItemIds = useRef<Set<string>>(new Set());
  const hasLoaded   = useRef(false);

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

  // Globe geometry
  const GLOBE_R    = Math.min(screenWidth * 0.41, 138);
  const SVG_W      = screenWidth - 24;
  const CX         = SVG_W / 2;
  const CY         = GLOBE_R + 18;
  const BASE_Y     = CY + GLOBE_R;
  const SVG_H      = BASE_Y + 58;
  const ITEM_MAX_R = GLOBE_R - 26;

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
       <View style={{ position: 'relative', width: SVG_W, height: SVG_H }}>
        <Svg width={SVG_W} height={SVG_H}>

          <Defs>
            <ClipPath id="domeClip">
              <Circle cx={CX} cy={CY} r={GLOBE_R - 6} />
            </ClipPath>
          </Defs>

          {/* Interior fill */}
          <Circle cx={CX} cy={CY} r={GLOBE_R - 6} fill="#120C05" />

          {/* Ground plane */}
          <Ellipse
            cx={CX} cy={CY + GLOBE_R * 0.70}
            rx={GLOBE_R * 0.54} ry={GLOBE_R * 0.085}
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
              cx={CX}
              cy={CY}
              maxR={ITEM_MAX_R}
            />
          ))}

          {/* Glass dome — drawn on top of items */}
          <Circle cx={CX} cy={CY} r={GLOBE_R}
            fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth={10} />
          <Circle cx={CX} cy={CY} r={GLOBE_R - 6}
            fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth={4} />
          <Path d={arcPath(CX, CY, GLOBE_R - 3, 200, 272)}
            fill="none" stroke="rgba(255,255,255,0.36)" strokeWidth={5} strokeLinecap="round" />
          <Path d={arcPath(CX, CY, GLOBE_R - 3, 218, 248)}
            fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={3} strokeLinecap="round" />

          {/* Stand */}
          <Ellipse cx={CX} cy={BASE_Y} rx={GLOBE_R * 0.36} ry={7}
            fill="#1C1207" stroke={StrivoColors.border} strokeWidth={1} />
          <Path
            d={`M ${CX - 19},${BASE_Y} L ${CX + 19},${BASE_Y} L ${CX + 23},${BASE_Y + 28} L ${CX - 23},${BASE_Y + 28} Z`}
            fill="#221508" stroke={StrivoColors.border} strokeWidth={1} strokeLinejoin="round"
          />
          <Path
            d={`M ${CX - 52},${BASE_Y + 28} L ${CX + 52},${BASE_Y + 28} L ${CX + 52},${BASE_Y + 48} Q ${CX + 52},${BASE_Y + 53} ${CX + 44},${BASE_Y + 53} L ${CX - 44},${BASE_Y + 53} Q ${CX - 52},${BASE_Y + 53} ${CX - 52},${BASE_Y + 48} Z`}
            fill="#2A1C0A" stroke={StrivoColors.border} strokeWidth={1} strokeLinejoin="round"
          />
          <Path d={`M ${CX - 49},${BASE_Y + 31} L ${CX + 49},${BASE_Y + 31}`}
            stroke="#4A3020" strokeWidth={1} strokeLinecap="round" />
          <Path d={`M ${CX - 45},${BASE_Y + 36} L ${CX + 45},${BASE_Y + 36}`}
            stroke="#3A2515" strokeWidth={0.7} strokeLinecap="round" />
        </Svg>

         {/* Native-driver snow shimmer — overlay inside the dome interior */}
         <SnowShimmer cx={CX} cy={CY} r={GLOBE_R - 6} />
       </View>

        <Text style={styles.caption}>{caption}</Text>

        {!hasItems && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyTitle}>Your globe is empty</Text>
            <Text style={styles.emptyBody}>
              Complete a focus session on the Focus tab{'\n'}to start filling your globe.
            </Text>
          </View>
        )}
      </View>
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
});
