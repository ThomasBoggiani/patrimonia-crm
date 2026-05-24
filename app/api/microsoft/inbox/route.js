// app/api/microsoft/inbox/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGraph } from '@/lib/microsoft-graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =================================================================
// GET /api/microsoft/inbox?limit=50&filter=all|unread|today&categorie=...
// =================================================================
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
    const filter = url.searchParams.get('filter') || 'all';
    const categorieFilter = url.searchParams.get('categorie') || null;

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const select = '$select=id,subject,bodyPreview,from,toRecipients,receivedDateTime,isRead,webLink,hasAttachments';
    const orderby = `$orderby=${encodeURIComponent('receivedDateTime desc')}`;
    const fetchSize = filter === 'unread' ? Math.max(limit * 3, 50) : limit;
    let endpoint = `/me/mailFolders/Inbox/messages?${select}&${orderby}&$top=${fetchSize}`;

    if (filter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const iso = today.toISOString();
      endpoint += `&$filter=${encodeURIComponent(`receivedDateTime ge ${iso}`)}`;
    }

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

    if (filter === 'unread') {
      messages = messages.filter(m => !m.isRead);
    }
    messages = messages.slice(0, limit);

    const emailMap = new Map();
    for (const c of clients) {
      if (c.email) emailMap.set(c.email.toLowerCase().trim(), c);
    }

    // Charge les catégories depuis le cache pour tous les messages d'un coup
    const messageIds = messages.map(m => m.id);
    let categoriesMap = new Map();
    if (messageIds.length > 0) {
      const { data: cachedCats } = await adminSupabase
        .from('email_categories')
        .select('message_id, categorie, confiance')
        .eq('user_id', user.id)
        .in('message_id', messageIds);
      for (const c of cachedCats || []) {
        categoriesMap.set(c.message_id, { categorie: c.categorie, confiance: c.confiance });
      }
    }

    // Enrichit chaque message
    const enriched = messages.map(m => {
      const fromAddr = m.from?.emailAddress?.address?.toLowerCase().trim();
      const matchedClient = fromAddr ? emailMap.get(fromAddr) : null;
      const cachedCat = categoriesMap.get(m.id);
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
        } : null,
        categorie: cachedCat?.categorie || null,
        confiance: cachedCat?.confiance || null
      };
    });

    // Identifie les messages NON classifiés (pour déclenchement background)
    const toClassify = enriched
      .filter(m => !m.categorie)
      .map(m => ({
        id: m.id,
        subject: m.subject || '',
        bodyPreview: (m.bodyPreview || '').slice(0, 500),
        fromName: m.from?.name || '',
        fromAddress: m.from?.address || '',
        hasCrmMatch: !!m.crm_client
      }));

    // La classification est déclenchée côté client (fire-and-forget côté serveur ne marche pas en serverless)
    // toClassify est retourné dans la réponse pour que le client puisse déclencher

    // Filtre côté catégorie si demandé
    let filtered = enriched;
    if (categorieFilter) {
      filtered = filtered.filter(m => m.categorie === categorieFilter);
    }

    const unreadCount = filtered.filter(m => !m.isRead).length;

    return NextResponse.json({
      messages: filtered,
      total: filtered.length,
      unread_count: unreadCount,
      filter,
      pending_classification: toClassify.length,       
      to_classify: toClassify
    });
  } catch (err) {
    console.error('Inbox error:', err);
    if (err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Microsoft non connecté', code: 'NOT_CONNECTED' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// =================================================================
// PATCH /api/microsoft/inbox  → marque un mail comme lu/non-lu
// =================================================================
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

// =================================================================
// DELETE /api/microsoft/inbox?messageId=xxx
// Déplace le mail vers la corbeille Outlook (suppression réversible côté Outlook)
// =================================================================
export async function DELETE(request) {
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
    const messageId = url.searchParams.get('messageId');
    if (!messageId) {
      return NextResponse.json({ error: 'messageId requis' }, { status: 400 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Microsoft Graph : DELETE /me/messages/{id} déplace vers Deleted Items
    await callGraph({
      supabase: adminSupabase,
      userId: user.id,
      endpoint: `/me/messages/${messageId}`,
      method: 'DELETE'
    });

    // On nettoie aussi le cache catégorie
    await adminSupabase
      .from('email_categories')
      .delete()
      .eq('user_id', user.id)
      .eq('message_id', messageId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Inbox DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
