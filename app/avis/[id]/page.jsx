'use client';

// app/avis/[id]/page.jsx
// Avis de valeur — page imprimable (charte « Turenne » conçue par Thomas via
// Claude Design). Réutilise le HTML/CSS exact du design (public/avis-template.html)
// et injecte les données du mandat. Chaque slide = une page 16:9 (1920×1080).
// « Imprimer → Enregistrer en PDF » depuis le navigateur.

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// Valeurs de démonstration = l'exemple 66 Turenne (rendu identique au design).
const DEMO = {
  TITRE: '66 rue de Turenne',
  VILLE: 'Paris 3ᵉ · Le Marais',
  SOUS_TITRE: "Maison-loft d'architecte avec jardin privatif",
  EYEBROW_DATE: 'Avis de valeur — Juillet 2026',
  FOOTER_ADDR: '66 rue de Turenne, Paris 3ᵉ · Juillet 2026 · Confidentiel',
  CONSULTANT: 'Thomas Boggiani — Directeur du développement',
  CONTACT_SUB: 'Avis de valeur · 66 rue de Turenne, Paris 3ᵉ',
  CONTACT_DATE: 'Juillet 2026 · Document confidentiel',
};

function moisAnnee(d = new Date()) {
  return `${MOIS[d.getMonth()].charAt(0).toUpperCase() + MOIS[d.getMonth()].slice(1)} ${d.getFullYear()}`;
}

// Construit les données de l'avis à partir du mandat.
function buildData(m) {
  if (!m) return DEMO;
  const ma = moisAnnee();
  const adresse = (m.adresse || '').trim();
  const ville = (m.ville || '').trim();
  const lieu = [adresse, ville].filter(Boolean).join(', ') || (m.nom || 'Bien à évaluer');
  const sousTitre = [m.type, m.sous_type].filter(Boolean).join(' — ') || (m.marche === 'b2c' ? "Bien d'habitation" : 'Immeuble de rapport');
  const consultant = m.avis_valeur?.preconisation?.consultant_nom || 'Immeubles & Patrimoine';
  return {
    TITRE: m.nom || adresse || 'Bien à évaluer',
    VILLE: ville || '',
    SOUS_TITRE: sousTitre,
    EYEBROW_DATE: `Avis de valeur — ${ma}`,
    FOOTER_ADDR: `${lieu} · ${ma} · Confidentiel`,
    CONSULTANT: consultant,
    CONTACT_SUB: `Avis de valeur · ${lieu}`,
    CONTACT_DATE: `${ma} · Document confidentiel`,
  };
}

function fill(html, data) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, k) => (data[k] != null ? String(data[k]) : ''));
}

export default function AvisPage() {
  const { id } = useParams();
  const [html, setHtml] = useState('');
  const [state, setState] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1);

  // Échelle d'aperçu écran (le doc fait 1920px de large)
  useEffect(() => {
    const onResize = () => setScale(Math.min(1, (window.innerWidth - 40) / 1920));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const tpl = await fetch('/avis-template.html').then(r => r.text());
        let data;
        if (id === 'demo') {
          data = DEMO;
        } else {
          const { data: m, error: e } = await supabase.from('mandats').select('*').eq('id', id).maybeSingle();
          if (e) throw e;
          if (!m) { setError('Mandat introuvable (ou accès non autorisé).'); setState('error'); return; }
          data = buildData(m);
        }
        setHtml(fill(tpl, data));
        setState('ready');
      } catch (e) {
        setError(e.message || 'Erreur de chargement.');
        setState('error');
      }
    })();
  }, [id]);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Albert+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        html,body{margin:0;padding:0;background:#241912}
        .avis-toolbar{position:fixed;top:0;left:0;right:0;z-index:1000;display:flex;align-items:center;justify-content:space-between;
          gap:12px;padding:10px 18px;background:#241912;color:#F5EDE5;font-family:'Albert Sans',system-ui,sans-serif;font-size:14px}
        .avis-toolbar button{font:inherit;font-weight:600;cursor:pointer;border-radius:8px;border:1px solid #8C9978;
          background:#294029;color:#F5EDE5;padding:8px 16px}
        .avis-toolbar button:hover{background:#33513380}
        .avis-scaler{padding:56px 0 60px;display:flex;justify-content:center}
        .avis-doc{width:1920px;zoom:var(--z,1)}
        .avis-doc section{width:1920px;height:1080px;position:relative;margin:0 auto 24px;box-shadow:0 10px 40px rgba(0,0,0,.35)}
        .avis-msg{min-height:100vh;display:flex;align-items:center;justify-content:center;color:#F5EDE5;
          font-family:'Albert Sans',system-ui,sans-serif;font-size:16px}
        @media print {
          @page { size: 1920px 1080px; margin: 0; }
          html,body{background:#fff}
          .avis-toolbar{display:none}
          .avis-scaler{padding:0}
          .avis-doc{zoom:1 !important;width:1920px}
          .avis-doc section{margin:0;box-shadow:none;break-after:page;page-break-after:always}
          .avis-doc section:last-child{break-after:auto;page-break-after:auto}
        }
      `}</style>

      {state === 'loading' && <div className="avis-msg">Préparation de l'avis…</div>}
      {state === 'error' && <div className="avis-msg">⚠️ {error}</div>}
      {state === 'ready' && (
        <>
          <div className="avis-toolbar">
            <span>Avis de valeur · aperçu — chaque page = une diapositive 16:9</span>
            <button onClick={() => window.print()}>Imprimer / Enregistrer en PDF</button>
          </div>
          <div className="avis-scaler">
            <div className="avis-doc" style={{ ['--z']: scale }}
              dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </>
      )}
    </>
  );
}
