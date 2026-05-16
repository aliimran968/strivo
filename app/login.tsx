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
import { SvgXml } from 'react-native-svg';

import { StrivoColors } from '@/constants/theme';
import { saveUserProfile } from '@/services/storage';
import { supabase } from '@/lib/supabase';

const LAPTOP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 354.24402 256.59116"><rect width="100%" height="100%" fill="#1A1208"/><g><path style="fill:#C9933A;stroke-width:1;fill-rule:evenodd" d="m 10.732199999999466 256.27700000000004 c -3.8162,-0.633 -6.7055,-2.792 -7.8576,-5.872 -0.6865,-1.834 -2.1653,-8.968 -2.6685,-12.873 -0.3267,-2.531 -0.319,-2.603 0.4204,-3.864 0.7019,-1.198 6.0345,-6.696 32.552,-33.562 l 10.3761,-10.512 -0.9094,-0.933 c -1.0374,-1.064 -2.013,-2.99 -2.4423,-4.821 -0.4491,-1.917 -0.7714,-171.995 -0.331,-174.793 0.789,-5.016 3.9299,-8.179 8.7869,-8.848 1.1091,-0.154 55.4231,-0.231 130.0964,-0.187 l 128.1915,0.08 1.9335,0.952 c 2.2503,1.108 3.7942,2.691 4.8769,4.999 l 0.7692,1.641 v 87.307 c 0,72.98 -0.066,87.57 -0.4006,88.913 -0.4724,1.896 -1.5936,4.094 -2.5438,4.987 l -0.6788,0.638 6.7309,6.895 c 23.2696,23.844 35.9677,37.036 36.344,37.765 0.3885,0.75 0.3697,1.18 -0.1777,4.255 -1.0153,5.689 -2.2536,11.003 -2.9323,12.581 -0.7372,1.714 -2.4136,3.355 -4.261,4.173 -3.387,1.497 6.8346,1.415 -170.0017,1.378 -95.4674,-0.02 -164.956,-0.143 -165.8731,-0.295 z"/></g></svg>`;

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const [view, setView]                 = useState<'login' | 'forgot'>('login');
  const [resetEmail, setResetEmail]     = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError]     = useState('');
  const [resetSent, setResetSent]       = useState(false);

  const passwordRef = useRef<TextInput>(null);

  function clearError() {
    if (error) setError('');
  }

  function goToForgot() {
    setView('forgot');
    setResetEmail(email); // pre-fill with whatever is already in the sign-in field
    setResetError('');
    setResetSent(false);
  }

  function goToLogin() {
    setView('login');
    setResetError('');
    setResetSent(false);
  }

  async function handleResetPassword() {
    const e = resetEmail.trim().toLowerCase();
    if (!e) { setResetError('Please enter your email.'); return; }
    setResetLoading(true);
    setResetError('');
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(e);
    setResetLoading(false);
    if (resetErr) {
      setResetError(resetErr.message ?? 'Something went wrong. Please try again.');
      return;
    }
    setResetSent(true);
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
          <Text style={styles.wordmark}>STRIVO</Text>
          <SvgXml xml={LAPTOP_SVG} width={260} height={188} style={{ alignSelf: 'center', marginTop: 24, marginBottom: 8 }} />

          {view === 'login' ? (
            <>
              <Text style={styles.heading}>Welcome back.</Text>

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

              <TouchableOpacity onPress={goToForgot} style={styles.forgotLink} activeOpacity={0.7}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          ) : (
            <>
              <Text style={styles.heading}>Reset password.</Text>

              {resetSent ? (
                <Text style={styles.resetSentText}>Check your email for a reset link.</Text>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={StrivoColors.accentDim}
                    value={resetEmail}
                    onChangeText={(t) => { setResetEmail(t); if (resetError) setResetError(''); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="done"
                    onSubmitEditing={handleResetPassword}
                  />
                  {resetError ? <Text style={styles.error}>{resetError}</Text> : null}
                </>
              )}

              <TouchableOpacity onPress={goToLogin} activeOpacity={0.7}>
                <Text style={styles.backToSignIn}>← Back to sign in</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <View style={styles.ctaArea}>
        {view === 'login' ? (
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSignIn}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
          </TouchableOpacity>
        ) : !resetSent ? (
          <TouchableOpacity
            style={[styles.btn, resetLoading && styles.btnDisabled]}
            onPress={handleResetPassword}
            activeOpacity={0.85}
            disabled={resetLoading}
          >
            <Text style={styles.btnText}>{resetLoading ? 'Sending…' : 'Send reset link'}</Text>
          </TouchableOpacity>
        ) : null}

        {view === 'login' && (
          <View style={styles.createAccountRow}>
            <Text style={styles.createAccountPrompt}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/register')} activeOpacity={0.7}>
              <Text style={styles.createAccountLink}>Create account</Text>
            </TouchableOpacity>
          </View>
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
    gap: 16,
  },
  wordmark: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 4,
    color: StrivoColors.accent,
    fontFamily: 'serif',
    alignSelf: 'center',
    marginBottom: 12,
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    color: StrivoColors.text,
    fontFamily: 'serif',
    marginBottom: 24,
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
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -8,
  },
  forgotText: {
    fontSize: 13,
    color: StrivoColors.accentDim,
    letterSpacing: 0.2,
  },
  createAccountRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  createAccountPrompt: {
    fontSize: 13,
    color: StrivoColors.textMuted,
    letterSpacing: 0.2,
  },
  createAccountLink: {
    fontSize: 13,
    fontWeight: '600',
    color: StrivoColors.accent,
    letterSpacing: 0.2,
  },
  resetSentText: {
    fontSize: 15,
    color: '#88786a',
    lineHeight: 22,
    textAlign: 'center',
  },
  backToSignIn: {
    fontSize: 14,
    color: StrivoColors.accent,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
