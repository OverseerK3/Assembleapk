import { useAuth } from '@/app/_layout';
import { Theme } from '@/constants/Theme';
import { emitAppEvent, onAppEvent } from '@/lib/event-bus';
import { countInterested, fetchEventsFeed, joinEvent, listInterestedEventIds, listJoinedEventIds, toggleInterested } from '@/lib/events';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { Heart as HeartIcon } from 'phosphor-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
// No live feed here; keep static demo posts

// (definition appears below with the static POSTS)

type EventPost = {
  id: string;
  org: string;
  orgLogo?: string;
  title: string;
  date: string;
  location: string;
  banner?: any;
  likes: number;
  comments: number;
  category: 'hackathon' | 'tech event' | 'workshop' | 'projects' | 'tech meetup';
};

const POSTS: EventPost[] = [
  {
    id: '1',
    org: 'DevX Community',
    title: 'Hackathon 2025: Build with AI',
    date: 'Sep 12 · 9:00 AM',
    location: 'Pune · In-person',
    likes: 128,
    comments: 34,
    category: 'hackathon',
    banner: require('@/assets/images/tempHackathon/hack1poster.png'),
  },
  {
    id: '2',
    org: 'Cloud Native Org',
    title: 'Kubernetes Workshop — Zero to Hero',
    date: 'Aug 30 · 2:00 PM',
    location: 'Online · Zoom',
    likes: 89,
    comments: 19,
    category: 'workshop',
    banner: require('@/assets/images/tempHackathon/hack2poster.png'),
  },
  {
    id: '3',
    org: 'AI Labs',
    title: 'LLM Fine-tuning Bootcamp',
    date: 'Sep 05 · 11:00 AM',
    location: 'Bengaluru · Hybrid',
    likes: 210,
    comments: 51,
    category: 'tech event',
    banner: require('@/assets/images/tempHackathon/hack3poster.png'),
  },
  {
    id: '4',
    org: 'Open Source India',
    title: 'Open Source Summit — Community Day',
    date: 'Oct 10 · 10:00 AM',
    location: 'Delhi · In-person',
    likes: 58,
    comments: 12,
    category: 'projects',
    banner: require('@/assets/images/tempHackathon/hack4poster.png'),
  },
];

