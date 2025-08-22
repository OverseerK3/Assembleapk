import { getSupabase } from './supabase';
import { uploadToBucketSimple } from './upload-simple';

export type EventInsert = {
  organization_id: string;
  title: string;
  description: string;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  is_online: boolean;
  category?: EventCategory | null;
  location?: string | null;
  website?: string | null;
  banner_url?: string | null;
  min_team_size?: number | null;
  max_team_size?: number | null;
};

export type EventCategory = 'hackathon' | 'tech event' | 'workshop' | 'projects' | 'tech meetup';

export async function createEvent(payload: EventInsert) {
  const supabase = getSupabase();
  const { error, data } = await supabase.from('events').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function getEventById(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getEventWithOrgById(id: string): Promise<EventWithOrg> {
  const supabase = getSupabase();
  // First try: joined select (fast path)
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        id,
        organization_id,
        title,
        description,
        starts_at,
        ends_at,
        is_online,
        category,
        location,
        website,
        banner_url,
        min_team_size,
        max_team_size,
        profiles:organization_id(full_name, avatar_url)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    const row: any = data;
    return {
      id: row.id,
      organization_id: row.organization_id,
      title: row.title,
      description: row.description,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      is_online: row.is_online,
      category: row.category ?? null,
      location: row.location ?? null,
      website: row.website ?? null,
      banner_url: row.banner_url ?? null,
      min_team_size: row.min_team_size ?? null,
      max_team_size: row.max_team_size ?? null,
      org_name: row.profiles?.full_name ?? null,
      org_avatar_url: row.profiles?.avatar_url ?? null,
    } as EventWithOrg;
  } catch (_e) {
    // Fallback: get event then organizer profile
    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
    if (evErr) throw evErr;
    let org_name: string | null = null;
    let org_avatar_url: string | null = null;
    if (ev?.organization_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', ev.organization_id)
        .single();
      org_name = (prof as any)?.full_name ?? null;
      org_avatar_url = (prof as any)?.avatar_url ?? null;
    }
    return {
      id: ev.id,
      organization_id: ev.organization_id,
      title: ev.title,
      description: ev.description,
      starts_at: ev.starts_at,
      ends_at: ev.ends_at,
      is_online: ev.is_online,
      category: ev.category ?? null,
      location: ev.location ?? null,
      website: ev.website ?? null,
      banner_url: ev.banner_url ?? null,
      min_team_size: ev.min_team_size ?? null,
      max_team_size: ev.max_team_size ?? null,
      org_name,
      org_avatar_url,
    } as EventWithOrg;
  }
}

export type EventUpdate = Partial<Omit<EventInsert, 'organization_id'>>;

export async function updateEvent(id: string, changes: EventUpdate) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('events')
    .update(changes)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

// Participants API
export async function joinEvent(eventId: string, userId: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from('event_participants').insert({ event_id: eventId, user_id: userId });
  if (error && !/duplicate key/i.test(error.message)) throw error; // ignore duplicate joins
}

export async function unjoinEvent(eventId: string, userId: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from('event_participants').delete().eq('event_id', eventId).eq('user_id', userId);
  if (error) throw error;
}

export async function isUserJoined(eventId: string, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('event_participants')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function countParticipants(eventId: string): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('event_participants')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (error) throw error;
  return count ?? 0;
}

// Interested (likes)
export async function toggleInterested(eventId: string, userId: string, setTo?: boolean): Promise<'added' | 'removed' | 'noop'> {
  const supabase = getSupabase();
  // Determine current
  const { count } = await supabase
    .from('event_interests')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('user_id', userId);
  const has = (count ?? 0) > 0;
  const desired = typeof setTo === 'boolean' ? setTo : !has;
  if (desired === has) return 'noop';
  if (desired) {
    const { error } = await supabase.from('event_interests').insert({ event_id: eventId, user_id: userId });
    if (error && !/duplicate key/i.test(error.message)) throw error;
    return 'added';
  } else {
    const { error } = await supabase.from('event_interests').delete().eq('event_id', eventId).eq('user_id', userId);
    if (error) throw error;
    return 'removed';
  }
}

export async function countInterested(eventId: string): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('event_interests')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (error) throw error;
  return count ?? 0;
}

