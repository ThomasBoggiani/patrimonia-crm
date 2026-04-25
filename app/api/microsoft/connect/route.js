import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildAuthorizeUrl, generateState } from '@/lib/microsoft-graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Vérifier que l'utilisateur est authentifié
    const authHeader = request.headers.get('cookie') || '';
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

    const tenantId = process.env.MICROSOFT_TENANT_ID;
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const origin = request.headers.get('origin') || 'https://patrimonia-crm.vercel.app';
    const redirectUri = `${origin}/api/microsoft/callback`;

    if (!tenantId || !clientId) {
      return NextResponse.json({ error: 'Configuration Microsoft manquante (variables Vercel)' }, { status: 500 });
    }

    // State = userId + random (sera vérifié au retour)
    const state = `${user.id}:${generateState()}`;
    const authUrl = buildAuthorizeUrl({ tenantId, clientId, redirectUri, state });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Connect error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
