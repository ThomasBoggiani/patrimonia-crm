import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { email, prenom, nom, role, fonction } = await request.json();

    if (!email || !prenom || !nom) {
      return NextResponse.json({ error: 'Email, prénom et nom requis' }, { status: 400 });
    }

    // Vérifier que l'utilisateur appelant est Admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    
    const accessToken = authHeader.replace('Bearer ', '');
    const publicSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
    
    const { data: { user } } = await publicSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Session invalide' }, { status: 401 });
    
    const { data: callerProfile } = await publicSupabase.from('profiles').select('role').eq('id', user.id).single();
    if (callerProfile?.role !== 'Admin') {
      return NextResponse.json({ error: 'Seuls les admins peuvent inviter' }, { status: 403 });
    }

    // Création via service role
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      data: { prenom, nom, role: role || 'Commercial', fonction: fonction || null },
      redirectTo: `${request.headers.get('origin') || 'https://patrimonia-crm.vercel.app'}/reset-password`
    });

    if (error) {
      if (error.message?.includes('already') || error.message?.includes('exist')) {
        return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, userId: data.user?.id });
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: error.message || 'Erreur' }, { status: 500 });
  }
}
