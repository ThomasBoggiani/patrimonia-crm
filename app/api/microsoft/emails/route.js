import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGraph } from '@/lib/microsoft-graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/microsoft/emails?email=client@...&limit=20
// Retourne les emails échangés avec une adresse précise (entrants + sortants)
//
// FIX : Microsoft Graph rejette les filtres OR complexes entre `from` et
// `toRecipients/any`. On fait donc 2 requêtes séparées et on merge côté Node.
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
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    
    if (!email) return NextResponse.json({ error: 'Paramètre email requis' }, { status: 400 });

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const select = '$select=id,subject,bodyPreview,from,toRecipients,receivedDateTime,sentDateTime,isRead,webLink';
    const safeEmail = email.replace(/'/g, "''");
    const safeEmailLower = safeEmail.toLowerCase();

    // STRATÉGIE :
    // Graph refuse les filtres complexes (from + orderby, toRecipients/any) sur certains dossiers.
    // Solution robuste : on récupère les N derniers messages de Inbox + SentItems SANS filtre serveur,
    // puis on filtre côté Node sur l'adresse email. Plus simple, plus fiable, et cap N suffit.
    const fetchSize = Math.max(limit * 5, 50); // on récupère plus pour avoir de la marge après filtrage
    const endpointFrom = `/me/mailFolders/Inbox/messages?$top=${fetchSize}&$orderby=${encodeURIComponent('receivedDateTime desc')}&${select}`;
    const endpointTo = `/me/mailFolders/SentItems/messages?$top=${fetchSize}&$orderby=${encodeURIComponent('sentDateTime desc')}&${select}`;

    // Lancer les 2 requêtes en parallèle
    const [resFrom, resTo] = await Promise.allSettled([
      callGraph({ supabase: adminSupabase, userId: user.id, endpoint: endpointFrom }),
      callGraph({ supabase: adminSupabase, userId: user.id, endpoint: endpointTo }),
    ]);

    const allFrom = resFrom.status === 'fulfilled' ? (resFrom.value?.value || []) : [];
    const allTo = resTo.status === 'fulfilled' ? (resTo.value?.value || []) : [];

    // Filtrage côté Node : ne garder que ceux avec cette adresse
    const emailsFrom = allFrom.filter(m =>
      m.from?.emailAddress?.address?.toLowerCase() === safeEmailLower
    );
    const emailsTo = allTo.filter(m =>
      (m.toRecipients || []).some(r =>
        r.emailAddress?.address?.toLowerCase() === safeEmailLower
      )
    );

    // 🔍 DEBUG : capturer les erreurs Graph dans la réponse
    const debug = {
      from_status: resFrom.status,
      from_error: resFrom.status === 'rejected' ? String(resFrom.reason?.message || resFrom.reason) : null,
      to_status: resTo.status,
      to_error: resTo.status === 'rejected' ? String(resTo.reason?.message || resTo.reason) : null,
      endpointFrom,
      endpointTo
    };

    // Merge + déduplication par id
    const seen = new Set();
    const merged = [];
    for (const e of [...emailsFrom, ...emailsTo]) {
      if (e.id && !seen.has(e.id)) {
        seen.add(e.id);
        merged.push(e);
      }
    }

    // Tri par date décroissante
    merged.sort((a, b) => {
      const dateA = new Date(a.receivedDateTime || a.sentDateTime || 0).getTime();
      const dateB = new Date(b.receivedDateTime || b.sentDateTime || 0).getTime();
      return dateB - dateA;
    });

    const emails = merged.slice(0, limit);

    return NextResponse.json({ emails });
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

    if (clientId) {
      await adminSupabase.from('interactions').insert({
        client_id: clientId,
        type: 'Email',
        date: new Date().toISOString().split('T')[0],
        resume: `Email envoyé : ${subject}`,
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
