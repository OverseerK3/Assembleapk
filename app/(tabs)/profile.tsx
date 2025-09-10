import { useAuth } from '@/app/_layout';
import { Theme } from '@/constants/Theme';
import { listEventsFor } from '@/lib/events';
import { getSupabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Calendar, Globe, Link as LinkIcon, MapPin, Settings, Share2 } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const { user, role } = useAuth();
  const router = useRouter();

  const md: any = user?.user_metadata ?? {};
  const isOrg = role === 'organization';
  const displayName = (md.full_name || md.org_name || 'User') as string;
  const headline = isOrg ? (md.org_location || md.website || '') : (md.bio || md.interests || '');

  const [tab, setTab] = useState<'Posts' | 'About' | 'Events'>(isOrg ? 'Posts' : 'Posts');
  const tabs = isOrg ? (['Posts', 'About', 'Events'] as const) : (['Posts', 'About'] as const);

  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [stats, setStats] = useState<{ joined: number; created: number; followers: number; following: number }>({ joined: 0, created: 0, followers: 0, following: 0 });

  // Icon casts to satisfy lucide types in RN
  const IconSettings = Settings as any;
  const IconShare = Share2 as any;
  const IconGlobe = Globe as any;
  const IconMapPin = MapPin as any;
  const IconLink = LinkIcon as any;
  const IconCalendar = Calendar as any;

  useEffect(() => {
    if (tab === 'Events' && isOrg && user?.id) {
      setLoadingEvents(true);
      listEventsFor('organization', user.id)
        .then((d) => setEvents(d))
        .finally(() => setLoadingEvents(false));
    }
  }, [tab, isOrg, user?.id]);

  // Load stats for profile
  useEffect(() => {
    async function loadStats() {
      if (!user?.id) return;
      const supabase = getSupabase();
      try {
        // followers and following
        const [{ count: followers }, { count: following }] = await Promise.all([
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', user.id),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
        ]);
        if (isOrg) {
          const { count: created } = await supabase.from('events').select('*', { count: 'exact', head: true }).eq('organization_id', user.id);
          setStats((s) => ({ ...s, created: created ?? 0, followers: followers ?? 0, following: following ?? 0 }));
        } else {
          const { count: joined } = await supabase.from('event_participants').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
          setStats((s) => ({ ...s, joined: joined ?? 0, followers: followers ?? 0, following: following ?? 0 }));
        }
      } catch (e) {
        // ignore stats errors to avoid blocking profile
      }
    }
    loadStats();
  }, [user?.id, isOrg]);

  function openURLSafe(url?: string) {
    if (!url) return;
    const u = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(u).catch(() => {});
  }

  const initials = useMemo(() => getInitials(displayName), [displayName]);

  const CONTENT_MAX_WIDTH = width >= 768 ? 720 : width >= 600 ? 560 : undefined;
  const SAFE_TOP_PAD = Platform.select({ ios: 8, android: (StatusBar.currentHeight || 0) + 8, default: 8 });
  const gridItemWidth = width >= 1024 ? '24%' : width >= 768 ? '32%' : width >= 480 ? '48%' : '100%';

  return (
    <SafeAreaView style={styles.container}>
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      {/* Top actions */}
  <View style={[styles.headerRow, CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null, { paddingTop: SAFE_TOP_PAD }]}>
  <Text style={styles.title}>Profile</Text>
  <View style={{ flexDirection: 'row', gap: 10 }}>
          <IconButton onPress={() => router.push('/settings' as any)}>
            <IconSettings size={18} color={Theme.colors.text} />
          </IconButton>
          <IconButton onPress={() => { /* share placeholder */ }}>
            <IconShare size={18} color={Theme.colors.text} />
          </IconButton>
        </View>
      </View>

      {/* Cover + Avatar */}
      <View style={styles.cover}>
        <View style={styles.coverAccent} />
      </View>
  <View style={[styles.headerCard, CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null]}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            {md?.avatar_url ? (
              <Image source={{ uri: md.avatar_url }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
        </View>
        <View style={styles.headerContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.roleBadge}>{role.toUpperCase()}</Text>
          </View>
          {!!headline && <Text style={styles.headline} numberOfLines={1}>{headline}</Text>}
          <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>

          {/* Quick actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={() => router.push('/settings' as any)} style={[styles.btn, styles.btnPrimary]}> 
              <Text style={[styles.btnText, { color: '#fff' }]}>Edit Profile</Text>
            </TouchableOpacity>
            {isOrg && !!md.website && (
              <TouchableOpacity onPress={() => openURLSafe(md.website)} style={[styles.btn, styles.btnGhost]}> 
                <Text style={[styles.btnText, { color: Theme.colors.text }]}>Visit Website</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {isOrg ? (
              <>
                <StatPill num={stats.created} label="Events created" />
                <StatPill num={stats.followers} label="Followers" />
                <StatPill num={stats.following} label="Following" />
              </>
            ) : (
              <>
                <StatPill num={stats.joined} label="Events joined" />
                <StatPill num={stats.followers} label="Followers" />
                <StatPill num={stats.following} label="Following" />
              </>
            )}
          </View>
        </View>
      </View>

      {/* Tabs */}
  <View style={[styles.tabsBar, CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null]}>
        {tabs.map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t as any)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'Posts' && (
  <View style={[styles.grid, CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null]}>
          {Array.from({ length: 9 }).map((_, i) => (
            <View key={i} style={[styles.gridItem, { width: gridItemWidth }]} />
          ))}
        </View>
      )}

      {tab === 'About' && (
  <View style={[styles.card, CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null]}>
          {!!md.bio && (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.paragraph}>{md.bio}</Text>
            </View>
          )}
          {isOrg ? (
            <View style={{ gap: 10 }}>
              {!!md.website && (
                <Row>
                  <IconGlobe size={16} color={Theme.colors.muted} />
                  <Text onPress={() => openURLSafe(md.website)} style={styles.link}>{md.website}</Text>
                </Row>
              )}
              {!!md.org_location && (
                <Row>
                  <IconMapPin size={16} color={Theme.colors.muted} />
                  <Text style={styles.paragraph}>{md.org_location}</Text>
                </Row>
              )}
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {!!md.username && (
                <Row>
                  <IconLink size={16} color={Theme.colors.muted} />
                  <Text style={styles.paragraph}>@{md.username}</Text>
                </Row>
              )}
              {!!md.interests && (
                <View>
                  <Text style={styles.sectionTitle}>Interests</Text>
                  <View style={styles.chipsRow}>
                    {md.interests.split(',').map((raw: string, idx: number) => {
                      const v = raw.trim();
                      if (!v) return null;
                      return (
                        <View key={idx} style={styles.chip}><Text style={styles.chipText}>{v}</Text></View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {tab === 'Events' && isOrg && (
  <View style={[{ gap: 10 }, CONTENT_MAX_WIDTH ? { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH } : null]}>
          {loadingEvents ? (
            <Text style={styles.muted}>Loading events…</Text>
          ) : events.length === 0 ? (
            <View style={styles.card}><Text style={styles.muted}>No events yet.</Text></View>
          ) : (
            events.map((ev) => (
              <View key={ev.id} style={styles.eventCard}>
                {ev.banner_url ? (
                  <Image source={{ uri: ev.banner_url }} style={styles.eventBanner} contentFit="cover" />
                ) : (
                  <View style={[styles.eventBanner, { backgroundColor: '#E8EFFF', borderColor: Theme.colors.border, borderWidth: 1 }]} />
                )}
                <View style={{ padding: 12 }}>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  <Row style={{ marginTop: 6 }}>
                    <IconCalendar size={14} color={Theme.colors.muted} />
                    <Text style={styles.paragraph}>{formatDateRange(ev.starts_at, ev.ends_at)}</Text>
                  </Row>
                </View>
              </View>
            ))
          )}
        </View>
      )}
  </ScrollView>
  </SafeAreaView>
  );
}

function IconButton({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.iconBtn}>
      {children}
    </TouchableOpacity>
  );
}

function StatPill({ num, label }: { num: number; label: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, style]}>{children}</View>;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'U';
  const a = parts[0]?.[0] ?? '';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase() || 'U';
}

function formatDateRange(startISO?: string, endISO?: string) {
  if (!startISO) return '';
  try {
    const s = new Date(startISO);
    const e = endISO ? new Date(endISO) : undefined;
    const sameDay = e && s.toDateString() === e.toDateString();
    const sStr = s.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    const eStr = e ? (sameDay ? e.toLocaleTimeString([], { timeStyle: 'short' }) : e.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })) : '';
    return e ? `${sStr} – ${eStr}` : sStr;
  } catch {
    return startISO;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.bg, padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: Theme.colors.text, fontSize: 24, fontFamily: 'Urbanist_800ExtraBold', letterSpacing: 0.2 },

  cover: { height: 120, backgroundColor: '#E8EFFF', borderRadius: 16, borderWidth: 1, borderColor: Theme.colors.border, marginBottom: -44 },
  coverAccent: { flex: 1, borderRadius: 16, borderColor: '#D9E4FF', borderWidth: 1, opacity: 0.6 },

  headerCard: {
    backgroundColor: Theme.colors.card,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  headerContent: { paddingTop: 8, paddingLeft: 100, paddingRight: 8, minHeight: 84 },
  avatarWrap: { position: 'absolute', top: -44, left: 16, borderRadius: 48, padding: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: Theme.colors.border, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  avatar: { width: 84, height: 84, borderRadius: 44, backgroundColor: '#EFF4FF', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%', borderRadius: 44 },
  avatarText: { color: Theme.colors.text, fontFamily: 'Urbanist_800ExtraBold', fontSize: 24 },

  name: { color: Theme.colors.text, fontSize: 22, fontFamily: 'Urbanist_800ExtraBold', maxWidth: '60%' },
  roleBadge: { backgroundColor: '#E8F0FF', color: Theme.colors.text, borderColor: '#D4E3FF', borderWidth: 1, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden', fontFamily: 'Urbanist_700Bold', fontSize: 11, letterSpacing: 0.3 },
  headline: { color: Theme.colors.muted, marginTop: 6 },
  email: { color: Theme.colors.subtle, marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Theme.colors.border, backgroundColor: Theme.colors.card },
  btnPrimary: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  btnGhost: { backgroundColor: '#F0F4FF' },
  btnText: { fontFamily: 'Urbanist_700Bold' },
  iconBtn: { padding: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Theme.colors.border, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  statPill: { flex: 1, marginHorizontal: 4, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: Theme.colors.border },
  statNum: { color: Theme.colors.text, fontSize: 20, fontFamily: 'Urbanist_800ExtraBold' },
  statLabel: { color: Theme.colors.muted, fontFamily: 'Urbanist_600SemiBold', marginTop: 2 },

  tabsBar: { flexDirection: 'row', backgroundColor: Theme.colors.card, borderWidth: 1, borderColor: Theme.colors.border, borderRadius: 12, padding: 4, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#E8F0FF' },
  tabText: { color: Theme.colors.muted, fontFamily: 'Urbanist_700Bold' },
  tabTextActive: { color: Theme.colors.text },

  card: { backgroundColor: Theme.colors.card, borderColor: Theme.colors.border, borderWidth: 1, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  sectionTitle: { color: Theme.colors.text, fontFamily: 'Urbanist_700Bold', marginBottom: 6 },
  paragraph: { color: Theme.colors.text },
  muted: { color: Theme.colors.muted },
  link: { color: Theme.colors.primary, textDecorationLine: 'underline' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#F0F4FF', borderColor: Theme.colors.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  chipText: { color: Theme.colors.text, fontFamily: 'Urbanist_600SemiBold' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  gridItem: { width: '32%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#F7FAFF', borderColor: Theme.colors.border, borderWidth: 1 },

  eventCard: { backgroundColor: Theme.colors.card, borderColor: Theme.colors.border, borderWidth: 1, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  eventBanner: { width: '100%', height: 120 },
  eventTitle: { color: Theme.colors.text, fontFamily: 'Urbanist_700Bold', fontSize: 16 },
});
