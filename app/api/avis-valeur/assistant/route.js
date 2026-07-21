// ═══════════════════════════════════════════════════════════════════
// app/api/avis-valeur/assistant/route.js
// Assistant de l'avis : transforme un ORDRE ORAL de l'agent en ajustements
// de valorisation structurés (± % sur le prix au m²), positionnement et
// recommandation. Ne persiste rien : le front applique dans l'éditeur.
// Ex : « exposition mauvaise, c'est bruyant, on se positionne en dessous »
//   → [{label:'Exposition défavorable',pct:-5},{label:'Nuisances sonores',pct:-4}]
// ═══════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : user;
}

const SYSTEM = `Tu es l'assistant d'estimation d'une agence immobilière (Immeubles & Patrimoine).
L'agent te donne une instruction en langage naturel pour AJUSTER la valorisation d'un bien.
Traduis-la en ajustements chiffrés cohérents.

Règles :
- Chaque facteur mentionné devient un ajustement { "label": court, "pct": nombre } où pct est un pourcentage appliqué au prix au m².
- pct NÉGATIF pour une décote (exposition défavorable, bruit, 1er étage, travaux à prévoir, charges élevées, marché baissier…), POSITIF pour une surcote (rénovation par architecte renommé, prestations d'exception, vue, calme, étage élevé, terrasse…).
- Magnitudes réalistes : entre 2 % et 12 % par facteur (exceptionnellement 15 %).
- Si l'agent donne un pourcentage explicite, respecte-le.
- "positionnement" : phrase courte de positionnement prix (ex : "à positionner légèrement sous le marché", "au-dessus du marché, bien d'exception").
- "recommandation" : 1 à 2 phrases de recommandation reprenant l'esprit de l'instruction (facultatif).
- "resume" : une phrase très courte décrivant ce que tu as fait.
- N'invente pas de facteurs non évoqués. Si l'instruction ne parle pas de prix, ajustements = [].

Réponds UNIQUEMENT en JSON valide, sans backticks :
{"ajustements":[{"label":"","pct":0}],"positionnement":"","recommandation":"","resume":""}`;

export async function POST(request) {
  try {
    const { token, transcript, context = {} } = await request.json();
    const user = await verifyToken(token);
    if (!user) return Response.json({ ok: false, error: 'Authentification requise' }, { status: 401 });
    if (!transcript || String(transcript).trim().length < 3) return Response.json({ ok: false, error: 'Instruction vide.' }, { status: 400 });

    const ctx = [
      context.type && `Type : ${context.type}`,
      context.surface && `Surface : ${context.surface} m²`,
      context.prixMarche && `Prix de marché de référence : ${context.prixMarche} €`,
      context.prixM2 && `Prix au m² actuel : ${context.prixM2} €/m²`,
      Array.isArray(context.ajustementsActuels) && context.ajustementsActuels.length
        && `Ajustements déjà posés : ${context.ajustementsActuels.map(a => `${a.label} ${a.pct}%`).join(', ')}`,
    ].filter(Boolean).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Contexte du bien :\n${ctx || '(peu d\'informations)'}\n\nInstruction de l'agent :\n« ${String(transcript).slice(0, 2000)} »` }],
    });

    const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    let j;
    try { j = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()); }
    catch { return Response.json({ ok: false, error: "L'assistant n'a pas renvoyé un résultat exploitable." }, { status: 502 }); }

    const ajustements = Array.isArray(j.ajustements) ? j.ajustements
      .map(a => ({ label: String(a.label || '').slice(0, 60), pct: Math.max(-30, Math.min(30, Math.round(parseFloat(a.pct) || 0))) }))
      .filter(a => a.label && a.pct !== 0) : [];

    return Response.json({
      ok: true,
      ajustements,
      positionnement: typeof j.positionnement === 'string' ? j.positionnement.trim() : '',
      recommandation: typeof j.recommandation === 'string' ? j.recommandation.trim() : '',
      resume: typeof j.resume === 'string' ? j.resume.trim() : '',
      transcript,
    });
  } catch (e) {
    console.error('[avis-valeur/assistant]', e);
    return Response.json({ ok: false, error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}
