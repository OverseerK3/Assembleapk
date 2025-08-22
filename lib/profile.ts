import { getSupabase } from './supabase';

// Upsert minimal profile fields we have in the table schema
export async function upsertProfileFromMetadata(user: { id: string; user_metadata?: any }) {
  if (!user?.id) return;
  const md = (user.user_metadata ?? {}) as any;
  const row = {
    id: user.id,
    username: (md.username ?? null) as string | null,
    full_name: (md.full_name ?? md.org_name ?? null) as string | null,
    role: (md.role ?? null) as string | null,
    bio: (md.bio ?? null) as string | null,
    website: (md.website ?? null) as string | null,
    avatar_url: (md.avatar_url ?? null) as string | null,
  };
  const { error } = await getSupabase().from('profiles').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

// Normalize a username: lowercase, keep letters, numbers, underscore, dot, and dash
export function sanitizeUsername(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^\.+|\.+$/g, '') // trim leading/trailing dots
    .slice(0, 30); // reasonable max length
}

// Check if a username is available (not used by another profile)
export async function isUsernameAvailable(username: string, currentUserId: string): Promise<boolean> {
  const supabase = getSupabase();
  const uname = sanitizeUsername(username);
  if (!uname) return true; // treat empty as available
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('username', uname)
    .neq('id', currentUserId);
  if (error) throw error;
  return (count ?? 0) === 0;
}
