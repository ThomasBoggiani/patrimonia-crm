import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGraph } from '@/lib/microsoft-graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/microsoft/emails?email=client@...&limit=20
// Retourne les emails échangés avec une adresse précise (entrants + sortants)
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const accessToken = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Session invalide' }, { status: 401 });

    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const limit = url.searchParams.get('limit') || '20';
    
    if (!email) return NextResponse.json({ error: 'Paramètre email requis' }, { status: 400 });

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Filter : emails échangés avec cette adresse (envoyés OU reçus)
    // On utilise $search qui cherche dans tout le contenu de l'email
    const filter = `(from/emailAddress/address eq '${email}') or (toRecipients/any(r:r/emailAddress/address eq '${email}'))`;
    const endpoint = `/me/messages?$filter=${encodeURIComponent(filter)}&$top=${limit}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,from,toRecipients,receivedDateTime,sentDateTime,isRead,webLink`;
    
    const result = await callGraph({
      supabase: adminSupabase,
      userId: user.id,
      endpoint
    });

    return NextResponse.json({ emails: result.value || [] });
  } catch (err) {
    console.error('List emails error:', err);
    if (err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Microsoft non connecté', code: 'NOT_CONNECTED' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/microsoft/emails  → envoie un email
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const accessToken = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Session invalide' }, { status: 401 });

    const body = await request.json();
    const { to, subject, content, clientId } = body;

    if (!to || !subject || !content) {
      return NextResponse.json({ error: 'Paramètres to, subject, content requis' }, { status: 400 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Envoi via Graph
    const message = {
      message: {
        subject: subject,
        body: { contentType: 'HTML', content: content },
        toRecipients: (Array.isArray(to) ? to : [to]).map(addr => ({
          emailAddress: { address: addr }
        }))
      },
      saveToSentItems: true
    };

    await callGraph({
      supabase: adminSupabase,
      userId: user.id,
      endpoint: '/me/sendMail',
      method: 'POST',
      body: message
    });

    // Log dans interactions si on a un clientId
    if (clientId) {
      await adminSupabase.from('interactions').insert({
        client_id: clientId,
        type: 'Email',
        date: new Date().toISOString().split('T')[0],
        notes: `Email envoyé : ${subject}`,
        created_by: user.id
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Send email error:', err);
    if (err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Microsoft non connecté', code: 'NOT_CONNECTED' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
