import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/invite-user
 * Body: { email, prenom, nom, role, fonction }
 * Headers: Authorization: Bearer <access_token>
 *
 * Workflow :
 *   1. Vérifie que l'appelant est admin
 *   2. Crée l'utilisateur dans auth.users via Admin API + envoie l'email d'invitation
 *   3. Crée la ligne correspondante dans la table `profiles` avec les infos pré-remplies
 *   4. Si la création du profile échoue, on rollback en supprimant l'auth user (pour éviter les orphelins)
 */
export async function POST(request) {
  try {
    const { email, prenom, nom, role, fonction } = await request.json();

    if (!email || !prenom || !nom) {
      return NextResponse.json({ error: 'Email, prénom et nom requis' }, { status: 400 });
    }

    // ─── 1. Vérification du token + droits admin ──────────────────
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

    const { data: callerProfile } = await publicSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // On accepte 'Admin' (capitalize) ET 'admin' (lowercase) pour gérer
    // les profiles existants créés à la main avec une casse différente.
    const callerRole = (callerProfile?.role || '').toLowerCase();
    if (callerRole !== 'admin' && callerRole !== 'directeur') {
      return NextResponse.json({ error: 'Seuls les admins peuvent inviter' }, { status: 403 });
    }

    // ─── 2. Détermination de l'URL de redirect ────────────────────
    // Priorité : NEXT_PUBLIC_SITE_URL > origin du header > fallback prod
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get('origin') ||
      'https://patrimonia-crm.vercel.app';
    const redirectTo = `${siteUrl}/reset-password`;

    // ─── 3. Création via service role ─────────────────────────────
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      data: { prenom, nom, role: role || 'Commercial', fonction: fonction || null },
      redirectTo
    });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('already') || msg.includes('exist') || msg.includes('registered')) {
        return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
      }
      throw error;
    }

    const newUserId = data.user?.id;
    if (!newUserId) {
      return NextResponse.json({ error: 'Utilisateur créé mais ID introuvable' }, { status: 500 });
    }

    // ─── 4. Création du profile (table profiles) ──────────────────
    // Si une ligne existe déjà pour cet ID (re-invitation), on la met à jour.
    const profilePayload = {
      id: newUserId,
      email,
      prenom,
      nom,
      role: role || 'Commercial',
      fonction: fonction || null,
      actif: true,
    };

    const { error: profileError } = await adminSupabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' });

    if (profileError) {
      // Rollback : on supprime l'auth user pour éviter un orphelin
      // (un user existant en auth.users mais sans profile ne peut pas se connecter au CRM correctement)
      await adminSupabase.auth.admin.deleteUser(newUserId).catch(() => {});
      return NextResponse.json({
        error: `Profile non créé : ${profileError.message}. Invitation annulée.`
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      userId: newUserId,
      email,
      message: `Invitation envoyée à ${email}`
    });
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: error.message || 'Erreur inconnue' }, { status: 500 });
  }
}
