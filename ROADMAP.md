# 🗺️ ROADMAP — PATRIMONIA CRM

> **Document de référence** à coller en début de chaque session avec Claude pour reprendre le travail au bon endroit.

---

## 🎯 Vision produit à 12 mois

Outil central d'Immeubles & Patrimoine. Construit proprement dès maintenant pour évoluer.

**Cibles à 12 mois** :
- 300 mandats actifs
- 400-500 clients qualifiés
- Équipe interne (commerciaux, direction, assistantes)
- Possibilité d'ouverture externe : portails mandants + accès premium acquéreurs qualifiés

**5 features cœur** :
1. **Base Mandats** propre, complète, centralisée (source unique de vérité)
2. **Base Acquéreurs/Clients** séparée (recherche, critères, profil, historique, motivations)
3. **Matching auto Mandats ↔ Acquéreurs** = CŒUR DU CRM, distinct des Deals
4. **Création/enrichissement client ultra rapide** (WhatsApp, vocal, dictée, IA qualifiante)
5. **Envoi sans friction** de docs/questionnaires/plaquettes/relances

**B2B ET B2C** dès maintenant.

**IA = copilote** (créer, analyser, détecter manquants, matcher, qualifier, générer, vérifier qualité).

**Pas en production** → on peut casser/refaire sans rétrocompatibilité.

---

## 🗂️ Plan en 8 sprints / 4 phases

### Phase I — Fondations
- ✅ **Sprint 1** : Schema clean + RLS + .env.example + nettoyage initial
- 🟡 **Sprint 2** : Convention de code unique + nettoyage code mort
- 🟡 **Sprint 3** : Refonte modèle de données contacts (mandants ↔ acquéreurs unifiés)

### Phase II — Refonte des 3 entités cœur
- 🟡 **Sprint 4** : Fiche Mandat refondue (source unique de vérité)
- 🟡 **Sprint 5** : Fiche Client refondue (avec recherche, historique, motivations)
- 🟡 **Sprint 6** : Matching ≠ Deals (séparation propre, algorithme unique)

### Phase III — Vitesse & IA
- 🟡 **Sprint 7** : Création client ultra-rapide (vocal/WhatsApp/dictée) + IA qualifiante
- 🟡 **Sprint 8** : Documents & envois sans friction

### Phase IV — Post-MEP (à planifier)
- Portails mandants & acquéreurs premium

---

## 📜 Décisions prises (à respecter dans tous les sprints)

| # | Décision | Conséquence |
|---|----------|-------------|
| D1 | Visibilité **ouverte** : tous les commerciaux voient tout | Policies RLS "Authenticated full access" sur mandats/clients/deals/etc. |
| D2 | Casse `role` : **CapitalCase** (`'Admin'`, `'Commercial'`, `'Directeur'`) | CHECK constraint en BDD. Code à aligner en S2. |
| D3 | Marché B2B/B2C : minuscules (`'b2b'`, `'b2c'`) | CHECK constraint en BDD. |
| D4 | Pas de FK polymorphique stricte (todos.lien_id, questionnaires.imported_id) | À revoir éventuellement en S3 ou S4. |
| D5 | Tables IA : 3 tables existantes (`ai_conversations`, `client_ai_conversations`, `client_analyses`) — à unifier au S3 ou S4 | Pour l'instant on garde. |
| D6 | Tables annexes (`campagnes`, `annonces`, `questionnaires`) : on garde toutes au S1 | `annonces` deviendra "Diffusion OTA". `campagnes` à rediscuter. `questionnaires` à refondre au S8. |
| D7 | Colonnes legacy mandats (`photos`, `docs`) : on garde au S1 | Migration propre au S4 (refonte mandat). |
| D8 | `mandats.alerts` : on garde | Utilisée par PDF et fiche mandat. |
| D9 | `mandats.owner` et `clients.owner` (text 2 lettres) : à fusionner avec `profile_id` UUID en S3 ou S2 | Pour l'instant on garde, mais plus de DEFAULT 'JD'. |
| D10 | Convention casing JavaScript : à décider en **S2** | Le code mélange aujourd'hui camelCase et snake_case. |
| D11 | github.dev bug : drop `<a` au copier-coller JSX | Toujours vérifier manuellement après paste de JSX. |

---

## ✅ Sprint 1 — TERMINÉ

**Objectif** : Base technique propre, sûre, documentée.

### Critères "fini" — tous validés ✅
- [x] Schema BDD aligné avec la réalité (vu via information_schema)
- [x] `.env.example` complet (16 variables documentées)
- [x] RLS activée + policies définies (était déjà activée, contrairement à mon audit initial)
- [x] Tables/colonnes mortes supprimées

### Livrables réalisés

#### 1.1 Inventaire BDD ✅
24 tables + 1 vue inventoriées. FK majoritairement présentes (audit initial erroné). RLS activée partout.

#### 1.2 Migration BDD ✅
- Corrections données :
  - `clients.marche` : `B2C` → `b2c`
  - `clients.maturite` : `Avancé`/`Chaud`/`Haute` → `Élevé`
  - `todos.statut` : `Termine` → `Terminé`
  - `profiles.photo_url` migrés vers `avatar_url`