export default function HomeScreen() {
  const { role, user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<'all' | 'hackathon' | 'tech event' | 'workshop' | 'projects' | 'tech meetup'>('all');
  const [live, setLive] = useState<any[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ visible: boolean; eventId?: string } | null>(null);
  const [ack, setAck] = useState(false);
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());
  const [interestedCounts, setInterestedCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingLive(true);
      try {
        const data = await fetchEventsFeed({
          search: query.trim() || undefined,
          category: cat === 'all' ? null : (cat as any),
          limit: 20,
        });
        if (!cancelled) setLive(data);
        // fetch interested counts for visible live items
        try {
          const entries = await Promise.all((data || []).map(async (e: any) => [e.id, await countInterested(e.id)] as const));
          if (!cancelled) setInterestedCounts(Object.fromEntries(entries));
        } catch {}
      } catch (e) {
        if (!cancelled) setLive([]);
      } finally {
        if (!cancelled) setLoadingLive(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [query, cat]);

  // Load joined event ids for the current user
  useEffect(() => {
    let cancelled = false;
    async function loadJoined() {
      if (!user?.id) { setJoinedIds(new Set()); return; }
      try {
        const ids = await listJoinedEventIds(user.id);
        if (!cancelled) setJoinedIds(new Set(ids));
      } catch {
        if (!cancelled) setJoinedIds(new Set());
      }
    }
    loadJoined();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Load interested ids for the current user
  useEffect(() => {
    let cancelled = false;
    async function loadInterested() {
      if (!user?.id) { setInterestedIds(new Set()); return; }
      try {
        const ids = await listInterestedEventIds(user.id);
        if (!cancelled) setInterestedIds(new Set(ids));
      } catch {
        if (!cancelled) setInterestedIds(new Set());
      }
    }
    loadInterested();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Cross-screen sync for join/leave actions
  useEffect(() => {
    const off = onAppEvent((e) => {
      if (e.type === 'event:joined') {
        setJoinedIds((prev) => new Set([...prev, e.eventId]));
      } else if (e.type === 'event:left') {
        setJoinedIds((prev) => {
          const next = new Set(prev);
          next.delete(e.eventId);
          return next;
        });
      }
    });
    return off;
  }, []);

  const data = useMemo(() => {
    return POSTS.filter((p) => (cat === 'all' || p.category === cat) && (
      p.title.toLowerCase().includes(query.toLowerCase()) ||
      p.org.toLowerCase().includes(query.toLowerCase())
    ));
  }, [cat, query]);
  const items = useMemo(() => {
    const liveMapped = (live || []).map((e) => ({
      kind: 'live' as const,
      id: e.id,
      org_name: e.org_name,
      org_avatar_url: e.org_avatar_url,
      title: e.title,
      starts_at: e.starts_at,
      is_online: e.is_online,
      location: e.location,
      category: e.category,
      banner_url: e.banner_url,
      joined: false as boolean,
    }));
    const staticMapped = (data || []).map((p) => ({
      kind: 'static' as const,
      ...p,
    }));
    return [...liveMapped, ...staticMapped];
  }, [live, data]);

  // Add a comfortable top gap similar to professional apps
  const SAFE_TOP_PAD = Platform.select({ ios: 8, android: (StatusBar.currentHeight || 0) + 8, default: 8 });
  // Responsive card max width (center on tablets/web)
  const CARD_MAX_WIDTH = width >= 768 ? 720 : width >= 600 ? 560 : undefined;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: 14 + (SAFE_TOP_PAD as number) }]}>
        <Text style={styles.brand}>Assemble</Text>
  {/* For organization role, remove the + Post from Home as requested */}
  <View style={{ width: 86 }} />
      </View>

  {/* Participant search + chips */}
  <View style={[styles.toolsWrap, CARD_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CARD_MAX_WIDTH } : null]}>
        <View style={styles.searchRow}>
          <Search size={20}/>
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="#98A9D7"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.circleBtn} activeOpacity={0.8}>
            {/* reserved for future quick action */}
          </TouchableOpacity>
        </View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 0 }}>
      {(['all','hackathon','tech event','workshop','projects','tech meetup'] as const).map((c) => (
            <TouchableOpacity key={c} onPress={() => setCat(c)} style={[styles.chip, cat === c && styles.chipActive]} activeOpacity={0.9}>
              <Text style={[styles.chipText, cat === c && styles.chipTextActive]}>
        {c === 'tech event' ? 'Tech event' : c === 'tech meetup' ? 'Tech meetup' : c.charAt(0).toUpperCase() + c.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

  {/* Unified feed (live + static) */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
        renderItem={({ item }) => (
          <View style={[styles.card, CARD_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CARD_MAX_WIDTH } : null]}>
            <View style={styles.headerRow}>
              {item.kind === 'live' ? (
                item.org_avatar_url ? (
                  <Image source={{ uri: item.org_avatar_url }} style={styles.avatar as any} contentFit="cover" />
                ) : (
                  <View style={styles.avatar} />
                )
              ) : (
                <View style={styles.avatar} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.org}>{item.kind === 'live' ? (item.org_name || 'Organization') : item.org}</Text>
                <Text style={styles.meta}>posted an event</Text>
              </View>
              <Text style={styles.more}>•••</Text>
            </View>
            {item.kind === 'live' ? (
              <TouchableOpacity onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.id } } as any)} activeOpacity={0.85}>
                <Text style={styles.title}>{item.title}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.title}>{item.title}</Text>
            )}
            <View style={styles.pillRow}>
              <Text style={styles.pill}>{item.kind === 'live' ? new Date(item.starts_at).toLocaleString() : item.date}</Text>
              <Text style={styles.pill}>
                {item.kind === 'live' ? (item.is_online ? 'Online' : (item.location || 'In-person')) : item.location}
              </Text>
              {!!(item.kind === 'live' ? item.category : item.category) && (
                <Text style={[styles.pill, styles.tagGreen]}>
                  {(() => {
                    const c = item.kind === 'live' ? String(item.category) : String(item.category);
                    return c === 'tech event' ? 'Tech event' : c === 'tech meetup' ? 'Tech meetup' : c.charAt(0).toUpperCase() + c.slice(1);
                  })()}
                </Text>
              )}
            </View>
            {item.kind === 'live' ? (
        item.banner_url ? (
                <TouchableOpacity onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.id } } as any)} activeOpacity={0.9}>
          <Image source={{ uri: item.banner_url }} style={styles.banner} contentFit="cover" transition={100} />
                </TouchableOpacity>
              ) : <View style={styles.banner} />
            ) : (
        item.banner ? <Image source={item.banner as any} style={styles.banner} contentFit="cover" transition={100} /> : <View style={styles.banner} />
            )}
            <View style={styles.footerRow}>
              {item.kind === 'live' ? (
                <TouchableOpacity
                  disabled={!user?.id || role !== 'participant'}
                  onPress={async () => {
                    if (!user?.id) return;
                    const wasInterested = interestedIds.has(item.id);
                    const prevCount = interestedCounts[item.id] ?? 0;
                    // optimistic toggle
                    setInterestedIds((prev) => {
                      const next = new Set(prev);
                      if (wasInterested) next.delete(item.id); else next.add(item.id);
                      return next;
                    });
                    setInterestedCounts((prev) => ({ ...prev, [item.id]: Math.max(0, prevCount + (wasInterested ? -1 : 1)) }));
                    try {
                      const res = await toggleInterested(item.id, user.id, !wasInterested);
                      // After server ack, optionally resync exact count to avoid drift
                      try {
                        const c = await countInterested(item.id);
                        setInterestedCounts((prev) => ({ ...prev, [item.id]: c }));
                      } catch {}
                    } catch (e) {
                      // revert on error
                      setInterestedIds((prev) => {
                        const next = new Set(prev);
                        if (wasInterested) next.add(item.id); else next.delete(item.id);
                        return next;
                      });
                      setInterestedCounts((prev) => ({ ...prev, [item.id]: prevCount }));
                    }
                  }}
                  activeOpacity={0.8}
                  style={[styles.interestBtn, interestedIds.has(item.id) && styles.interestBtnActive]}
                >
                  <HeartIcon
                    size={16}
                    color={interestedIds.has(item.id) ? '#ef4444' : Theme.colors.muted}
                    weight={interestedIds.has(item.id) ? 'fill' : 'regular'}
                  />
                  <Text style={styles.footerText}>{interestedCounts[item.id] ?? 0} Interested</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.footerText}>{item.likes} likes</Text>
              )}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {item.kind === 'live' && role === 'participant' ? (
                  joinedIds.has(item.id) ? (
                    <View style={[styles.actionBtn, { backgroundColor: '#EAF7EF', borderColor: '#7DD58C' }]}>
                      <Text style={[styles.actionBtnText, { color: '#146C43' }]}>Already joined</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setConfirm({ visible: true, eventId: item.id })}
                      style={[styles.actionBtn, styles.joinBtn]}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.actionBtnText, styles.joinBtnText]}>Join</Text>
                    </TouchableOpacity>
                  )
                ) : null}
                <TouchableOpacity onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.id } } as any)} style={[styles.actionBtn]} activeOpacity={0.9}>
                  <Text style={styles.actionBtnText}>Read more</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={loadingLive ? null : ( <Text style={[styles.footerText, { textAlign: 'center', marginTop: 10 }]}>No events.</Text>)}
      />
      {/* Join confirmation modal */}
      <Modal visible={!!confirm?.visible} transparent animationType="fade" onRequestClose={() => { setConfirm(null); setAck(false); }}>
        <Pressable style={stylesC.backdrop} onPress={() => { setConfirm(null); setAck(false); }}>
          <Pressable style={stylesC.card} onPress={() => { /* swallow */ }}>
            <Text style={stylesC.title}>Join this event?</Text>
            <Text style={stylesC.body}>By joining, you agree to receive updates from the organizer and abide by the event guidelines.</Text>
            <TouchableOpacity onPress={() => setAck((v) => !v)} style={stylesC.checkRow} activeOpacity={0.8}>
              <View style={[stylesC.checkbox, ack && stylesC.checkboxChecked]} />
              <Text style={stylesC.checkText}>I read and accept the info</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity onPress={() => { setConfirm(null); setAck(false); }} style={[styles.actionBtn]}>
        <Text style={styles.actionBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!ack}
                onPress={async () => {
                  if (!user?.id || !confirm?.eventId) return;
                  try {
                    await joinEvent(confirm.eventId, user.id);
                    setJoinedIds((prev) => new Set([...prev, confirm.eventId!]));
          emitAppEvent({ type: 'event:joined', eventId: confirm.eventId });
                  } catch {}
                  setConfirm(null);
                  setAck(false);
                }}
                style={[styles.actionBtn, styles.joinBtn, !ack && { opacity: 0.5 }]}
                activeOpacity={ack ? 0.9 : 1}
              >
                <Text style={[styles.actionBtnText, styles.joinBtnText]}>Join</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
  </SafeAreaView>
  );
}

