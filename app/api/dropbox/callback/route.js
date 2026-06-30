// app/api/dropbox/callback/route.js
// Retour OAuth Dropbox : échange le code, stocke le token dans user_integrations.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exchangeCodeForTokens, getCurrentAccount } from '@/lib/dropbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request) {
  const origin = request.nextUrl.origin || 'https://patrimonia-crm.vercel.app';
  const back = (status) => NextResponse.redirect(`${origin}/?tab=integrations&dropbox=${status}`);

  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');
    if (error) return back('error');
    if (!code || !state) return back('error');

    const userId = state.split(':')[0];
    if (!userId) return back('error');

    const clientId = process.env.DROPBOX_APP_KEY;
    const clientSecret = process.env.DROPBOX_APP_SECRET;
    if (!clientId || !clientSecret) {
      console.error('[dropbox/callback] config manquante');
      return back('config');
    }

    const redirectUri = `${origin}/api/dropbox/callback`;
    const tokens = await exchangeCodeForTokens({ clientId, clientSecret, code, redirectUri });

    let accountEmail = null, accountName = null;
    try {
      const acc = await getCurrentAccount(tokens.access_token);
      accountEmail = acc?.email || null;
      accountName = acc?.name?.display_name || null;
    } catch { /* non bloquant */ }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + (tokens.expires_in * 1000)).toISOString()
      : null;

    const { error: upErr } = await supabaseAdmin.from('user_integrations').upsert({
      user_id: userId,
      provider: 'dropbox',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: expiresAt,
      scope: tokens.scope || null,
      account_email: accountEmail,
      account_name: accountName,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    if (upErr) {
      console.error('[dropbox/callback] upsert error:', upErr.message);
      return back('error');
    }
    return back('connected');
  } catch (e) {
    console.error('[dropbox/callback] error:', e);
    return back('error');
  }
}
