
// ═══════════════════════════════════════════════════════════════════
// app/api/leads/interet-bien/route.js — VERSION FINALE v12.1
// → Assignation auto au commercial qui a le mandat (mandats.owner)
// ═══════════════════════════════════════════════════════════════════

import {
  verifyApiKey, checkHoneypot, checkRateLimit, validateEmail,
  findOrCreateClient, createInteraction, resolveOwner, notifyOwner,
  logCapture, extractIp, sanitizeString, sanitizePhone,
  jsonResponse, corsPreflightResponse,
} from '@/lib/leads-capture';

export async function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(request) {
  const ip = extractIp(request);
  const endpoint = '/api/leads/interet-bien';
  let email = null;

  try {
    const auth = verifyApiKey(request);
    if (!auth.ok) {
      await logCapture({ ip, endpoint, email, status: 'error', errorMessage: auth.error });
      return jsonResponse({ ok: false, error: auth.error }, auth.status);
    }

    let body;
    try { body = await request.json(); }
    catch (e) {
      await logCapture({ ip, endpoint, email, status: 'error', errorMessage: 'JSON invalide' });
      return jsonResponse({ ok: false, error: 'JSON invalide' }, 400);
    }

    const honeypot = checkHoneypot(body);
    if (honeypot.isBot) {
      await logCapture({ ip, endpoint, email, status: 'spam_honeypot' });
      return jsonResponse({ ok: true, id: 'noop' }, 200);
    }

    email = sanitizeString(body.email, 200);
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      await logCapture({ ip, endpoint, email, status: 'spam_email', errorMessage: emailCheck.reason });
      return jsonResponse({ ok: false, error: emailCheck.reason }, 400);
    }
    email = emailCheck.email;

    const rateLimit = await checkRateLimit(ip);
    if (!rateLimit.allowed) {
      await logCapture({ ip, endpoint, email, status: 'spam_rate_limit', errorMessage: rateLimit.message });
      return jsonResponse({ ok: false, error: 'Trop de requêtes, réessayez dans quelques minutes' }, 429);
    }

    const prenom = sanitizeString(body.prenom, 100);
    const nom = sanitizeString(body.nom, 100);
    const telephone = sanitizePhone(body.telephone);
    const message = sanitizeString(body.message, 2000);
    const bienRef = sanitizeString(body.bien_ref, 50);

    if (!nom && !prenom) {
      await logCapture({ ip, endpoint, email, status: 'error', errorMessage: 'Nom requis' });
      return jsonResponse({ ok: false, error: 'Nom requis' }, 400);
    }

    if (!bienRef) {
      await logCapture({ ip, endpoint, email, status: 'error', errorMessage: 'Référence bien requise' });
      return jsonResponse({ ok: false, error: 'Référence du bien requise' }, 400);
    }

    const ownerInfo = await resolveOwner({ bienRef });

    const sourceDetail = {
      type_demande: 'interet_bien',
      formulaire: 'fiche_bien',
      bien_ref: bienRef,
      mandat_id: ownerInfo.mandatId,
      page_origine: sanitizeString(body.page_origine, 500),
      utm_source: sanitizeString(body.utm_source, 100),
      utm_medium: sanitizeString(body.utm_medium, 100),
      utm_campaign: sanitizeString(body.utm_campaign, 100),
      ip,
      user_agent: sanitizeString(request.headers.get('user-agent'), 500),
      received_at: new Date().toISOString(),
    };

    const { client, isNew } = await findOrCreateClient({
      email, prenom, nom, telephone,
      typeClient: 'Particuliers',
      sourceDetail,
      ownerId: ownerInfo.ownerId,
    });

    const resumeInteraction = `Intérêt sur le bien ${bienRef}${ownerInfo.mandatTitre ? ' (' + ownerInfo.mandatTitre + ')' : ''}
${message ? '\nMessage : ' + message : ''}`;

    await createInteraction({
      clientId: client.id,
      type: 'lead_site_interet_bien',
      resume: resumeInteraction,
      metadata: {
        bien_ref: bienRef,
        mandat_id: ownerInfo.mandatId,
        page_origine: sourceDetail.page_origine,
        utm_source: sourceDetail.utm_source,
      },
      createdBy: ownerInfo.ownerId,
    });

    const ownerNotifId = isNew ? ownerInfo.ownerId : (client.owner || ownerInfo.ownerId);
    const titleNotif = `Intérêt bien ${bienRef} : ${prenom} ${nom}`;
    const bodyNotif = ownerInfo.mandatTitre
      ? `Sur ${ownerInfo.mandatTitre}${message ? ' — ' + message.slice(0, 80) : ''}`
      : (message ? message.slice(0, 100) : 'Demande de contact reçue');

    await notifyOwner({
      ownerId: ownerNotifId,
      title: titleNotif,
      body: bodyNotif,
      linkUrl: `/clients/${client.id}`,
      metadata: {
        source: 'site_wordpress',
        type_demande: 'interet_bien',
        client_id: client.id,
        bien_ref: bienRef,
        mandat_id: ownerInfo.mandatId,
        assignment_reason: ownerInfo.reason,
      },
    });

    if (!ownerInfo.mandatId && ownerInfo.reason === 'director_fallback') {
      console.warn(`[interet-bien] Bien ref "${bienRef}" introuvable, fallback directeur`);
    }

    await logCapture({ ip, endpoint, email, status: 'success' });

    return jsonResponse({
      ok: true, id: client.id, isNew,
      bien_ref: bienRef,
      mandat_found: !!ownerInfo.mandatId,
      message: 'Intérêt enregistré',
    }, 200);

  } catch (err) {
    console.error('[/api/leads/interet-bien] Erreur:', err);
    await logCapture({ ip, endpoint, email, status: 'error', errorMessage: err.message });
    return jsonResponse({ ok: false, error: 'Erreur serveur' }, 500);
  }
}
