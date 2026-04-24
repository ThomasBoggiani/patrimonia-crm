import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { text, existingMandats, existingClients } = await request.json();

    if (!text || text.trim().length < 20) {
      return NextResponse.json({ error: 'Contenu trop court pour être analysé' }, { status: 400 });
    }

    // Index simplifié pour détection de doublon
    const mandatsIndex = (existingMandats || []).map(m => ({
      id: m.id,
      label: `${m.nom || ''} — ${m.adresse || ''} ${m.ville || ''}`.trim()
    })).slice(0, 100); // limite pour pas surcharger le prompt
    
    const clientsIndex = (existingClients || []).map(c => ({
      id: c.id,
      label: `${c.prenom || ''} ${c.nom} — ${c.societe || ''}`.trim()
    })).slice(0, 100);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3500,
      messages: [{
        role: 'user',
        content: `Tu es l'assistant d'un courtier en immobilier d'investissement. On te donne un contenu textuel venant potentiellement de sources diverses : conversation ChatGPT, email reçu, note de réunion, fiche document, compte-rendu de visite, etc.

CONTENU À ANALYSER :
"""
${text.slice(0, 20000)}
"""

MANDATS EXISTANTS DANS LE CRM (id — libellé) :
${mandatsIndex.length ? mandatsIndex.map(m => `- ${m.id} — ${m.label}`).join('\n') : '(aucun mandat)'}

CLIENTS EXISTANTS DANS LE CRM (id — libellé) :
${clientsIndex.length ? clientsIndex.map(c => `- ${c.id} — ${c.label}`).join('\n') : '(aucun client)'}

TÂCHE :
Détermine si ce contenu concerne PRINCIPALEMENT un bien immobilier (mandat) OU un acquéreur/investisseur (client), ou BIEN les deux.

Retourne UNIQUEMENT un objet JSON valide (pas de markdown, pas de texte avant/après) avec cette structure :

{
  "primaryType": "mandat" | "client" | "both" | "unclear",
  "confidence": "high" | "medium" | "low",
  "summary": "Phrase courte décrivant ce que tu as identifié (ex: 'Note sur le 12 rue de la Paix — Immeuble vendu par Foncière Durand')",
  
  "mandat": {
    "action": "create" | "update" | "none",
    "matchedId": "id ou null",
    "matchConfidence": "high | medium | low | null",
    "fields": {
      "nom": "string ou null",
      "adresse": "string ou null",
      "ville": "string ou null",
      "type": "Immeuble d'habitation | Immeuble mixte | Immeuble tertiaire | Local commercial | Local d'activité | Hôtel | Hébergement hôtelier | Appartement | Maison | Studio | Terrain | Bureau | Promotion immobilière | null",
      "prix": number ou null,
      "prixM2": number ou null,
      "surface": number ou null,
      "loyersAnnuels": number ou null,
      "rendement": number ou null,
      "nbLots": number ou null,
      "contact": "string ou null",
      "tel": "string ou null",
      "description": "string courte (2-3 phrases) ou null",
      "commercialisation": "Off-market | Mandat exclusif | Mandat simple | null"
    },
    "alerts": [
      { "type": "critical | warning | info", "title": "titre court", "message": "explication" }
    ],
    "highlights": ["atout 1", "atout 2"]
  },
  
  "client": {
    "action": "create" | "update" | "none",
    "matchedId": "id ou null",
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
      "zones": ["Paris 3e" | "Paris 4e" | "Paris 8e" | "Paris 9e" | "Paris 10e" | "Paris 11e" | "Paris 13e" | "Paris 15e" | "Paris 16e" | "Paris 17e" | "Paris 18e" | "Paris 19e" | "Paris 20e" | "Hauts-de-Seine (92)" | "Seine-Saint-Denis (93)" | "Val-de-Marne (94)" | "Val-d'Oise (95)" | "Yvelines (78)" | "Seine-et-Marne (77)" | "Essonne (91)" | "Province"],
      "typologiesRecherchees": ["Immeuble d'habitation" | "Immeuble mixte" | "Immeuble tertiaire" | "Local commercial" | "Local d'activité" | "Hôtel" | "Hébergement hôtelier" | "Appartement" | "Maison" | "Studio" | "Terrain" | "Bureau" | "Promotion immobilière"],
      "maturite": "Haute | Moyen | Basse | null",
      "origine": "Apporteur | Salon | Pub | Mandant | Site web | Autre | null"
    },
    "interaction": {
      "type": "Appel | Email | Rendez-vous | Visite | Message",
      "resume": "1-2 phrases résumant l'échange",
      "nextStep": "string ou null",
      "dateNextStep": "YYYY-MM-DD ou null"
    }
  },
  
  "actions": [
    { "titre": "action concrète à mener", "priorite": "Haute | Moyenne | Basse", "echeanceJours": number, "motif": "pourquoi", "linkedTo": "mandat | client" }
  ]
}

RÈGLES IMPORTANTES :

1. PRIMARY TYPE :
   - "mandat" : le contenu parle principalement d'un BIEN (adresse, prix, surface, baux)
   - "client" : le contenu parle principalement d'un ACQUÉREUR/INVESTISSEUR (personne/société avec budget, critères)
   - "both" : le contenu décrit clairement les deux (ex: "discussion avec M. Durand au sujet du 12 rue de la Paix")
   - "unclear" : on ne peut rien extraire d'utile → explique dans summary

2. DÉTECTION DE DOUBLONS :
   - Compare noms, adresses, sociétés avec les listes existantes
   - "high" = correspondance très probable (nom+contexte identiques)
   - "medium" = correspondance probable
   - "low" = simple similarité
   - Si action="update", le matchedId DOIT être rempli
   
3. EXTRACTION :
   - null pour tout champ absent. Ne devine JAMAIS.
   - Budgets en euros : "5 à 15M" → 5000000 / 15000000
   - Si les deux types sont présents, remplis les deux sections

4. SI primaryType="client" OU "both", remplir l'interaction :
   - Par défaut type="Email" si le contenu ressemble à un email reçu, sinon "Appel" ou "Rendez-vous"
   - resume = 1-2 phrases clés
   - Si "rappeler la semaine prochaine" → nextStep + dateNextStep (date du jour + X jours)

5. ACTIONS AUTOMATIQUES :
   - Propose 2-5 actions de suivi basées sur ce qui manque ou est critique
   - Haute priorité (3j) : infos bloquantes (contact propriétaire, contentieux)
   - Moyenne priorité (7j) : infos utiles (DPE, baux, TF)
   - Basse priorité (14j) : compléments
   - linkedTo : "mandat" ou "client" selon à qui s'applique l'action
   - Si action="none" pour les deux, n'ajoute AUCUNE action

6. DATES : aujourd'hui est ${new Date().toISOString().split('T')[0]}. Calcule les échéances par rapport à cette date.

Réponds UNIQUEMENT avec le JSON.`
      }]
    });

    const text_response = response.content.map(b => b.type === 'text' ? b.text : '').join('').trim();
    const cleaned = text_response.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Erreur smart-import:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur analyse' },
      { status: 500 }
    );
  }
}
