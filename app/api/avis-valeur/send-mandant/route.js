// ═══════════════════════════════════════════════════════════════════
// app/api/avis-valeur/send-mandant/route.js
// Envoie l'avis de valeur (beau design, PDF Chromium) au mandant par email
// (Microsoft Graph), avec un corps adapté : pré-avis vs avis définitif.
// POST { token, mandatId, subject?, htmlBody?, to? } → { ok, to }
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { callGraph } from '@/lib/microsoft-graph';
import { renderAvisPdf } from '@/lib/avis/renderAvisPdf';
import { buildAvisData } from '@/lib/avis/buildAvis';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Résout l'e-mail du mandant. Le propriétaire peut être stocké de 3 façons dans
// le CRM : (1) champ JSON mandat.mandant_info, (2) pivot mandat_contacts → table
// `contacts` (rôle mandant/proprietaire), (3) mandat.mandant_client_id → clients.
// On essaie les trois, dans cet ordre.
async function resolveMandant(mandat) {
  // On retient le meilleur candidat : un mandant AVEC e-mail gagne et arrête la
  // recherche ; sinon on garde au moins son NOM (pour dire « mandant trouvé mais
  // sans e-mail » plutôt que « aucun mandant »).
  let best = null;
  const consider = (row) => {
    if (!row) return false;
    const info = { email: (row.email || '').trim(), prenom: row.prenom || '', nom: row.nom || '' };
    if (!info.email && !info.prenom && !info.nom) return false;
    if (info.email) { best = info; return true; }   // e-mail trouvé → on s'arrête
    if (!best) best = info;                          // sinon on mémorise le nom
    return false;
  };

  // 1. mandant_info (JSON direct sur le mandat)
  if (consider(mandat.mandant_info)) return best;

  // 2. mandat_contacts → table contacts (rôle mandant/proprietaire d'abord)
  try {
    const { data: contacts } = await supabaseAdmin
      .from('mandat_contacts')
      .select('role, contact:contacts(prenom, nom, email)')
      .eq('mandat_id', mandat.id);
    const rows = (contacts || []).filter(c => c.contact);
    const ordered = [...rows.filter(c => ['mandant', 'proprietaire'].includes(c.role)), ...rows];
    for (const c of ordered) if (consider(c.contact)) return best;
  } catch { /* ignore, on tente la suite */ }

  // 3. mandant_client_id → clients, puis contacts (selon la table pointée)
  const cid = mandat.mandant_client_id;
  if (cid) {
    for (const table of ['clients', 'contacts']) {
      try {
        const { data } = await supabaseAdmin.from(table).select('email, prenom, nom').eq('id', cid).maybeSingle();
        if (consider(data)) return best;
      } catch { /* table absente ou id incompatible */ }
    }
  }
  return best;
}

const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Corps par défaut — modèles FOURNIS par l'agence, utilisés sans modification
// (seuls l'adresse du bien et le prénom du destinataire sont personnalisés).
// Choix automatique selon la phase : Mail A = pré-avis, Mail B = avis définitif.
function defaultEmail({ isPreAvis, adresse, prenom, signature }) {
  const lieu = adresse || '[Adresse du bien]';
  const bonjour = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  const subject = `${isPreAvis ? 'Pré-avis' : 'Avis'} de valeur${adresse ? ' — ' + adresse : ''}`;
  const paras = isPreAvis ? [
    // ── Mail A — Pré-avis de valeur ──
    bonjour,
    `Je vous remercie pour votre demande d'estimation concernant votre bien situé ${lieu}.`,
    `Vous trouverez ci-joint un pré-avis de valeur, réalisé à partir des informations dont je dispose actuellement.`,
    `Cette première analyse s'appuie notamment sur :\n• l'étude du marché local ;\n• les ventes comparables issues des données DVF ;\n• les biens actuellement proposés à la vente sur le secteur ;\n• les caractéristiques connues du quartier et de son environnement.`,
    `À ce stade, certains éléments essentiels n'ont pas pu être vérifiés, notamment les prestations réelles du bien, son état général, son agencement, sa luminosité, ses volumes ou encore les éventuels travaux réalisés ou à prévoir.`,
    `En conséquence, la valeur au m² ainsi que la fourchette d'estimation doivent être considérées comme une première approche, destinée à vous fournir un repère cohérent et argumenté. Elles pourront être affinées après une visite du bien ou à la réception de documents complémentaires (plans, diagnostics, DPE, charges, taxe foncière, procès-verbaux d'assemblée générale, etc.).`,
    `Je reste naturellement à votre disposition pour échanger sur cette première analyse et, si vous le souhaitez, établir un avis de valeur définitif reposant sur une étude complète de votre bien.`,
    `Au plaisir d'échanger avec vous.`,
    `Bien à vous,\n${signature}`,
  ] : [
    // ── Mail B — Avis de valeur définitif ──
    bonjour,
    `Vous trouverez ci-joint l'avis de valeur de votre bien situé ${lieu}.`,
    `Cette estimation a été réalisée selon notre méthodologie d'expertise, en croisant notamment :\n• l'analyse du marché local ;\n• les ventes comparables issues des données DVF ;\n• les biens actuellement en commercialisation ;\n• les caractéristiques propres à votre bien ;\n• les documents techniques et juridiques mis à notre disposition ;\n• ainsi que les observations réalisées lors de la visite lorsque celle-ci a eu lieu.`,
    `L'objectif de cet avis est de déterminer la valeur de marché la plus pertinente à la date de son établissement, en tenant compte des qualités intrinsèques du bien, de son environnement et des conditions actuelles du marché immobilier.`,
    `Je reste naturellement à votre disposition pour vous présenter cette analyse en détail, répondre à vos questions et vous accompagner dans la définition de la stratégie de commercialisation la plus adaptée à votre projet.`,
    `Au plaisir d'échanger avec vous.`,
    `Bien à vous,\n${signature}`,
  ];
  return { subject, text: paras.join('\n\n') };
}

