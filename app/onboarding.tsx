import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { StrivoColors } from '@/constants/theme';
import { clearAllData } from '@/services/storage';

export default function EntryScreen() {
  async function handleResetData() {
    await clearAllData();
    router.replace('/onboarding');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.wordmark}>STRIVO</Text>
        <Text style={styles.tagline}>For anyone building anything.</Text>
        <Text style={styles.deco}>📚</Text>
      </View>

      <View style={styles.ctaArea}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.push('/login')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => router.push('/register')}
          activeOpacity={0.7}
        >
          <Text style={styles.linkText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResetData} activeOpacity={0.6} style={styles.resetBtn}>
          <Text style={styles.resetText}>Reset App Data</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: StrivoColors.bg,
    paddingHorizontal: 28,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  wordmark: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: 10,
    color: StrivoColors.accent,
    fontFamily: 'serif',
  },
  tagline: {
    fontSize: 16,
    color: StrivoColors.textMuted,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  deco: {
    fontSize: 64,
    marginTop: 8,
  },
  ctaArea: {
    width: '100%',
    paddingBottom: 8,
    gap: 10,
    alignItems: 'center',
  },
  btn: {
    backgroundColor: StrivoColors.accent,
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
  },
  btnText: {
    fontSize: 17,
    fontWeight: '600',
    color: StrivoColors.bg,
    letterSpacing: 0.4,
  },
  linkBtn: {
    paddingVertical: 10,
  },
  linkText: {
    fontSize: 15,
    color: StrivoColors.accent,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  resetBtn: {
    paddingVertical: 10,
    marginTop: 4,
  },
  resetText: {
    fontSize: 12,
    color: StrivoColors.textMuted,
    opacity: 0.55,
    letterSpacing: 0.3,
  },
});
