import { useAuth } from '@/app/_layout';
import { Theme } from '@/constants/Theme';
import { emitAppEvent } from '@/lib/event-bus';
import { countParticipants, getEventWithOrgById, isUserJoined, joinEvent, unjoinEvent } from '@/lib/events';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Clock, Globe, MapPin, Tag, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

export default function EventDetailsScreen() {
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, role } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<any | null>(null);
  const [joined, setJoined] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [pCount, setPCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!id) return;
      try {
        setLoadError(null);
        const e = await getEventWithOrgById(String(id));
        if (mounted) setEvent(e);
        try {
          const c = await countParticipants(String(id));
          if (mounted) setPCount(c);
        } catch {}
        if (user?.id) {
          const j = await isUserJoined(String(id), user.id);
          if (mounted) setJoined(!!j);
        }
      } catch (err: any) {
        if (mounted) setLoadError(err?.message || 'Failed to load event');
      }
    }
    load();
    return () => { mounted = false; };
  }, [id, user?.id]);

  // Responsive metrics
  const SAFE_TOP_PAD = Platform.select({ ios: 8, android: (StatusBar.currentHeight || 0) + 8, default: 8 });
  const CONTENT_MAX_WIDTH = width >= 768 ? 720 : width >= 600 ? 560 : undefined;

  if (!event) {
    return (
      <SafeAreaView style={[styles.container, { padding: 16 }]}>
        {loadError ? (
          <View>
            <Text style={[styles.text, { marginBottom: 8 }]}>Error: {loadError}</Text>
            <TouchableOpacity onPress={() => {
              // simple re-run of effect by nudging id dep
              setLoadError(null);
              // no-op; navigation will keep id, effect will re-run on next render tick anyway
            }} style={[styles.btn, styles.btnPrimary]}>
              <Text style={styles.btnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.text}>Loading…</Text>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 36 }}>
        {/* Hero banner */}
        <View style={styles.heroWrap}>
          {event.banner_url ? (
            <Image source={{ uri: event.banner_url }} style={styles.hero} contentFit="cover" />
          ) : (
            <View style={[styles.hero, { backgroundColor: '#E6EDFF' }]} />
          )}
          <View style={styles.heroOverlay} />
          <View style={[styles.heroHeader, { top: 18 + (SAFE_TOP_PAD as number) }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.heroBtn}><Text style={styles.heroBtnText}>Back</Text></TouchableOpacity>
          </View>
          <View style={styles.heroFooter}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {event.org_avatar_url ? (
                <Image source={{ uri: event.org_avatar_url }} style={styles.orgAvatar as any} />
              ) : (
                <View style={styles.orgAvatar} />
              )}
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.heroTitle} numberOfLines={2} ellipsizeMode="tail">{event.title}</Text>
                <Text style={styles.heroOrg} numberOfLines={1} ellipsizeMode="tail">{event.org_name || 'Organization'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick facts */}
        <View style={[
          styles.section,
          { paddingTop: 12 },
          CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null,
        ]}>
          <View style={styles.row}>
            <View style={styles.fact}><Calendar size={16} /><Text style={styles.factText} numberOfLines={1} ellipsizeMode="tail">{formatDateTime(event.starts_at)}</Text></View>
            <View style={styles.fact}><Clock size={16} /><Text style={styles.factText} numberOfLines={1} ellipsizeMode="tail">{formatDateTime(event.ends_at)}</Text></View>
          </View>
          <View style={styles.row}>
            <View style={styles.fact}><MapPin size={16} /><Text style={styles.factText} numberOfLines={1} ellipsizeMode="tail">{event.is_online ? 'Online' : (event.location || 'In-person')}</Text></View>
            {event.category ? (<View style={[styles.fact, styles.factTag]}><Tag size={16} /><Text style={[styles.factText, { color: '#146C43' }]}>{event.category === 'tech event' ? 'Tech event' : event.category === 'tech meetup' ? 'Tech meetup' : String(event.category).charAt(0).toUpperCase() + String(event.category).slice(1)}</Text></View>) : null}
          </View>
          <View style={styles.row}>
            {typeof event.min_team_size === 'number' || typeof event.max_team_size === 'number' ? (
              <View style={styles.fact}><Users size={16} /><Text style={styles.factText} numberOfLines={1} ellipsizeMode="tail">Team size: {event.min_team_size ?? 1}{event.max_team_size ? `–${event.max_team_size}` : '+'}</Text></View>
            ) : null}
            {pCount !== null ? (<View style={styles.fact}><Users size={16} /><Text style={styles.factText} numberOfLines={1} ellipsizeMode="tail">{pCount} joined</Text></View>) : null}
          </View>
          {event.website ? (
            <TouchableOpacity onPress={() => Linking.openURL(event.website!)} style={[styles.linkRow]} activeOpacity={0.9}>
              <Globe size={16} />
              <Text style={[styles.linkText, { flex: 1 }]} numberOfLines={1} ellipsizeMode="middle">{event.website}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Description */}
        {event.description ? (
          <View style={[styles.section, CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null]}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.text}>{event.description}</Text>
          </View>
        ) : null}
          {role === 'participant' && user?.id ? (
            joined ? (
              <TouchableOpacity onPress={() => setConfirmLeave(true)} style={[styles.btn, styles.btnOutline, styles.cta, CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null]}>
                <Text style={[styles.btnText, styles.btnTextOutline]}>Leave event</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={async () => {
                  try { await joinEvent(event.id, user.id); setJoined(true); emitAppEvent({ type: 'event:joined', eventId: event.id }); if (pCount !== null) setPCount((c) => (c ?? 0) + 1); } catch {}
                }}
                style={[styles.btn, styles.btnPrimary, styles.cta, CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null]}
              >
                <Text style={styles.btnText}>Join event</Text>
              </TouchableOpacity>
            )
          ) : null}
        <View style={{ height: 8 }} />
      </ScrollView>
      {/* Leave confirmation modal */}
      <Modal visible={confirmLeave} transparent animationType="fade" onRequestClose={() => setConfirmLeave(false)}>
        <Pressable style={stylesM.backdrop} onPress={() => setConfirmLeave(false)}>
          <Pressable style={stylesM.card} onPress={() => { /* swallow */ }}>
            <Text style={stylesM.title}>Leave this event?</Text>
            <Text style={stylesM.body}>You will stop receiving updates from the organizer and your spot may be released.</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity onPress={() => setConfirmLeave(false)} style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
        onPress={async () => {
                  if (!user?.id || !event?.id) return;
                  try {
                    await unjoinEvent(event.id, user.id);
                    setJoined(false);
                    emitAppEvent({ type: 'event:left', eventId: event.id });
          try { const c = await countParticipants(String(event.id)); setPCount(c); } catch {}
                  } catch {}
                  setConfirmLeave(false);
                }}
                style={[styles.btn, styles.btnOutline]}
              >
                <Text style={[styles.btnText, styles.btnTextOutline]}>Confirm leave</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.bg },
  heroWrap: { position: 'relative' },
  hero: { width: '100%', aspectRatio: 16/9 },
  heroOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%', backgroundColor: 'rgba(0,0,0,0.25)' },
  heroHeader: { position: 'absolute', top: 18, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  heroBtn: { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  heroBtnText: { color: '#fff', fontFamily: 'Urbanist_700Bold' },
  heroFooter: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  orgAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E6EDFF', borderWidth: 1, borderColor: Theme.colors.border },
  heroTitle: { color: '#fff', fontFamily: 'Urbanist_800ExtraBold', fontSize: 22, flexShrink: 1 },
  heroOrg: { color: '#E5F0FF', fontFamily: 'Urbanist_600SemiBold', marginTop: 2 },
  section: { backgroundColor: Theme.colors.card, marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: Theme.colors.border, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  sectionTitle: { color: Theme.colors.text, fontFamily: 'Urbanist_800ExtraBold', fontSize: 16, marginBottom: 8 },
  text: { color: Theme.colors.text, lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start', marginTop: 8 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0F4FF', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: Theme.colors.border, maxWidth: '100%' },
  factText: { color: Theme.colors.text, fontFamily: 'Urbanist_600SemiBold', flexShrink: 1 },
  factTag: { backgroundColor: '#E8F9EF', borderColor: '#7DD58C' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  linkText: { color: Theme.colors.primary, fontFamily: 'Urbanist_700Bold' },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', marginTop: 12 },
  btnPrimary: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  btnOutline: { backgroundColor: Theme.colors.card, borderColor: Theme.colors.primary },
  btnText: { color: '#fff', fontFamily: 'Urbanist_700Bold' },
  btnTextOutline: { color: Theme.colors.primary },
  btnGhost: { backgroundColor: '#F0F4FF' },
  cta: { marginHorizontal: 16 },
});

const stylesM = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, borderColor: Theme.colors.border, borderWidth: 1, padding: 16 },
  title: { color: Theme.colors.text, fontFamily: 'Urbanist_700Bold', fontSize: 18 },
  body: { color: Theme.colors.muted, marginTop: 8 },
});
