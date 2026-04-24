import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 30;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { transcript, existingMandats, existingClients } = await request.json();

    if (!transcript || transcript.trim().length < 10) {
      return NextResponse.json({ error: 'Transcription trop courte' }, { status: 400 });
    }

    // Index simplifié pour contexte (optionnel)
    const mandatsIndex = (existingMandats || []).map(m => ({
      id: m.id, label: `${m.nom || ''} — ${m.adresse || ''}`.trim()
    })).slice(0, 50);
    const clientsIndex = (existingClients || []).map(c => ({
      id: c.id, label: `${c.prenom || ''} ${c.nom} — ${c.societe || ''}`.trim()
    })).slice(0, 50);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const todayDayName = dayNames[today.getDay()];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `Tu es l'assistant d'un courtier en immobilier d'investissement. On te donne une note vocale qu'il vient de dicter. Analyse-la et détermine de quoi il s'agit.

NOTE VOCALE :
"""
${transcript}
"""

CONTEXTE DATE : Aujourd'hui est ${todayDayName} ${todayStr}.

MANDATS EXISTANTS (pour lier éventuellement des tâches) :
${mandatsIndex.length ? mandatsIndex.map(m => `- ${m.id} — ${m.label}`).join('\n') : '(aucun)'}

CLIENTS EXISTANTS :
${clientsIndex.length ? clientsIndex.map(c => `- ${c.id} — ${c.label}`).join('\n') : '(aucun)'}

TÂCHE :
Détermine le mode principal de cette note vocale et retourne UNIQUEMENT un objet JSON valide (pas de markdown) avec cette structure :

{
  "mode": "taches" | "reunion_recurrente" | "compte_rendu" | "note_libre",
  "confidence": "high" | "medium" | "low",
  "summary": "Phrase courte décrivant ce que tu as identifié",
  
  "taches": [
    {
      "titre": "titre court de la tâche",
      "priorite": "Haute" | "Moyenne" | "Basse",
      "dateEcheance": "YYYY-MM-DD",
      "assignee": "prénom de la personne ou null si pour l'utilisateur",
      "lien_type": "mandat" | "client" | null,
      "lien_id": "id ou null",
      "contexte": "note courte optionnelle"
    }
  ],
  
  "reunionRecurrente": {
    "titre": "Nom de la réunion",
    "description": "string ou null",
    "frequence": "Hebdomadaire" | "Bi-hebdomadaire" | "Mensuelle",
    "jourSemaine": 0-6 (0=dimanche, 1=lundi...) ou null si mensuel,
    "jourMois": 1-31 ou null si hebdomadaire,
    "heure": "HH:MM" (format 24h),
    "dureeMinutes": number (défaut 60),
    "lieu": "string ou null",
    "participants": ["prénom1", "prénom2"]
  },
  
  "compteRendu": {
    "titre": "Titre synthétique de la réunion",
    "participants": ["prénom1", "prénom2"],
    "decisions": ["décision 1", "décision 2"],
    "contenu": "résumé narratif complet de la réunion en 3-5 phrases",
    "actions": [
      {
        "titre": "action à faire",
        "assignee": "prénom ou null",
        "priorite": "Haute" | "Moyenne" | "Basse",
        "dateEcheance": "YYYY-MM-DD"
      }
    ]
  },
  
  "noteLibre": {
    "titre": "Titre court résumant la note",
    "contenu": "contenu narratif complet"
  }
}

RÈGLES :

1. **MODE "taches"** : la note est une liste d'actions à faire
   Exemples : "Faut que je rappelle Durand demain, que je prépare la fiche Penthièvre..."
   → Rempli le champ "taches" UNIQUEMENT, les autres à null
   → Calcule les dates relatives (demain = ${new Date(today.getTime() + 86400000).toISOString().split('T')[0]}, après-demain = ${new Date(today.getTime() + 2*86400000).toISOString().split('T')[0]}, "la semaine prochaine" = lundi prochain, "vendredi" = prochain vendredi...)
   → Détecte les assignations : "Sophie s'occupe de...", "Pierre doit...", "pour Pierre..." → assignee = "Sophie" ou "Pierre"
   → Priorité Haute si urgent/important, Moyenne par défaut

2. **MODE "reunion_recurrente"** : la note décrit un événement qui se répète
   Exemples : "Réunion équipe tous les mardis à 11h", "Point mensuel le 15 du mois à 9h"
   → Rempli "reunionRecurrente" UNIQUEMENT
   → jourSemaine : 0=dimanche, 1=lundi, 2=mardi, 3=mercredi, 4=jeudi, 5=vendredi, 6=samedi

3. **MODE "compte_rendu"** : la note est un compte-rendu de réunion passée
   Exemples : "Point avec Thomas ce matin, on a décidé de X, Sophie s'occupe de Y..."
   → Rempli "compteRendu" (incluant les actions issues du compte-rendu)
   → TOUTES les actions décidées deviennent des entrées dans compteRendu.actions

4. **MODE "note_libre"** : juste une idée ou pensée sans action directe
   → Rempli "noteLibre" UNIQUEMENT

5. ASSIGNATION : Quand un prénom est mentionné comme responsable d'une action (Pierre, Sophie, Thomas, etc.), mets-le dans "assignee". Si la tâche est pour l'utilisateur lui-même (je dois..., faut que je...), assignee = null.

6. CHAMPS VIDES : Les sections non utilisées doivent être à null ou tableau vide [].

Réponds UNIQUEMENT avec le JSON.`
      }]
    });

    const text = response.content.map(b => b.type === 'text' ? b.text : '').join('').trim();
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Erreur analyse global voice:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur analyse' },
      { status: 500 }
    );
  }
}
