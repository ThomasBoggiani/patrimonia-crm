-- =====================================================
-- PATRIMONIA CRM - SCHÉMA BASE DE DONNÉES SUPABASE
-- =====================================================
-- Copiez-collez tout ce fichier dans l'éditeur SQL de Supabase :
-- Dashboard Supabase → SQL Editor → New Query → Coller → Run

-- === MANDATS (Biens) ===
CREATE TABLE IF NOT EXISTS mandats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  adresse TEXT,
  ville TEXT,
  type TEXT DEFAULT 'Immeubles',
  sous_type TEXT,
  prix NUMERIC DEFAULT 0,
  prix_m2 NUMERIC DEFAULT 0,
  surface NUMERIC DEFAULT 0,
  loyers_annuels NUMERIC DEFAULT 0,
  rendement NUMERIC DEFAULT 0,
  nb_lots INT DEFAULT 1,
  commercialisation TEXT DEFAULT 'Off-market',
  date_signature DATE,
  statut TEXT DEFAULT 'Sourcing',
  owner TEXT DEFAULT 'JD',
  description TEXT,
  contact TEXT,
  tel TEXT,
  docs JSONB DEFAULT '[]'::jsonb,
  alerts JSONB DEFAULT '[]'::jsonb,
  highlights JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- === CLIENTS (Acquéreurs) ===
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  prenom TEXT,
  societe TEXT,
  tel TEXT,
  email TEXT,
  typologie TEXT DEFAULT 'Foncières',
  nature TEXT DEFAULT 'Privée',
  budget_min NUMERIC DEFAULT 0,
  budget_max NUMERIC DEFAULT 0,
  rendement_min NUMERIC DEFAULT 0,
  zones JSONB DEFAULT '[]'::jsonb,
  typologies_recherchees JSONB DEFAULT '[]'::jsonb,
  statut TEXT DEFAULT 'Actif',
  maturite TEXT DEFAULT 'Moyen',
  origine TEXT DEFAULT 'Apporteur',
  owner TEXT DEFAULT 'JD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- === INTERACTIONS (journal d'échanges par client) ===
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT DEFAULT 'Appel',
  resume TEXT,
  next_step TEXT,
  date_next_step DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === DEALS (pivot Mandat ↔ Client) ===
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandat_id UUID REFERENCES mandats(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  statut TEXT DEFAULT 'À proposer',
  date_envoi DATE,
  date_reponse DATE,
  motif_refus TEXT,
  commentaire TEXT,
  prix_offre NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- === TODOS (to-do personnelle) ===
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  priorite TEXT DEFAULT 'Moyenne',
  statut TEXT DEFAULT 'À faire',
  echeance DATE,
  lien_type TEXT,
  lien_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === ANNONCES (suivi portails) ===
CREATE TABLE IF NOT EXISTS annonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandat_id UUID REFERENCES mandats(id) ON DELETE CASCADE,
  portails JSONB DEFAULT '{"seloger":"Non diffusé","leboncoin":"Non diffusé","bienici":"Non diffusé","figaro":"Non diffusé"}'::jsonb,
  date_publication DATE DEFAULT CURRENT_DATE,
  last_update DATE DEFAULT CURRENT_DATE
);

-- === CAMPAGNES (emailings) ===
CREATE TABLE IF NOT EXISTS campagnes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  sujet TEXT,
  corps TEXT,
  segment TEXT,
  nb_destinataires INT DEFAULT 0,
  date_envoi DATE,
  statut TEXT DEFAULT 'Brouillon',
  taux INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === QUESTIONNAIRES ===
CREATE TABLE IF NOT EXISTS questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  nom TEXT,
  lien TEXT,
  reponses JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === INDEX pour performances ===
CREATE INDEX IF NOT EXISTS idx_deals_mandat ON deals(mandat_id);
CREATE INDEX IF NOT EXISTS idx_deals_client ON deals(client_id);
CREATE INDEX IF NOT EXISTS idx_interactions_client ON interactions(client_id);
CREATE INDEX IF NOT EXISTS idx_mandats_statut ON mandats(statut);
CREATE INDEX IF NOT EXISTS idx_mandats_commercialisation ON mandats(commercialisation);

-- === STORAGE : bucket pour les documents des mandats ===
-- À créer manuellement dans Supabase Dashboard :
-- Storage → New bucket → Name: "mandat-docs" → Public: ON

-- === RLS (Row Level Security) ===
-- Pour un usage mono-utilisateur, on désactive RLS (plus simple)
-- Si usage multi-utilisateurs plus tard, activez et ajoutez des policies
ALTER TABLE mandats DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE interactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE todos DISABLE ROW LEVEL SECURITY;
ALTER TABLE annonces DISABLE ROW LEVEL SECURITY;
ALTER TABLE campagnes DISABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaires DISABLE ROW LEVEL SECURITY;
