import { useAuth } from '@/app/_layout';
import { Theme } from '@/constants/Theme';
import { isUsernameAvailable, sanitizeUsername, upsertProfileFromMetadata } from '@/lib/profile';
import { getSupabase } from '@/lib/supabase';
import { deleteFromBucket, extractBucketPathFromPublicUrl } from '@/lib/upload';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const { user, role } = useAuth();
  const router = useRouter();

  // Common
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [notifications, setNotifications] = useState({ app: true, email: true });

  // Participant
  const [username, setUsername] = useState('');
  const [interests, setInterests] = useState('');

  // Organization
  const [orgName, setOrgName] = useState('');
  const [website, setWebsite] = useState('');
  const [orgLocation, setOrgLocation] = useState('');
  // Frontend-only avatar preview
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    const md: any = user?.user_metadata ?? {};
    setFullName(md.full_name ?? '');
    setBio(md.bio ?? '');
  setAvatarPreview(md.avatar_url ?? null);
    setUsername(md.username ?? '');
    setInterests(md.interests ?? '');
    setOrgName(md.org_name ?? '');
    setWebsite(md.website ?? '');
    setOrgLocation(md.org_location ?? '');
    setNotifications({ app: (md.notif_app ?? true) as boolean, email: (md.notif_email ?? true) as boolean });
  }, [user?.id]);

  const isOrg = role === 'organization';
  const canSave = useMemo(() => fullName.trim().length > 0, [fullName]);

  async function onSave() {
    if (!user?.id) return;
    try {
      // 1) If a new avatar preview is a local file URI, upload to storage and set avatar_url
      let avatar_url: string | undefined;
    // Upload if local URI (file:// or content://). Skip if it's already an http(s) URL.
    if (avatarPreview && !/^https?:/i.test(avatarPreview)) {
        try {
          const fileExt = (avatarPreview.split('.').pop() || 'jpg').toLowerCase();
          // Keep a stable path for the current avatar so old files don't accumulate.
          const path = `avatars/${user.id}/avatar.${fileExt}`;
          
          const { uploadToBucketSimple } = await import('@/lib/upload-simple');
          avatar_url = await uploadToBucketSimple({ bucket: 'event-banners', path, uri: avatarPreview, contentType: 'image/jpeg' });

          // Cleanup: if user had an old avatar file at a different path, delete it
          const oldUrl = user.user_metadata?.avatar_url as string | undefined;
          if (oldUrl && avatar_url && oldUrl !== avatar_url) {
            const oldPath = extractBucketPathFromPublicUrl(oldUrl, 'event-banners');
            if (oldPath && oldPath !== path) {
              try {
                await deleteFromBucket({ bucket: 'event-banners', path: oldPath });
              } catch (e) {
                console.log('⚠️ Failed to delete old avatar:', e);
              }
            }
          }
        } catch (e: any) {
          console.warn('Avatar upload failed:', e?.message || e);
          Alert.alert('Upload failed', e?.message ?? 'Could not upload profile image.');
        }
      }

      const md: any = {
        full_name: fullName.trim(),
        bio: bio.trim(),
        notif_app: notifications.app,
        notif_email: notifications.email,
      };
      if (avatar_url) md.avatar_url = avatar_url;
      if (!isOrg) {
        const prev = sanitizeUsername((user.user_metadata?.username ?? '') as string);
        const clean = sanitizeUsername(username.trim());
        if (clean && clean !== prev) {
          const available = await isUsernameAvailable(clean, user.id);
          if (!available) {
            // Don't block the rest of the save. Inform and continue without changing username.
            Alert.alert('Username taken', 'That username is already in use. We’ll keep your current username.');
          } else {
            md.username = clean;
          }
        }
        md.interests = interests.trim();
      } else {
        md.org_name = orgName.trim();
        md.website = website.trim();
        md.org_location = orgLocation.trim();
      }
      const { data: updated, error } = await getSupabase().auth.updateUser({ data: md });
      if (error) throw error;
      if (updated?.user) {
        await upsertProfileFromMetadata(updated.user as any);
      }
      Alert.alert('Saved', 'Your settings have been updated.');
      router.back();
    } catch (e: any) {
      // Friendly mapping for common errors
      const msg = String(e?.message || e || 'Failed to save settings');
      if (/profiles_username_key/i.test(msg) || /duplicate key value/i.test(msg)) {
        Alert.alert('Username taken', 'That username is already in use. Please choose another.');
      } else {
        Alert.alert('Error', msg);
      }
    }
  }

  async function onSignOut() {
    await getSupabase().auth.signOut();
    router.replace('/');
  }

  async function pickAvatar() {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!result.canceled && result.assets?.length) {
      setAvatarPreview(result.assets[0].uri);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.title}>Settings</Text>

        <Section title="Account">
          <Field label="Profile Image (preview only)">
            <Row style={{ alignItems: 'center' }}>
              <View style={styles.avatarCircle}>
                {avatarPreview ? (
                  <Image source={{ uri: avatarPreview }} style={{ width: '100%', height: '100%', borderRadius: 40 }} contentFit="cover" />
                ) : (
                  <View style={{ flex: 1, backgroundColor: '#E6EDFF' }} />
                )}
              </View>
              <TouchableOpacity onPress={pickAvatar} style={[styles.btn, styles.btnGhost]}>
                <Text style={[styles.btnText, { color: Theme.colors.text }]}>Change image</Text>
              </TouchableOpacity>
            </Row>
            <Text style={[styles.muted, { marginTop: 4 }]}>Not saved yet — backend wiring pending.</Text>
          </Field>
          <Field label="Full Name">
            <Input value={fullName} onChangeText={setFullName} placeholder="Your name" />
          </Field>
          <Field label="Email">
            <Input value={user?.email ?? ''} editable={false} />
          </Field>
          <Field label="Bio">
            <Input multiline value={bio} onChangeText={setBio} placeholder="Tell something about you" style={{ height: 100, textAlignVertical: 'top' }} />
          </Field>
        </Section>

        {isOrg ? (
          <Section title="Organization Profile">
            <Field label="Organization Name"><Input value={orgName} onChangeText={setOrgName} placeholder="Your org name" /></Field>
            <Field label="Website"><Input value={website} onChangeText={setWebsite} autoCapitalize="none" placeholder="https://..." /></Field>
            <Field label="Location"><Input value={orgLocation} onChangeText={setOrgLocation} placeholder="City, Country" /></Field>
          </Section>
        ) : (
          <Section title="Public Profile">
            <Field label="Username"><Input value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="username" /></Field>
            <Field label="Interests"><Input value={interests} onChangeText={setInterests} placeholder="AI, Web, DevOps" /></Field>
          </Section>
        )}

        <Section title="Notifications">
          <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.label}>In-app notifications</Text>
            <Switch value={notifications.app} onValueChange={(v) => setNotifications((p) => ({ ...p, app: v }))} thumbColor={Theme.colors.primary} />
          </Row>
          <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.label}>Email notifications</Text>
            <Switch value={notifications.email} onValueChange={(v) => setNotifications((p) => ({ ...p, email: v }))} thumbColor={Theme.colors.primary} />
          </Row>
        </Section>

        <Row>
          <TouchableOpacity style={[styles.btn, styles.btnGhost, { flex: 1 }]} onPress={() => router.back()}>
            <Text style={[styles.btnText, { color: Theme.colors.text }]}>Cancel</Text>
          </TouchableOpacity>
          <View style={{ width: 8 }} />
          <TouchableOpacity disabled={!canSave} style={[styles.btn, !canSave ? styles.btnDisabled : styles.btnPrimary, { flex: 1 }]} onPress={onSave}>
            <Text style={[styles.btnText, { color: '#fff' }]}>Save</Text>
          </TouchableOpacity>
        </Row>

        <TouchableOpacity style={[styles.btn, { marginTop: 12, backgroundColor: '#FFE9E9', borderColor: '#F6CACA' }]} onPress={onSignOut}>
          <Text style={[styles.btnText, { color: '#B42318' }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}
function Row({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[{ flexDirection: 'row', gap: 8 }, style]}>{children}</View>;
}
function Input(props: any) {
  return (
    <TextInput
      {...props}
      style={[styles.input, props.multiline && { height: 100 }, props.style]}
      placeholderTextColor={Theme.colors.muted}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.bg, padding: 16 },
  title: { color: Theme.colors.text, fontSize: 24, fontFamily: 'Urbanist_800ExtraBold', marginBottom: 12 },
  section: { backgroundColor: Theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: Theme.colors.border, padding: 14, marginBottom: 12 },
  sectionTitle: { color: Theme.colors.text, fontFamily: 'Urbanist_700Bold', marginBottom: 10, fontSize: 16 },
  label: { color: Theme.colors.text, fontFamily: 'Urbanist_600SemiBold', marginBottom: 6 },
  input: { backgroundColor: '#FFFFFF', borderColor: Theme.colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: Theme.colors.text },
  btn: { backgroundColor: Theme.colors.card, borderColor: Theme.colors.border, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  btnGhost: { backgroundColor: '#F0F4FF' },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontFamily: 'Urbanist_700Bold' },
  avatarCircle: { width: 64, height: 64, borderRadius: 40, backgroundColor: '#EFF4FF', borderWidth: 1, borderColor: Theme.colors.border, overflow: 'hidden', marginRight: 8 },
  muted: { color: Theme.colors.muted },
});

