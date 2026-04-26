
// ═══════════════════════════════════════════════════════════════════
// app/api/leads/estimation/route.js — VERSION FINALE v12.1
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
  const endpoint = '/api/leads/estimation';
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
    const typeBien = sanitizeString(body.type_bien, 100);
    const adresseBien = sanitizeString(body.adresse_bien, 500);
    const surface = sanitizeString(body.surface, 50);
    const nbPieces = sanitizeString(body.nb_pieces, 20);
    const messageEstimation = sanitizeString(body.message, 2000);

    if (!nom && !prenom) {
      await logCapture({ ip, endpoint, email, status: 'error', errorMessage: 'Nom requis' });
      return jsonResponse({ ok: false, error: 'Nom requis' }, 400);
    }

    if (!adresseBien) {
      await logCapture({ ip, endpoint, email, status: 'error', errorMessage: 'Adresse du bien requise' });
      return jsonResponse({ ok: false, error: 'Adresse du bien requise' }, 400);
    }

    const ownerInfo = await resolveOwner({ bienRef: null });

    const sourceDetail = {
      type_demande: 'estimation',
      formulaire: 'estimer_mon_bien',
      page_origine: sanitizeString(body.page_origine, 500),
      utm_source: sanitizeString(body.utm_source, 100),
      utm_medium: sanitizeString(body.utm_medium, 100),
      utm_campaign: sanitizeString(body.utm_campaign, 100),
      ip,
      user_agent: sanitizeString(request.headers.get('user-agent'), 500),
      bien_a_estimer: {
        type: typeBien,
        adresse: adresseBien,
        surface,
        nb_pieces: nbPieces,
      },
      received_at: new Date().toISOString(),
    };

    const { client, isNew } = await findOrCreateClient({
      email, prenom, nom, telephone,
      typeClient: 'Particuliers',
      sourceDetail,
      ownerId: ownerInfo.ownerId,
    });

    const resumeInteraction = `Demande d'estimation
Type de bien : ${typeBien || 'non précisé'}
Adresse : ${adresseBien}
Surface : ${surface || 'non précisée'}
Nombre de pièces : ${nbPieces || 'non précisé'}
${messageEstimation ? '\nMessage : ' + messageEstimation : ''}`;

    await createInteraction({
      clientId: client.id,
      type: 'lead_site_estimation',
      resume: resumeInteraction,
      metadata: {
        page_origine: sourceDetail.page_origine,
        bien_a_estimer: sourceDetail.bien_a_estimer,
        utm_source: sourceDetail.utm_source,
      },
      createdBy: ownerInfo.ownerId,
    });

    const ownerNotifId = isNew ? ownerInfo.ownerId : (client.owner || ownerInfo.ownerId);
    const titleNotif = isNew
      ? `Nouvelle estimation : ${prenom} ${nom}`
      : `${prenom} ${nom} demande une estimation`;
    const bodyNotif = `${typeBien || 'Bien'} à ${adresseBien}${surface ? ' · ' + surface + ' m²' : ''}`;

    await notifyOwner({
      ownerId: ownerNotifId,
      title: titleNotif,
      body: bodyNotif,
      linkUrl: `/clients/${client.id}`,
      metadata: { source: 'site_wordpress', type_demande: 'estimation', client_id: client.id },
    });

    await logCapture({ ip, endpoint, email, status: 'success' });

    return jsonResponse({
      ok: true, id: client.id, isNew,
      message: 'Demande d\'estimation enregistrée',
    }, 200);

  } catch (err) {
    console.error('[/api/leads/estimation] Erreur:', err);
    await logCapture({ ip, endpoint, email, status: 'error', errorMessage: err.message });
    return jsonResponse({ ok: false, error: 'Erreur serveur' }, 500);
  }
}
