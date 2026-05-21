// ═══════════════════════════════════════════════════════════════════
// app/api/clients/[id]/analyze/route.js
// Génère une analyse IA structurée d'un client à partir de tout son historique :
// - Interactions (notes, RDV, emails sortants logged)
// - Deals (matches avec statuts + motifs de refus)
// - Emails Outlook échangés
// - Questionnaire complété si dispo
//
// Renvoie 4 blocs : profil_affine, sujets_sensibles, signaux_achat, action_recommandee
// Stocke en BDD dans client_analyses
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { callGraph } from '@/lib/microsoft-graph';

export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// GET /api/clients/[id]/analyze → récupère la dernière analyse
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401 });
    }

    const { data: analysis } = await supabaseAdmin
      .from('client_analyses')
      .select('*')
      .eq('client_id', id)
      .eq('is_latest', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!analysis) {
      return new Response(JSON.stringify({ ok: true, analysis: null }), { status: 200 });
    }

    // Compter les événements depuis l'analyse pour détecter "périmée"
    const analysisDate = analysis.created_at;
    const [interactionsRes, dealsRes] = await Promise.all([
      supabaseAdmin
        .from('interactions')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', id)
        .gt('created_at', analysisDate),
      supabaseAdmin
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', id)
        .gt('updated_at', analysisDate),
    ]);

    const newEvents = (interactionsRes.count || 0) + (dealsRes.count || 0);

    return new Response(JSON.stringify({
      ok: true,
      analysis,
      is_stale: newEvents > 0,
      new_events_count: newEvents,
    }), { status: 200 });
  } catch (err) {
    console.error('[GET /api/clients/[id]/analyze]', err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
}

// POST /api/clients/[id]/analyze → génère une nouvelle analyse
export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { token } = body;

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise' }), { status: 401 });
    }

    // 1. Récupérer le client
    const { data: client, error: cErr } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();
    if (cErr || !client) {
      return new Response(JSON.stringify({ ok: false, error: 'Client introuvable' }), { status: 404 });
    }

    // 2. Agréger toutes les sources de données
    const [interactionsRes, dealsRes, questionnaireRes] = await Promise.all([
      // Interactions (notes, RDV, emails sortants logged)
      supabaseAdmin
        .from('interactions')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      // Deals (avec infos mandat)
      supabaseAdmin
        .from('deals')
        .select('*, mandats!inner(id, nom, adresse, ville, prix, type, sous_type, marche, surface)')
        .eq('client_id', id)
        .order('updated_at', { ascending: false }),
      // Questionnaire si soumis
      supabaseAdmin
        .from('questionnaires')
        .select('*')
        .eq('client_id', id)
        .eq('statut', 'Complété')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const interactions = interactionsRes.data || [];
    const deals = dealsRes.data || [];
    const questionnaire = questionnaireRes.data;

    // 3. Récupérer les emails Outlook échangés (si email dispo)
    let emails = [];
    if (client.email) {
      try {
        const safeEmail = client.email.toLowerCase();
        const endpointFrom = `/me/mailFolders/Inbox/messages?$top=20&$orderby=${encodeURIComponent('receivedDateTime desc')}&$select=subject,bodyPreview,from,toRecipients,receivedDateTime,sentDateTime`;
        const endpointTo = `/me/mailFolders/SentItems/messages?$top=20&$orderby=${encodeURIComponent('sentDateTime desc')}&$select=subject,bodyPreview,from,toRecipients,receivedDateTime,sentDateTime`;

        const [resFrom, resTo] = await Promise.allSettled([
          callGraph({ supabase: supabaseAdmin, userId: user.id, endpoint: endpointFrom }),
          callGraph({ supabase: supabaseAdmin, userId: user.id, endpoint: endpointTo }),
        ]);

        const allFrom = resFrom.status === 'fulfilled' ? (resFrom.value?.value || []) : [];
        const allTo = resTo.status === 'fulfilled' ? (resTo.value?.value || []) : [];

        const filteredFrom = allFrom.filter(m =>
          m.from?.emailAddress?.address?.toLowerCase() === safeEmail
        );
        const filteredTo = allTo.filter(m =>
          (m.toRecipients || []).some(r => r.emailAddress?.address?.toLowerCase() === safeEmail)
        );

        emails = [...filteredFrom, ...filteredTo]
          .sort((a, b) => {
            const dA = new Date(a.receivedDateTime || a.sentDateTime || 0).getTime();
            const dB = new Date(b.receivedDateTime || b.sentDateTime || 0).getTime();
            return dB - dA;
          })
          .slice(0, 15);
      } catch (e) {
        console.warn('[analyze] Récupération emails Outlook échouée:', e.message);
      }
    }

    // 4. Construire le prompt pour GPT-4o
    const today = new Date().toISOString().split('T')[0];

    const clientResume = {
      nom: `${client.prenom || ''} ${client.nom || ''}`.trim(),
      email: client.email,
      societe: client.societe,
      typologie: client.typologie,
      nature: client.nature,
      budget_min: client.budget_min,
      budget_max: client.budget_max,
      rendement_min: client.rendement_min,
      zones: client.zones,
      typologies_recherchees: client.typologies_recherchees,
      details_recherche: client.details_recherche,
      maturite: client.maturite,
      origine: client.origine,
      statut: client.statut,
    };

    const dealsResume = deals.map(d => ({
      mandat: d.mandats?.nom || d.mandats?.adresse,
      ville: d.mandats?.ville,
      prix: d.mandats?.prix,
      type: d.mandats?.type,
      sous_type: d.mandats?.sous_type,
      marche: d.mandats?.marche,
      statut_deal: d.statut,
      motif_refus: d.motif_refus,
      commentaire: d.commentaire,
      date_envoi: d.date_envoi,
      date_reponse: d.date_reponse,
    }));

    const interactionsResume = interactions.map(i => ({
      type: i.type,
      date: i.date || i.created_at?.split('T')[0],
      resume: i.resume,
      next_step: i.next_step,
    }));

    const emailsResume = emails.map(e => ({
      date: (e.receivedDateTime || e.sentDateTime || '').split('T')[0],
      sens: e.from?.emailAddress?.address?.toLowerCase() === client.email?.toLowerCase() ? 'entrant' : 'sortant',
      sujet: e.subject,
      apercu: (e.bodyPreview || '').slice(0, 300),
    }));

    const systemPrompt = `Tu es un analyste senior d'un cabinet d'investissement immobilier patrimonial off-market parisien.
Tu analyses un client (acquéreur potentiel) pour le compte d'un conseiller commercial.

Date du jour : ${today}.

Objectif : produire une analyse stratégique en 4 blocs structurés.

CONSIGNES :
- Sois factuel, concis, basé uniquement sur les données fournies.
- Si une donnée manque, dis-le ("aucun historique d'échange disponible").
- Ne révèle JAMAIS de données techniques (IDs, JSON brut).
- Le ton : professionnel, métier immobilier, comme un brief interne à un confrère.
- Tes 4 blocs doivent être ACTIONNABLES (le conseiller doit savoir quoi faire ensuite).

FORMAT DE RÉPONSE STRICT (JSON uniquement, pas de markdown, pas de backticks) :

{
  "profil_affine": {
    "synthese": "2-3 lignes de synthèse sur le vrai profil du client tel qu'il transparaît dans l'historique (vs critères déclarés)",
    "criteres_reels": ["liste de 3-5 critères réellement recherchés tels qu'observés dans l'historique"],
    "ecart_avec_declare": "ce qui diverge entre ce qu'il a déclaré au questionnaire et ce qu'il montre dans les échanges (ou 'aucun écart notable')"
  },
  "sujets_sensibles": {
    "synthese": "2-3 lignes sur ce qu'il refuse systématiquement, ses points de friction",
    "motifs_refus_recurrents": ["motif 1", "motif 2"],
    "a_eviter": ["type de bien/proposition à NE PAS faire à ce client"]
  },
  "signaux_achat": {
    "synthese": "2-3 lignes sur ce qui le motive vraiment, sur quoi il a montré de l'intérêt",
    "interets_marques": ["intérêt 1", "intérêt 2"],
    "maturite_estimee": "Froide | Tiède | Chaude | Très chaude — avec justification courte"
  },
  "action_recommandee": {
    "priorite": "Haute | Moyenne | Basse",
    "action": "1 action très concrète à faire dans les prochains jours (ex: 'Lui envoyer la plaquette de [mandat X] qui matche ses critères Y', 'Le relancer car silence depuis 3 semaines sur sa dernière demande')",
    "argumentaire": "1-2 lignes pour justifier cette action"
  }
}`;

    const userMessage = `Voici les données disponibles sur ce client :

═══ FICHE CLIENT ═══
${JSON.stringify(clientResume, null, 2)}

═══ DEALS (matches mandat ↔ client) — ${deals.length} au total ═══
${deals.length > 0 ? JSON.stringify(dealsResume, null, 2) : 'Aucun deal'}

═══ INTERACTIONS (notes, RDV, emails logged) — ${interactions.length} au total ═══
${interactions.length > 0 ? JSON.stringify(interactionsResume, null, 2) : 'Aucune interaction'}

═══ EMAILS OUTLOOK (entrants et sortants avec cette adresse) — ${emails.length} récupérés ═══
${emails.length > 0 ? JSON.stringify(emailsResume, null, 2) : 'Aucun email échangé via Outlook avec cette adresse'}

═══ QUESTIONNAIRE COMPLÉTÉ ═══
${questionnaire ? JSON.stringify(questionnaire.reponses || questionnaire, null, 2) : 'Pas de questionnaire complété'}

Génère maintenant l'analyse stratégique en JSON STRICT selon le format demandé.`;

    // 5. Appel GPT-4o
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('[analyze] OpenAI error:', errText);
      return new Response(JSON.stringify({ ok: false, error: 'Erreur OpenAI: ' + errText.slice(0, 200) }), { status: 500 });
    }

    const openaiData = await openaiRes.json();
    const rawResponse = openaiData.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
    } catch (e) {
      console.error('[analyze] Parse JSON échoué:', rawResponse);
      return new Response(JSON.stringify({ ok: false, error: 'Réponse IA non-parsable' }), { status: 500 });
    }

    const dataSources = {
      nb_interactions: interactions.length,
      nb_deals: deals.length,
      nb_emails: emails.length,
      has_questionnaire: !!questionnaire,
      tokens_used: openaiData.usage?.total_tokens || 0,
    };

    // 6. Sauvegarder dans client_analyses
    // D'abord, marquer toutes les anciennes analyses comme non-latest
    await supabaseAdmin
      .from('client_analyses')
      .update({ is_latest: false })
      .eq('client_id', id);

    const { data: savedAnalysis, error: insertErr } = await supabaseAdmin
      .from('client_analyses')
      .insert({
        client_id: id,
        profil_affine: parsed.profil_affine || null,
        sujets_sensibles: parsed.sujets_sensibles || null,
        signaux_achat: parsed.signaux_achat || null,
        action_recommandee: parsed.action_recommandee || null,
        raw_response: rawResponse,
        data_sources: dataSources,
        created_by: user.id,
        is_latest: true,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[analyze] Insert error:', insertErr);
      return new Response(JSON.stringify({ ok: false, error: 'Erreur sauvegarde: ' + insertErr.message }), { status: 500 });
    }

    return new Response(JSON.stringify({
      ok: true,
      analysis: savedAnalysis,
      data_sources: dataSources,
    }), { status: 200 });
  } catch (err) {
    console.error('[POST /api/clients/[id]/analyze]', err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
}
