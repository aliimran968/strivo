import React, { useRef, useState } from 'react';
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
import { router } from 'expo-router';

import { StrivoColors } from '@/constants/theme';
import { saveUserProfile } from '@/services/storage';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const passwordRef = useRef<TextInput>(null);

  function clearError() {
    if (error) setError('');
  }

  async function handleSignIn() {
    const e = email.trim().toLowerCase();
    if (!e || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: e,
      password,
    });

    if (authError || !data.session) {
      setError(authError?.message ?? 'Invalid credentials.');
      setLoading(false);
      return;
    }

    // Sync profile to local storage so existing screens can read name/tags offline
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, tags')
      .eq('id', data.user.id)
      .single();

    if (profile) {
      await saveUserProfile({ name: profile.name as string, tags: ((profile.tags as string[]) ?? []) as import('@/constants/tags').SubjectTag[] });
    }

    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()} activeOpacity={0.7}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.heading}>Sign in</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={StrivoColors.accentDim}
            value={email}
            onChangeText={(t) => { setEmail(t); clearError(); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={StrivoColors.accentDim}
            value={password}
            onChangeText={(t) => { setPassword(t); clearError(); }}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </KeyboardAvoidingView>

      <View style={styles.ctaArea}>
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSignIn}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
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
  back: {
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 15,
    color: StrivoColors.accent,
    letterSpacing: 0.3,
  },
  body: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    color: StrivoColors.text,
    fontFamily: 'serif',
    marginBottom: 12,
  },
  input: {
    fontSize: 17,
    color: StrivoColors.text,
    borderBottomWidth: 1.5,
    borderBottomColor: StrivoColors.accentDim,
    paddingVertical: 10,
    letterSpacing: 0.3,
  },
  error: {
    fontSize: 13,
    color: '#C47070',
    letterSpacing: 0.2,
    marginTop: -4,
  },
  ctaArea: {
    width: '100%',
    paddingBottom: 8,
  },
  btn: {
    backgroundColor: StrivoColors.accent,
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '600',
    color: StrivoColors.bg,
    letterSpacing: 0.4,
  },
});
