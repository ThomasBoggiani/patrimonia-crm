
// ═══════════════════════════════════════════════════════════════════
// app/api/leads/alerte/route.js — VERSION FINALE v12.1
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
  const endpoint = '/api/leads/alerte';
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

    const typesActifs = Array.isArray(body.types_actifs)
      ? body.types_actifs.map((t) => sanitizeString(t, 100)).filter(Boolean).slice(0, 13)
      : [];
    const zones = Array.isArray(body.zones)
      ? body.zones.map((z) => sanitizeString(z, 50)).filter(Boolean).slice(0, 21)
      : [];
    const budgetMin = parseInt(body.budget_min, 10) || null;
    const budgetMax = parseInt(body.budget_max, 10) || null;

    const ownerInfo = await resolveOwner({ bienRef: null });

    const sourceDetail = {
      type_demande: 'alerte',
      formulaire: 'inscription_alertes',
      criteres: {
        types_actifs: typesActifs,
        zones,
        budget_min: budgetMin,
        budget_max: budgetMax,
      },
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

    const resumeInteraction = `Inscription aux alertes nouveaux biens
${typesActifs.length ? 'Types : ' + typesActifs.join(', ') : ''}
${zones.length ? 'Zones : ' + zones.join(', ') : ''}
${budgetMin || budgetMax ? `Budget : ${budgetMin || '?'} - ${budgetMax || '?'} €` : ''}`;

    await createInteraction({
      clientId: client.id,
      type: 'lead_site_alerte',
      resume: resumeInteraction,
      metadata: sourceDetail.criteres,
      createdBy: ownerInfo.ownerId,
    });

    // Pour les alertes, on ne notifie qu'à la première inscription
    if (isNew) {
      await notifyOwner({
        ownerId: ownerInfo.ownerId,
        title: `Nouvelle inscription alertes : ${prenom} ${nom}`,
        body: `${typesActifs.length ? typesActifs.join(', ') : 'Tous types'}${zones.length ? ' · ' + zones.slice(0, 3).join(', ') : ''}`,
        linkUrl: `/clients/${client.id}`,
        metadata: { source: 'site_wordpress', type_demande: 'alerte', client_id: client.id },
      });
    }

    await logCapture({ ip, endpoint, email, status: 'success' });

    return jsonResponse({
      ok: true, id: client.id, isNew,
      message: 'Inscription enregistrée',
    }, 200);

  } catch (err) {
    console.error('[/api/leads/alerte] Erreur:', err);
    await logCapture({ ip, endpoint, email, status: 'error', errorMessage: err.message });
    return jsonResponse({ ok: false, error: 'Erreur serveur' }, 500);
  }
}
