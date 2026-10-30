import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, verifyAdminUser } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  // 1. Verify caller has admin role
  const { errorResponse } = await verifyAdminUser(request);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password is required and must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = email.trim().toLowerCase();

    // 2. Create user with service role key
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: trimmedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        name: trimmedName || trimmedEmail,
        role: 'teammate',
        initial_password: password,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Return created user
    return NextResponse.json(
      {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: trimmedName,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
