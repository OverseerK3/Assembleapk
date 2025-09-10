import { getSupabase } from '@/lib/supabase';
import { Link, router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Icon casts to satisfy lucide types in RN
const IconEye = Eye as any;
const IconEyeOff = EyeOff as any;

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = async () => {
    setError(null);
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    try {
      setLoading(true);
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
  router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.centerWrap}>
        <Text style={styles.brand}>Assemble</Text>
        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={styles.input}
            placeholderTextColor="#98A9D7"
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPwd}
              autoCapitalize="none"
              autoComplete="password"
              style={styles.inputInner}
              placeholderTextColor="#98A9D7"
            />
            <TouchableOpacity onPress={() => setShowPwd((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {showPwd ? (
                <IconEyeOff size={20} color={BLUE_PRIMARY} />
              ) : (
                <IconEye size={20} color={BLUE_PRIMARY} />
              )}
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={onSignIn}
            activeOpacity={0.9}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
          </TouchableOpacity>

          <View style={styles.bottomRow}>
            <Text style={styles.muted}>New here?</Text>
            <Link href="../sign-up" style={styles.link}>
              Create account
            </Link>
          </View>
        </View>
      </View>
    </View>
  );
}

const BLUE_PRIMARY = '#1E5BFF';
const BLUE_TEXT = '#0A2A6B';
const BG = '#F5F8FF';
const CARD = '#FFFFFF';
const BORDER = '#E3EAFD';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  brand: { color: BLUE_TEXT, fontSize: 28, fontWeight: '800', marginBottom: 12 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  title: { color: BLUE_TEXT, fontSize: 20, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  label: { color: BLUE_TEXT, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#F9FBFF',
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 14, android: 12, default: 10 }),
    color: BLUE_TEXT,
  },
  inputWrap: {
    backgroundColor: '#F9FBFF',
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 2, android: 0, default: 0 }),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputInner: {
    flex: 1,
    paddingVertical: Platform.select({ ios: 12, android: 10, default: 8 }),
    color: BLUE_TEXT,
  },
  toggleText: { color: BLUE_PRIMARY, fontWeight: '700' },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: BLUE_PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: BLUE_PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
  btnDisabled: {
    opacity: 0.6,
  },
  bottomRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  link: { color: BLUE_PRIMARY, fontWeight: '700' },
  muted: { color: '#5E6E99' },
  error: { color: '#C62828', marginTop: 10, textAlign: 'center' },
});
