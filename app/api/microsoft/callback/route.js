import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exchangeCodeForTokens, getMyProfile } from '@/lib/microsoft-graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Cas erreur Microsoft
  if (error) {
    return NextResponse.redirect(
      `${url.origin}/integrations?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${url.origin}/integrations?error=missing_params`);
  }

  try {
    // Extraire l'userId du state
    const userId = state.split(':')[0];
    if (!userId) throw new Error('Invalid state');

    const tenantId = process.env.MICROSOFT_TENANT_ID;
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = `${url.origin}/api/microsoft/callback`;

    // Échanger le code contre des tokens
    const tokens = await exchangeCodeForTokens({
      tenantId, clientId, clientSecret, code, redirectUri
    });

    // Récupérer le profil pour stocker email + nom
    const profile = await getMyProfile(tokens.access_token);

    // Stocker l'intégration via service_role (pour bypass RLS)
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Upsert : remplace si existe déjà
    const { error: upsertError } = await adminSupabase
      .from('user_integrations')
      .upsert({
        user_id: userId,
        provider: 'microsoft',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        scope: tokens.scope,
        account_email: profile.mail || profile.userPrincipalName,
        account_name: profile.displayName,
        metadata: {
          tenant_id: tenantId,
          microsoft_user_id: profile.id
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,provider'
      });

    if (upsertError) throw upsertError;

    // Redirection vers la page intégrations avec succès
    return NextResponse.redirect(`${url.origin}/integrations?success=microsoft`);
  } catch (err) {
    console.error('Callback error:', err);
    return NextResponse.redirect(
      `${url.origin}/integrations?error=${encodeURIComponent(err.message || 'callback_failed')}`
    );
  }
}
