import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { router } from 'expo-router';

import { StrivoColors } from '@/constants/theme';
import { clearAllData } from '@/services/storage';

const LIBRARY_SVG = `<svg width="300" height="230" viewBox="0 0 300 230" xmlns="http://www.w3.org/2000/svg">
  <rect width="300" height="230" fill="#1A1208"/>
  <rect x="0" y="40" width="300" height="190" fill="#0D0803"/>
  <ellipse cx="150" cy="40" rx="90" ry="18" fill="#2a1a08"/>
  <rect x="20" y="68" width="260" height="6" rx="2" fill="#3a2208"/>
  <rect x="28" y="36" width="14" height="32" rx="2" fill="#7a3a10"/>
  <rect x="44" y="42" width="11" height="26" rx="2" fill="#C9933A" opacity="0.9"/>
  <rect x="57" y="38" width="16" height="30" rx="2" fill="#5a3a18"/>
  <rect x="75" y="44" width="10" height="24" rx="2" fill="#C9933A" opacity="0.5"/>
  <rect x="87" y="40" width="13" height="28" rx="2" fill="#8a4a20"/>
  <rect x="102" y="46" width="9" height="22" rx="2" fill="#C9933A" opacity="0.7"/>
  <rect x="113" y="38" width="15" height="30" rx="2" fill="#4a2810"/>
  <rect x="130" y="43" width="12" height="25" rx="2" fill="#9a5a28"/>
  <rect x="144" y="37" width="10" height="31" rx="2" fill="#C9933A" opacity="0.85"/>
  <rect x="156" y="44" width="14" height="24" rx="2" fill="#6a3a18"/>
  <rect x="172" y="40" width="11" height="28" rx="2" fill="#C9933A" opacity="0.6"/>
  <rect x="185" y="36" width="16" height="32" rx="2" fill="#7a4010"/>
  <rect x="203" y="45" width="9" height="23" rx="2" fill="#C9933A" opacity="0.75"/>
  <rect x="214" y="39" width="13" height="29" rx="2" fill="#5a2e10"/>
  <rect x="229" y="43" width="11" height="25" rx="2" fill="#C9933A" opacity="0.5"/>
  <rect x="242" y="38" width="15" height="30" rx="2" fill="#8a4818"/>
  <rect x="259" y="44" width="10" height="24" rx="2" fill="#C9933A" opacity="0.9"/>
  <rect x="20" y="136" width="260" height="6" rx="2" fill="#3a2208"/>
  <rect x="28" y="108" width="12" height="28" rx="2" fill="#C9933A" opacity="0.6"/>
  <rect x="42" y="112" width="15" height="24" rx="2" fill="#6a3212"/>
  <rect x="59" y="106" width="10" height="30" rx="2" fill="#C9933A" opacity="0.85"/>
  <rect x="71" y="110" width="14" height="26" rx="2" fill="#7a4218"/>
  <rect x="87" y="108" width="11" height="28" rx="2" fill="#C9933A" opacity="0.5"/>
  <rect x="100" y="114" width="9" height="22" rx="2" fill="#9a5222"/>
  <rect x="111" y="107" width="16" height="29" rx="2" fill="#C9933A" opacity="0.7"/>
  <rect x="130" y="111" width="12" height="25" rx="2" fill="#5a2e10"/>
  <rect x="148" y="112" width="14" height="22" rx="3" fill="#1a1006"/>
  <rect x="150" y="113" width="10" height="17" rx="2" fill="#C9933A" opacity="0.2"/>
  <rect x="152" y="110" width="6" height="3" rx="1" fill="#C9933A" opacity="0.5"/>
  <ellipse cx="155" cy="121" rx="3.5" ry="4" fill="#C9933A" opacity="0.4"/>
  <rect x="168" y="109" width="13" height="27" rx="2" fill="#7a3e16"/>
  <rect x="183" y="113" width="10" height="23" rx="2" fill="#C9933A" opacity="0.8"/>
  <rect x="195" y="107" width="15" height="29" rx="2" fill="#4a2810"/>
  <rect x="212" y="111" width="11" height="25" rx="2" fill="#C9933A" opacity="0.55"/>
  <rect x="225" y="108" width="14" height="28" rx="2" fill="#8a4418"/>
  <rect x="241" y="114" width="9" height="22" rx="2" fill="#C9933A" opacity="0.75"/>
  <rect x="252" y="107" width="12" height="29" rx="2" fill="#5a3010"/>
  <rect x="0" y="170" width="300" height="60" fill="#140e06"/>
  <ellipse cx="55" cy="189" rx="50" ry="3.5" fill="#060300" opacity="0.85"/>
  <line x1="53" y1="175" x2="132" y2="183" stroke="#7a5818" stroke-width="4" stroke-linecap="round"/>
  <line x1="128" y1="183" x2="140" y2="184" stroke="#7a5818" stroke-width="4.5" stroke-linecap="round"/>
  <line x1="47" y1="174" x2="76" y2="154" stroke="#7a5818" stroke-width="4" stroke-linecap="round"/>
  <line x1="76" y1="154" x2="79" y2="183" stroke="#7a5818" stroke-width="4" stroke-linecap="round"/>
  <line x1="76" y1="182" x2="88" y2="184" stroke="#7a5818" stroke-width="4.5" stroke-linecap="round"/>
  <line x1="50" y1="174" x2="46" y2="146" stroke="#7a5818" stroke-width="4.5" stroke-linecap="round"/>
  <line x1="48" y1="153" x2="62" y2="161" stroke="#7a5818" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="62" y1="161" x2="68" y2="172" stroke="#7a5818" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="44" y1="155" x2="55" y2="163" stroke="#7a5818" stroke-width="3" stroke-linecap="round"/>
  <line x1="55" y1="163" x2="60" y2="172" stroke="#7a5818" stroke-width="3" stroke-linecap="round"/>
  <path d="M58 175 L83 178 L78 185 L56 183Z" fill="#5a3810" opacity="0.85" stroke="#3a2208" stroke-width="0.7"/>
  <path d="M58 175 L83 160 L83 170 L62 177Z" fill="#F0E6D3" opacity="0.9" stroke="#7a6040" stroke-width="0.8"/>
  <line x1="63" y1="170" x2="80" y2="162" stroke="#a09070" stroke-width="0.5" opacity="0.5"/>
  <line x1="62" y1="173" x2="81" y2="166" stroke="#a09070" stroke-width="0.5" opacity="0.5"/>
  <line x1="47" y1="146" x2="45" y2="140" stroke="#7a5818" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="43" cy="128" r="13" fill="#0D0803" stroke="#7a5818" stroke-width="2"/>
  <circle cx="51" cy="126" r="1.3" fill="#7a5818"/>
  <path d="M53 129 L56 132 L53 133" stroke="#7a5818" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M52 136 Q54 138 52 139" stroke="#7a5818" stroke-width="1.1" fill="none" stroke-linecap="round"/>
  <rect x="88" y="173" width="24" height="14" fill="#3a2210" stroke="#1a0c04" stroke-width="0.8"/>
  <ellipse cx="100" cy="173" rx="12" ry="3" fill="#4a2e14" stroke="#C9933A" stroke-width="0.6" opacity="0.9"/>
  <ellipse cx="100" cy="187" rx="12" ry="3" fill="#2a1a0c" stroke="#1a0c04" stroke-width="0.6"/>
  <path d="M112 176 Q122 180 112 184" stroke="#2e1a08" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <path d="M112 176 Q120 180 112 184" stroke="#5a3418" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M93 169 Q91 162 93 155" stroke="#C9933A" stroke-width="0.9" fill="none" opacity="0.22"/>
  <path d="M100 168 Q98 160 100 153" stroke="#C9933A" stroke-width="0.9" fill="none" opacity="0.18"/>
  <path d="M107 169 Q105 162 107 155" stroke="#C9933A" stroke-width="0.9" fill="none" opacity="0.22"/>
</svg>`;

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
        <SvgXml xml={LIBRARY_SVG} width={300} height={230} style={{ alignSelf: 'center', marginBottom: 0 }} />
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
