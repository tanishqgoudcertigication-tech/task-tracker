import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, verifyAdminUser } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  // 1. Verify caller has admin role
  const { user: adminUser, errorResponse } = await verifyAdminUser(request);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Target userId is required.' }, { status: 400 });
    }

    // Prevent admin from accidentally deleting themselves
    if (adminUser?.id === userId) {
      return NextResponse.json(
        { error: 'You cannot remove your own admin account.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 2. Safely reassign tasks assigned to this user to unassigned (everyone)
    await supabaseAdmin
      .from('tasks')
      .update({ assigned_to: null })
      .eq('assigned_to', userId);

    // 3. Remove submissions belonging to this user
    await supabaseAdmin
      .from('submissions')
      .delete()
      .eq('user_id', userId);

    // 4. Ensure profile row is removed if DB foreign key does not cascade
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    // 5. Delete user from auth via auth.admin.deleteUser
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      return NextResponse.json({ error: deleteAuthError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, userId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
