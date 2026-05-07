import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = 'https://vobvpbqtpmtvuabannjb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Ni3oxpqRzugzRy-uWJxOrg_-oPXKgDA';

// SecureStore has a ~2 KB per-key limit; fall back to AsyncStorage for larger values.
const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const val = await SecureStore.getItemAsync(key);
      if (val !== null) return val;
    } catch {}
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (value.length <= 1800) {
        await SecureStore.setItemAsync(key, value);
        return;
      }
    } catch {}
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await Promise.allSettled([
      SecureStore.deleteItemAsync(key),
      AsyncStorage.removeItem(key),
    ]);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
