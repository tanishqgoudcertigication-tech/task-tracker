import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, verifyAdminUser } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  // 1. Verify caller has admin role
  const { errorResponse } = await verifyAdminUser(request);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 2. Fetch profiles and auth users in parallel
    const [profilesRes, usersRes] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, name, email, role')
        .eq('role', 'teammate')
        .order('name', { ascending: true }),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    if (profilesRes.error) {
      return NextResponse.json({ error: profilesRes.error.message }, { status: 400 });
    }

    if (usersRes.error) {
      return NextResponse.json({ error: usersRes.error.message }, { status: 400 });
    }

    const authUsers = usersRes.data.users || [];
    const profiles = profilesRes.data || [];

    // Map each profile to its auth user metadata for password
    const teammates = profiles.map((p) => {
      const authUser = authUsers.find((u) => u.id === p.id);
      const meta = authUser?.user_metadata || {};
      const password = (meta.initial_password as string) || null;

      return {
        id: p.id,
        name: p.name || meta.name || p.email,
        email: p.email || authUser?.email || '',
        role: p.role,
        password,
      };
    });

    return NextResponse.json({ teammates });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  // 1. Verify caller has admin role
  const { errorResponse } = await verifyAdminUser(request);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const body = await request.json();
    const { userId, password } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Valid userId is required.' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password is required and must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch existing user to preserve other metadata
    const { data: userRes, error: fetchErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (fetchErr || !userRes?.user) {
      return NextResponse.json(
        { error: fetchErr?.message || 'User not found.' },
        { status: 404 }
      );
    }

    const existingMeta = userRes.user.user_metadata || {};

    // Update password and store in user_metadata
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
      user_metadata: {
        ...existingMeta,
        initial_password: password,
      },
    });

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, userId, password });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
