'use client';

// app/avis/[id]/page.jsx
// Avis de valeur — page imprimable (charte « 66 Turenne »). Le contenu est
// ENTIÈREMENT construit à partir des données du mandat (lib/avis/buildAvis).
// Chaque slide = une page 16:9 (1920×1080). « Imprimer → PDF ».

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { buildAvisHtml } from '@/lib/avis/buildAvis';

const DEMO_MANDAT = {
  nom: '66 rue de Turenne', adresse: '66 rue de Turenne', ville: 'Paris 3ᵉ', marche: 'b2c',
  type: 'Maison-loft', surface: 168.1, dpe_consommation: 109, dpe_classe: 'B', nb_pieces: 5, nb_chambres: 3, prix_m2: 13100,
  prix: 2250000, prix_net_vendeur: 2100000,
  avis_valeur: {
    preconisation: { prix_plancher: 1950000, prix_marche: 2100000, prix_coup_de_coeur: 2250000, recommandation: 'affichage 2 200 000 – 2 250 000 € FAI, objectif de signature 2 050 000 – 2 150 000 €.', consultant_nom: 'Thomas Boggiani — Directeur du développement' },
    comparables: { prix_zone_min: 12200, prix_zone_max: 17500, commentaire: 'Micro-secteur Turenne / Tournelles / Beaumarchais — médiane DVF 12 550 €/m².' },
    swot: { facteurs_limitatifs: ['Publication du lot 79 à vérifier', 'Surfaces à harmoniser'], menaces: ['Zone PPRI inondation'] },
  },
};

export default function AvisPage() {
  const { id } = useParams();
  const [html, setHtml] = useState('');
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const onResize = () => setScale(Math.min(1, (window.innerWidth - 40) / 1920));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // À l'impression, on masque tout ce qui n'est pas l'avis lui-même : les
  // extensions du navigateur injectent souvent un bouton flottant (assistant IA,
  // lecteur…) en position fixe, qui se retrouverait imprimé sur chaque page.
  useEffect(() => {
    const hidden = [];
    const onBefore = () => {
      const doc = document.querySelector('.avis-scaler');
      if (!doc) return;
      Array.from(document.body.children).forEach((el) => {
        if (el.contains(doc)) return; // on garde la branche qui contient l'avis
        if (el.style.display === 'none') return;
        hidden.push([el, el.style.getPropertyValue('display'), el.style.getPropertyPriority('display')]);
        el.style.setProperty('display', 'none', 'important');
      });
    };
    const onAfter = () => {
      hidden.forEach(([el, val, prio]) => {
        if (val) el.style.setProperty('display', val, prio);
        else el.style.removeProperty('display');
      });
      hidden.length = 0;
    };
    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);
    return () => {
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', onAfter);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        let m;
        if (id === 'demo') m = DEMO_MANDAT;
        else {
          const { data, error: e } = await supabase.from('mandats').select('*').eq('id', id).maybeSingle();
          if (e) throw e;
          if (!data) { setError('Mandat introuvable (ou accès non autorisé — connecte-toi au CRM dans cet onglet).'); setState('error'); return; }
          m = data;
        }
        setHtml(buildAvisHtml(m));
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
        .avis-scaler{padding:56px 0 60px;display:flex;justify-content:center}
        .avis-doc{width:1920px;zoom:var(--z,1)}
        /* Conserve TOUTES les couleurs de fond à l'impression PDF (sinon Chrome les supprime). */
        .avis-doc, .avis-doc *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}
        .avis-doc section{width:1920px;height:1080px;position:relative;margin:0 auto 24px;box-shadow:0 10px 40px rgba(0,0,0,.35)}
        .avis-msg{min-height:100vh;display:flex;align-items:center;justify-content:center;color:#F5EDE5;
          font-family:'Albert Sans',system-ui,sans-serif;font-size:16px;padding:24px;text-align:center}
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
            <div className="avis-doc" style={{ ['--z']: scale }} dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </>
      )}
    </>
  );
}
