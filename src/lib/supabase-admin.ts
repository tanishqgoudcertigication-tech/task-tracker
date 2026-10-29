import { createClient, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Returns a Supabase client with admin privileges (Service Role Key).
 * MUST ONLY be called on the server.
 */
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('Server configuration error: NEXT_PUBLIC_SUPABASE_URL is missing');
    throw new Error('Server is missing configuration');
  }

  if (!serviceRoleKey || serviceRoleKey === 'your-supabase-service-role-key-here') {
    console.error('Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing');
    throw new Error('Server is missing configuration');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Verifies that the incoming request has a valid Supabase bearer token
 * belonging to a user with profile role 'admin'.
 */
export async function verifyAdminUser(
  request: Request
): Promise<{ user: User | null; errorResponse: NextResponse | null }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 1. Verify environment configuration
  if (!supabaseUrl || !anonKey || !serviceRoleKey || serviceRoleKey === 'your-supabase-service-role-key-here') {
    if (!supabaseUrl) {
      console.error('Server configuration error: NEXT_PUBLIC_SUPABASE_URL is missing');
    }
    if (!anonKey) {
      console.error('Server configuration error: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
    }
    if (!serviceRoleKey || serviceRoleKey === 'your-supabase-service-role-key-here') {
      console.error('Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing');
    }

    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Server is missing configuration' },
        { status: 500 }
      ),
    };
  }

  // 2. Read token from Authorization header
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Authorization check failed: Missing or malformed Authorization header');
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Missing authorization token.' },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    console.error('Authorization check failed: Empty bearer token');
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Missing authorization token.' },
        { status: 401 }
      ),
    };
  }

  try {
    // 3. Verify the token with a server client created from NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Token verification failed:', userError?.message || 'No user returned for token');
      return {
        user: null,
        errorResponse: NextResponse.json(
          { error: 'Invalid or expired session token.' },
          { status: 401 }
        ),
      };
    }

    // 4. Use service role client to read profiles.role for that user id
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Failed to read profile role for user:', profileError.message);
      return {
        user: null,
        errorResponse: NextResponse.json(
          { error: 'Admins only' },
          { status: 403 }
        ),
      };
    }

    if (profile?.role !== 'admin') {
      console.error(`Forbidden: User ${user.id} has role "${profile?.role}", required: "admin"`);
      return {
        user: null,
        errorResponse: NextResponse.json(
          { error: 'Admins only' },
          { status: 403 }
        ),
      };
    }

    return { user, errorResponse: null };
  } catch (err: unknown) {
    console.error('Unexpected error in verifyAdminUser:', err);
    const msg = err instanceof Error ? err.message : 'Authentication verification failed.';
    return {
      user: null,
      errorResponse: NextResponse.json({ error: msg }, { status: 500 }),
    };
  }
}
