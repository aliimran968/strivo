import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';

import { StrivoColors } from '@/constants/theme';
import { SubjectTag, TAG_CONFIG, TAG_LIST } from '@/constants/tags';
import { saveUserProfile } from '@/services/storage';
import { supabase } from '@/lib/supabase';

type Step = 0 | 1 | 2;

const TAG_ROWS: [SubjectTag, SubjectTag, SubjectTag][] = [
  [TAG_LIST[0], TAG_LIST[1], TAG_LIST[2]],
  [TAG_LIST[3], TAG_LIST[4], TAG_LIST[5]],
];

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function RegisterScreen() {
  const [step, setStep]               = useState<Step>(0);
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [selectedTags, setSelectedTags] = useState<SubjectTag[]>([]);
  const [password, setPassword]       = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  const opacity = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  function advance(next: Step) {
    opacity.value = withTiming(0, { duration: 160 });
    setTimeout(() => {
      setStep(next);
      opacity.value = withTiming(1, { duration: 200 });
    }, 160);
  }

  function toggleTag(tag: SubjectTag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function canAdvanceStep0() {
    return name.trim().length > 0 && isValidEmail(email.trim());
  }

  async function handleFinish() {
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPw) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Sign up failed. Please try again.');
      setLoading(false);
      return;
    }

    const trimmedName = name.trim();

    // Insert profile row
    await supabase.from('profiles').insert({
      id: data.user.id,
      name: trimmedName,
      tags: selectedTags,
    });

    // Keep local copy for offline screens
    await saveUserProfile({ name: trimmedName, tags: selectedTags });

    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => (step === 0 ? router.back() : advance((step - 1) as Step))}
          activeOpacity={0.7}
          style={styles.back}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.dots}>
          {([0, 1, 2] as Step[]).map((i) => (
            <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
          ))}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.stepContent, animStyle]}>

          {/* Step 0: Name + Email */}
          {step === 0 && (
            <View style={styles.stepInner}>
              <Text style={styles.heading}>Create your{'\n'}account</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={StrivoColors.accentDim}
                value={name}
                onChangeText={setName}
                autoFocus
                autoCorrect={false}
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, { marginTop: 20 }]}
                placeholder="Email"
                placeholderTextColor={StrivoColors.accentDim}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="done"
              />
            </View>
          )}

          {/* Step 1: Focus areas */}
          {step === 1 && (
            <View style={styles.stepInner}>
              <Text style={styles.heading}>What do you{'\n'}work on most?</Text>
              <Text style={styles.subLabel}>Pick as many as you like</Text>
              <View style={styles.tagGrid}>
                {TAG_ROWS.map((row, rowIdx) => (
                  <View key={rowIdx} style={styles.tagRow}>
                    {row.map((tag) => {
                      const { emoji, label } = TAG_CONFIG[tag];
                      const active = selectedTags.includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          style={[styles.tagCard, active && styles.tagCardActive]}
                          onPress={() => toggleTag(tag)}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.tagCardEmoji}>{emoji}</Text>
                          <Text style={[styles.tagCardLabel, active && styles.tagCardLabelActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Step 2: Password */}
          {step === 2 && (
            <View style={styles.stepInner}>
              <Text style={styles.heading}>Set a password</Text>
              <Text style={styles.subLabel}>At least 6 characters</Text>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={StrivoColors.accentDim}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                secureTextEntry
                autoFocus
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, { marginTop: 20 }]}
                placeholder="Confirm password"
                placeholderTextColor={StrivoColors.accentDim}
                value={confirmPw}
                onChangeText={(t) => { setConfirmPw(t); setError(''); }}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleFinish}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          )}

        </Animated.View>
      </KeyboardAvoidingView>

      <View style={styles.ctaArea}>
        {step === 0 && (
          <TouchableOpacity
            style={[styles.btn, !canAdvanceStep0() && styles.btnDisabled]}
            onPress={() => { if (canAdvanceStep0()) advance(1); }}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Continue</Text>
          </TouchableOpacity>
        )}
        {step === 1 && (
          <TouchableOpacity style={styles.btn} onPress={() => advance(2)} activeOpacity={0.85}>
            <Text style={styles.btnText}>Continue</Text>
          </TouchableOpacity>
        )}
        {step === 2 && (
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleFinish}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
          </TouchableOpacity>
        )}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 8,
  },
  back: {
    paddingVertical: 8,
  },
  backText: {
    fontSize: 15,
    color: StrivoColors.accent,
    letterSpacing: 0.3,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: StrivoColors.border,
  },
  dotActive: {
    backgroundColor: StrivoColors.accent,
    width: 20,
  },
  body: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
  },
  stepInner: {
    flex: 1,
    justifyContent: 'center',
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    color: StrivoColors.text,
    fontFamily: 'serif',
    lineHeight: 40,
    marginBottom: 32,
  },
  subLabel: {
    fontSize: 14,
    color: StrivoColors.textMuted,
    letterSpacing: 0.3,
    marginTop: -20,
    marginBottom: 24,
  },
  input: {
    fontSize: 22,
    fontFamily: 'serif',
    color: StrivoColors.text,
    borderBottomWidth: 1.5,
    borderBottomColor: StrivoColors.accentDim,
    paddingVertical: 10,
    letterSpacing: 0.4,
  },
  error: {
    fontSize: 13,
    color: '#C47070',
    letterSpacing: 0.2,
    marginTop: 8,
  },
  tagGrid: { gap: 12 },
  tagRow: { flexDirection: 'row', gap: 12 },
  tagCard: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: StrivoColors.bgCard,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: StrivoColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tagCardActive: {
    backgroundColor: StrivoColors.bgCardHighlight,
    borderColor: StrivoColors.accent,
  },
  tagCardEmoji: { fontSize: 28 },
  tagCardLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: StrivoColors.textMuted,
    letterSpacing: 0.3,
  },
  tagCardLabelActive: { color: StrivoColors.accent, fontWeight: '600' },
  ctaArea: { width: '100%', paddingBottom: 8 },
  btn: {
    backgroundColor: StrivoColors.accent,
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.35 },
  btnText: {
    fontSize: 17,
    fontWeight: '600',
    color: StrivoColors.bg,
    letterSpacing: 0.4,
  },
});
