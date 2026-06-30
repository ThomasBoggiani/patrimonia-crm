// app/api/dropbox/connect/route.js
// Démarre la connexion OAuth Dropbox : redirige l'utilisateur vers Dropbox.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildAuthorizeUrl, generateState } from '@/lib/dropbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const accessToken = request.nextUrl.searchParams.get('token');
    if (!accessToken) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const clientId = process.env.DROPBOX_APP_KEY;
    if (!clientId) {
      return NextResponse.json({ error: 'Configuration Dropbox manquante (DROPBOX_APP_KEY)' }, { status: 500 });
    }

    const origin = request.headers.get('origin') || request.nextUrl.origin || 'https://patrimonia-crm.vercel.app';
    const redirectUri = `${origin}/api/dropbox/callback`;
    const state = `${user.id}:${generateState()}`;

    return NextResponse.redirect(buildAuthorizeUrl({ clientId, redirectUri, state }));
  } catch (error) {
    console.error('[dropbox/connect] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
