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
  const norm = (row) => (row && row.email) ? { id: row.id || null, email: row.email, prenom: row.prenom || '', nom: row.nom || '' } : null;

  // 1. mandant_info (JSON direct sur le mandat)
  const mi = mandat.mandant_info;
  if (mi && mi.email) return { id: null, email: mi.email, prenom: mi.prenom || '', nom: mi.nom || '' };

  // 2. mandat_contacts (rôle mandant/proprietaire) → table contacts
  try {
    const { data: contacts } = await supabaseAdmin
      .from('mandat_contacts')
      .select('role, contact:contacts(id, prenom, nom, email)')
      .eq('mandat_id', mandat.id);
    const rows = (contacts || []).filter(c => c.contact?.email);
    const mc = rows.find(c => ['mandant', 'proprietaire'].includes(c.role)) || rows[0];
    if (mc?.contact) return norm(mc.contact);
  } catch { /* ignore, on tente la suite */ }

  // 3. mandant_client_id → clients, puis contacts (selon la table pointée)
  const cid = mandat.mandant_client_id;
  if (cid) {
    for (const table of ['clients', 'contacts']) {
      try {
        const { data } = await supabaseAdmin.from(table).select('id, email, prenom, nom').eq('id', cid).maybeSingle();
        const r = norm(data);
        if (r) return r;
      } catch { /* table absente ou id incompatible */ }
    }
  }
  return null;
}

const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Corps par défaut (texte simple, éditable par l'agent avant envoi), adapté à
// la phase (pré-avis / définitif).
function defaultEmail({ isPreAvis, adresse, prenom, signature }) {
  const lieu = adresse ? ` de votre bien situé ${adresse}` : '';
  const subject = `${isPreAvis ? 'Pré-avis' : 'Avis'} de valeur${adresse ? ' — ' + adresse : ''}`;
  const paras = isPreAvis ? [
    prenom ? `Bonjour ${prenom},` : 'Bonjour,',
    `Je vous prie de trouver ci-joint un pré-avis de valeur${lieu}.`,
    `Il s'agit d'une première estimation établie à partir de l'adresse et des données de marché. Nous l'affinerons — à la hausse comme à la baisse — après une visite et à réception des documents utiles, afin d'aboutir à un avis de valeur définitif.`,
    `Je reste à votre entière disposition pour convenir d'un rendez-vous.`,
    `Bien à vous,\n${signature}`,
  ] : [
    prenom ? `Cher(e) ${prenom},` : 'Madame, Monsieur,',
    `Je vous prie de trouver ci-joint l'avis de valeur${lieu}.`,
    `Nous vous remercions de la confiance que vous nous témoignez et serions ravis de vous accompagner dans la commercialisation de votre bien, avec l'exigence et la discrétion qui caractérisent notre maison.`,
    `Je me tiens à votre disposition pour en échanger.`,
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

    // Signature = conseiller courant
    let signature = user.email;
    try {
      const { data: profile } = await supabaseAdmin.from('profiles').select('prenom, nom, fonction').eq('id', user.id).maybeSingle();
      if (profile) signature = [[profile.prenom, profile.nom].filter(Boolean).join(' '), profile.fonction].filter(Boolean).join(' — ') || signature;
    } catch { /* garde l'email */ }

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
      return json({ ok: true, preview: true, to, subject, bodyText, isPreAvis, mandantTrouve: !!cli?.email });
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

    return json({ ok: true, to, isPreAvis, subject });
  } catch (err) {
    console.error('[/api/avis-valeur/send-mandant] Erreur:', err);
    return json({ ok: false, error: 'Erreur serveur', detail: err.message }, 500);
  }
}
