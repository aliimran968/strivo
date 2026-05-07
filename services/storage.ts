import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubjectTag } from '@/constants/tags';

export type GlobeItem = {
  id: string;
  tag: SubjectTag;
  durationSecs: number;
  completedAt: string;
};

export type UserProfile = {
  name: string;
  tags: SubjectTag[];
};

const STORAGE_KEY            = '@strivo/globe_items';
const LAST_TAG_KEY           = '@strivo/last_tag';
const ONBOARDED_KEY          = '@strivo/onboarded';
const USER_PROFILE_KEY       = '@strivo/user_profile';
const REMINDER_TIME_KEY      = '@strivo/reminder_time';
const CREDENTIALS_KEY        = '@strivo/credentials';
const BACKGROUND_SESSION_KEY = '@strivo/background_session';

export type BackgroundSession = {
  timeRemaining: number;
  selectedTag: SubjectTag;
  totalDuration: number;
  pausedAt: number;
  wasPaused: boolean;
};

export type Credentials = { username: string; password: string };

export type ReminderTime = { hour: number; minute: number };

export async function getGlobeItems(): Promise<GlobeItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GlobeItem[];
  } catch {
    return [];
  }
}

export async function saveGlobeItem(item: GlobeItem): Promise<void> {
  try {
    const existing = await getGlobeItems();
    const updated = [...existing, item];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // silently fail — don't crash the app if storage fails
  }
}

export async function clearGlobeItems(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently fail
  }
}

export async function getLastTag(): Promise<SubjectTag | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_TAG_KEY);
    return raw as SubjectTag | null;
  } catch {
    return null;
  }
}

export async function saveLastTag(tag: SubjectTag): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_TAG_KEY, tag);
  } catch {
    // silently fail
  }
}

export async function getOnboarded(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDED_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

export async function setOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
  } catch {
    // silently fail
  }
}

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export async function getReminderTime(): Promise<ReminderTime> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_TIME_KEY);
    if (!raw) return { hour: 9, minute: 0 };
    return JSON.parse(raw) as ReminderTime;
  } catch {
    return { hour: 9, minute: 0 };
  }
}

export async function saveReminderTime(time: ReminderTime): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDER_TIME_KEY, JSON.stringify(time));
  } catch {
    // silently fail
  }
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  try {
    await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
  } catch {
    // silently fail
  }
}

export async function getCredentials(): Promise<Credentials | null> {
  try {
    const raw = await AsyncStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export async function clearUserSession(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([ONBOARDED_KEY, USER_PROFILE_KEY]);
  } catch {
    // silently fail
  }
}

export async function saveBackgroundSession(session: BackgroundSession): Promise<void> {
  try {
    await AsyncStorage.setItem(BACKGROUND_SESSION_KEY, JSON.stringify(session));
  } catch {}
}

export async function getBackgroundSession(): Promise<BackgroundSession | null> {
  try {
    const raw = await AsyncStorage.getItem(BACKGROUND_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BackgroundSession;
  } catch {
    return null;
  }
}

export async function clearBackgroundSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BACKGROUND_SESSION_KEY);
  } catch {}
}

export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch {
    // silently fail
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    if (profile.tags.length > 0) {
      await saveLastTag(profile.tags[0]);
    }
  } catch {
    // silently fail
  }
}
