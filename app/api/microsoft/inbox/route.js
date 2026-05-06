// app/api/microsoft/inbox/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGraph } from '@/lib/microsoft-graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/microsoft/inbox?limit=50&filter=all|unread|today
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
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const filter = url.searchParams.get('filter') || 'all'; // all|unread|today

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const select = '$select=id,subject,bodyPreview,from,toRecipients,receivedDateTime,isRead,webLink,hasAttachments';
    const orderby = `$orderby=${encodeURIComponent('receivedDateTime desc')}`;

    // Récupère plus que demandé pour avoir de la marge après filtrage Node
    const fetchSize = filter === 'unread' ? Math.max(limit * 3, 50) : limit;
    let endpoint = `/me/mailFolders/Inbox/messages?${select}&${orderby}&$top=${fetchSize}`;

    // Filtre 'today' → côté serveur (Graph supporte le filter par date sur Inbox)
    if (filter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const iso = today.toISOString();
      endpoint += `&$filter=${encodeURIComponent(`receivedDateTime ge ${iso}`)}`;
    }

    // Lance Graph + lookup clients en parallèle
    const [graphResult, clientsResult] = await Promise.allSettled([
      callGraph({ supabase: adminSupabase, userId: user.id, endpoint }),
      adminSupabase.from('clients').select('id, prenom, nom, email, societe').not('email', 'is', null)
    ]);

    if (graphResult.status === 'rejected') {
      const errMsg = graphResult.reason?.message || 'Graph API error';
      if (errMsg === 'NOT_CONNECTED') {
        return NextResponse.json({ error: 'Microsoft non connecté', code: 'NOT_CONNECTED' }, { status: 400 });
      }
      throw new Error(errMsg);
    }

    let messages = graphResult.value?.value || [];
    const clients = clientsResult.status === 'fulfilled' ? (clientsResult.value.data || []) : [];

    // Filtre 'unread' côté Node (plus fiable que Graph qui combine mal isRead+orderby)
    if (filter === 'unread') {
      messages = messages.filter(m => !m.isRead);
    }

    // Cap au limit demandé
    messages = messages.slice(0, limit);

    // Map email → client (case-insensitive)
    const emailMap = new Map();
    for (const c of clients) {
      if (c.email) emailMap.set(c.email.toLowerCase().trim(), c);
    }

    // Enrichit chaque message avec son client matché
    const enriched = messages.map(m => {
      const fromAddr = m.from?.emailAddress?.address?.toLowerCase().trim();
      const matchedClient = fromAddr ? emailMap.get(fromAddr) : null;
      return {
        id: m.id,
        subject: m.subject,
        bodyPreview: m.bodyPreview,
        from: {
          name: m.from?.emailAddress?.name,
          address: m.from?.emailAddress?.address
        },
        receivedDateTime: m.receivedDateTime,
        isRead: m.isRead,
        webLink: m.webLink,
        hasAttachments: m.hasAttachments,
        crm_client: matchedClient ? {
          id: matchedClient.id,
          prenom: matchedClient.prenom,
          nom: matchedClient.nom,
          societe: matchedClient.societe,
          email: matchedClient.email
        } : null
      };
    });

    // Compteur global de non-lus dans l'inbox (côté Node, sur les messages déjà chargés)
    // Pour un vrai count exact, il faudrait une 2ème requête. Pour MVP, on compte ce qu'on voit.
    const unreadCount = enriched.filter(m => !m.isRead).length;

    return NextResponse.json({
      messages: enriched,
      total: enriched.length,
      unread_count: unreadCount,
      filter
    });
  } catch (err) {
    console.error('Inbox error:', err);
    if (err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Microsoft non connecté', code: 'NOT_CONNECTED' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/microsoft/inbox  → marque un mail comme lu/non-lu
export async function PATCH(request) {
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
    const { messageId, isRead } = body;
    if (!messageId) {
      return NextResponse.json({ error: 'messageId requis' }, { status: 400 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    await callGraph({
      supabase: adminSupabase,
      userId: user.id,
      endpoint: `/me/messages/${messageId}`,
      method: 'PATCH',
      body: { isRead: isRead !== false }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Inbox PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
