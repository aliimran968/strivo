/**
 * sessions.ts — dual-write and sync layer between AsyncStorage and Supabase.
 *
 * Local AsyncStorage is always written first (fast, offline-safe).
 * Supabase is written/read when online; failures fall back to local silently.
 */

import { supabase } from '@/lib/supabase';
import { SubjectTag } from '@/constants/tags';
import {
  GlobeItem,
  getGlobeItems,
  replaceGlobeItems,
  getSessionsMigrated,
  setSessionsMigrated,
} from './storage';

// ─── Row ↔ GlobeItem mapping ──────────────────────────────────────────────────

type SessionRow = {
  id: string;
  user_id: string;
  tag: string;
  duration_secs: number;
  completed_at: string;
};

function toRow(item: GlobeItem, userId: string): SessionRow {
  return {
    id:            item.id,
    user_id:       userId,
    tag:           item.tag,
    duration_secs: item.durationSecs,
    completed_at:  item.completedAt,
  };
}

function fromRow(row: SessionRow): GlobeItem {
  return {
    id:           row.id,
    tag:          row.tag as SubjectTag,
    durationSecs: row.duration_secs,
    completedAt:  row.completed_at,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Persist a single completed session to Supabase.
 * Call fire-and-forget (void) after saveGlobeItem — never awaited in UI path.
 */
export async function syncSessionToSupabase(item: GlobeItem): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('sessions')
      .upsert(toRow(item, user.id), { onConflict: 'id' });
  } catch {
    // Offline — local copy is already saved; will be included in next migration.
  }
}

/**
 * Fetch sessions from Supabase (if authenticated + online), merge with local
 * AsyncStorage, deduplicate by id, update local cache, and return the result.
 * Falls back to AsyncStorage-only if the network call fails.
 */
export async function getSessionsMerged(): Promise<GlobeItem[]> {
  const local = await getGlobeItems();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return local;

    const { data, error } = await supabase
      .from('sessions')
      .select('id, tag, duration_secs, completed_at')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: true });

    if (error || !data) return local;

    const remote = (data as SessionRow[]).map(fromRow);

    // Union by id — remote wins on conflict (source of truth)
    const byId = new Map<string, GlobeItem>();
    for (const item of local)  byId.set(item.id, item);
    for (const item of remote) byId.set(item.id, item);

    const merged = Array.from(byId.values()).sort(
      (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
    );

    // Keep local cache in sync
    await replaceGlobeItems(merged);

    return merged;
  } catch {
    return local;
  }
}

/**
 * One-time migration: upsert all existing AsyncStorage sessions into Supabase.
 * Idempotent — guarded by a persisted flag. Safe to call on every app start.
 */
export async function migrateLocalSessions(): Promise<void> {
  try {
    if (await getSessionsMigrated()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Not authenticated — retry next launch

    const local = await getGlobeItems();
    if (local.length > 0) {
      const rows = local.map((item) => toRow(item, user.id));
      const { error } = await supabase
        .from('sessions')
        .upsert(rows, { onConflict: 'id' });
      if (error) return; // Don't mark done if upsert failed — retry next launch
    }

    await setSessionsMigrated();
  } catch {
    // Offline — will retry on next launch
  }
}