- DROP tables : `mandat_chats`, `microsoft_tokens`
- DROP defaults `'JD'` sur `mandats.owner` et `clients.owner`
- DROP colonne `profiles.photo_url`
- ADD 10 CHECK constraints sur les enums (statuts, marchés, maturité, priorités, rôles)
- FIX policy `leads_capture_log` : `'admin'` → `'Admin'`

#### 1.3 .env.example ✅
16 variables documentées par section : Supabase, Anthropic, OpenAI (Whisper), Microsoft Graph, Google Maps, Dropbox, Webhooks WordPress, URLs.

#### 1.4 Suppression buckets fantômes ✅
DROP buckets `templates` et `avis_valeur_generique.pptx`.
Buckets actifs : `assistant-attachments`, `avatars`, `mandat-assets`, `mandat-docs`, `mandat-photos`, `mandat-plaquettes`.

#### 1.5 Correction code post-migration ✅
- 5 remplacements `photo_url` → `avatar_url` dans `app/api/mandats/[id]/pdf/route.js`
- 1 remplacement `photo_url` → `avatar_url` dans `app/api/avis-valeur/generate-pdf/route.js`
- DELETE `app/api/mandat-assistant/route.js` (route morte utilisait `mandat_chats`)

#### 1.6 ROADMAP.md ✅
Ce fichier.

---

## 🚧 Sprint 2 — À VENIR

**Objectif** : Convention de code unique + nettoyage du code mort.

### Critères "fini" (proposés)
- [ ] Choisir UNE convention de casing JavaScript (snake_case probable) et l'imposer
- [ ] Supprimer tous les hardcodes `owner: 'TB'`, `owner: 'JD'`
- [ ] Supprimer les hardcodes Thomas/Boggiani/Ezquerra/Lucas/Philippe (utiliser `profile.role` + `profile.prenom + profile.nom`)
- [ ] Supprimer `lib/helpers.js` (fichier mort)
- [ ] Supprimer `components/MergeMandatsModal.jsx` (orphelin)
- [ ] Supprimer les autres routes API mortes (`ai-create`, `analyze-voice`, `ai-send-plaquette`, `microsoft/contacts/push`, `webhooks/mandat-updated`, `clients/[id]/refresh-assets`, `clients/[id]/ai-suggestions`)
- [ ] Aligner casse `role === 'admin'` / `role === 'Admin'` partout
- [ ] Fix double `downloadPdf` dans `PdfExportButtons.jsx`
- [ ] Synchroniser les statuts/typologies dans le system prompt de l'assistant IA
- [ ] Migration progressive `gpt-4o` → `claude-haiku-4-5` (routes `assistant/chat` et `clients/[id]/analyze`)
- [ ] Déplacer la clé Maptiler hardcodée dans `.env`
- [ ] Factoriser les couleurs RATP/SNCF dans un seul fichier

---

## 🐛 Bugs critiques identifiés à corriger pendant les sprints

| # | Bug | Sprint cible |
|---|-----|--------------|
| B1 | `answersToMandat` perd 3 champs en camelCase | S2 ou S8 |
| B2 | `refreshProfile` vs `reloadProfile` : rechargement profil silencieusement KO | S2 |
| B3 | Signature "Thomas Boggiani" hardcodée dans génération emails IA | S2 |
| B4 | Tab "Questionnaires" : bouton "Générer un lien" mène à 404 | S8 |
| B5 | Faille SQL potentielle dans `executeSearchMandats/Clients` | S2 |
| B6 | Tokens dans URLs (6 endroits) | S2 ou S6 |
| B7 | Statuts mandat désynchronisés entre IA et BDD | S2 |
| B8 | `MediasModal` ≈ `MediasInline` (1100 lignes dupliquées) | S4 |
| B9 | `DocumentsModal` ≈ `DocumentsInline` (900 lignes dupliquées) | S4 |
| B10 | 65 `alert()` natifs → toast system | S2 ou S8 |
| B11 | `loadAll()` recharge 9 tables d'un coup, 50× dans CRM.jsx | S5 (React Query) |
| B12 | 34 routes utilisent service-role key (bypass RLS) | S6 ou plus tard |

---

## 📂 Référence : structure BDD finale après S1

### Tables actives (24)
ai_conversations, annonces, campagnes, client_ai_conversations, client_analyses, clients, deals, evenements_recurrents, interactions, leads_capture_log, mandat_documents, mandats, matching_notifications, notes_globales, notifications, outlook_emails_cache, profiles, questionnaires, references_ventes, settings, todos, user_integrations

### Vue
vw_leads_capture_stats

### Buckets Storage (6)
assistant-attachments, avatars, mandat-assets, mandat-docs, mandat-photos, mandat-plaquettes

### Enums validés par CHECK constraints
- mandats.statut : Sourcing, Analyse, Mandat signé, Commercialisation, Offre, Promesse, Acte, Vendu par autres, Perdu
- mandats.commercialisation : Off-market, Mandat exclusif, Mandat simple, Co-mandat
- mandats.marche, clients.marche : b2b, b2c
- clients.statut : Actif, Inactif, Perdu
- clients.maturite : Faible, Moyen, Élevé
- deals.statut : À proposer, Envoyé, En étude, Visite, Offre, Refusé, Gagné, Perdu
- todos.priorite : Basse, Moyenne, Haute
- todos.statut : À faire, En cours, Terminé
- profiles.role : Admin, Directeur, Commercial

---

**Dernière mise à jour** : 24/05/2026 (fin Sprint 1)