// Texte éditable → HTML pour l'envoi (paragraphes + retours à la ligne).
function textToHtml(text) {
  return String(text || '').trim().split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, mandatId } = body;

    const user = await verifyToken(token);
    if (!user) return json({ ok: false, error: 'Authentification requise' }, 401);
    if (!mandatId) return json({ ok: false, error: 'mandatId requis' }, 400);

    const { data: mandat, error: mErr } = await supabaseAdmin.from('mandats').select('*').eq('id', mandatId).maybeSingle();
    if (mErr || !mandat) return json({ ok: false, error: 'Mandat introuvable' }, 404);

    // Destinataire (résolu, surchargeable par l'agent dans la fenêtre d'envoi)
    const mandantOverride = (body.to || '').trim();
    const cli = await resolveMandant(mandat);
    const to = mandantOverride || cli?.email || '';

    // Signature = PRÉNOM du conseiller courant (les modèles signent « Thomas »).
    let signature = 'Thomas';
    try {
      const { data: profile } = await supabaseAdmin.from('profiles').select('prenom, nom').eq('id', user.id).maybeSingle();
      if (profile) signature = profile.prenom || [profile.prenom, profile.nom].filter(Boolean).join(' ') || signature;
    } catch { /* garde le défaut */ }

    // Phase (pré-avis / définitif) + libellés
    const d = buildAvisData(mandat);
    const isPreAvis = d.isPreAvis;
    const adresse = mandat.adresse || mandat.nom || '';

    const def = defaultEmail({ isPreAvis, adresse, prenom: cli?.prenom || '', signature });
    const subject = (body.subject || '').trim() || def.subject;
    const bodyText = (body.bodyText != null && String(body.bodyText).trim()) ? String(body.bodyText) : def.text;

    // MODE PRÉPARATION : renvoie le brouillon éditable, SANS générer le PDF ni
    // envoyer. La fenêtre d'envoi l'utilise pour laisser l'agent relire/modifier.
    if (body.preview) {
      const mandantNom = cli ? [cli.prenom, cli.nom].filter(Boolean).join(' ').trim() : '';
      return json({ ok: true, preview: true, to, subject, bodyText, isPreAvis, mandantNom, mandantSansEmail: !!(cli && !cli.email) });
    }

    if (!to) return json({ ok: false, error: "Aucune adresse e-mail pour le mandant. Saisis-la dans le champ « À » de la fenêtre d'envoi." }, 422);
    const htmlBody = textToHtml(bodyText);

    // PDF (beau design) via Chromium
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    let pdfBuffer;
    try {
      pdfBuffer = await renderAvisPdf(mandat, baseUrl);
    } catch (e) {
      console.error('[send-mandant] Échec génération PDF:', e);
      return json({ ok: false, error: 'Génération du PDF impossible : ' + e.message }, 500);
    }
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    const safeName = `${d.docLabel} - ${adresse}`.replace(/[^\w\-À-ÿ ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 70) || 'Avis de valeur';

    // Envoi Microsoft Graph
    await callGraph({
      supabase: supabaseAdmin,
      userId: user.id,
      endpoint: '/me/sendMail',
      method: 'POST',
      body: {
        message: {
          subject,
          body: { contentType: 'HTML', content: htmlBody },
          toRecipients: [{ emailAddress: { address: to } }],
          attachments: [{
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: `${safeName}.pdf`,
            contentType: 'application/pdf',
            contentBytes: pdfBase64,
          }],
        },
        saveToSentItems: true,
      },
    });

    // Journal
    try {
      await supabaseAdmin.from('interactions').insert({
        mandat_id: mandatId,
        type: 'email_sortant',
        resume: `${d.docLabel} envoyé au mandant : ${subject}`,
        created_by: user.id,
      });
    } catch (e) { console.warn('[send-mandant] interaction non journalisée:', e.message); }

    // Auto-avancement du pipeline : l'avis (ou pré-avis) envoyé au mandant marque
    // la fin de l'analyse. On fait sortir le deal du « Sourcing » vers « Analyse ».
    // Uniquement vers l'avant, et seulement depuis le sourcing (on ne touche jamais
    // aux statuts déjà plus avancés : Mandat signé, Commercialisation, Offre…).
    let statutAvance = null;
    try {
      const ORDRE = ['Sourcing', 'Analyse', 'Mandat signé', 'Commercialisation', 'Offre', 'Promesse', 'Acte'];
      const cur = ORDRE.indexOf(mandat.statut);
      if (cur !== -1 && cur < ORDRE.indexOf('Analyse')) {
        await supabaseAdmin.from('mandats')
          .update({ statut: 'Analyse', updated_at: new Date().toISOString() })
          .eq('id', mandatId);
        statutAvance = 'Analyse';
      }
    } catch (e) { console.warn('[send-mandant] auto-statut non appliqué:', e.message); }

    return json({ ok: true, to, isPreAvis, subject, statutAvance });
  } catch (err) {
    console.error('[/api/avis-valeur/send-mandant] Erreur:', err);
    return json({ ok: false, error: 'Erreur serveur', detail: err.message }, 500);
  }
}
