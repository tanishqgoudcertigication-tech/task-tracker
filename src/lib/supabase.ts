import { createClient, User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Role = 'admin' | 'teammate';

export interface Profile {
  id: string;
  name: string | null;
  role: Role;
  email?: string | null;
}

export interface Task {
  id: string;
  date: string;
  title: string;
  assigned_to: string | null;
}

export interface TaskStatusItem {
  task_id: string;
  title: string;
  done: boolean;
  reason?: string;
}

export interface Submission {
  id: string;
  user_id: string;
  date: string;
  photo_path?: string | null;
  status: 'pending' | 'approved' | 'rejected' | string;
  task_status?: TaskStatusItem[] | null;
}

/**
 * Helper to get the authenticated user and their corresponding profile record.
 */
export async function getCurrentProfile(): Promise<{
  user: User | null;
  profile: Profile | null;
  error: Error | null;
}> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { user: null, profile: null, error: userError || null };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, role, email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return { user, profile: null, error: new Error(profileError.message) };
    }

    return { user, profile: profile as Profile, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { user: null, profile: null, error };
  }
}
