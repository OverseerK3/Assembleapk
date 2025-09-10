import { isUsernameAvailable, sanitizeUsername, upsertProfileFromMetadata } from '@/lib/profile';
import { getSupabase } from '@/lib/supabase';
import { uploadToBucketSimple } from '@/lib/upload-simple';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Link, router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Multi-step signup after initial email+role
// Step 1 (from sign-up): user calls signUp(email,password) which triggers OTP email
// Step 2 (this screen): enter 6-digit OTP
// Step 3: profile completion (username, avatar, skills, college)

export default function SignUpOtpScreen() {
  const params = useLocalSearchParams<{ email?: string; fullName?: string; role?: string }>();
  const email = String(params.email || '');
  const fullName = String(params.fullName || '');
  const role = (params.role === 'organization' ? 'organization' : 'participant') as 'participant' | 'organization';

  const [step, setStep] = useState<1 | 2>(1);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile fields for step 2
  const [username, setUsername] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [skills, setSkills] = useState('');
  const [college, setCollege] = useState('');
  const [avatarMime, setAvatarMime] = useState<string | null>(null);
  const [checkingUname, setCheckingUname] = useState(false);
  const [unameOk, setUnameOk] = useState<boolean | null>(null);

  const supabase = getSupabase();

  async function verifyCode() {
    setError(null);
    if (!otp || otp.trim().length < 4) { setError('Enter the code sent to your email'); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: 'signup' });
      if (error) throw error;
      // Attach basic metadata now that user is verified
      if (data?.user?.id) {
        await supabase.auth.updateUser({ data: { full_name: fullName, role } });
        try { await upsertProfileFromMetadata(data.user as any); } catch {}
      }
      setStep(2);
    } catch (e: any) {
      setError(e?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  }

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9, base64: false });
    if (!result.canceled && result.assets?.length) {
      const a = result.assets[0] as any;
      setAvatarUri(a.uri);
      setAvatarMime(a.mimeType || (a.uri?.endsWith('.png') ? 'image/png' : a.uri?.endsWith('.webp') ? 'image/webp' : 'image/jpeg'));
    }
  }

  async function checkUsername(val: string) {
    setUsername(val);
    setUnameOk(null);
    if (!val) return;
    try {
      setCheckingUname(true);
      const session = await supabase.auth.getSession();
      const uid = session.data.session?.user.id;
      if (!uid) return;
      const ok = await isUsernameAvailable(val, uid);
      setUnameOk(ok);
    } catch {
      setUnameOk(null);
    } finally {
      setCheckingUname(false);
    }
  }

  async function completeProfile() {
    setError(null);
    try {
      setLoading(true);
      const session = await supabase.auth.getSession();
      const user = session.data.session?.user;
      if (!user?.id) throw new Error('No session');

      const uname = sanitizeUsername(username);
      if (!uname) throw new Error('Pick a username');

      // upload avatar first if any
      let avatarUrl: string | undefined;
    if (avatarUri) {
        try {
      const extGuess = avatarMime === 'image/png' ? 'png' : avatarMime === 'image/webp' ? 'webp' : avatarMime === 'image/heic' ? 'heic' : (avatarUri.split('.').pop() || 'jpg').toLowerCase();
      const path = `avatars/${user.id}/${Date.now()}.${extGuess}`;
      avatarUrl = await uploadToBucketSimple({ bucket: 'event-banners', path, uri: avatarUri, contentType: avatarMime || 'image/jpeg' });
        } catch (e) {
          console.warn('Avatar upload failed', e);
        }
      }

      // store metadata
      await supabase.auth.updateUser({ data: { username: uname, avatar_url: avatarUrl, skills, college } });
      try { await upsertProfileFromMetadata({ id: user.id, user_metadata: { username: uname, avatar_url: avatarUrl, full_name: fullName, role, skills, college } }); } catch {}

  router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e?.message || 'Failed to complete profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={S.container}>
      <View style={S.centerWrap}>
        <Text style={S.brand}>Assemble</Text>
        <View style={S.card}>
          {step === 1 ? (
            <>
              <Text style={S.title}>Verify your email</Text>
              <Text style={S.muted}>We sent a 6-digit code to {email}. Enter it below to continue.</Text>

              <Text style={[S.label, { marginTop: 12 }]}>Enter code</Text>
              <TextInput value={otp} onChangeText={setOtp} keyboardType="number-pad" placeholder="123456" style={S.input} placeholderTextColor="#98A9D7" />

              {error ? <Text style={S.error}>{error}</Text> : null}

              <TouchableOpacity onPress={verifyCode} style={[S.primaryBtn, loading && S.btnDisabled]} activeOpacity={0.9} disabled={loading}>
                <Text style={S.primaryBtnText}>{loading ? 'Verifying…' : 'Continue'}</Text>
              </TouchableOpacity>

              <View style={S.bottomRow}>
                <Text style={S.muted}>Didn’t get it?</Text>
                <TouchableOpacity onPress={async () => { try { await supabase.auth.resend({ type: 'signup', email }); } catch {} }}>
                  <Text style={S.link}>Resend</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={S.title}>Complete your profile</Text>

              <Text style={[S.label, { marginTop: 12 }]}>Username</Text>
              <TextInput value={username} onChangeText={checkUsername} autoCapitalize="none" placeholder="yourname" style={S.input} placeholderTextColor="#98A9D7" />
              {checkingUname ? <Text style={S.muted}>Checking…</Text> : unameOk === false ? <Text style={S.error}>Username taken</Text> : null}

              <Text style={[S.label, { marginTop: 12 }]}>Profile image (optional)</Text>
              <View style={S.avatarRow}>
                <View style={S.avatarCircle}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={{ width: '100%', height: '100%', borderRadius: 40 }} contentFit="cover" />
                  ) : (
                    <View style={S.avatarPlaceholder} />
                  )}
                </View>
                <TouchableOpacity onPress={pickAvatar} style={S.pickBtn} activeOpacity={0.9}>
                  <Text style={S.pickBtnText}>{avatarUri ? 'Change image' : 'Choose image'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={[S.label, { marginTop: 12 }]}>Skills (comma separated)</Text>
              <TextInput value={skills} onChangeText={setSkills} placeholder="react, node, ui/ux" style={S.input} placeholderTextColor="#98A9D7" />

              <Text style={[S.label, { marginTop: 12 }]}>College</Text>
              <TextInput value={college} onChangeText={setCollege} placeholder="Your college" style={S.input} placeholderTextColor="#98A9D7" />

              {error ? <Text style={S.error}>{error}</Text> : null}

              <TouchableOpacity onPress={completeProfile} style={[S.primaryBtn, loading && S.btnDisabled]} activeOpacity={0.9} disabled={loading}>
                <Text style={S.primaryBtnText}>{loading ? 'Saving…' : 'Finish'}</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={S.bottomRow}>
            <Text style={S.muted}>Already have an account?</Text>
            <Link href="/(auth)/sign-in" style={S.link}>Sign in</Link>
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

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  brand: { color: BLUE_TEXT, fontSize: 28, fontWeight: '800', marginBottom: 12 },
  card: { width: '100%', maxWidth: 420, backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  title: { color: BLUE_TEXT, fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  label: { color: BLUE_TEXT, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: '#F9FBFF', borderColor: BORDER, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.select({ ios: 14, android: 12, default: 10 }), color: BLUE_TEXT },
  primaryBtn: { marginTop: 16, backgroundColor: BLUE_PRIMARY, borderRadius: 12, paddingVertical: 14, alignItems: 'center', shadowColor: BLUE_PRIMARY, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.6 },
  bottomRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  link: { color: BLUE_PRIMARY, fontWeight: '700' },
  muted: { color: '#5E6E99' },
  error: { color: '#C62828', marginTop: 10, textAlign: 'center' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: { width: 64, height: 64, borderRadius: 40, backgroundColor: '#EFF4FF', borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  avatarPlaceholder: { flex: 1, backgroundColor: '#E6EDFF' },
  pickBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: '#F0F4FF' },
  pickBtnText: { color: BLUE_TEXT, fontWeight: '700' },
});
