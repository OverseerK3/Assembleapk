import { getSupabase } from '@/lib/supabase';
import { Link, router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Icon casts to satisfy lucide types in RN
const IconEye = Eye as any;
const IconEyeOff = EyeOff as any;

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [role, setRole] = useState<'participant' | 'organization'>('participant');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignUp = async () => {
    setError(null);
    if (!name || !email || !password) {
      setError('Please fill all fields');
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await getSupabase().auth.signUp({ email, password, options: { data: { full_name: name, role } } });
      if (error) throw error;
      // Navigate to OTP screen with context
      router.replace({ pathname: '/(auth)/sign-up-otp', params: { email, fullName: name, role } } as any);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.centerWrap}>
        <Text style={styles.brand}>Assemble</Text>
        <View style={styles.card}>
          <Text style={styles.title}>Create your account</Text>

          <Text style={styles.label}>I am a</Text>
          <View style={styles.segmentRow}>
            <TouchableOpacity
              onPress={() => setRole('participant')}
              activeOpacity={0.9}
              style={[styles.segment, role === 'participant' && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, role === 'participant' && styles.segmentTextActive]}>Participant</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setRole('organization')}
              activeOpacity={0.9}
              style={[styles.segment, role === 'organization' && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, role === 'organization' && styles.segmentTextActive]}>Organization</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Full name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Jane Doe"
            autoCapitalize="words"
            style={styles.input}
            placeholderTextColor="#98A9D7"
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Email</Text>
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
              placeholder="Create a strong password"
              secureTextEntry={!showPwd}
              autoCapitalize="none"
              autoComplete="password-new"
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

          <Text style={styles.muted}>We’ll send a 6‑digit code to verify your email.</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={onSignUp} activeOpacity={0.9} disabled={loading}>
            <Text style={styles.primaryBtnText}>{loading ? 'Sending code…' : 'Create account'}</Text>
          </TouchableOpacity>

          <View style={styles.bottomRow}>
            <Text style={styles.muted}>Already have an account?</Text>
            <Link href="/(auth)/sign-in" style={styles.link}>
              Sign in
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
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 },
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
  inputInner: { flex: 1, paddingVertical: Platform.select({ ios: 12, android: 10, default: 8 }), color: BLUE_TEXT },
  toggleText: { color: BLUE_PRIMARY, fontWeight: '700' },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  segment: {
    flex: 1,
    backgroundColor: '#F9FBFF',
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: BLUE_PRIMARY,
    borderColor: BLUE_PRIMARY,
  },
  segmentText: {
    color: '#5E6E99',
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
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
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  btnDisabled: { opacity: 0.6 },
  bottomRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  link: { color: BLUE_PRIMARY, fontWeight: '700' },
  muted: { color: '#5E6E99' },
  error: { color: '#C62828', marginTop: 10, textAlign: 'center' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: { width: 64, height: 64, borderRadius: 40, backgroundColor: '#EFF4FF', borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  avatarPlaceholder: { flex: 1, backgroundColor: '#E6EDFF' },
  pickBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: '#F0F4FF' },
  pickBtnText: { color: BLUE_TEXT, fontWeight: '700' },
});