export async function isInterested(eventId: string, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('event_interests')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function listInterestedEventIds(userId: string): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('event_interests')
    .select('event_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.event_id as string);
}

export async function listJoinedEventIds(userId: string): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('event_participants')
    .select('event_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.event_id as string);
}

export async function listEventsFor(role: 'organization' | 'participant', orgId?: string) {
  const supabase = getSupabase();
  if (role === 'organization' && orgId) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('organization_id', orgId)
      .order('starts_at', { ascending: true });
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function uploadBannerAsync(uri: string, userId: string) {
  const fileExt = uri.split('.').pop() || 'jpg';
  // Store under events/{userId}/... to match storage RLS policies
  const path = `events/${userId}/${Date.now()}.${fileExt}`;
  const publicUrl = await uploadToBucketSimple({ bucket: 'event-banners', path, uri, contentType: 'image/jpeg' });
  return publicUrl;
}

export type EventWithOrg = {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  is_online: boolean;
  category: EventCategory | null;
  location: string | null;
  website: string | null;
  banner_url: string | null;
  min_team_size: number | null;
  max_team_size: number | null;
  org_name: string | null;
  org_avatar_url: string | null;
};

export type FeedFilters = {
  search?: string;
  category?: EventCategory | null;
  after?: string | Date | null;
  limit?: number;
};

export type JoinedStatus = 'upcoming' | 'completed' | null;

// Fetch upcoming events for the public feed, joined with organizer profile
export async function listUpcomingEventsWithOrg(): Promise<EventWithOrg[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('events')
    .select(`
      id,
      organization_id,
      title,
      description,
      starts_at,
      ends_at,
      is_online,
  category,
      location,
      website,
      banner_url,
      min_team_size,
      max_team_size,
      profiles:organization_id(full_name, avatar_url)
    `)
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data as any[]).map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    title: row.title,
    description: row.description,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    is_online: row.is_online,
  category: row.category ?? null,
    location: row.location,
    website: row.website,
    banner_url: row.banner_url,
    min_team_size: row.min_team_size,
    max_team_size: row.max_team_size,
    org_name: row.profiles?.full_name ?? null,
    org_avatar_url: row.profiles?.avatar_url ?? null,
  })) as EventWithOrg[];
}

// Scalable feed powered by RPC with filters and keyset pagination
export async function fetchEventsFeed(filters: FeedFilters = {}): Promise<EventWithOrg[]> {
  const supabase = getSupabase();
  const payload: Record<string, any> = {
    search: filters.search ?? null,
    in_category: filters.category ?? null,
    after: filters.after ? new Date(filters.after).toISOString() : null,
    in_limit: Math.min(Math.max(filters.limit ?? 20, 1), 100),
  };
  const { data, error } = await supabase.rpc('events_feed', payload);
  if (error) throw error;
  return (data as any[] | null)?.map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    title: row.title,
    description: row.description,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    is_online: row.is_online,
    category: row.category ?? null,
    location: row.location ?? null,
    website: row.website ?? null,
    banner_url: row.banner_url ?? null,
    min_team_size: row.min_team_size ?? null,
    max_team_size: row.max_team_size ?? null,
    org_name: row.org_name ?? null,
    org_avatar_url: row.org_avatar_url ?? null,
  })) ?? [];
}

export async function listJoinedEvents(status: JoinedStatus = null, userId?: string, after?: string | Date | null, limit = 50): Promise<EventWithOrg[]> {
  const supabase = getSupabase();
  const payload: Record<string, any> = {
    in_status: status,
    after: after ? new Date(after).toISOString() : null,
    in_limit: Math.min(Math.max(limit, 1), 100),
  };
  const { data, error } = await supabase.rpc('joined_events_feed', payload);
  if (!error && data) {
    return (data as any[] | null)?.map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      title: row.title,
      description: row.description,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      is_online: row.is_online,
      category: row.category ?? null,
      location: row.location ?? null,
      website: row.website ?? null,
      banner_url: row.banner_url ?? null,
      min_team_size: row.min_team_size ?? null,
      max_team_size: row.max_team_size ?? null,
      org_name: row.org_name ?? null,
      org_avatar_url: row.org_avatar_url ?? null,
    })) ?? [];
  }
  // Fallback if RPC not available: fetch joined events and filter on client
  if (!userId) return [];
  const { data: epRows, error: epErr } = await supabase
    .from('event_participants')
    .select(`
      event_id,
      events:events (
        id, organization_id, title, description, starts_at, ends_at, is_online, category, location, website, banner_url, min_team_size, max_team_size
      )
    `)
    .eq('user_id', userId);
  if (epErr) throw epErr;
  const nowIso = new Date().toISOString();
  const filtered = (epRows as any[]).map(r => r.events).filter((e) => {
    if (!status) return true;
    return status === 'upcoming' ? e.ends_at >= nowIso : e.ends_at < nowIso;
  });
  // Sort ascending by starts_at for consistency
  filtered.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return filtered.map((row: any) => ({
    id: row.id,
    organization_id: row.organization_id,
    title: row.title,
    description: row.description,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    is_online: row.is_online,
    category: row.category ?? null,
    location: row.location ?? null,
    website: row.website ?? null,
    banner_url: row.banner_url ?? null,
    min_team_size: row.min_team_size ?? null,
    max_team_size: row.max_team_size ?? null,
    org_name: null,
    org_avatar_url: null,
  }));
}
