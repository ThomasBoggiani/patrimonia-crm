import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 30;

export async function POST(request) {
  try {
    const { transcript, existingClients } = await request.json();

    if (!transcript || transcript.trim().length < 10) {
      return NextResponse.json({ error: 'Transcription trop courte' }, { status: 400 });
    }

    // On prépare un index minimal des clients existants pour la détection de doublons
    const clientIndex = (existingClients || []).map(c => ({
      id: c.id,
      label: `${c.prenom || ''} ${c.nom} — ${c.societe || 'sans société'}`.trim()
    }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Tu es l'assistant d'un courtier en immobilier d'investissement. Voici une note vocale qu'il a dictée après un échange avec un acquéreur (RDV, appel, email reçu…).

NOTE VOCALE :
"""
${transcript}
"""

CLIENTS EXISTANTS DANS LE CRM (id — libellé) :
${clientIndex.length ? clientIndex.map(c => `- ${c.id} — ${c.label}`).join('\n') : '(aucun client pour l\'instant)'}

TÂCHE :
Tu dois analyser cette note et retourner UNIQUEMENT un objet JSON valide (pas de markdown, pas de texte avant/après) avec cette structure :

{
  "action": "create" | "update",
  "matchedClientId": "id ou null",
  "matchConfidence": "high | medium | low | null",
  "fields": {
    "nom": "string ou null",
    "prenom": "string ou null",
    "societe": "string ou null",
    "tel": "string ou null",
    "email": "string ou null",
    "typologie": "Foncières | Marchands de biens | Particuliers | Fonds | Promoteurs | Family Office | null",
    "budgetMin": number ou null,
    "budgetMax": number ou null,
    "rendementMin": number ou null,
    "zones": ["Paris" | "IDF" | "France" | "Europe"],
    "typologiesRecherchees": ["Immeubles" | "Hotels" | "Résidentiel" | "Terrains" | "Parking" | "Locaux commerciaux"],
    "maturite": "Haute | Moyen | Basse | null",
    "origine": "Apporteur | Salon | Pub | Mandant | Site web | Autre | null"
  },
  "interaction": {
    "type": "Appel | Email | Rendez-vous | Visite | Message",
    "resume": "string court (1-2 phrases)",
    "nextStep": "string ou null",
    "dateNextStep": "YYYY-MM-DD ou null"
  },
  "summary": "Phrase courte résumant ce qui a été fait (ex: 'Nouvelle fiche créée pour Philippe Durand, 3 champs détectés' ou 'Fiche existante enrichie avec une nouvelle interaction')"
}

RÈGLES IMPORTANTES :
1. DÉTECTION DE DOUBLON : si le nom/prénom/société de la note correspond à un client existant, mets "action":"update" et "matchedClientId" avec son id.
   - "high" = nom ET société identiques
   - "medium" = nom identique seulement
   - "low" = juste similaire
2. EXTRACTION : mets "null" pour tout champ non mentionné. Ne devine JAMAIS.
3. BUDGETS : convertis toujours en euros. "5 à 15 millions" → budgetMin: 5000000, budgetMax: 15000000.
4. ZONES : mappe intelligemment. "Paris 8e, 16e, 17e" → ["Paris"]. "Ile-de-France" → ["IDF"]. "toute la France" → ["France"].
5. INTERACTION : TOUJOURS remplir cette section. Par défaut type="Appel", date du jour.
6. PROCHAINE ÉTAPE : si la note mentionne "rappeler la semaine prochaine", "prévoir une visite", etc., remplis nextStep + dateNextStep (calcule la date par rapport à aujourd'hui ${new Date().toISOString().split('T')[0]}).
7. MATURITÉ : "décision rapide", "urgent", "prêt à signer" → Haute. "en réflexion", "veut y réfléchir" → Moyen. "juste curieux" → Basse.

Réponds UNIQUEMENT avec le JSON.`
      }]
    });

    const text = response.content.map(b => b.type === 'text' ? b.text : '').join('').trim();
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Erreur analyse vocale:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur analyse' },
      { status: 500 }
    );
  }
}
