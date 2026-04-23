import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60; // Vercel : 60s max pour l'analyse

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
    "type": "Immeubles | Hotels | Résidentiel | Terrains | Parking | Locaux commerciaux | null",
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
  "highlights": ["point important 1", "point important 2"]
}

RÈGLES :
- null pour tout champ absent. Ne devine JAMAIS.
- alerts.critical : contentieux, vacance forte, travaux lourds non budgétés, indivision, préemption, servitudes
- alerts.warning : rendement incohérent, DPE mauvais, travaux à prévoir, baux bientôt expirés, TF élevée
- alerts.info : bail long, enseigne nationale, emplacement premium
- highlights : 3-6 atouts commerciaux
- Si prix et loyers présents, vérifie la cohérence du rendement (écart >0.3 pt = warning)
- Calcule prix/m² si surface et prix présents

Réponds UNIQUEMENT avec le JSON.`
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
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
