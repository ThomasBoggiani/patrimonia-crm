// ═══════════════════════════════════════════════════════════════════
// components/AvisDeValeurEditor.jsx (v2 - structure générique avis de valeur)
// 8 sections : 4 dépliées (SWOT, méthodes, reconversion, préconisation)
//              4 repliées (localisation, locatif, caractéristiques, comparables)
// ═══════════════════════════════════════════════════════════════════

'use client';
import React, { useState, useEffect } from 'react';
import {
  X, Save, ChevronDown, ChevronRight, Plus, Trash2, Loader2,
  TrendingUp, Sparkles, AlertTriangle, Cloud,
  Building2, BarChart3, Target, Lightbulb, Tag, MessageCircle,
  MapPin, Key, Repeat, Calculator, FileDown, Image as ImageIcon, Send
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import DvfComparables from './DvfComparables';
import MicButton from './MicButton';

// Schéma vide par défaut
const EMPTY_AVIS = {
  // Phase du document : 'pre_avis' (depuis l'adresse) → 'definitif' (visite/dossier).
  phase: 'pre_avis',
  // 1. Localisation
  localisation: {
    transports: '', // texte libre (en attendant intégration auto)
    commentaire: '', // commentaire stratégique sur l'emplacement
    commentaire_rue: '', // analyse de la rue (page dédiée)
    commentaire_urbanisme: '', // cadastre / urbanisme / risques (page dédiée)
  },
  // 2. Situation locative (auto depuis etat_locatif, juste commentaire ici)
  situation_locative: {
    commentaire: '', // contexte locatif particulier
  },
  // 3. Caractéristiques
  caracteristiques: {
    annee_construction: '',
    architecte: '',
    distribution: '', // texte libre (R-1, RDC, R+1...)
    atouts_distinctifs: [], // bullets
    commentaire: '',
  },
  // 3bis. Visite — observations Phase 2 (avis définitif). Dictée + champs.
  visite: {
    architecture: '',       // architecture / style de l'immeuble
    immeuble_qualite: '',    // qualité de la construction / de l'immeuble
    parties_communes: '',    // hall, escalier, ascenseur, entretien
    agencement: '',          // distribution / agencement intérieur
    volumes: '',             // volumes, hauteur sous plafond
    luminosite: '',          // luminosité
    exposition: '',          // expositions
    vues: '',                // vues / dégagement
    prestations: [],         // prestations remarquables (bullets)
    etat_general: '',        // état général
    travaux: '',             // travaux éventuels à prévoir
    potentiel: '',           // potentiel de valorisation
  },
  // 3ter. DPE (classe/conso viennent du mandat) — commentaire d'expert optionnel.
  dpe: {
    commentaire: '',
  },
  // 3quater. Documents — copropriété, fiscalité, diagnostics (option « sur pièces »).
  documents: {
    taxe_fonciere: 0,
    charges_annuelles: 0,
    charges_detail: '',      // ce que comprennent les charges (chauffage collectif, eau chaude…)
    fonds_travaux: 0,
    copro_nb_lots: 0,
    travaux_votes: '',
    procedures: '',
    diagnostics: '',
    servitudes: '',
    commentaire: '',
    checklist: {},          // pièces réunies cochées à la main (le reste est auto-détecté)
  },
  // 4. Comparables & marché
  comparables: {
    prix_zone_min: 0,
    prix_zone_max: 0,
    rendement_zone_min: 0,
    rendement_zone_max: 0,
    transactions_recentes: '', // texte libre tableau
    commentaire: '',
    ventes: [],         // DVF structuré [{date,adresse,type,surface,prix,prixM2,lots,memeImmeuble}]
    par_annee: [],      // [{annee,count,m2Median}]
    mediane_m2: 0,      // médiane €/m² DVF retenue (pilote le prix de marché)
    biens_similaires: [], // 3 biens dispo saisis à la main [{lien,adresse,prix,surface}]
    meilleurs_agents_m2: 0,        // €/m² MeilleursAgents (saisi d'après un screenshot)
    meilleurs_agents_screenshot: '', // capture MeilleursAgents (image data-URL)
  },
  // 5. SWOT (déplié)
  swot: {
    forces: [],
    opportunites: [],
    facteurs_limitatifs: [],
    menaces: [],
  },
  // 6. Méthodes d'analyse de valeur (déplié)
  methode_m2: {
    valeur_basse: { prix_m2: 0, valeur_totale: 0, commentaire: '' },
    valeur_centrale: { prix_m2: 0, valeur_totale: 0, commentaire: '' },
    valeur_haute: { prix_m2: 0, valeur_totale: 0, commentaire: '' },
  },
  methode_capi: {
    ca_base: 0, // CA HT annuel base de calcul
    hypotheses: [], // [{rendement_pct, valeur_acte, valeur_m2, lecture}]
    zone_atterrissage: '', // texte libre
  },
  // 7. Potentiel de reconversion (déplié)
  reconversion: {
    usages: [], // [{titre, description}]
    bilan_financier: '', // texte libre (acquisition + travaux + CA cible)
    profils_acquereurs: [], // liste libre
  },
  // 8. Préconisation & 3 prix (déplié)
  preconisation: {
    recommandation: '',
    prix_coup_de_coeur: 0,
    prix_marche: 0,
    prix_plancher: 0,
    avis_client: '',
    confiance: '', // niveau de confiance affiché ('' = auto ; 'Indicatif'|'Correct'|'Élevé')
    consultant_id: '',
    consultant_nom: '',
    consultant_email: '',
    consultant_tel: '',
    honoraires_pct: 5,
    // Ajustement à la baisse justifié (discret) : facteurs de décote + note
    facteurs_decote: '', // ex : 1er étage sombre · charges 400 €/mois · marché baissier
    positionnement: '',  // ex : à positionner en fourchette basse
    ajustements: [],     // [{label, pct}] décote/surcote ± % sur le €/m² (±25 %)
    annexes: [],         // [{type, surface, prorata}] annexes au prorata du €/m² habitable
  },
  // Méta
  date_estimation: new Date().toISOString().split('T')[0],
  validite_mois: 1,
};

// Helper : merge profond avec EMPTY_AVIS
function ensureSchema(data) {
  if (!data) return JSON.parse(JSON.stringify(EMPTY_AVIS));
  const safe = {
    ...EMPTY_AVIS,
    ...data,
    localisation: { ...EMPTY_AVIS.localisation, ...(data.localisation || {}) },
    situation_locative: { ...EMPTY_AVIS.situation_locative, ...(data.situation_locative || {}) },
    caracteristiques: {
      ...EMPTY_AVIS.caracteristiques,
      ...(data.caracteristiques || {}),
      atouts_distinctifs: Array.isArray(data.caracteristiques?.atouts_distinctifs)
        ? data.caracteristiques.atouts_distinctifs : [],
    },
    visite: {
      ...EMPTY_AVIS.visite,
      ...(data.visite || {}),
      prestations: Array.isArray(data.visite?.prestations) ? data.visite.prestations : [],
    },
    dpe: { ...EMPTY_AVIS.dpe, ...(data.dpe || {}) },
    documents: { ...EMPTY_AVIS.documents, ...(data.documents || {}) },
    comparables: { ...EMPTY_AVIS.comparables, ...(data.comparables || {}) },
    swot: { ...EMPTY_AVIS.swot, ...(data.swot || {}) },
    methode_m2: {
      valeur_basse: { ...EMPTY_AVIS.methode_m2.valeur_basse, ...(data.methode_m2?.valeur_basse || {}) },
      valeur_centrale: { ...EMPTY_AVIS.methode_m2.valeur_centrale, ...(data.methode_m2?.valeur_centrale || {}) },
      valeur_haute: { ...EMPTY_AVIS.methode_m2.valeur_haute, ...(data.methode_m2?.valeur_haute || {}) },
    },
    methode_capi: {
      ...EMPTY_AVIS.methode_capi,
      ...(data.methode_capi || {}),
      hypotheses: Array.isArray(data.methode_capi?.hypotheses) ? data.methode_capi.hypotheses : [],
    },
    reconversion: {
      ...EMPTY_AVIS.reconversion,
      ...(data.reconversion || {}),
      usages: Array.isArray(data.reconversion?.usages) ? data.reconversion.usages : [],
      profils_acquereurs: Array.isArray(data.reconversion?.profils_acquereurs) ? data.reconversion.profils_acquereurs : [],
    },
    preconisation: { ...EMPTY_AVIS.preconisation, ...(data.preconisation || {}) },
  };
  // Migration : si on a l'ancien schéma (avec swot.forces[]…) on les garde
  return safe;
}

// Fusion « ne remplit que les vides » : on garde tout ce que Thomas a déjà saisi,
// l'IA ne comble que les champs vides / à zéro / listes vides.
function estVide(v) {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (typeof v === 'number') return v === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}
function mergePrefill(current, incoming) {
  if (Array.isArray(current) || Array.isArray(incoming)) {
    return (Array.isArray(current) && current.length > 0) ? current : (incoming || []);
  }
  if (current && typeof current === 'object' && incoming && typeof incoming === 'object') {
    const out = { ...current };
    for (const k of Object.keys(incoming)) {
      out[k] = mergePrefill(current[k], incoming[k]);
    }
    return out;
  }
  return estVide(current) ? incoming : current;
}

export default function AvisDeValeurEditor({ mandat, onClose, onSaved }) {
  const [data, setData] = useState(ensureSchema(mandat?.avisValeur || mandat?.avis_valeur));
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendingMandant, setSendingMandant] = useState(false);

  // SOURCE UNIQUE : les infos déjà sur la fiche mandat (taxe, charges, année,
  // descriptif, lots) sont affichées en LECTURE SEULE dans l'avis (composant
  // FicheField) et ne sont plus re-saisies ici. On les modifie sur la fiche.

  // Marché : le BtoC (habitation) masque les sections d'investissement.
  const estB2C = (mandat?.marche || mandat?.marche) === 'b2c';

  // Les 3 prix DÉCOULENT du calcul (méthode surface pondérée), identique à l'avis :
  // référence €/m² = 70 % DVF + 30 % annonces → décote/surcote → habitable + annexes
  // au prorata → prix de marché (arrondi 5 000 €), plancher −10 %, coup de cœur +10 %.
  useEffect(() => {
    const surf = +mandat?.surface || 0;
    if (!surf) return;
    const med = +data.comparables.mediane_m2 || 0;
    const annVals = (data.comparables.biens_similaires || [])
      .map(b => (+b.prix && +b.surface) ? Math.round(+b.prix / +b.surface) : 0)
      .filter(Boolean).sort((a, b) => a - b);
    const annM2 = annVals.length ? annVals[Math.floor(annVals.length / 2)] : 0;
    const maM2 = +data.comparables.meilleurs_agents_m2 || 0;
    const rParts = [[med, 0.5], [annM2, 0.25], [maM2, 0.25]].filter(x => x[0] > 0);
    const refM2 = rParts.length ? Math.round(rParts.reduce((s, [v, w]) => s + v * w, 0) / rParts.reduce((s, [, w]) => s + w, 0)) : 0;
    if (!refM2) return;
    const total = (data.preconisation.ajustements || []).reduce((s, a) => s + (+a.pct || 0), 0);
    const habM2 = Math.round(refM2 * (1 + total / 100));
    const habValue = Math.round(habM2 * surf);
    const annexesTotal = (data.preconisation.annexes || []).reduce((s, a) =>
      s + ((+a.surface > 0 && +a.prorata > 0) ? Math.round(+a.surface * (+a.prorata / 100) * habM2) : 0), 0);
    const r5 = (v) => v ? Math.round(v / 5000) * 5000 : 0;
    const central = r5(habValue + annexesTotal);
    const plancher = r5(central * 0.95);
    const coup = r5(central * 1.05);
    const p = data.preconisation;
    if (p.prix_marche !== central || p.prix_plancher !== plancher || p.prix_coup_de_coeur !== coup) {
      setData(prev => {
        const n = JSON.parse(JSON.stringify(prev));
        n.preconisation.prix_marche = central;
        n.preconisation.prix_plancher = plancher;
        n.preconisation.prix_coup_de_coeur = coup;
        return n;
      });
    }
  }, [data.preconisation.ajustements, data.preconisation.annexes, data.comparables.mediane_m2, data.comparables.biens_similaires, data.comparables.meilleurs_agents_m2, mandat?.surface]);

  // Pré-remplissage IA : premier jet complet, adapté au marché. Ne remplace que
  // les champs vides (on ne détruit pas ce que Thomas a déjà saisi).
  async function handlePrefill() {
    if (!mandat?.id) { alert('Enregistre d\'abord le mandat.'); return; }
    setPrefilling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/avis-valeur/prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session?.access_token || '', mandatId: mandat.id }),
      });
      const j = await res.json();
      if (!j.ok) { alert(j.error || 'Pré-remplissage impossible.'); setPrefilling(false); return; }
      // Le PRIX vient uniquement du DVF : l'IA ne touche pas aux méthodes de valeur
      // ni aux 3 prix (sinon elle invente des chiffres qui contredisent le DVF).
      const avis = ensureSchema(j.avis);
      delete avis.methode_m2; delete avis.methode_capi;
      if (avis.preconisation) { delete avis.preconisation.prix_marche; delete avis.preconisation.prix_plancher; delete avis.preconisation.prix_coup_de_coeur; }
      setData(prev => mergePrefill(prev, avis));
    } catch (e) {
      alert('Erreur : ' + e.message);
    } finally {
      setPrefilling(false);
    }
  }

  // Tout déplié par défaut (Thomas veut être sûr de tout remplir).
  const [openSections, setOpenSections] = useState({
    localisation: true,
    locatif: true,
    caracteristiques: true,
    visite: true,
    documents: true,
    comparables: true,
    swot: true,
    methodes: true,
    reconversion: true,
    preconisation: true,
  });

  // Consultants (équipe) — pour le choix déroulant + email/tél automatiques.
  // Repli sur l'équipe connue si la table profiles ne renvoie rien.
  const EQUIPE_FALLBACK = [
    { id: 'thomas-boggiani', prenom: 'Thomas', nom: 'Boggiani', fonction: 'Directeur du développement' },
    { id: 'thomas-ezquerra', prenom: 'Thomas', nom: 'Ezquerra', fonction: 'Dirigeant' },
    { id: 'philippe-korchia', prenom: 'Philippe', nom: 'Korchia', fonction: 'Directeur commercial' },
    { id: 'lucas-hindelang', prenom: 'Lucas', nom: 'Hindelang', fonction: 'Développement foncier' },
  ];
  const [profiles, setProfiles] = useState([]);
  useEffect(() => {
    (async () => {
      let list = [];
      try {
        const { data: profs } = await supabase.from('profiles').select('id, prenom, nom, email, tel, fonction');
        list = (profs || []).filter(p => p.prenom || p.nom);
      } catch { /* ignore */ }
      if (!list.length) list = EQUIPE_FALLBACK;
      setProfiles(list);
      const { data: { user } } = await supabase.auth.getUser();
      // Par défaut : le consultant = celui qui crée l'avis (si non déjà choisi)
      if (!data.preconisation.consultant_id) {
        const meProf = list.find(p => p.id === user?.id) || list[0];
        if (meProf) setConsultant(meProf);
      }
      // Honoraires par défaut : barème selon le prix (sinon 5 %)
      if (!(+data.preconisation.honoraires_pct)) {
        update('preconisation.honoraires_pct', honorairesBareme(data.preconisation.prix_marche || mandat?.prix_net_vendeur || mandat?.prix));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Barème d'honoraires par défaut selon le prix (net vendeur / marché)
  function honorairesBareme(prix) {
    const p = +prix || 0;
    if (p > 1000000) return 2; if (p >= 750000) return 3; if (p >= 500000) return 4; return 5;
  }
  function setConsultant(p) {
    if (!p) return;
    setData(prev => ({ ...prev, preconisation: { ...prev.preconisation,
      consultant_id: p.id,
      consultant_nom: `${p.prenom || ''} ${p.nom || ''}`.trim() + (p.fonction ? ` — ${p.fonction}` : ''),
      consultant_email: p.email || '', consultant_tel: p.tel || '',
    } }));
  }

  const [validating, setValidating] = useState(-1);
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistNote, setAssistNote] = useState('');

  // Assistant de l'avis : un ordre oral → ajustements ± % + positionnement + reco.
  async function handleAssistantCommand(transcript) {
    if (!transcript) return;
    setAssistBusy(true); setAssistNote('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/avis-valeur/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: session?.access_token || '', transcript,
          context: {
            type: mandat?.type, surface: mandat?.surface,
            prixMarche: data.preconisation.prix_marche || mandat?.prix_net_vendeur || mandat?.prix,
            prixM2: mandat?.prix_m2,
            ajustementsActuels: data.preconisation.ajustements || [],
          },
        }),
      });
      const j = await res.json();
      if (!j.ok) { setAssistNote('⚠️ ' + (j.error || 'Assistant indisponible.')); setAssistBusy(false); return; }
      setData(prev => {
        const p = { ...prev.preconisation };
        p.ajustements = [...(p.ajustements || []), ...(j.ajustements || [])];
        if (j.positionnement) p.positionnement = j.positionnement;
        if (j.recommandation) p.recommandation = ((p.recommandation || '').trim() + ' ' + j.recommandation).trim();
        return { ...prev, preconisation: p };
      });
      setAssistNote('✓ ' + (j.resume || `${(j.ajustements || []).length} ajustement(s) ajouté(s).`) + ` — « ${transcript.slice(0, 80)} »`);
    } catch (e) { setAssistNote('⚠️ ' + e.message); }
    finally { setAssistBusy(false); }
  }

  // Compresse un screenshot en data URL (max 1000px) pour les biens similaires
  function readImageCompressed(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const max = 1000; const scale = Math.min(1, max / img.width);
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject; img.src = e.target.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }

  async function validerBienLien(i) {
    const arr = [...(data.comparables.biens_similaires || [])];
    const bs = arr[i] || {};
    if (!bs.lien) { alert('Colle d\'abord le lien de l\'annonce.'); return; }
    setValidating(i);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/link-preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session?.access_token || '', url: bs.lien }),
      });
      const j = await res.json();
      if (!j.ok) { alert(j.error || 'Aperçu indisponible.'); setValidating(-1); return; }
      while (arr.length < 3) arr.push({});
      arr[i] = {
        ...bs,
        photo: j.image || bs.photo || '',
        adresse: bs.adresse || j.title || '',
        prix: bs.prix || j.prix || 0,
        surface: bs.surface || j.surface || 0,
      };
      update('comparables.biens_similaires', arr);
      if (!j.image && !j.prix && !j.surface) alert('Lien ouvert mais aucune info trouvée (site protégé). Remplis à la main.');
    } catch (e) { alert('Erreur : ' + e.message); }
    setValidating(-1);
  }

  const toggle = (k) => setOpenSections(s => ({ ...s, [k]: !s[k] }));
  // Grands thèmes à valider : on coche un bloc → il passe en vert et se replie.
  const THEMES = ['localisation', 'comparables', 'caracteristiques', 'visite', 'methodes', 'preconisation'];
  const valide = data._valide || {};
  const nbValides = THEMES.filter(k => valide[k]).length;
  // Phase AUTO : la visite renseignée fait basculer le doc en « avis définitif ».
  const VIS_KEYS = ['architecture', 'immeuble_qualite', 'parties_communes', 'agencement', 'volumes', 'luminosite', 'exposition', 'vues', 'etat_general', 'travaux', 'potentiel'];
  const visiteRempli = !!(data.visite && (
    VIS_KEYS.some(k => String(data.visite[k] || '').trim()) ||
    (Array.isArray(data.visite.prestations) && data.visite.prestations.some(x => String(x || '').trim()))
  ));
  const validerTheme = (k, v) => {
    setData(prev => ({ ...prev, _valide: { ...(prev._valide || {}), [k]: v } }));
    setOpenSections(s => ({ ...s, [k]: !v }));
  };
  const update = (path, value) => {
    setData(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let cur = copy;
      for (let i = 0; i < keys.length - 1; i++) {
        if (cur[keys[i]] === undefined || cur[keys[i]] === null) cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return copy;
    });
  };

  // Récupération auto de la situation locative depuis le mandat
  const lotsFromMandat = mandat?.etatLocatif || mandat?.etat_locatif || [];
  const sumLoyer = Array.isArray(lotsFromMandat)
    ? lotsFromMandat.reduce((s, l) => s + (parseFloat(l.loyer) || 0), 0)
    : 0;
  const sumPotentiel = Array.isArray(lotsFromMandat)
    ? lotsFromMandat.reduce((s, l) => {
        const p = parseFloat(l.loyer_potentiel) || 0;
        return s + (p > 0 ? p : (parseFloat(l.loyer) || 0));
      }, 0)
    : 0;
  const caActuelHTAnnuel = sumLoyer * 12;
  const caPotentielHTAnnuel = sumPotentiel * 12;

  // Highlights IA et description du mandat
  const mandatHighlights = mandat?.highlights || [];

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('mandats')
        .update({ avis_valeur: data })
        .eq('id', mandat.id);
      if (error) {
        alert('Erreur sauvegarde : ' + error.message);
      } else {
        onSaved?.(data);
        onClose();
      }
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
    setSaving(false);
  }

  // Envoi de l'avis (beau PDF) au mandant par e-mail. Enregistre d'abord l'avis
  // pour que le PDF reflète la dernière saisie, puis appelle la route serveur.
  async function sendToMandant() {
    setSendingMandant(true);
    try {
      await supabase.from('mandats').update({ avis_valeur: data }).eq('id', mandat.id);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/avis-valeur/send-mandant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session?.access_token || '', mandatId: mandat.id }),
      });
      const j = await res.json().catch(() => ({ ok: false, error: 'Réponse invalide du serveur.' }));
      if (!j.ok) { alert(j.error || "Envoi impossible."); }
      else { alert(`${visiteRempli ? 'Avis' : 'Pré-avis'} de valeur envoyé au mandant : ${j.to}`); setShowSendModal(false); }
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
    setSendingMandant(false);
  }
  async function handleGenerate() {
    setGenerating(true);
    try {
      const { error: saveErr } = await supabase
        .from('mandats')
        .update({ avis_valeur: data })
        .eq('id', mandat.id);
      
      if (saveErr) {
        alert('Erreur de sauvegarde avant generation : ' + saveErr.message);
        setGenerating(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('Session expirée, reconnecte-toi');
        setGenerating(false);
        return;
      }

      const response = await fetch('/api/avis-valeur/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mandatId: mandat.id }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        alert('Erreur generation PDF : ' + (errData.error || response.statusText) + 
              (errData.details ? '\n' + errData.details : ''));
        setGenerating(false);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cd = response.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      link.download = match ? match[1] : `Avis_de_valeur_${mandat.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      onSaved?.(data);
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
    setGenerating(false);
  }

  const fieldClass = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900";
  const labelClass = "block text-xs font-medium text-stone-600 mb-1";

  return (
    <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-luxe-hover w-full max-w-4xl max-h-[94vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >

        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div>
            <h2 className="font-display text-2xl font-semibold text-stone-900 flex items-center gap-2">
              📊 Avis de valeur
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {mandat?.adresse || mandat?.nom || 'Mandat'} · {mandat?.surface ? `${mandat.surface} m²` : ''}
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-cream-100 text-stone-600 border border-cream-dark">{estB2C ? 'Habitation (BtoC)' : 'Investissement (BtoB)'}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Assistant de l'avis : dicte un ordre → ajustements auto */}
            <span title="Dicte un ordre à l'assistant : ex. « exposition mauvaise et bruyant → on se positionne en dessous » ou « rénové par un architecte renommé → surcote »">
              {assistBusy
                ? <span className="inline-flex items-center gap-1.5 px-2.5 py-2 text-sm text-sage-darker"><Loader2 className="w-4 h-4 animate-spin" /> Analyse…</span>
                : <MicButton onText={handleAssistantCommand} title="Assistant de l'avis" />}
            </span>
            <button onClick={handlePrefill} disabled={prefilling || saving || generating}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-sage-100 to-sage-200 text-sage-darker rounded-lg text-sm hover:from-sage-200 hover:to-sage-300 font-medium border border-sage-light disabled:opacity-50"
              title="Générer un premier jet de l'avis à partir de la fiche mandat (ne remplace pas ce qui est déjà saisi)">
              {prefilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {prefilling ? 'Rédaction…' : 'Pré-remplir avec l\'IA'}
            </button>
            <button onClick={onClose} className="text-stone-500 hover:text-stone-900">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {assistNote && (
          <div className="px-6 py-2 text-xs bg-sage-50 border-b border-sage-light text-sage-darker">{assistNote}</div>
        )}

        {/* BODY */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-3 bg-cream-50/30">

          {/* ─── 0. NIVEAU DU DOCUMENT (automatique, non modifiable) ─── */}
          <div className={`rounded-lg border p-3 ${visiteRempli ? 'border-sage-dark/40 bg-sage-50/60' : 'border-stone-200 bg-white'}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-semibold text-sage-darker uppercase tracking-wide">Niveau du document — automatique</div>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  {visiteRempli
                    ? 'Avis définitif — la visite est renseignée. Mêmes pages que le pré-avis, enrichies par la visite.'
                    : 'Pré-avis — dès que tu remplis « La visite » (thème 4), le document passe tout seul en avis définitif.'}
                </p>
              </div>
              <span className={`px-3 py-1.5 text-sm font-semibold rounded-lg flex-shrink-0 ${visiteRempli ? 'bg-sage-dark text-white' : 'bg-stone-100 text-stone-600'}`}>
                {visiteRempli ? 'Avis définitif' : 'Pré-avis'}
              </span>
            </div>
          </div>

          {/* ─── PROGRESSION DES GRANDS THÈMES ─── */}
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Grands thèmes à valider</span>
              <span className="text-xs font-medium text-sage-darker">{nbValides} / {THEMES.length} validés</span>
            </div>
            <div className="flex gap-1">
              {THEMES.map((k, i) => (
                <div key={k} className={`flex-1 h-1.5 rounded-full ${valide[k] ? 'bg-sage-dark' : 'bg-stone-200'}`} title={`Thème ${i + 1}`} />
              ))}
            </div>
          </div>

          {/* ─── 1. LOCALISATION (repliée) ─── */}
          <Section
            num={1} valide={valide.localisation} onValider={(v) => validerTheme('localisation', v)}
            open={openSections.localisation} onToggle={() => toggle('localisation')}
            title="Le secteur — quartier, rue & urbanisme" icon={<MapPin className="w-4 h-4" />}
            subtitle="Quartier, transports, cadastre & risques auto-récupérés · enrichis les commentaires"
            count={[data.localisation.commentaire, data.localisation.commentaire_rue, data.localisation.commentaire_urbanisme].filter(Boolean).length}
          >
            <div className="space-y-3">
              <div className="bg-cream-100/50 rounded-lg p-3 text-xs text-stone-600">
                <strong>Adresse :</strong> {mandat?.adresse || '—'}
              </div>
              <div>
                <label className={labelClass}>Transports & accessibilité (libre)</label>
                <textarea
                  value={data.localisation.transports}
                  onChange={e => update('localisation.transports', e.target.value)}
                  rows={3} className={fieldClass}
                  placeholder="Ex: Métro Bastille (L1, L5, L8) à 5 min · Bus 20, 29, 65 · A4 / Périphérique"
                />
                <p className="text-[10px] text-stone-400 mt-1 italic">Plus tard : récupération auto via API transports.</p>
              </div>
              <div>
                <label className={labelClass}>Commentaire sur le quartier (page « Le secteur »)</label>
                <textarea
                  value={data.localisation.commentaire}
                  onChange={e => update('localisation.commentaire', e.target.value)}
                  rows={3} className={fieldClass}
                  placeholder="Ex: Emplacement stratégique au cœur du quartier Bastille, l'un des secteurs tertiaires les plus dynamiques..."
                />
              </div>
              <div>
                <label className={labelClass}>Commentaire sur la rue (page « L'analyse de la rue »)</label>
                <textarea
                  value={data.localisation.commentaire_rue}
                  onChange={e => update('localisation.commentaire_rue', e.target.value)}
                  rows={2} className={fieldClass}
                  placeholder="Ex: Rue calme et recherchée, immeubles de caractère, faible rotation des biens…"
                />
                <p className="text-[10px] text-stone-400 mt-1 italic">Vide = phrase générée automatiquement à partir des ventes DVF de la voie.</p>
              </div>
              <div>
                <label className={labelClass}>Commentaire urbanisme / cadastre / risques (page « Cadastre & urbanisme »)</label>
                <textarea
                  value={data.localisation.commentaire_urbanisme}
                  onChange={e => update('localisation.commentaire_urbanisme', e.target.value)}
                  rows={2} className={fieldClass}
                  placeholder="Ex: Zone UG du PLU, secteur sauvegardé du Marais, servitude de cour commune…"
                />
                <p className="text-[10px] text-stone-400 mt-1 italic">Les risques naturels (Géorisques) et la parcelle cadastrale sont ajoutés automatiquement.</p>
              </div>
            </div>
          </Section>


          {/* ─── 4. COMPARABLES (repliée) ─── */}
          <Section
            num={2} valide={valide.comparables} onValider={(v) => validerTheme('comparables', v)}
            open={openSections.comparables} onToggle={() => toggle('comparables')}
            title="Comparables & données marché" icon={<BarChart3 className="w-4 h-4" />}
            subtitle="Ventes réelles DVF + saisie libre"
            count={data.comparables.transactions_recentes ? 1 : 0}
          >
            <div className="space-y-3">
              {/* Comparables réels DVF (paramétrable, triable, sélectionnable) */}
              <DvfComparables
                mandat={mandat}
                savedVentes={data.comparables.ventes}
                onApply={(r) => {
                  const surf = +mandat?.surface || 0;
                  const med = +r.mediane || 0; // médiane €/m²
                  const centre = med && surf ? Math.round(med * surf) : 0;
                  setData(prev => {
                    const next = JSON.parse(JSON.stringify(prev));
                    next.comparables.prix_zone_min = r.prix_zone_min;
                    next.comparables.prix_zone_max = r.prix_zone_max;
                    next.comparables.transactions_recentes = r.transactions_recentes;
                    next.comparables.ventes = r.ventes || [];
                    next.comparables.par_annee = r.parAnnee || [];
                    next.comparables.mediane_m2 = med;
                    if (med) next.comparables.commentaire = `Médiane observée : ${med.toLocaleString('fr-FR')} €/m² sur ${r.count} vente(s) DVF retenue(s).`;
                    // Le prix de marché = médiane DVF × surface ; méthode : centrale −10 % / +10 %
                    if (centre) {
                      next.preconisation.prix_marche = centre;
                      next.preconisation.prix_plancher = Math.round(centre * 0.95);
                      next.preconisation.prix_coup_de_coeur = Math.round(centre * 1.05);
                      next.methode_m2 = {
                        valeur_basse: { prix_m2: Math.round(med * 0.95), valeur_totale: Math.round(centre * 0.95), commentaire: 'Scénario prudent (−5 % sous la médiane).' },
                        valeur_centrale: { prix_m2: med, valeur_totale: centre, commentaire: 'Médiane DVF du secteur × surface.' },
                        valeur_haute: { prix_m2: Math.round(med * 1.05), valeur_totale: Math.round(centre * 1.05), commentaire: 'Scénario haut (+5 % au-dessus de la médiane).' },
                      };
                    }
                    return next;
                  });
                  if (med && !surf) alert('Astuce : renseigne la surface du mandat pour calculer automatiquement le prix (médiane × surface).');
                }}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Prix zone MIN (€/m²)</label>
                  <input type="number" value={data.comparables.prix_zone_min || ''}
                    onChange={e => update('comparables.prix_zone_min', +e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Prix zone MAX (€/m²)</label>
                  <input type="number" value={data.comparables.prix_zone_max || ''}
                    onChange={e => update('comparables.prix_zone_max', +e.target.value)} className={fieldClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Rendement zone MIN (%)</label>
                  <input type="number" step="0.1" value={data.comparables.rendement_zone_min || ''}
                    onChange={e => update('comparables.rendement_zone_min', +e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Rendement zone MAX (%)</label>
                  <input type="number" step="0.1" value={data.comparables.rendement_zone_max || ''}
                    onChange={e => update('comparables.rendement_zone_max', +e.target.value)} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Prix au m² MeilleursAgents (d'après un screenshot de la rue)</label>
                <div className="flex gap-2 items-start">
                  <label className="w-16 h-16 flex-shrink-0 rounded border border-stone-200 bg-stone-50 overflow-hidden flex items-center justify-center cursor-pointer hover:border-sage-light" title="Coller le screenshot MeilleursAgents">
                    {data.comparables.meilleurs_agents_screenshot ? <img src={data.comparables.meilleurs_agents_screenshot} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-stone-300" />}
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const url = await readImageCompressed(f); update('comparables.meilleurs_agents_screenshot', url); } catch { alert('Image illisible.'); } }} />
                  </label>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <input type="number" value={data.comparables.meilleurs_agents_m2 || ''} onChange={e => update('comparables.meilleurs_agents_m2', +e.target.value)} placeholder="Prix au m² MeilleursAgents" className={fieldClass} />
                      <span className="text-xs text-stone-400 whitespace-nowrap">€/m²</span>
                    </div>
                    <p className="text-[10px] text-stone-400 mt-1 italic">Saisi à la main d'après MeilleursAgents (pas d'API). Entre dans le prix de référence, avec le DVF et les annonces.</p>
                  </div>
                </div>
              </div>
              <div>
                <label className={labelClass}>Commentaire sur le marché local</label>
                <textarea value={data.comparables.commentaire}
                  onChange={e => update('comparables.commentaire', e.target.value)}
                  rows={2} className={fieldClass} />
              </div>

              {/* Biens similaires DISPONIBLES (saisis à la main, avec lien) */}
              <div className="pt-2 border-t border-stone-100">
                <label className={labelClass}>Biens similaires disponibles (3 max) — colle les liens des annonces</label>
                {[0, 1, 2].map(i => {
                  const bs = (data.comparables.biens_similaires || [])[i] || {};
                  const setBs = (k, v) => {
                    const arr = [...(data.comparables.biens_similaires || [])];
                    while (arr.length < 3) arr.push({});
                    arr[i] = { ...arr[i], [k]: v };
                    update('comparables.biens_similaires', arr);
                  };
                  return (
                    <div key={i} className="flex gap-2 mb-2 items-start">
                      <label className="w-14 h-14 flex-shrink-0 rounded border border-stone-200 bg-stone-50 overflow-hidden flex items-center justify-center cursor-pointer hover:border-sage-light" title="Ajouter un screenshot de l'annonce">
                        {bs.photo ? <img src={bs.photo} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-stone-300" />}
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const f = e.target.files?.[0]; if (!f) return;
                          try { const url = await readImageCompressed(f); setBs('photo', url); } catch { alert('Image illisible.'); }
                        }} />
                      </label>
                      <div className="flex-1 grid grid-cols-12 gap-1.5">
                        <input value={bs.adresse || ''} onChange={e => setBs('adresse', e.target.value)} placeholder={`Bien ${i + 1} — adresse / titre`} className="col-span-5 px-2 py-1.5 text-xs border border-stone-200 rounded" />
                        <input type="number" value={bs.surface || ''} onChange={e => setBs('surface', +e.target.value)} placeholder="m²" className="col-span-2 px-2 py-1.5 text-xs border border-stone-200 rounded" />
                        <input type="number" value={bs.prix || ''} onChange={e => setBs('prix', +e.target.value)} placeholder="Prix €" className="col-span-5 px-2 py-1.5 text-xs border border-stone-200 rounded" />
                        <input value={bs.lien || ''} onChange={e => setBs('lien', e.target.value)} placeholder="Colle le lien de l'annonce…" className="col-span-9 px-2 py-1.5 text-xs border border-stone-200 rounded" />
                        <button type="button" onClick={() => validerBienLien(i)} disabled={validating === i}
                          className="col-span-3 px-2 py-1.5 text-xs rounded bg-sage-dark text-white hover:bg-sage-darker disabled:opacity-50 inline-flex items-center justify-center gap-1">
                          {validating === i ? <Loader2 className="w-3 h-3 animate-spin" /> : '⤵'} Valider
                        </button>
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-stone-400 mt-1 italic">Ces 3 biens apparaîtront sur une page dédiée « Biens similaires disponibles » de l'avis.</p>
              </div>
            </div>
          </Section>


          {/* ─── 3. CARACTÉRISTIQUES (repliée) ─── */}
          <Section
            num={3} valide={valide.caracteristiques} onValider={(v) => validerTheme('caracteristiques', v)}
            open={openSections.caracteristiques} onToggle={() => toggle('caracteristiques')}
            title="Caractéristiques & atouts — le bien" icon={<Building2 className="w-4 h-4" />}
            subtitle="Phase 2 (visite / dossier) · highlights IA + détails du bien"
            count={data.caracteristiques.atouts_distinctifs.length}
          >
            <div className="space-y-3">
              {/* Highlights IA en lecture seule */}
              {mandatHighlights.length > 0 && (
                <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-200">
                  <p className="text-[10px] uppercase text-amber-800 mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Points forts détectés par l'IA
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {mandatHighlights.map((h, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-white border border-amber-200 text-amber-900 rounded-full">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Année de construction <span className="text-sage-dark">· fiche</span></label>
                  <FicheField value={mandat?.annee_construction} block />
                </div>
                <div>
                  <label className={labelClass}>Architecte (si connu)</label>
                  <input
                    type="text"
                    value={data.caracteristiques.architecte}
                    onChange={e => update('caracteristiques.architecte', e.target.value)}
                    placeholder="ex: E. Gutelle" className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Distribution par niveau (libre)</label>
                <textarea
                  value={data.caracteristiques.distribution}
                  onChange={e => update('caracteristiques.distribution', e.target.value)}
                  rows={3} className={fieldClass}
                  placeholder="R-1: 415 m² · RDC: 850 m² · R+1: 510 m² · R+2: 335 m²..."
                />
              </div>

              <ArrayEditor
                label="Atouts distinctifs (bullets)"
                items={data.caracteristiques.atouts_distinctifs}
                onChange={items => update('caracteristiques.atouts_distinctifs', items)}
                placeholder="Ex: Immeuble indépendant — totale liberté d'usage"
              />

              <div>
                <label className={labelClass}>Descriptif du bien <span className="text-sage-dark">· fiche</span></label>
                <FicheField value={mandat?.description} block multiline />
                <p className="text-[10px] text-stone-400 mt-1 italic">Vient de la fiche du bien (« Modifier mandat ») — sert aussi aux plaquettes.</p>
              </div>
            </div>
          </Section>


          {/* ─── 3bis. VISITE (Phase 2) — dictée + champs ─── */}
          <Section
            num={4} valide={valide.visite} onValider={(v) => validerTheme('visite', v)}
            open={openSections.visite} onToggle={() => toggle('visite')}
            title="La visite — le bien en détail" icon={<Building2 className="w-4 h-4" />}
            subtitle={visiteRempli ? "Visite renseignée → avis définitif · dictée ou saisie" : "Remplis cette section pour passer en avis définitif"}
            count={Object.entries(data.visite).filter(([k, v]) => k !== 'prestations' && String(v || '').trim()).length + (data.visite.prestations || []).filter(x => String(x || '').trim()).length}
          >
            <div className="space-y-3">
              <div className="bg-sage-50/60 border border-sage-light rounded-lg p-2.5 text-[11px] text-sage-darker flex items-center gap-2">
                <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Dicte tes observations sur place (bouton micro de chaque champ) ou écris-les. Ces éléments alimentent les pages « L'immeuble », « Volumes & lumière » et « Prestations & état ».
              </div>
              {(() => {
                const F = [
                  { k: 'architecture', label: 'Architecture / style', ph: 'Ex : immeuble haussmannien en pierre de taille, façade ordonnancée…' },
                  { k: 'immeuble_qualite', label: "Qualité de l'immeuble", ph: 'Ex : construction soignée, standing, ravalement récent…' },
                  { k: 'parties_communes', label: 'Parties communes', ph: 'Ex : hall en marbre, ascenseur, escalier avec tapis, bien entretenu…' },
                  { k: 'agencement', label: 'Agencement / distribution', ph: 'Ex : double séjour traversant, pas de perte de place…' },
                  { k: 'volumes', label: 'Volumes', ph: 'Ex : hauteur sous plafond 3,10 m, belles réceptions…' },
                  { k: 'luminosite', label: 'Luminosité', ph: 'Ex : très lumineux, traversant est-ouest…' },
                  { k: 'exposition', label: 'Exposition', ph: 'Ex : sud-ouest sur rue calme…' },
                  { k: 'vues', label: 'Vues / dégagement', ph: 'Ex : dégagée sur cour arborée, sans vis-à-vis…' },
                  { k: 'etat_general', label: 'État général', ph: 'Ex : bon état, rafraîchissement à prévoir dans la cuisine…' },
                  { k: 'travaux', label: 'Travaux éventuels', ph: 'Ex : électricité à reprendre, cuisine à refaire…' },
                  { k: 'potentiel', label: 'Potentiel de valorisation', ph: 'Ex : combles aménageables, possibilité de créer une suite parentale…' },
                ];
                return (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {F.map(({ k, label, ph }) => (
                      <div key={k}>
                        <div className="flex items-center justify-between mb-1">
                          <label className={labelClass} style={{ marginBottom: 0 }}>{label}</label>
                          <MicButton compact onText={(t) => update('visite.' + k, ((data.visite[k] || '').trim() + ' ' + t).trim())} />
                        </div>
                        <textarea value={data.visite[k] || ''} onChange={e => update('visite.' + k, e.target.value)}
                          rows={2} className={fieldClass} placeholder={ph} />
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelClass} style={{ marginBottom: 0 }}>Prestations remarquables (une par ligne)</label>
                  <MicButton compact onText={(t) => update('visite.prestations', [...(data.visite.prestations || []), t])} />
                </div>
                <textarea
                  value={(data.visite.prestations || []).join('\n')}
                  onChange={e => update('visite.prestations', e.target.value.split('\n'))}
                  rows={4} className={fieldClass}
                  placeholder={"Ex :\nParquet point de Hongrie\nCheminées en marbre\nMoulures et rosaces d'origine\nCuisine équipée haut de gamme"}
                />
              </div>
            </div>
          </Section>


          {/* ─── 3ter. DOCUMENTS & DPE (Phase 2 — option « sur pièces ») ─── */}
          <Section
            open={openSections.documents} onToggle={() => toggle('documents')}
            title="Documents — copropriété, fiscalité & DPE" icon={<FileDown className="w-4 h-4" />}
            subtitle="DPE, charges, taxe foncière, diagnostics, servitudes"
            count={[data.documents.travaux_votes, data.documents.procedures, data.documents.diagnostics, data.documents.servitudes, data.documents.commentaire, data.documents.charges_detail].filter(v => String(v || '').trim()).length + [mandat?.taxe_fonciere, mandat?.charges_annuelles, mandat?.nb_lots, data.documents.fonds_travaux].filter(v => +v).length}
          >
            <div className="space-y-3">
              {/* DPE — repris du mandat, commentaire d'expert optionnel */}
              <div className="bg-cream-100/50 rounded-lg p-3 text-xs text-stone-600 flex items-center gap-2">
                <strong>DPE :</strong> {mandat?.dpe_classe ? `Classe ${mandat.dpe_classe}` : 'classe non renseignée'}{mandat?.dpe_consommation ? ` · ${mandat.dpe_consommation} kWh/m²·an` : ''}
                <span className="text-stone-400 italic">— l'impact valeur, les obligations et les pistes sont générés automatiquement.</span>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelClass} style={{ marginBottom: 0 }}>Commentaire DPE (optionnel)</label>
                  <MicButton compact onText={(t) => update('dpe.commentaire', ((data.dpe.commentaire || '').trim() + ' ' + t).trim())} />
                </div>
                <textarea value={data.dpe.commentaire || ''} onChange={e => update('dpe.commentaire', e.target.value)}
                  rows={2} className={fieldClass} placeholder="Ex : audit réalisé, devis d'isolation obtenu à 25 000 €, gain estimé de 2 classes…" />
              </div>
              {/* Infos déjà sur la fiche — lecture seule (source unique, plus de double saisie) */}
              <div className="rounded-lg border border-cream-dark bg-cream-100/40 p-3">
                <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-2">Depuis la fiche du bien</div>
                <div className="grid grid-cols-3 gap-3">
                  <FicheField label="Taxe foncière" value={mandat?.taxe_fonciere} format={v => `${(+v).toLocaleString('fr-FR')} €/an`} />
                  <FicheField label="Charges copro" value={mandat?.charges_annuelles} format={v => `${(+v).toLocaleString('fr-FR')} €/an`} />
                  <FicheField label="Nombre de lots" value={mandat?.nb_lots} />
                </div>
                <p className="text-[10px] text-stone-400 mt-2 italic">Ces infos viennent de la fiche du bien — pour les modifier, ouvre « Modifier mandat ».</p>
              </div>
              {/* Fonds travaux — spécifique à l'avis */}
              <div>
                <label className={labelClass}>Fonds travaux (€)</label>
                <input type="number" value={data.documents.fonds_travaux || ''} onChange={e => update('documents.fonds_travaux', +e.target.value)} className={fieldClass} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelClass} style={{ marginBottom: 0 }}>Ce que comprennent les charges</label>
                  <MicButton compact onText={(t) => update('documents.charges_detail', ((data.documents.charges_detail || '').trim() + ' ' + t).trim())} />
                </div>
                <textarea value={data.documents.charges_detail || ''} onChange={e => update('documents.charges_detail', e.target.value)}
                  rows={2} className={fieldClass} placeholder="Ex : chauffage collectif et eau chaude inclus, gardien, entretien des parties communes, ascenseur…" />
              </div>
              {/* Textes du dossier (dictée possible) */}
              {[
                { k: 'travaux_votes', label: 'Travaux votés / à prévoir (copropriété)', ph: 'Ex : ravalement voté 2025, réfection toiture à prévoir…' },
                { k: 'procedures', label: 'Procédures / points de vigilance copropriété', ph: 'Ex : aucune procédure en cours · impayés maîtrisés…' },
                { k: 'diagnostics', label: 'Diagnostics techniques', ph: 'Ex : amiante néant, plomb néant, électricité conforme…' },
                { k: 'servitudes', label: 'Servitudes', ph: 'Ex : cour commune, servitude de passage…' },
              ].map(({ k, label, ph }) => (
                <div key={k}>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelClass} style={{ marginBottom: 0 }}>{label}</label>
                    <MicButton compact onText={(t) => update('documents.' + k, ((data.documents[k] || '').trim() + ' ' + t).trim())} />
                  </div>
                  <textarea value={data.documents[k] || ''} onChange={e => update('documents.' + k, e.target.value)} rows={2} className={fieldClass} placeholder={ph} />
                </div>
              ))}
              <div>
                <label className={labelClass}>Synthèse du dossier (optionnel)</label>
                <textarea value={data.documents.commentaire || ''} onChange={e => update('documents.commentaire', e.target.value)}
                  rows={2} className={fieldClass} placeholder="Ex : copropriété saine, charges maîtrisées, aucun point bloquant pour la vente." />
              </div>
            </div>
          </Section>


          {/* ─── 2. SITUATION LOCATIVE (repliée, lecture auto) — BtoB seulement ─── */}
          {!estB2C && (
          <Section
            open={openSections.locatif} onToggle={() => toggle('locatif')}
            title="Situation locative" icon={<Key className="w-4 h-4" />}
            subtitle={`Auto-affiché depuis l'état locatif · ${lotsFromMandat.length} lot${lotsFromMandat.length > 1 ? 's' : ''}`}
            count={lotsFromMandat.length > 0 ? 1 : 0}
          >
            {lotsFromMandat.length === 0 ? (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-xs text-amber-900">
                ⚠️ Aucun lot saisi dans l'état locatif du mandat. Saisir d'abord les lots dans le formulaire "Modifier mandat".
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-sage-50 rounded-lg p-3 border border-sage-light">
                    <p className="text-[10px] uppercase text-sage-darker">CA actuel HT/an</p>
                    <p className="text-lg font-semibold text-sage-darker">
                      {caActuelHTAnnuel > 0 ? `${caActuelHTAnnuel.toLocaleString('fr-FR')} €` : '—'}
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <p className="text-[10px] uppercase text-amber-800">CA potentiel HT/an</p>
                    <p className="text-lg font-semibold text-amber-800">
                      {caPotentielHTAnnuel > 0 ? `${caPotentielHTAnnuel.toLocaleString('fr-FR')} €` : '—'}
                    </p>
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-stone-200 max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-stone-50 border-b">
                      <tr>
                        <th className="text-left px-2 py-1.5 text-stone-600">Lot</th>
                        <th className="text-left px-2 py-1.5 text-stone-600">Surface</th>
                        <th className="text-right px-2 py-1.5 text-stone-600">Loyer/mois</th>
                        <th className="text-right px-2 py-1.5 text-stone-600">Potentiel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lotsFromMandat.map((l, i) => (
                        <tr key={i} className="border-b border-stone-100 last:border-0">
                          <td className="px-2 py-1.5">{l.numero || (i + 1)} · {l.type || l.nature || '—'}</td>
                          <td className="px-2 py-1.5">{l.surface ? `${l.surface} m²` : '—'}</td>
                          <td className="px-2 py-1.5 text-right">{l.loyer ? `${parseFloat(l.loyer).toLocaleString('fr-FR')} €` : '—'}</td>
                          <td className="px-2 py-1.5 text-right text-amber-700">{l.loyer_potentiel ? `${parseFloat(l.loyer_potentiel).toLocaleString('fr-FR')} €` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <label className={labelClass}>Commentaire sur la situation locative</label>
                  <textarea
                    value={data.situation_locative.commentaire}
                    onChange={e => update('situation_locative.commentaire', e.target.value)}
                    rows={2} className={fieldClass}
                    placeholder="Ex: Immeuble livré libre à la vente, les deux occupants libèrent l'ensemble..."
                  />
                </div>
              </div>
            )}
          </Section>
          )}


          {/* ─── 6. MÉTHODES D'ANALYSE DE VALEUR (dépliée) ─── */}
          <Section
            num={5} valide={valide.methodes} onValider={(v) => validerTheme('methodes', v)}
            open={openSections.methodes} onToggle={() => toggle('methodes')}
            title="Méthodes d'analyse de valeur" icon={<Calculator className="w-4 h-4" />}
            subtitle="Par comparaison m² + par capitalisation"
            count={(data.methode_m2.valeur_centrale.prix_m2 > 0 ? 1 : 0) + (data.methode_capi.hypotheses.length > 0 ? 1 : 0)}
          >
            <div className="space-y-4">

              {/* Méthode par m² */}
              <div className="bg-white rounded-lg border border-stone-200 p-3">
                <p className="text-xs font-medium text-stone-700 mb-2">📐 Par comparaison au m²</p>
                <div className="grid grid-cols-3 gap-3">
                  <ValeurM2Card label="Valeur basse" color="blue" data={data.methode_m2.valeur_basse}
                    onChange={v => update('methode_m2.valeur_basse', v)} />
                  <ValeurM2Card label="Valeur centrale" color="emerald" data={data.methode_m2.valeur_centrale}
                    onChange={v => update('methode_m2.valeur_centrale', v)} />
                  <ValeurM2Card label="Valeur haute" color="amber" data={data.methode_m2.valeur_haute}
                    onChange={v => update('methode_m2.valeur_haute', v)} />
                </div>
              </div>

              {/* Méthode par capitalisation — BtoB seulement */}
              {!estB2C && (
              <div className="bg-white rounded-lg border border-stone-200 p-3">
                <p className="text-xs font-medium text-stone-700 mb-2">💰 Par capitalisation des revenus</p>
                <div>
                  <label className={labelClass}>CA HT annuel (base de calcul)</label>
                  <input type="number" value={data.methode_capi.ca_base || ''}
                    onChange={e => update('methode_capi.ca_base', +e.target.value)} className={fieldClass}
                    placeholder="Ex: 763 600" />
                </div>
                <div className="mt-2">
                  <label className={labelClass}>Hypothèses de rendement → valeur</label>
                  <div className="space-y-1.5">
                    {data.methode_capi.hypotheses.map((h, i) => (
                      <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                        <input type="number" step="0.05" value={h.rendement_pct || ''}
                          onChange={e => {
                            const arr = [...data.methode_capi.hypotheses];
                            arr[i] = { ...h, rendement_pct: +e.target.value };
                            update('methode_capi.hypotheses', arr);
                          }}
                          placeholder="6,5"
                          className="col-span-2 px-2 py-1 text-xs border border-stone-200 rounded" />
                        <span className="col-span-1 text-xs text-stone-500">%</span>
                        <input type="number" value={h.valeur_acte || ''}
                          onChange={e => {
                            const arr = [...data.methode_capi.hypotheses];
                            arr[i] = { ...h, valeur_acte: +e.target.value };
                            update('methode_capi.hypotheses', arr);
                          }}
                          placeholder="Valeur acte (€)"
                          className="col-span-3 px-2 py-1 text-xs border border-stone-200 rounded" />
                        <input type="text" value={h.lecture || ''}
                          onChange={e => {
                            const arr = [...data.methode_capi.hypotheses];
                            arr[i] = { ...h, lecture: e.target.value };
                            update('methode_capi.hypotheses', arr);
                          }}
                          placeholder="Lecture marché"
                          className="col-span-5 px-2 py-1 text-xs border border-stone-200 rounded" />
                        <button
                          onClick={() => update('methode_capi.hypotheses', data.methode_capi.hypotheses.filter((_, x) => x !== i))}
                          className="col-span-1 text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => update('methode_capi.hypotheses', [...data.methode_capi.hypotheses, { rendement_pct: 0, valeur_acte: 0, lecture: '' }])}
                      className="w-full py-1.5 border border-dashed border-stone-300 rounded text-xs text-stone-500 hover:bg-stone-50 flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Ajouter une hypothèse
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <label className={labelClass}>Zone d'atterrissage (texte libre)</label>
                  <textarea value={data.methode_capi.zone_atterrissage}
                    onChange={e => update('methode_capi.zone_atterrissage', e.target.value)}
                    rows={2} className={fieldClass}
                    placeholder="Ex: Zone d'atterrissage commercialisation : 27 M€ à 29 M€ — Atterrissage probable : 24,5 M€ à 27 M€..." />
                </div>
              </div>
              )}
            </div>
          </Section>


          {/* ─── 7. POTENTIEL DE RECONVERSION (dépliée) — BtoB seulement ─── */}
          {!estB2C && (
          <Section
            open={openSections.reconversion} onToggle={() => toggle('reconversion')}
            title="Potentiel de reconversion" icon={<Repeat className="w-4 h-4" />}
            subtitle="Usages alternatifs + bilan financier indicatif"
            count={data.reconversion.usages.length}
          >
            <div className="space-y-3">
              {/* Usages alternatifs */}
              <div className="space-y-2">
                {data.reconversion.usages.map((u, i) => (
                  <div key={i} className="bg-white rounded-lg border border-stone-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-stone-700">Usage #{i + 1}</p>
                      <button
                        onClick={() => update('reconversion.usages', data.reconversion.usages.filter((_, x) => x !== i))}
                        className="text-stone-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input type="text" placeholder="Titre (ex: Reconversion hôtelière 49 chambres)"
                      value={u.titre || ''}
                      onChange={e => {
                        const arr = [...data.reconversion.usages];
                        arr[i] = { ...u, titre: e.target.value };
                        update('reconversion.usages', arr);
                      }} className={fieldClass} />
                    <textarea placeholder="Description / arguments / atouts" rows={3}
                      value={u.description || ''}
                      onChange={e => {
                        const arr = [...data.reconversion.usages];
                        arr[i] = { ...u, description: e.target.value };
                        update('reconversion.usages', arr);
                      }} className={fieldClass} />
                  </div>
                ))}
                <button
                  onClick={() => update('reconversion.usages', [...data.reconversion.usages, { titre: '', description: '' }])}
                  className="w-full py-2 border border-dashed border-stone-300 rounded-lg text-sm text-stone-500 hover:bg-white"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" /> Ajouter un usage alternatif
                </button>
              </div>

              {/* Bilan financier */}
              <div>
                <label className={labelClass}>Bilan financier indicatif (libre)</label>
                <textarea value={data.reconversion.bilan_financier}
                  onChange={e => update('reconversion.bilan_financier', e.target.value)}
                  rows={4} className={fieldClass}
                  placeholder="Ex:&#10;Prix acquisition : 17-19 M€&#10;Travaux conversion : ~10 M€&#10;FF&E : ~2,5 M€&#10;Coût total : ~30-32 M€&#10;CA hôtelier cible (RevPAR 220€) : ~3,9 M€/an&#10;Valeur hôtel livré (yield 6,5%) : ~60 M€" />
              </div>

              {/* Profils acquéreurs */}
              <ArrayEditor
                label="Profils d'acquéreurs ciblés"
                items={data.reconversion.profils_acquereurs}
                onChange={items => update('reconversion.profils_acquereurs', items)}
                placeholder="Ex: Groupes hôteliers indépendants (boutique 4-5*)"
              />
            </div>
          </Section>
          )}


          {/* ─── 8. PRÉCONISATION & 3 PRIX (dépliée) ─── */}
          <Section
            num={6} valide={valide.preconisation} onValider={(v) => validerTheme('preconisation', v)}
            open={openSections.preconisation} onToggle={() => toggle('preconisation')}
            title="Préconisation & 3 prix" icon={<Tag className="w-4 h-4" />}
            subtitle="Recommandation finale + prix + consultant"
            count={[data.preconisation.prix_coup_de_coeur, data.preconisation.prix_marche, data.preconisation.prix_plancher].filter(p => p > 0).length}
          >
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelClass} style={{ marginBottom: 0 }}>Recommandation stratégique</label>
                  <MicButton onText={(t) => update('preconisation.recommandation', ((data.preconisation.recommandation || '').trim() + ' ' + t).trim())} />
                </div>
                <textarea value={data.preconisation.recommandation}
                  onChange={e => update('preconisation.recommandation', e.target.value)}
                  rows={4} className={fieldClass}
                  placeholder="Écris ou dicte : positionner le bien à... compte tenu de... avec un objectif de signature sous X mois..." />
              </div>


              {/* Aperçu du calcul — IDENTIQUE à l'avis (référence mixte → décote/surcote → habitable + annexes) */}
              {(() => {
                const surf = +mandat?.surface || 0;
                const med = +data.comparables.mediane_m2 || 0;
                const annVals = (data.comparables.biens_similaires || []).map(b => (+b.prix && +b.surface) ? Math.round(+b.prix / +b.surface) : 0).filter(Boolean).sort((a, b) => a - b);
                const annM2 = annVals.length ? annVals[Math.floor(annVals.length / 2)] : 0;
                const maM2 = +data.comparables.meilleurs_agents_m2 || 0;
                const rParts = [[med, 0.5], [annM2, 0.25], [maM2, 0.25]].filter(x => x[0] > 0);
                const refM2 = rParts.length ? Math.round(rParts.reduce((s, [v, w]) => s + v * w, 0) / rParts.reduce((s, [, w]) => s + w, 0)) : 0;
                const srcTxt = [med && `DVF ${med.toLocaleString('fr-FR')}`, annM2 && `annonces ${annM2.toLocaleString('fr-FR')}`, maM2 && `MeilleursAgents ${maM2.toLocaleString('fr-FR')}`].filter(Boolean).join(' · ');
                const total = (data.preconisation.ajustements || []).reduce((s, a) => s + (+a.pct || 0), 0);
                const habM2 = Math.round(refM2 * (1 + total / 100));
                const habValue = Math.round(habM2 * surf);
                const annexesTotal = (data.preconisation.annexes || []).reduce((s, a) => s + ((+a.surface > 0 && +a.prorata > 0) ? Math.round(+a.surface * (+a.prorata / 100) * habM2) : 0), 0);
                const finale = (habValue + annexesTotal) ? Math.round((habValue + annexesTotal) / 5000) * 5000 : 0;
                const f = (n) => (n || 0).toLocaleString('fr-FR');
                if (!refM2 || !surf) return <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800">Renseigne la surface du mandat et lance une recherche DVF pour calculer le prix.</div>;
                return (
                  <div className="rounded-lg border border-sage-light bg-sage-50/40 p-3 text-xs space-y-1">
                    <div><b>Prix de référence :</b> <b className="text-sage-darker">{f(refM2)} €/m²</b> <span className="text-stone-500">(moyenne : {srcTxt})</span></div>
                    <div>Décote / surcote <b className={total < 0 ? 'text-red-600' : 'text-emerald-700'}>{total > 0 ? '+' : ''}{total} %</b> → €/m² retenu <b className="text-sage-darker">{f(habM2)} €/m²</b></div>
                    <div>Habitable {f(habValue)} €{annexesTotal ? <> + annexes {f(annexesTotal)} €</> : ''} = <b className="text-sage-darker">prix de marché {f(finale)} €</b></div>
                  </div>
                );
              })()}

              {/* Ajustement à la baisse justifié — pour positionner en fourchette basse */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">Décote / surcote (assumée, ±25 %)</div>

                {/* Curseurs ± % sur le prix au m² */}
                {(() => {
                  const aj = data.preconisation.ajustements || [];
                  const setAj = (arr) => update('preconisation.ajustements', arr);
                  const upd = (i, k, v) => { const a = [...aj]; a[i] = { ...a[i], [k]: v }; setAj(a); };
                  return (
                    <div>
                      <label className={labelClass}>Facteurs ± % (curseur)</label>
                      {aj.map((a, i) => (
                        <div key={i} className="mb-2 pb-2 border-b border-amber-100 last:border-0">
                          <div className="flex items-center gap-2">
                            <input value={a.label || ''} onChange={e => upd(i, 'label', e.target.value)} placeholder="Ex : 1er étage sombre" className="w-44 px-2 py-1 text-xs border border-stone-200 rounded" />
                            <input type="range" min="-25" max="25" step="1" value={a.pct || 0} onChange={e => upd(i, 'pct', +e.target.value)} className="flex-1 accent-sage-dark" />
                            <span className={`w-14 text-right text-sm font-semibold tabular-nums ${(+a.pct || 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{(+a.pct || 0) > 0 ? '+' : ''}{a.pct || 0} %</span>
                            <button type="button" onClick={() => setAj(aj.filter((_, x) => x !== i))} className="text-stone-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                          <input value={a.note || ''} onChange={e => upd(i, 'note', e.target.value)} placeholder="Justification (affichée sur la page de calcul) — ex : offre rare sur ce micro-secteur" className="mt-1 w-full px-2 py-1 text-xs border border-stone-200 rounded text-stone-600" />
                        </div>
                      ))}
                      <button type="button" onClick={() => setAj([...aj, { label: '', pct: -5, note: '' }])} className="text-xs text-sage-darker border border-sage-light rounded px-2 py-1 hover:bg-sage-50">+ Ajouter un facteur</button>
                      <p className="text-[10px] text-stone-400 mt-1.5 italic">La décote/surcote s'applique au prix de référence au m² ci-dessus. Le prix de marché se recalcule automatiquement.</p>
                    </div>
                  );
                })()}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelClass} style={{ marginBottom: 0 }}>Facteurs de décote (texte)</label>
                    <MicButton compact onText={(t) => update('preconisation.facteurs_decote', ((data.preconisation.facteurs_decote || '').trim() + ' ' + t).trim())} />
                  </div>
                  <textarea value={data.preconisation.facteurs_decote || ''}
                    onChange={e => update('preconisation.facteurs_decote', e.target.value)}
                    rows={2} className={fieldClass}
                    placeholder="Écris ou dicte : 1er étage sombre · charges 400 €/mois · marché baissier · peu d'atouts" />
                </div>
                <div>
                  <label className={labelClass}>Positionnement conseillé</label>
                  <input type="text" value={data.preconisation.positionnement || ''}
                    onChange={e => update('preconisation.positionnement', e.target.value)}
                    className={fieldClass}
                    placeholder="Ex : à positionner en fourchette basse, sous le prix de marché" />
                </div>
                <p className="text-[10px] text-stone-500 italic">Le positionnement conseillé apparaît discrètement sous la préconisation.</p>
              </div>

              {/* Annexes au prorata du €/m² habitable (jardin, cave, terrasse, parking…) */}
              <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
                <label className={labelClass}>Annexes — valorisées au prorata du prix au m² habitable</label>
                {(() => {
                  const anx = data.preconisation.annexes || [];
                  const setAnx = (arr) => update('preconisation.annexes', arr);
                  const updA = (i, k, v) => { const a = [...anx]; a[i] = { ...a[i], [k]: v }; setAnx(a); };
                  return (
                    <div className="space-y-1.5">
                      {anx.map((a, i) => (
                        <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                          <input value={a.type || ''} onChange={e => updA(i, 'type', e.target.value)} placeholder="Ex : Jardin" className="col-span-4 px-2 py-1 text-xs border border-stone-200 rounded" />
                          <div className="col-span-3 flex items-center gap-1"><input type="number" value={a.surface || ''} onChange={e => updA(i, 'surface', +e.target.value)} placeholder="Surface" className="w-full px-2 py-1 text-xs border border-stone-200 rounded" /><span className="text-[10px] text-stone-400">m²</span></div>
                          <div className="col-span-3 flex items-center gap-1"><input type="number" value={a.prorata || ''} onChange={e => updA(i, 'prorata', +e.target.value)} placeholder="Prorata" className="w-full px-2 py-1 text-xs border border-stone-200 rounded" /><span className="text-[10px] text-stone-400">%</span></div>
                          <button type="button" onClick={() => setAnx(anx.filter((_, x) => x !== i))} className="col-span-2 text-stone-400 hover:text-red-600 justify-self-end"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setAnx([...anx, { type: '', surface: 0, prorata: 30 }])} className="text-xs text-sage-darker border border-sage-light rounded px-2 py-1 hover:bg-sage-50">+ Ajouter une annexe</button>
                      <p className="text-[10px] text-stone-400 italic">Prorata = % du prix au m² habitable. Ex : jardin 10–80 % selon l'emplacement, cave ~15 %, terrasse ~40 %.</p>
                    </div>
                  );
                })()}
              </div>

              {/* Les 3 prix — DÉRIVÉS du calcul (référence mixte + décote/surcote + annexes) */}
              <div className="grid grid-cols-3 gap-3">
                <PrixCard label="Prix plancher" subtitle="Base négociation" value={data.preconisation.prix_plancher} color="blue" />
                <PrixCard label="Prix de marché" subtitle="Médiane × ajustements" value={data.preconisation.prix_marche} color="emerald" />
                <PrixCard label="Prix coup de cœur" subtitle="Acquéreur convaincu" value={data.preconisation.prix_coup_de_coeur} color="amber" />
              </div>
              <p className="text-[10px] text-stone-400 italic -mt-1">Ces 3 prix se recalculent automatiquement à partir de la médiane DVF et des ajustements ci-dessus — bouge les curseurs pour les faire évoluer.</p>

              <div>
                <label className={labelClass}>Avis client (témoignage à inclure)</label>
                <textarea value={data.preconisation.avis_client}
                  onChange={e => update('preconisation.avis_client', e.target.value)}
                  rows={3} className={fieldClass}
                  placeholder="Témoignage d'un client précédent à insérer..." />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Consultant</label>
                  <select value={data.preconisation.consultant_id || ''}
                    onChange={e => setConsultant(profiles.find(p => p.id === e.target.value))}
                    className={fieldClass}>
                    <option value="">— Choisir —</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{`${p.prenom || ''} ${p.nom || ''}`.trim()}</option>)}
                  </select>
                </div>
                <div className="col-span-2 flex items-end">
                  <p className="text-xs text-stone-500">
                    {data.preconisation.consultant_email || data.preconisation.consultant_tel
                      ? <>📧 {data.preconisation.consultant_email || '—'} · 📞 {data.preconisation.consultant_tel || '—'} <span className="text-stone-400">(auto)</span></>
                      : 'Email & téléphone récupérés automatiquement depuis la fiche du consultant.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Honoraires (%)</label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" step="0.1" value={data.preconisation.honoraires_pct || ''}
                      onChange={e => update('preconisation.honoraires_pct', +e.target.value)}
                      className={fieldClass} />
                    <button type="button" title="Barème auto selon le prix"
                      onClick={() => update('preconisation.honoraires_pct', honorairesBareme(data.preconisation.prix_marche || mandat?.prix_net_vendeur || mandat?.prix))}
                      className="text-[11px] whitespace-nowrap text-sage-darker border border-sage-light rounded px-2 py-2 hover:bg-sage-50">Auto</button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Date estimation</label>
                  <input type="date" value={data.date_estimation || ''}
                    onChange={e => update('date_estimation', e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Validité (mois)</label>
                  <input type="number" value={data.validite_mois || ''}
                    onChange={e => update('validite_mois', +e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Niveau de confiance</label>
                  <select value={data.preconisation.confiance || ''}
                    onChange={e => update('preconisation.confiance', e.target.value)} className={fieldClass}>
                    <option value="">Auto (selon les données)</option>
                    <option value="Indicatif">Indicatif</option>
                    <option value="Correct">Correct</option>
                    <option value="Élevé">Élevé</option>
                  </select>
                  <p className="text-[10px] text-stone-400 mt-1 italic">Affiché sur la page de la fourchette.</p>
                </div>
              </div>
            </div>
          </Section>


          {/* ─── 5. SWOT (dépliée) ─── */}
          <Section
            open={openSections.swot} onToggle={() => toggle('swot')}
            title="Analyse SWOT" icon={<Sparkles className="w-4 h-4" />}
            subtitle="Forces / Opportunités / Limites / Menaces"
            count={data.swot.forces.length + data.swot.opportunites.length + data.swot.facteurs_limitatifs.length + data.swot.menaces.length}
          >
            <div className="grid grid-cols-2 gap-3">
              <SwotQuadrant
                label="Forces" color="emerald" icon={<TrendingUp className="w-4 h-4" />}
                items={data.swot.forces}
                onChange={items => update('swot.forces', items)}
              />
              <SwotQuadrant
                label="Opportunités" color="blue" icon={<Sparkles className="w-4 h-4" />}
                items={data.swot.opportunites}
                onChange={items => update('swot.opportunites', items)}
              />
              <SwotQuadrant
                label="Facteurs limitatifs" color="amber" icon={<AlertTriangle className="w-4 h-4" />}
                items={data.swot.facteurs_limitatifs}
                onChange={items => update('swot.facteurs_limitatifs', items)}
              />
              <SwotQuadrant
                label="Menaces" color="red" icon={<Cloud className="w-4 h-4" />}
                items={data.swot.menaces}
                onChange={items => update('swot.menaces', items)}
              />
            </div>
          </Section>

        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between p-4 border-t border-stone-200 bg-white">
          <div className="text-xs text-stone-500">
            Document servant à <strong>convaincre le mandant</strong> de confier son bien.
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-stone-700 hover:bg-cream-100 rounded-lg"
            >
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving || generating}
              className="flex items-center gap-2 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
            <button onClick={async () => {
              setGenerating(true);
              try {
                await supabase.from('mandats').update({ avis_valeur: data }).eq('id', mandat.id);
                window.open(`/avis/${mandat.id}`, '_blank', 'noopener');
              } catch (e) { alert('Erreur : ' + e.message); }
              setGenerating(false);
            }} disabled={saving || generating}
              className="flex items-center gap-2 px-4 py-2 bg-sage-dark text-white rounded-lg text-sm hover:bg-sage-darker disabled:opacity-50"
              title="Enregistre puis ouvre l'avis (charte) — Imprimer → PDF"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {generating ? 'Ouverture…' : 'Aperçu / PDF'}
            </button>
            <button onClick={() => setShowSendModal(true)} disabled={saving || generating || sendingMandant}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm hover:bg-emerald-800 disabled:opacity-50"
              title="Envoie l'avis (PDF) au mandant par e-mail, avec un texte adapté"
            >
              <Send className="w-4 h-4" />
              Envoyer au mandant
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation d'envoi au mandant */}
      {showSendModal && (
        <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-[60] p-4" onClick={(e) => { e.stopPropagation(); if (!sendingMandant) setShowSendModal(false); }}>
          <div className="bg-white rounded-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Send className="w-5 h-5 text-emerald-700" />
              <h3 className="font-semibold text-stone-900">Envoyer au mandant</h3>
            </div>
            <p className="text-sm text-stone-600 mb-2">
              L'avis va être envoyé <b>par e-mail au mandant</b> (adresse enregistrée sur la fiche), avec le PDF joint.
            </p>
            <div className="text-sm rounded-lg border border-stone-200 bg-cream-50 p-3 mb-3">
              <div>Niveau : <b>{visiteRempli ? 'Avis définitif' : 'Pré-avis de valeur'}</b></div>
              <div className="text-xs text-stone-500 mt-1">
                {visiteRempli
                  ? "Texte de remerciement + proposition d'accompagnement pour la commercialisation."
                  : "Texte précisant qu'il s'agit d'une première estimation, à affiner après visite/documents."}
              </div>
            </div>
            <p className="text-[11px] text-stone-400 mb-4">Le PDF est généré au beau format « charte ». La génération peut prendre quelques secondes.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSendModal(false)} disabled={sendingMandant}
                className="px-3 py-2 text-sm text-stone-700 hover:bg-cream-100 rounded-lg disabled:opacity-50">Annuler</button>
              <button onClick={sendToMandant} disabled={sendingMandant}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm hover:bg-emerald-800 disabled:opacity-50">
                {sendingMandant ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sendingMandant ? 'Envoi…' : 'Confirmer l\'envoi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

// Affichage LECTURE SEULE d'une info venant de la fiche mandat (source unique).
function FicheField({ label, value, format, block, multiline }) {
  const has = value != null && value !== '' && !(typeof value === 'number' && value === 0);
  const disp = has ? (format ? format(value) : String(value)) : null;
  if (block) {
    return (
      <div className={`px-3 py-2 rounded-lg bg-cream-100/50 border border-cream-dark text-sm text-stone-700 ${multiline ? 'whitespace-pre-wrap min-h-[60px]' : 'min-h-[38px] flex items-center'}`}>
        {disp || <span className="text-stone-400 italic text-xs">à compléter sur la fiche</span>}
      </div>
    );
  }
  return (
    <div>
      {label && <div className="text-[10px] uppercase tracking-wide text-stone-500 mb-0.5">{label}</div>}
      {disp ? <div className="text-sm font-medium text-stone-800">{disp}</div>
        : <div className="text-xs text-stone-400 italic">à compléter</div>}
    </div>
  );
}

function Section({ title, icon, subtitle, open, onToggle, count, children, num, valide, onValider }) {
  const isTheme = num != null;
  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${valide ? 'border-sage-dark/40' : 'border-stone-200'}`}>
      <div className={`w-full flex items-center justify-between p-4 ${valide ? 'bg-sage-50/60' : ''}`}>
        <button onClick={onToggle} className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80">
          {open ? <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" />}
          {isTheme
            ? <span className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold ${valide ? 'bg-sage-dark text-white' : 'bg-stone-100 text-stone-500'}`}>{valide ? '✓' : num}</span>
            : <span className="text-stone-500 flex-shrink-0">{icon}</span>}
          <h3 className="font-medium text-sm text-stone-900">{title}</h3>
          {!isTheme && <span className="text-[10px] bg-stone-100 text-stone-400 px-1.5 py-0.5 rounded-full flex-shrink-0">complément</span>}
          {count > 0 && (
            <span className="text-[10px] bg-sage-100 text-sage-darker px-1.5 py-0.5 rounded-full flex-shrink-0">
              {count}
            </span>
          )}
          {subtitle && <span className="text-xs text-stone-400 italic truncate hidden sm:inline">· {subtitle}</span>}
        </button>
        {onValider && (
          <button
            onClick={() => onValider(!valide)}
            className={`ml-2 flex-shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors ${valide
              ? 'border-sage-dark/30 text-sage-darker bg-white hover:bg-sage-50'
              : 'border-sage-dark bg-sage-dark text-white hover:bg-sage-darker'}`}>
            {valide ? 'Modifier' : 'Valider ✓'}
          </button>
        )}
      </div>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

function SwotQuadrant({ label, color, icon, items, onChange }) {
  const [draft, setDraft] = useState('');
  const colorClasses = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };
  const pillClasses = {
    emerald: 'bg-emerald-100 text-emerald-900',
    blue: 'bg-blue-100 text-blue-900',
    amber: 'bg-amber-100 text-amber-900',
    red: 'bg-red-100 text-red-900',
  };

  const addItem = () => {
    if (draft.trim()) {
      onChange([...items, draft.trim()]);
      setDraft('');
    }
  };

  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-medium">
        {icon} {label}
        <span className="text-[10px] opacity-60">({items.length})</span>
      </div>
      <div className="space-y-1 mb-2">
        {items.map((item, idx) => (
          <div key={idx} className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${pillClasses[color]}`}>
            <span className="flex-1 break-words">{item}</span>
            <button
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="opacity-50 hover:opacity-100"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          type="text" value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder="Ajouter..."
          className="flex-1 px-2 py-1 bg-white border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900"
        />
        <button
          onClick={addItem}
          disabled={!draft.trim()}
          className="px-2 py-1 bg-white border border-stone-200 rounded text-xs hover:bg-cream-50 disabled:opacity-30"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// Carte prix — LECTURE SEULE : dérivée des ajustements. Arrondi 5 000 € en grand,
// prix réel calculé en petit dessous.
function PrixCard({ label, subtitle, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    amber: 'bg-amber-50 border-amber-200',
  };
  const labelColors = {
    blue: 'text-blue-900',
    emerald: 'text-emerald-900',
    amber: 'text-amber-900',
  };
  const precis = Math.round(+value || 0);
  const arrondi = precis ? Math.round(precis / 5000) * 5000 : 0;
  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <p className={`text-xs font-medium ${labelColors[color]}`}>{label}</p>
      <p className="text-[10px] text-stone-500 mb-2">{subtitle}</p>
      <div className="text-xl font-bold text-stone-900 tabular-nums">{arrondi ? `${arrondi.toLocaleString('fr-FR')} €` : '—'}</div>
      {precis > 0 && (
        <p className="text-[10px] text-stone-500 mt-1">prix réel : {precis.toLocaleString('fr-FR')} €</p>
      )}
    </div>
  );
}

function ValeurM2Card({ label, color, data, onChange }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    amber: 'bg-amber-50 border-amber-200',
  };
  const labelColors = {
    blue: 'text-blue-900',
    emerald: 'text-emerald-900',
    amber: 'text-amber-900',
  };
  return (
    <div className={`rounded-lg border p-2 ${colorClasses[color]} space-y-1.5`}>
      <p className={`text-xs font-medium ${labelColors[color]}`}>{label}</p>
      <input type="number" value={data.prix_m2 || ''}
        onChange={e => onChange({ ...data, prix_m2: +e.target.value })}
        placeholder="Prix /m²"
        className="w-full px-2 py-1 text-xs bg-white border border-stone-200 rounded" />
      <input type="number" value={data.valeur_totale || ''}
        onChange={e => onChange({ ...data, valeur_totale: +e.target.value })}
        placeholder="Valeur totale"
        className="w-full px-2 py-1 text-xs bg-white border border-stone-200 rounded" />
      <textarea value={data.commentaire || ''}
        onChange={e => onChange({ ...data, commentaire: e.target.value })}
        placeholder="Commentaire"
        rows={2}
        className="w-full px-2 py-1 text-xs bg-white border border-stone-200 rounded" />
    </div>
  );
}

function ArrayEditor({ label, items, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const addItem = () => {
    if (draft.trim()) {
      onChange([...items, draft.trim()]);
      setDraft('');
    }
  };
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 mb-1">{label}</label>
      <div className="space-y-1 mb-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-stone-50 rounded text-xs">
            <span className="flex-1 break-words">• {item}</span>
            <button
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="text-stone-400 hover:text-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          type="text" value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder={placeholder}
          className="flex-1 px-2 py-1.5 bg-white border border-stone-200 rounded text-xs focus:outline-none focus:border-stone-900"
        />
        <button
          onClick={addItem}
          disabled={!draft.trim()}
          className="px-2 py-1.5 bg-white border border-stone-200 rounded text-xs hover:bg-cream-50 disabled:opacity-30"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
