/**
 * rooms.ts — service layer for Phase 2 Rooms.
 *
 * Wraps the Supabase tables `rooms` and `room_members`. RLS is enforced on
 * the database, so these helpers assume the user is authenticated; functions
 * throw if there is no current session.
 *
 * Limits:
 *   - Each user may belong to at most 3 rooms (creator counted as a member).
 *   - Each room may hold at most 25 members.
 */

import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RoomRole = 'owner' | 'member';

export type Room = {
  id:          string;
  name:        string;
  inviteCode:  string;
  ownerId:     string;
  createdAt:   string;
  memberCount: number;
};

type RoomRow = {
  id:          string;
  name:        string;
  invite_code: string;
  owner_id:    string;
  created_at:  string;
  room_members?: { count: number }[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_ROOMS_PER_USER = 3;
const MAX_MEMBERS_PER_ROOM = 25;
const INVITE_CODE_LENGTH = 6;
// Skips ambiguous characters (0/O, 1/I, etc.) to make codes easier to share.
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  return user.id;
}

function rowToRoom(row: RoomRow): Room {
  return {
    id:          row.id,
    name:        row.name,
    inviteCode:  row.invite_code,
    ownerId:     row.owner_id,
    createdAt:   row.created_at,
    memberCount: row.room_members?.[0]?.count ?? 0,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Random 6-character alphanumeric invite code (uppercase, no ambiguous chars).
 * Not guaranteed unique on its own — createRoom retries on collision.
 */
export function generateInviteCode(): string {
  let out = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    out += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Create a new room owned by the current user.
 *
 * - Enforces MAX_ROOMS_PER_USER (counts all room_members rows for this user).
 * - Generates a unique invite code (retries on collision).
 * - Inserts the owner as the first member with role 'owner'.
 *
 * Throws on cap reached, network failure, or any RLS rejection.
 */
export async function createRoom(name: string): Promise<Room> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Room name is required.');

  const userId = await requireUserId();

  // Cap check — count this user's existing memberships.
  const { count, error: countError } = await supabase
    .from('room_members')
    .select('room_id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (countError) throw countError;
  if ((count ?? 0) >= MAX_ROOMS_PER_USER) {
    throw new Error(`You can be in at most ${MAX_ROOMS_PER_USER} rooms.`);
  }

  // Insert the room (retry up to a few times if the random invite code collides).
  let roomRow: RoomRow | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const inviteCode = generateInviteCode();
    const { data, error } = await supabase
      .from('rooms')
      .insert({ name: trimmed, invite_code: inviteCode, owner_id: userId })
      .select('id, name, invite_code, owner_id, created_at')
      .single();
    if (!error && data) {
      roomRow = data as RoomRow;
      break;
    }
    lastError = error;
    // Postgres unique-violation code is 23505 — retry with a fresh code.
    if (error && (error as { code?: string }).code !== '23505') break;
  }
  if (!roomRow) {
    throw (lastError instanceof Error ? lastError : new Error('Could not create room.'));
  }

  // Add the owner as the first member.
  const { error: memberError } = await supabase
    .from('room_members')
    .insert({ room_id: roomRow.id, user_id: userId, role: 'owner' as RoomRole });
  if (memberError) {
    // Best-effort rollback so the user doesn't see a phantom empty room.
    await supabase.from('rooms').delete().eq('id', roomRow.id);
    throw memberError;
  }

  return {
    ...rowToRoom(roomRow),
    memberCount: 1,
  };
}

/**
 * Join a room by its invite code. Code lookup is case-insensitive.
 *
 * - Enforces MAX_MEMBERS_PER_ROOM.
 * - Enforces MAX_ROOMS_PER_USER on the joiner.
 * - No-ops gracefully if the user is already a member (returns the room).
 */
export async function joinRoom(code: string): Promise<Room> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) throw new Error('Invite code is required.');

  const userId = await requireUserId();

  // Joiner's room cap.
  const { count: myCount, error: myCountError } = await supabase
    .from('room_members')
    .select('room_id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (myCountError) throw myCountError;
  if ((myCount ?? 0) >= MAX_ROOMS_PER_USER) {
    throw new Error(`You can be in at most ${MAX_ROOMS_PER_USER} rooms.`);
  }

  // Look up the room.
  const { data: roomRow, error: roomError } = await supabase
    .from('rooms')
    .select('id, name, invite_code, owner_id, created_at')
    .eq('invite_code', normalized)
    .single();
  if (roomError || !roomRow) throw new Error('Room not found.');

  // Already a member? Treat as success.
  const { data: existing } = await supabase
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomRow.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) {
    const { count: memberCount } = await supabase
      .from('room_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('room_id', roomRow.id);
    return { ...rowToRoom(roomRow as RoomRow), memberCount: memberCount ?? 0 };
  }

  // Member cap.
  const { count: memberCount, error: countError } = await supabase
    .from('room_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('room_id', roomRow.id);
  if (countError) throw countError;
  if ((memberCount ?? 0) >= MAX_MEMBERS_PER_ROOM) {
    throw new Error('This room is full.');
  }

  const { error: insertError } = await supabase
    .from('room_members')
    .insert({ room_id: roomRow.id, user_id: userId, role: 'member' as RoomRole });
  if (insertError) throw insertError;

  return { ...rowToRoom(roomRow as RoomRow), memberCount: (memberCount ?? 0) + 1 };
}

/**
 * Leave a room.
 *
 * - Owner: deletes the entire room (cascades remove members + child rows).
 * - Member: deletes only the caller's row in room_members.
 *
 * Throws if the user is not a member of the room.
 */
export async function leaveRoom(roomId: string): Promise<void> {
  if (!roomId) throw new Error('Room ID is required.');
  const userId = await requireUserId();

  const { data: membership, error: membershipError } = await supabase
    .from('room_members')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) throw new Error('You are not a member of this room.');

  if ((membership as { role: RoomRole }).role === 'owner') {
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('room_members')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * All rooms the current user belongs to, with member counts.
 * Returns an empty array if the user is not in any rooms.
 */
export async function getUserRooms(): Promise<Room[]> {
  const userId = await requireUserId();

  // Step 1: room ids this user belongs to.
  const { data: memberships, error: memberError } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('user_id', userId);
  if (memberError) throw memberError;

  const roomIds = (memberships ?? []).map((m) => (m as { room_id: string }).room_id);
  if (!roomIds.length) return [];

  // Step 2: fetch rooms with an embedded count of ALL members per room.
  const { data: rows, error: roomsError } = await supabase
    .from('rooms')
    .select('id, name, invite_code, owner_id, created_at, room_members(count)')
    .in('id', roomIds)
    .order('created_at', { ascending: true });
  if (roomsError) throw roomsError;

  return (rows ?? []).map((row) => rowToRoom(row as RoomRow));
}
