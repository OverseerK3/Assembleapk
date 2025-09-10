import { useAuth } from '@/app/_layout';
import { Theme } from '@/constants/Theme';
import { deleteEvent, listEventsFor, listJoinedEvents, listParticipants } from '@/lib/events';
import { getSupabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, RefreshControl, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

export default function EventsScreen() {
  const { role, user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<'your' | 'upcoming' | 'completed'>(role === 'organization' ? 'your' : 'your');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [orgProfile, setOrgProfile] = useState<{ full_name?: string | null; avatar_url?: string | null } | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [pStatus, setPStatus] = useState<'upcoming' | 'completed'>('upcoming');
  // Participants modal state
  const [partsOpen, setPartsOpen] = useState(false);
  const [parts, setParts] = useState<Array<{ user_id: string; full_name?: string | null; avatar_url?: string | null; username?: string | null; email?: string | null; joined_at?: string | null }>>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partsError, setPartsError] = useState<string | null>(null);
  const [partsEvent, setPartsEvent] = useState<any | null>(null);

  async function load() {
    if (!user?.id) return;
    setLoading(true);
    try {
      if (role === 'organization') {
        const data = await listEventsFor(role, user.id);
        setEvents(data ?? []);
      } else {
        // participant: fetch joined events by status
  const data = await listJoinedEvents(pStatus, user.id);
        setEvents(data ?? []);
      }
    } catch (e) {
      console.warn('Failed to load events', e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); // initial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, user?.id, pStatus]);

  // Load current organization profile for display on the card header (name/avatar)
  useEffect(() => {
    async function loadProfile() {
      if (role !== 'organization' || !user?.id) { setOrgProfile(null); return; }
      try {
        const { data, error } = await getSupabase()
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single();
        if (!error) setOrgProfile(data ?? null);
      } catch {}
    }
    loadProfile();
  }, [role, user?.id]);

  // Also reload whenever this tab regains focus (e.g., after creating an event)
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [role, user?.id])
  );
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const now = Date.now();
  const your = useMemo(() => events.filter((e) => e.organization_id === user?.id), [events, user?.id]);
  const upcoming = useMemo(() => events.filter((e) => new Date(e.ends_at).getTime() >= now), [events, now]);
  const completed = useMemo(() => events.filter((e) => new Date(e.ends_at).getTime() < now), [events, now]);
  const byFilter = role === 'organization' ? (filter === 'your' ? your : filter === 'upcoming' ? upcoming : completed) : events;
  const counts = role === 'organization'
    ? { your: your.length, upcoming: upcoming.length, completed: completed.length }
    : { your: events.length, upcoming: 0, completed: 0 };

  function formatDatePill(starts_at: string) {
    const d = new Date(starts_at);
    return d.toLocaleString(undefined, {
      month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit'
    }).replace(',', ' ·');
  }

  function onEdit(item: any) {
    setSelected(null);
    router.push({ pathname: '/create-event', params: { id: item.id } } as any);
  }
  async function onDelete(item: any) {
    setSelected(null);
    Alert.alert('Delete event', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteEvent(item.id); await load(); } catch (e) { Alert.alert('Error', (e as any)?.message || 'Failed to delete'); }
        }
      }
    ]);
  }

  async function onParticipants(item: any) {
    try {
      setPartsEvent(item);
      setPartsError(null);
      setPartsOpen(true);
      setPartsLoading(true);
      const rows = await listParticipants(item.id);
      setParts(rows);
    } catch (e: any) {
      setPartsError(e?.message ?? 'Failed to load participants');
      setParts([]);
    } finally {
      setPartsLoading(false);
    }
  }

  function renderYourEventCard(item: any) {
    const orgName = orgProfile?.full_name || 'Your organization';
    const datePill = formatDatePill(item.starts_at);
    const locPill = item.is_online ? 'Online' : (item.location || 'In-person');
    return (
      <View style={stylesRich.card}>
        <View style={stylesRich.headerRow}>
          {orgProfile?.avatar_url ? (
            <Image source={{ uri: orgProfile.avatar_url }} style={stylesRich.avatar} contentFit="cover" transition={100} />
          ) : (
            <View style={stylesRich.avatar} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={stylesRich.org}>{orgName}</Text>
            <Text style={stylesRich.meta}>posted an event</Text>
          </View>
          {role === 'organization' ? (
            <TouchableOpacity onPress={() => setSelected(item)}>
              <Text style={stylesRich.more}>•••</Text>
            </TouchableOpacity>
          ) : (
            <Text style={stylesRich.more}>•••</Text>
          )}
        </View>
        <Text style={stylesRich.title}>{item.title}</Text>
        <View style={stylesRich.pillRow}>
          <Text style={stylesRich.pill}>{datePill}</Text>
          <Text style={stylesRich.pill}>{locPill}</Text>
          {!!item.category && (
            <Text style={[stylesRich.pill, stylesRich.tagGreen]}>
              {item.category === 'tech event' ? 'Tech event' : item.category === 'tech meetup' ? 'Tech meetup' : String(item.category).charAt(0).toUpperCase() + String(item.category).slice(1)}
            </Text>
          )}
        </View>
        {item.banner_url ? (
          <Image source={{ uri: item.banner_url }} style={stylesRich.banner} contentFit="cover" transition={100} />
        ) : (
          <View style={stylesRich.banner} />
        )}
        <View style={stylesRich.footerRow}>
          <Text style={stylesRich.footerText}>0 likes</Text>
          <Text style={stylesRich.footerText}>0 comments</Text>
        </View>
      </View>
    );
  }

  const CONTENT_MAX_WIDTH = width >= 768 ? 720 : width >= 600 ? 560 : undefined;
  const SAFE_TOP_PAD = Platform.select({ ios: 8, android: (StatusBar.currentHeight || 0) + 8, default: 8 });

  return (
  <SafeAreaView style={styles.container}>
      <View style={[styles.headerRow, CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null, { paddingTop: SAFE_TOP_PAD }]}>
        <Text style={styles.header}>Events</Text>
        {role === 'organization' && (
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.9} onPress={() => router.push('/create-event' as any)}>
            <Text style={styles.addBtnText}>+ Post</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={[styles.segmentRow, CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null]}>
        {(role === 'organization' ? (['your', 'upcoming', 'completed'] as const) : (['your'] as const)).map((k) => (
          <TouchableOpacity key={k} onPress={() => setFilter(k)} style={[styles.segment, filter === k && styles.segmentActive]}>
            <Text style={[styles.segmentText, filter === k && styles.segmentTextActive]}>
              {(k === 'your' ? 'Your events' : k.charAt(0).toUpperCase() + k.slice(1))} ({counts[k]})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {role === 'participant' && (
        <View style={[stylesInner.chipsRow, CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null]}>
          {(['upcoming','completed'] as const).map((k) => (
            <TouchableOpacity key={k} onPress={() => setPStatus(k)} style={[stylesInner.chip, pStatus === k && stylesInner.chipActive]}>
              <Text style={[stylesInner.chipText, pStatus === k && stylesInner.chipTextActive]}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
    <FlatList
          data={byFilter}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            role === 'organization' ? (
              renderYourEventCard(item)
            ) : (
      <View style={[stylesRich.card, CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null]}>
                <View style={stylesRich.headerRow}>
                  {item.org_avatar_url ? (
                    <Image source={{ uri: item.org_avatar_url }} style={stylesRich.avatar} contentFit="cover" transition={100} />
                  ) : (
                    <View style={stylesRich.avatar} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={stylesRich.org}>{item.org_name || 'Organization'}</Text>
                    <Text style={stylesRich.meta}>you joined this event</Text>
                  </View>
                  <Text style={stylesRich.more}>•••</Text>
                </View>
                <Text style={stylesRich.title}>{item.title}</Text>
                <View style={stylesRich.pillRow}>
                  <Text style={stylesRich.pill}>{formatDatePill(item.starts_at)}</Text>
                  <Text style={stylesRich.pill}>{item.is_online ? 'Online' : (item.location || 'In-person')}</Text>
                  {!!item.category && (
                    <Text style={[stylesRich.pill, stylesRich.tagGreen]}>
                      {item.category === 'tech event' ? 'Tech event' : item.category === 'tech meetup' ? 'Tech meetup' : String(item.category).charAt(0).toUpperCase() + String(item.category).slice(1)}
                    </Text>
                  )}
                </View>
                {item.banner_url ? (
                  <Image source={{ uri: item.banner_url }} style={stylesRich.banner} contentFit="cover" transition={100} />
                ) : (
                  <View style={stylesRich.banner} />
                )}
                <View style={stylesRich.footerRow}>
                  <Text style={stylesRich.footerText}>{pStatus === 'completed' ? 'Completed' : 'Upcoming'}</Text>
                  <Text style={stylesRich.footerText}></Text>
                </View>
              </View>
            )
          )}
          contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: CONTENT_MAX_WIDTH ? 16 : 0 }}
          ListEmptyComponent={<Text style={[styles.cardMeta, { textAlign: 'center', marginTop: 24 }]}>No events.</Text>}
        />
      )}
      {/* Manage modal */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={stylesM.backdrop} onPress={() => setSelected(null)}>
          <View style={stylesM.card}>
            <Text style={stylesM.title}>Manage event</Text>
            <TouchableOpacity style={[stylesM.btn, stylesM.btnPrimary]} onPress={() => selected && onEdit(selected)}>
              <Text style={stylesM.btnTextPrimary}>Edit</Text>
            </TouchableOpacity>
            {role === 'organization' && (
              <TouchableOpacity
                style={[stylesM.btn, stylesM.btnPrimary]}
                onPress={() => {
                  const item = selected;
                  setSelected(null);
                  if (item) onParticipants(item);
                }}
              >
                <Text style={stylesM.btnTextPrimary}>Participants</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[stylesM.btn, stylesM.btnDanger]} onPress={() => selected && onDelete(selected)}>
              <Text style={stylesM.btnTextDanger}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[stylesM.btn]} onPress={() => setSelected(null)}>
              <Text style={stylesM.btnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      {/* Participants modal */}
      <Modal visible={partsOpen} transparent animationType="fade" onRequestClose={() => setPartsOpen(false)}>
        <Pressable style={stylesM.backdrop} onPress={() => setPartsOpen(false)}>
          <View style={[stylesM.card, CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null]}>
            <Text style={stylesM.title}>Participants{partsEvent?.title ? ` • ${partsEvent.title}` : ''}</Text>
            {partsLoading ? (
              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                <ActivityIndicator />
              </View>
            ) : partsError ? (
              <Text style={[styles.cardMeta, { textAlign: 'center' }]}>{partsError}</Text>
            ) : parts.length === 0 ? (
              <Text style={[styles.cardMeta, { textAlign: 'center' }]}>No participants yet.</Text>
            ) : (
              <View style={{ maxHeight: 360 }}>
        {parts.map((p) => (
                  <View key={p.user_id} style={stylesP.row}>
                    {p.avatar_url ? (
                      <Image source={{ uri: p.avatar_url }} style={stylesP.avatar} contentFit="cover" />
                    ) : (
                      <View style={stylesP.avatar} />
                    )}
                    <View style={{ flex: 1 }}>
          <Text style={stylesP.name} numberOfLines={1}>{p.full_name || p.username || 'User'}</Text>
          <Text style={stylesP.meta} numberOfLines={1}>{p.email || 'No email available'}</Text>
                    </View>
                    {!!p.joined_at && <Text style={stylesP.meta}>{new Date(p.joined_at).toLocaleDateString()}</Text>}
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity style={[stylesM.btn]} onPress={() => setPartsOpen(false)}>
              <Text style={stylesM.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
  </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.bg, padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  header: { color: Theme.colors.text, fontSize: 28, fontWeight: '800', fontFamily: 'Urbanist_800ExtraBold' },
  addBtn: { backgroundColor: Theme.colors.primary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '800' },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  segment: { flex: 1, backgroundColor: '#F0F4FF', borderColor: Theme.colors.border, borderWidth: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  segmentActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  segmentText: { color: Theme.colors.text, fontWeight: '700', fontFamily: 'Urbanist_600SemiBold' },
  segmentTextActive: { color: '#FFFFFF' },
  card: {
    backgroundColor: Theme.colors.card,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardTitle: { color: Theme.colors.text, fontWeight: '700', fontSize: 16, fontFamily: 'Urbanist_700Bold' },
  cardMeta: { color: Theme.colors.muted, fontSize: 12, marginTop: 4, fontFamily: 'Urbanist_400Regular' },
});

// Rich card styles matching Home feed UI, namespaced to avoid conflicts
const BLUE_BG = Theme.colors.bg;
const BLUE_CARD = Theme.colors.card;
const BLUE_BORDER = Theme.colors.border;
const BLUE_TEXT_DARK = Theme.colors.text;

const stylesRich = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: BLUE_CARD,
    borderColor: BLUE_BORDER,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E6EDFF', borderWidth: 1, borderColor: BLUE_BORDER },
  org: { color: BLUE_TEXT_DARK, fontWeight: '800', fontFamily: 'Urbanist_700Bold' },
  meta: { color: Theme.colors.muted, fontSize: 12, fontFamily: 'Urbanist_400Regular' },
  more: { color: Theme.colors.muted, fontWeight: '700' },
  title: { color: BLUE_TEXT_DARK, fontSize: 16, fontWeight: '800', marginBottom: 8, fontFamily: 'Urbanist_700Bold' },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pill: {
    color: BLUE_TEXT_DARK,
    fontSize: 12,
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BLUE_BORDER,
    overflow: 'hidden',
  },
  tagGreen: { backgroundColor: '#E8F9EF', borderColor: '#7DD58C', color: '#146C43' },
  banner: { width: '100%', aspectRatio: 16/9, borderRadius: 12, backgroundColor: '#E6EDFF', marginBottom: 10, borderWidth: 1, borderColor: BLUE_BORDER },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { color: Theme.colors.muted, fontSize: 12, fontFamily: 'Urbanist_400Regular' },
});

const stylesM = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: Theme.colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Theme.colors.border, width: '100%' },
  title: { color: Theme.colors.text, fontFamily: 'Urbanist_700Bold', fontSize: 16, marginBottom: 8, textAlign: 'center' },
  btn: { backgroundColor: '#F0F4FF', borderColor: Theme.colors.border, borderWidth: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnPrimary: { backgroundColor: Theme.colors.card },
  btnDanger: { backgroundColor: '#FFECEF', borderColor: '#FFD1D9' },
  btnText: { color: Theme.colors.text, fontFamily: 'Urbanist_700Bold' },
  btnTextPrimary: { color: Theme.colors.text, fontFamily: 'Urbanist_700Bold' },
  btnTextDanger: { color: '#B42318', fontFamily: 'Urbanist_700Bold' },
});

const stylesP = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Theme.colors.border },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E6EDFF', borderWidth: 1, borderColor: Theme.colors.border },
  name: { color: Theme.colors.text, fontFamily: 'Urbanist_700Bold' },
  meta: { color: Theme.colors.muted, fontFamily: 'Urbanist_400Regular', fontSize: 12 },
});

const stylesInner = StyleSheet.create({
  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: {
    backgroundColor: '#F0F4FF',
    borderColor: Theme.colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  chipText: { color: Theme.colors.text, fontFamily: 'Urbanist_600SemiBold' },
  chipTextActive: { color: '#FFFFFF' },
});
