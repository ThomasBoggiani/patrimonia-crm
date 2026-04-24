import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60; // Vercel : 60s max pour l'analyse
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { files } = await request.json();
    // files = [{ name, type, data (base64) }, ...]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Construction du content multimodal
    const content = [];
    for (const file of files) {
      if (file.type === 'application/pdf') {
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: file.data }
        });
      } else if (file.type.startsWith('image/')) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: file.type, data: file.data }
        });
      } else {
        // DOCX, TXT : décodage base64 → texte
        const text = Buffer.from(file.data, 'base64').toString('utf-8');
        content.push({ type: 'text', text: `Document : ${file.name}\n\n${text}` });
      }
    }

    content.push({
      type: 'text',
      text: `Tu es un expert en immobilier d'investissement. Analyse le(s) dossier(s) ci-dessus (fiche immeuble, dossier commercial, plaquette, baux…) et extrais les informations pour créer une fiche de mandat.

Retourne UNIQUEMENT un objet JSON valide (pas de markdown, pas de texte avant/après) avec cette structure exacte :

{
  "fields": {
    "nom": "string ou null",
    "adresse": "string ou null",
    "ville": "string ou null",
    "type": "Immeuble d'habitation | Immeuble mixte | Immeuble tertiaire | Local commercial | Local d'activité | Hôtel | Hébergement hôtelier | Appartement | Maison | Studio | Terrain | Bureau | Promotion immobilière | null",
    "sousType": "string ou null",
    "prix": number ou null,
    "prixM2": number ou null,
    "surface": number ou null,
    "loyersAnnuels": number ou null,
    "rendement": number ou null,
    "nbLots": number ou null,
    "contact": "string ou null",
    "tel": "string ou null",
    "description": "string courte (3-4 phrases) ou null"
  },
  "alerts": [
    { "type": "warning | info | critical", "title": "titre court", "message": "explication courte" }
  ],
  "highlights": ["point important 1", "point important 2"],
  "actions": [
    { "titre": "action à mener", "priorite": "Haute | Moyenne | Basse", "echeanceJours": number, "motif": "pourquoi cette action" }
  ]
}

RÈGLES :
- null pour tout champ absent. Ne devine JAMAIS.
- alerts.critical : contentieux, vacance forte, travaux lourds non budgétés, indivision, préemption, servitudes
- alerts.warning : rendement incohérent, DPE mauvais, travaux à prévoir, baux bientôt expirés, TF élevée
- alerts.info : bail long, enseigne nationale, emplacement premium
- highlights : 3-6 atouts commerciaux
- Si prix et loyers présents, vérifie la cohérence du rendement (écart >0.3 pt = warning)
- Calcule prix/m² si surface et prix présents

RÈGLES POUR "actions" (TRÈS IMPORTANT) :
Génère des tâches concrètes à faire par le courtier pour COMPLÉTER les informations manquantes ou CONFIRMER les points d'attention. Pour chaque champ critique absent ou alerte, propose une action avec :
- titre : phrase d'action claire (ex : "Demander le montant de la taxe foncière au propriétaire", "Vérifier la date d'échéance des baux commerciaux", "Obtenir le DPE à jour")
- priorite : "Haute" pour les infos bloquantes commercialisation (prix, contact propriétaire, baux, contentieux) ; "Moyenne" pour infos utiles (DPE, TF, travaux) ; "Basse" pour compléments (photos, plans)
- echeanceJours : nombre de jours à partir d'aujourd'hui pour traiter l'action (3 pour Haute, 7 pour Moyenne, 14 pour Basse)
- motif : 1 phrase expliquant pourquoi cette action est nécessaire

Propose entre 3 et 8 actions maximum, uniquement les plus pertinentes. Une action par info critique manquante.

EXEMPLES D'ACTIONS TYPIQUES :
- "Demander le contact direct du propriétaire" si contact manquant
- "Obtenir les baux commerciaux signés" si nb lots commerciaux > 0 mais détails baux manquants
- "Vérifier la date d'échéance des baux" si loyers connus mais dates non
- "Demander la taxe foncière des 2 dernières années" si TF manquante
- "Obtenir le DPE et audit énergétique" si mentions mais pas de valeur
- "Clarifier la situation d'indivision" si alerte critique indivision
- "Organiser une visite du bien" systématiquement si off-market nouveau
- "Demander la liste des travaux réalisés récemment" si travaux mentionnés sans détail
- "Vérifier l'absence de préemption" pour biens à Paris

Réponds UNIQUEMENT avec le JSON.`
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content }]
    });

    const text = response.content.map(b => b.type === 'text' ? b.text : '').join('').trim();
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Erreur analyse:', error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de l'analyse" },
      { status: 500 }
    );
  }
}
