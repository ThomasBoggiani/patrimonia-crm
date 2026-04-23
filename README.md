# 🏛️ Patrimonia CRM

CRM immobilier d'investissement — mandats, acquéreurs, matching automatique, analyse IA des dossiers.

---

## 🚀 Guide de déploiement (30 minutes)

Ce guide vous permet d'obtenir votre URL publique `votre-crm.vercel.app` avec base de données partagée.

### Prérequis
- Un compte email
- Aucune compétence technique requise — tout se fait dans le navigateur

---

### Étape 1 — Créer la base de données (Supabase) • 10 min

1. Allez sur **[supabase.com](https://supabase.com)** → cliquez **"Start your project"**
2. Inscrivez-vous (GitHub ou email)
3. Cliquez **"New Project"** :
   - **Name** : `patrimonia`
   - **Database Password** : choisissez un mot de passe fort — **notez-le**
   - **Region** : `West EU (Paris)` ou `Central EU (Frankfurt)`
   - Cliquez **"Create new project"** et attendez ~2 min
4. Une fois le projet prêt, dans le menu de gauche cliquez **"SQL Editor"** → **"New query"**
5. Ouvrez le fichier `supabase/schema.sql` de ce projet, copiez TOUT son contenu, collez-le dans l'éditeur Supabase, cliquez **"Run"** (en bas à droite)
   - ✅ Vous devez voir `Success. No rows returned`
6. Récupérez vos clés : menu de gauche → **"Project Settings"** (icône engrenage en bas) → **"API"**
   - **Project URL** : `https://xxxx.supabase.co` → **copiez-la**
   - **anon public** (sous "Project API keys") → **copiez-la**

---

### Étape 2 — Obtenir une clé Anthropic • 5 min

1. Allez sur **[console.anthropic.com](https://console.anthropic.com)**
2. Créez un compte (email + carte bancaire requis pour l'API)
3. Ajoutez ~5€ de crédits dans **"Plans & Billing"** (cela couvre largement des centaines d'analyses de dossiers)
4. Dans **"API Keys"** → **"Create Key"** → nom : `patrimonia` → copiez la clé `sk-ant-api03-...`

---

### Étape 3 — Déposer le code sur GitHub • 5 min

1. Allez sur **[github.com](https://github.com)** → créez un compte si besoin
2. Cliquez **"New repository"** :
   - **Repository name** : `patrimonia-crm`
   - **Private** (recommandé)
   - Cliquez **"Create repository"**
3. Téléchargez tout le dossier `patrimonia-crm` depuis ce chat (voir le zip fourni à la fin)
4. Suivez les instructions GitHub "or push an existing repository from the command line" :
   ```bash
   cd patrimonia-crm
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/VOTRE-USERNAME/patrimonia-crm.git
   git push -u origin main
   ```

**Alternative sans ligne de commande** : sur la page du repo GitHub cliquez **"uploading an existing file"**, glissez tous les fichiers/dossiers du projet, commit.

---

### Étape 4 — Déployer sur Vercel • 10 min

1. Allez sur **[vercel.com](https://vercel.com)** → **"Sign Up"** → **"Continue with GitHub"**
2. Cliquez **"Add New..."** → **"Project"**
3. Sélectionnez votre repository `patrimonia-crm` → **"Import"**
4. **Framework Preset** : Next.js (détecté automatiquement)
5. Déployez **Environment Variables** (très important) :
   
   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Votre URL Supabase (étape 1.6) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Votre clé anon Supabase (étape 1.6) |
   | `ANTHROPIC_API_KEY` | Votre clé `sk-ant-api03-...` (étape 2) |

6. Cliquez **"Deploy"** → attendez ~2 min
7. 🎉 **Votre URL est prête** : `https://patrimonia-crm-xxxx.vercel.app`

**Pour personnaliser l'URL** : Settings → Domains → modifier ou ajouter un domaine custom (ex: `crm.votresociete.fr`).

---

## 🔄 Faire évoluer le CRM

À chaque fois que vous me demandez une modification dans ce chat :
1. Je vous fournis les fichiers modifiés
2. Vous les remplacez dans votre repo GitHub (via l'interface web GitHub, en glisser-déposer)
3. Vercel redéploie automatiquement en ~1 min
4. Votre URL affiche la nouvelle version

Pas de ligne de commande nécessaire si vous utilisez GitHub web.

---

## 🛠️ Développement local (optionnel)

Si vous voulez tester les modifications avant de les déployer :

```bash
# 1. Cloner
git clone https://github.com/VOTRE-USERNAME/patrimonia-crm.git
cd patrimonia-crm

# 2. Créer .env.local avec vos clés (copier .env.example)
cp .env.example .env.local
# puis éditer .env.local avec vos vraies clés

# 3. Installer et lancer
npm install
npm run dev
```

Ouvre `http://localhost:3000`.

---

## 📦 Structure du projet

```
patrimonia-crm/
├── app/
│   ├── api/
│   │   └── analyze-mandat/     # API IA (analyse docs)
│   │       └── route.js
│   ├── globals.css              # Styles
│   ├── layout.js                # Layout racine
│   └── page.js                  # Page d'accueil
├── components/
│   └── CRM.jsx                  # 🧠 Tout le CRM (2000+ lignes)
├── lib/
│   └── supabase.js              # Client BDD
├── supabase/
│   └── schema.sql               # 🗂️ Tables BDD
├── .env.example                 # Modèle variables d'env
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── tsconfig.json
```

---

## 🎯 Fonctionnalités

- ✅ **Mandats** avec statut commercialisation (Off-market / Exclusif / Simple) + pastilles couleur
- ✅ **Import intelligent** de dossiers PDF/DOCX/images — Claude lit, pré-remplit, signale les alertes critiques et les infos manquantes
- ✅ **Clients** avec interactions horodatées, critères d'investissement, fiche détaillée
- ✅ **Deals** avec vue Tableau + Kanban drag&drop
- ✅ **Matching automatique** avec score de compatibilité 0-100
- ✅ **To-do personnelle** liée à mandats/clients/deals
- ✅ **Annonces portails** (SeLoger, LeBonCoin, Bien'ici, Figaro)
- ✅ **Questionnaires** vendeur/acquéreur avec QR code + lien
- ✅ **Emailings** avec segmentation multi-critères

---

## 🔒 Sécurité

- La clé Anthropic est **côté serveur uniquement** (API route Next.js), jamais exposée au navigateur
- Supabase est protégé par la clé `anon` publique — pour un usage multi-utilisateurs avec authentification, activez RLS (Row Level Security) dans `schema.sql`
- Variables d'environnement chiffrées dans Vercel

---

## 💡 Coûts attendus

- **Vercel** : gratuit (Hobby plan suffit largement)
- **Supabase** : gratuit jusqu'à 500 Mo BDD + 1 Go storage
- **Anthropic** : ~0,02 € par analyse de dossier (Sonnet 4) → 50 analyses ≈ 1 €
- **Total** : ~1 à 5 € / mois selon votre usage

---

## 📞 Support

Besoin d'ajouter une fonctionnalité ? Revenez dans ce chat et décrivez ce que vous voulez, je vous fournirai le code mis à jour.