const BLUE_BG = Theme.colors.bg;
const BLUE_CARD = Theme.colors.card;
const BLUE_BORDER = Theme.colors.border;
const BLUE_PRIMARY = Theme.colors.primary;
const BLUE_TEXT_DARK = Theme.colors.text;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BLUE_BG },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Theme.colors.card,
    borderBottomColor: BLUE_BORDER,
    borderBottomWidth: 1,
  },
  brand: { color: BLUE_TEXT_DARK, fontSize: 22, fontWeight: '800', letterSpacing: 0.2, fontFamily: 'Urbanist_800ExtraBold' },
  primaryCta: { backgroundColor: BLUE_PRIMARY, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  primaryCtaText: { color: '#FFFFFF', fontWeight: '800', fontFamily: 'Urbanist_800ExtraBold' },
  toolsWrap: { paddingVertical: 10, paddingHorizontal: 12, gap: 10 },
  searchRow: {
    marginHorizontal: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchIcon: { fontSize: 16, color: Theme.colors.subtle },
  searchInput: { flex: 1, color: BLUE_TEXT_DARK, paddingVertical: 2 },
  circleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnText: { fontSize: 14 },
  chip: {
    marginRight: 8,
    backgroundColor: '#F0F4FF',
    borderColor: BLUE_BORDER,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: BLUE_PRIMARY, borderColor: BLUE_PRIMARY },
  chipText: { color: BLUE_TEXT_DARK, fontWeight: '700', fontFamily: 'Urbanist_600SemiBold' },
  chipTextActive: { color: '#FFFFFF' },

  card: {
    marginHorizontal: 12,
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
  },
  tagGreen: { backgroundColor: '#E8F9EF', borderColor: '#7DD58C', color: '#146C43' },
  // On larger screens, width is controlled by card; make banner scale responsively
  banner: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: '#E6EDFF',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BLUE_BORDER,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { color: Theme.colors.muted, fontSize: 12, fontFamily: 'Urbanist_400Regular' },
  actionBtn: { backgroundColor: '#F0F4FF', borderColor: BLUE_BORDER, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  actionBtnText: { color: Theme.colors.text, fontFamily: 'Urbanist_700Bold', fontSize: 12 },
  joinBtn: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  joinBtnText: { color: '#fff' },
  interestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FDF2F2',
    borderColor: '#FEE2E2',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  interestBtnActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#fecaca',
  },
});

const stylesC = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderColor: BLUE_BORDER,
    borderWidth: 1,
    padding: 16,
  },
  title: { color: BLUE_TEXT_DARK, fontSize: 18, fontWeight: '800', fontFamily: 'Urbanist_700Bold' },
  body: { color: Theme.colors.muted, marginTop: 8, lineHeight: 20, fontFamily: 'Urbanist_400Regular' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderColor: BLUE_BORDER, borderWidth: 1, backgroundColor: '#fff' },
  checkboxChecked: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  checkText: { color: BLUE_TEXT_DARK, fontFamily: 'Urbanist_600SemiBold' },
});
