// components/AIAssistantChat.jsx
//
// Assistant Patrimonia - Phase 4.1 UI Chat (v12)
// + Cartes de proposition d'actions (création de mandat) avec confirmation utilisateur
// v11 : tous les champs visibles dans la card, warnings affichés, Budget min/max séparés, Recherche éditable
// v12 : FieldEditor intelligent — selects, boutons, date pickers, cascade typologie/sous-typologie

'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, X, Send, Mic, Loader2, Square, Paperclip, FileText, Image as ImageIcon, Check, ExternalLink, AlertTriangle, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  TYPOLOGIES_CLIENT_TREE,
  TYPES_ACTIF_B2B_TREE,
  TYPES_HABITATION_B2C,
  CATEGORIES_CONTACT,
} from '@/lib/crm-constants';

const SAGE_DARK = '#5d6e5d';
const SAGE_DARKER = '#3d4d3d';

const BUCKET = 'assistant-attachments';
const SIGNED_URL_TTL = 3600;

// ─── Listes hardcodées (synchro avec les forms du CRM) ─────────────────

const STATUTS_CLIENT = ['Actif', 'Inactif', 'Mandant'];
const STATUTS_MANDAT = ['Sourcing', 'Prospection', 'Mandat', 'Offre', 'Promesse', 'Acte', 'Perdu', 'Vendu par autres'];
const COMMERCIALISATIONS = ['Off-market', 'On-market', 'Confidentiel'];
const MATURITES = ['Chaud', 'Tiède', 'Froid'];
const PRIORITES = ['Haute', 'Moyenne', 'Basse'];
const MARCHES = [
  { value: 'b2b', label: 'B2B' },
  { value: 'b2c', label: 'B2C' }
];

// ─── Utils ─────────────────────────────────────────────────────────────

function renderMarkdown(text) {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

function randomKey() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// =========================================================================
// Mapping label → clé data pour les champs éditables (couvre tous les types d'action)
// Si key est un array, c'est un champ composé (ex: Budget → min + max)
// =========================================================================

const FIELD_KEYS = {
  'Nom': 'nom',
  'Prénom': 'prenom',
  'Adresse': 'adresse',
  'Ville': 'ville',
  'Société': 'societe',
  'Email': 'email',
  'Téléphone': 'tel',
  'Prix': 'prix',
  'Surface': 'surface',
  'Statut': 'statut',
  'Commercialisation': 'commercialisation',
  'Contact': 'contact',
  'Typologie': 'typologie',
  'Sous-typologie': 'sous_typologie',
  'Type': 'type',
  'Catégorie': 'categorie',
  'Maturité': 'maturite',
  'Origine': 'origine',
  'Marché': 'marche',
  'Titre': 'titre',
  'Échéance': 'echeance',
  'Priorité': 'priorite',
  'Date début': 'date_debut',
  'Durée': 'duree_minutes',
  'Lieu': 'lieu',
  'Description': 'description',
  'Résumé': 'resume',
  'Prochaine action': 'next_step',
  'Date prochaine action': 'date_next_step',
  'À': 'to',
  'Objet': 'subject',
  'Message': 'body',
  'Recherche': 'details_recherche',
  'Owner': 'owner',
  'Responsable': 'owner',
  'Mandat ID': null, // non éditable
  'Client ID': null, // non éditable
  'ID mandat': null,
  'ID client': null,
  'Participants': null, // tableau, non géré simplement
  'Lié à': null,
  'Budget': ['budget_min', 'budget_max'] // composé : 2 inputs côte à côte
};

const NUMERIC_KEYS = new Set(['prix', 'surface', 'loyers_annuels', 'nb_lots', 'nb_pieces', 'nb_chambres', 'etage', 'budget_min', 'budget_max', 'rendement_min', 'duree_minutes']);

// Clés qui sont des dates (input type="date")
const DATE_KEYS = new Set(['echeance', 'date_debut', 'date_next_step', 'date_fin']);

// Clés qui doivent être affichées en textarea (long texte)
const TEXTAREA_KEYS = new Set(['description', 'resume', 'body', 'details_recherche', 'notes']);

function parseNumeric(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/[€\s]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function formatFieldValue(key, value) {
  if (NUMERIC_KEYS.has(key)) {
    if (typeof value === 'number' && value > 0) {
      return new Intl.NumberFormat('fr-FR').format(value);
    }
    return '';
  }
  if (DATE_KEYS.has(key) && value) {
    // Convertit en format YYYY-MM-DD (requis par input type="date")
    if (typeof value === 'string' && value.length >= 10) {
      return value.slice(0, 10);
    }
    try {
      return new Date(value).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }
  return value || '';
}

// =========================================================================
// FieldEditor — composant qui choisit le bon UI selon la clé
// =========================================================================

function FieldEditor({ fieldKey, value, onChange, disabled, actionType, allData, profiles }) {
  // ─── Marché : boutons B2B/B2C ────────────────────────────────────────
  if (fieldKey === 'marche') {
    return (
      <div className="flex-1 inline-flex rounded border border-stone-200 overflow-hidden">
        {MARCHES.map(m => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            disabled={disabled}
            className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
              value === m.value
                ? (m.value === 'b2b' ? 'bg-sage-100 text-sage-darker' : 'bg-amber-100 text-amber-800')
                : 'bg-white text-stone-600 hover:bg-stone-50'
            } ${m.value === 'b2c' ? 'border-l border-stone-200' : ''}`}
          >
            {m.label}
          </button>
        ))}
      </div>
    );
  }

  // ─── Maturité : boutons Chaud/Tiède/Froid ────────────────────────────
  if (fieldKey === 'maturite') {
    return (
      <div className="flex-1 inline-flex rounded border border-stone-200 overflow-hidden">
        {MATURITES.map(m => {
          const color = m === 'Chaud' ? 'bg-red-100 text-red-800' : m === 'Tiède' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800';
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              disabled={disabled}
              className={`flex-1 px-2 py-1 text-xs font-medium transition-colors border-l border-stone-200 first:border-l-0 ${
                value === m ? color : 'bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>
    );
  }

  // ─── Priorité : boutons Haute/Moyenne/Basse ──────────────────────────
  if (fieldKey === 'priorite') {
    return (
      <div className="flex-1 inline-flex rounded border border-stone-200 overflow-hidden">
        {PRIORITES.map(p => {
          const color = p === 'Haute' ? 'bg-red-100 text-red-800' : p === 'Moyenne' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-700';
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              disabled={disabled}
              className={`flex-1 px-2 py-1 text-xs font-medium transition-colors border-l border-stone-200 first:border-l-0 ${
                value === p ? color : 'bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>
    );
  }

  // ─── Statut : select (dépend du type d'action client/mandat) ─────────
  if (fieldKey === 'statut') {
    const isMandat = (actionType || '').includes('mandat');
    const options = isMandat ? STATUTS_MANDAT : STATUTS_CLIENT;
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs text-stone-900 bg-white focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
      >
        <option value="">— Choisir —</option>
        {options.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  }

  // ─── Commercialisation : select ──────────────────────────────────────
  if (fieldKey === 'commercialisation') {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs text-stone-900 bg-white focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
      >
        <option value="">— Choisir —</option>
        {COMMERCIALISATIONS.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    );
  }

  // ─── Typologie client : select TYPOLOGIES_CLIENT_TREE ────────────────
  if (fieldKey === 'typologie') {
    const isClient = (actionType || '').includes('client');
    if (isClient) {
      return (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs text-stone-900 bg-white focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
        >
          <option value="">— Choisir —</option>
          {Object.keys(TYPOLOGIES_CLIENT_TREE).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      );
    }
    // Sinon (mandats), c'est juste un texte libre (rare)
  }

  // ─── Sous-typologie : cascadé sur typologie ──────────────────────────
  if (fieldKey === 'sous_typologie') {
    const parentTypologie = allData?.typologie;
    const subOptions = parentTypologie ? (TYPOLOGIES_CLIENT_TREE[parentTypologie] || []) : [];
    if (subOptions.length === 0) {
      return (
        <input
          type="text"
          value={value || ''}
          disabled
          placeholder="— Pas applicable —"
          className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs text-stone-400 bg-stone-50"
        />
      );
    }
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs text-stone-900 bg-white focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
      >
        <option value="">— Choisir —</option>
        {subOptions.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  }

  // ─── Type d'actif (mandat) : select avec optgroups ───────────────────
  if (fieldKey === 'type') {
    const isMandat = (actionType || '').includes('mandat');
    if (isMandat) {
      return (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs text-stone-900 bg-white focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
        >
          <option value="">— Choisir —</option>
          <optgroup label="Investissement (B2B)">
            {Object.entries(TYPES_ACTIF_B2B_TREE).map(([famille, sousTypes]) => (
              <optgroup key={famille} label={`  ${famille}`}>
                {(sousTypes || []).map(s => <option key={s} value={s}>{s}</option>)}
              </optgroup>
            ))}
          </optgroup>
          <optgroup label="Habitation (B2C)">
            {TYPES_HABITATION_B2C.map(t => <option key={t} value={t}>{t}</option>)}
          </optgroup>
        </select>
      );
    }
  }

  // ─── Catégorie contact : select CATEGORIES_CONTACT ───────────────────
  if (fieldKey === 'categorie') {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs text-stone-900 bg-white focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
      >
        <option value="">— Choisir —</option>
        {CATEGORIES_CONTACT.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    );
  }

  // ─── Owner : select des profils ──────────────────────────────────────
  if (fieldKey === 'owner') {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || !profiles}
        className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs text-stone-900 bg-white focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
      >
        <option value="">— Choisir —</option>
        {(profiles || []).map(p => {
          const initials = `${(p.prenom || '').charAt(0)}${(p.nom || '').charAt(0)}`.toUpperCase();
          return (
            <option key={p.id} value={initials}>
              {p.prenom} {p.nom} ({initials})
            </option>
          );
        })}
      </select>
    );
  }

  // ─── Date : input type="date" ────────────────────────────────────────
  if (DATE_KEYS.has(fieldKey)) {
    return (
      <input
        type="date"
        value={formatFieldValue(fieldKey, value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs text-stone-900 focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
      />
    );
  }

  // ─── Textarea (description, body, notes...) ──────────────────────────
  if (TEXTAREA_KEYS.has(fieldKey)) {
    return (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={2}
        className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs text-stone-900 focus:outline-none focus:border-stone-400 disabled:bg-stone-50 resize-y min-h-[2rem]"
      />
    );
  }

  // ─── Email : input type="email" ──────────────────────────────────────
  if (fieldKey === 'email') {
    return (
      <input
        type="email"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="exemple@domaine.com"
        className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs text-stone-900 focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
      />
    );
  }

  // ─── Tel : input type="tel" ──────────────────────────────────────────
  if (fieldKey === 'tel') {
    return (
      <input
        type="tel"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="+33 6 12 34 56 78"
        className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs text-stone-900 focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
      />
    );
  }

  // ─── Default : input text ────────────────────────────────────────────
  return (
    <input
      type="text"
      value={formatFieldValue(fieldKey, value)}
      onChange={(e) => onChange(NUMERIC_KEYS.has(fieldKey) ? parseNumeric(e.target.value) : e.target.value)}
      disabled={disabled}
      className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs text-stone-900 focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
    />
  );
}

// =========================================================================
// Carte de proposition d'action
// =========================================================================

function ProposalCard({ action, onConfirm, onCancel, executing, executed, executedResult, executedError, profiles }) {
  // État local des données éditables (initialisé depuis action.data)
  const [editData, setEditData] = useState(() => ({ ...action.data }));

  const updateField = (key, value) => {
    setEditData(prev => ({
      ...prev,
      [key]: NUMERIC_KEYS.has(key) ? (typeof value === 'number' ? value : parseNumeric(value)) : value
    }));
  };

  const handleConfirm = () => {
    onConfirm(editData);
  };

  // Champs à afficher (utilise action.fields pour l'ordre)
  // Chaque champ peut avoir une `key` string OU un array (pour champ composé Budget)
  const editableFields = action.fields
    .map(f => ({ label: f.label, key: FIELD_KEYS[f.label] }))
    .filter(f => f.key !== null && f.key !== undefined);

  return (
    <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-sm p-3 max-w-[90%]">
      <div className="text-xs font-medium text-stone-600 mb-2 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5" style={{ color: SAGE_DARK }} />
        {action.summary || 'Action proposée'}
      </div>

      {/* Warnings (champs recommandés manquants) */}
      {!executed && action.warnings && (
        <div className="flex items-start gap-1.5 px-2 py-1.5 mb-2 rounded-lg bg-amber-50 text-amber-800 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{action.warnings}</span>
        </div>
      )}

      {/* Missing (champs obligatoires manquants - bloque la création) */}
      {!executed && action.missing && (
        <div className="flex items-start gap-1.5 px-2 py-1.5 mb-2 rounded-lg bg-red-50 text-red-800 text-xs">
          <X className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{action.missing}</span>
        </div>
      )}

      {!executed ? (
        <div className="space-y-1.5 mb-3">
          {editableFields.map((f) => {
            // Champ composé (ex: Budget = budget_min + budget_max)
            if (Array.isArray(f.key)) {
              return (
                <div key={f.label} className="flex items-center gap-2 text-xs">
                  <label className="text-stone-500 w-24 flex-shrink-0">{f.label}</label>
                  <div className="flex-1 flex items-center gap-1">
                    <input
                      type="text"
                      value={formatFieldValue(f.key[0], editData[f.key[0]])}
                      onChange={(e) => updateField(f.key[0], parseNumeric(e.target.value))}
                      disabled={executing}
                      placeholder="min"
                      className="w-full px-2 py-1 border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
                    />
                    <span className="text-stone-400">→</span>
                    <input
                      type="text"
                      value={formatFieldValue(f.key[1], editData[f.key[1]])}
                      onChange={(e) => updateField(f.key[1], parseNumeric(e.target.value))}
                      disabled={executing}
                      placeholder="max"
                      className="w-full px-2 py-1 border border-stone-200 rounded text-stone-900 focus:outline-none focus:border-stone-400 disabled:bg-stone-50"
                    />
                  </div>
                </div>
              );
            }
            // Champ simple : utilise FieldEditor
            return (
              <div key={f.key} className="flex items-center gap-2 text-xs">
                <label className="text-stone-500 w-24 flex-shrink-0">{f.label}</label>
                <FieldEditor
                  fieldKey={f.key}
                  value={editData[f.key]}
                  onChange={(v) => updateField(f.key, v)}
                  disabled={executing}
                  actionType={action.type}
                  allData={editData}
                  profiles={profiles}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-stone-50 rounded-lg p-2.5 text-xs space-y-1 mb-3">
          {action.fields.map((f, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-stone-500 flex-shrink-0">{f.label} :</span>
              <span className="text-stone-900 font-medium truncate">{f.value}</span>
            </div>
          ))}
        </div>
      )}

      {executed && executedResult && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: '#e8f0e8', color: SAGE_DARKER }}>
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{action.type?.startsWith('update_') ? 'Modifié' : action.type?.startsWith('send_') ? 'Envoyé' : 'Créé'} avec succès : {executedResult.label}</span>
        </div>
      )}

      {executed && executedError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-red-50 text-red-700">
          <X className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Erreur : {executedError}</span>
        </div>
      )}

      {!executed && (
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={executing || action.missing}
            style={{ backgroundColor: SAGE_DARK }}
            className="flex-1 px-3 py-2 rounded-lg text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            title={action.missing ? 'Complète les champs obligatoires avant de créer' : ''}
          >
            {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {executing ? 'En cours…' : (action.type?.startsWith('update_') ? 'Modifier' : action.type?.startsWith('send_') ? 'Envoyer' : 'Créer')}
          </button>
          <button
            onClick={onCancel}
            disabled={executing}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// Composant principal
// =========================================================================

export default function AIAssistantChat({
  floating = false,
  context = null,
  open: controlledOpen,
  onOpenChange
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === 'boolean';
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (val) => {
    if (isControlled) onOpenChange?.(val);
    else setInternalOpen(val);
  };

  // Messages = { role, content?, proposed_action?, action_state? }
  // action_state : { executing, executed, result, error }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [inputBeforeRecord, setInputBeforeRecord] = useState('');

  const [attachments, setAttachments] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Profils (commerciaux actifs) — chargés au mount pour le select Owner
  const [profiles, setProfiles] = useState([]);

  // P1d : contexte reçu via event de fenêtre (fiche mandat/client ouverte)
  const [liveContext, setLiveContext] = useState(null);
  useEffect(() => {
    function onContext(e) {
      setLiveContext(e.detail?.context || null);
    }
    window.addEventListener('patrimonia:context', onContext);
    return () => window.removeEventListener('patrimonia:context', onContext);
  }, []);
  const activeContext = liveContext || context;

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const speechRecognitionRef = useRef(null);

  // ─── Chargement profils au premier ouverture ────────────────────────
  useEffect(() => {
    if (!open || profiles.length > 0) return;
    supabase.from('profiles').select('id, prenom, nom').eq('actif', true).order('prenom')
      .then(({ data }) => setProfiles(data || []))
      .catch(e => console.warn('[AIAssistantChat] profiles load failed:', e));
  }, [open]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInput('');
      setLiveTranscript('');
      setInputBeforeRecord('');
      setAttachments([]);
    }
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // ========================================================================
  // PJ
  // ========================================================================

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingFiles(true);
    const newAttachments = [];

    for (const file of files) {
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        alert(`Type de fichier non supporté : ${file.name}`);
        continue;
      }
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `chat/${Date.now()}_${randomKey()}_${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });
        if (uploadErr) {
          console.error('[AIAssistantChat] Upload error:', uploadErr);
          alert(`Erreur upload "${file.name}" : ${uploadErr.message}`);
          continue;
        }
        const { data: signedData, error: signedErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(storagePath, SIGNED_URL_TTL);
        if (signedErr) {
          console.error('[AIAssistantChat] Signed URL error:', signedErr);
          continue;
        }
        newAttachments.push({
          name: file.name, type: file.type, size: file.size,
          storagePath, signedUrl: signedData.signedUrl
        });
      } catch (err) {
        console.error('[AIAssistantChat] File error:', err);
        alert('Erreur sur ' + file.name + ' : ' + err.message);
      }
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    setUploadingFiles(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (idx) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  // ========================================================================
  // ENVOI MESSAGE
  // ========================================================================

  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || loading) return;

    const userMsg = {
      role: 'user',
      content: text || (attachments.length > 0 ? '(pièces jointes uniquement)' : '')
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    const currentAttachments = attachments;
    setInput('');
    setAttachments([]);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setLoading(true);

    try {
      const payload = { messages: newMessages.map(m => ({ role: m.role, content: m.content })) };
      if (activeContext) payload.context = activeContext;
      if (currentAttachments.length > 0) {
        payload.attachments = currentAttachments.map(a => ({
          name: a.name, type: a.type, signedUrl: a.signedUrl
        }));
      }

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text() || 'Erreur serveur');

      const data = await res.json();
      const assistantMsg = {
        role: 'assistant',
        content: data.message || '(réponse vide)'
      };
      if (data.proposed_action) {
        assistantMsg.proposed_action = data.proposed_action;
        assistantMsg.action_state = { executing: false, executed: false };
      }
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error('[AIAssistantChat] Erreur:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Erreur : ' + (err.message || 'impossible de joindre l\'assistant')
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ========================================================================
  // CONFIRMATION D'UNE ACTION
  // ========================================================================

  const confirmAction = async (msgIdx, editData) => {
    const msg = messages[msgIdx];
    if (!msg?.proposed_action) return;

    setMessages(prev => {
      const copy = [...prev];
      copy[msgIdx] = { ...copy[msgIdx], action_state: { executing: true, executed: false } };
      return copy;
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const finalData = { ...msg.proposed_action.data, ...editData };

      const res = await fetch('/api/assistant/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: msg.proposed_action.type, data: finalData },
          token
        })
      });

      const data = await res.json();

      setMessages(prev => {
        const copy = [...prev];
        if (data.ok) {
          copy[msgIdx] = {
            ...copy[msgIdx],
            action_state: { executing: false, executed: true, result: data.result }
          };
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('patrimonia:action-executed', {
              detail: { type: msg.proposed_action.type, result: data.result }
            }));
          }
        } else {
          copy[msgIdx] = {
            ...copy[msgIdx],
            action_state: { executing: false, executed: true, error: data.error || 'Erreur inconnue' }
          };
        }
        return copy;
      });
    } catch (err) {
      console.error('[AIAssistantChat] Execute error:', err);
      setMessages(prev => {
        const copy = [...prev];
        copy[msgIdx] = {
          ...copy[msgIdx],
          action_state: { executing: false, executed: true, error: err.message }
        };
        return copy;
      });
    }
  };

  const cancelAction = (msgIdx) => {
    setMessages(prev => {
      const copy = [...prev];
      copy[msgIdx] = {
        ...copy[msgIdx],
        action_state: { executing: false, executed: true, error: 'Annulé par l\'utilisateur' }
      };
      return copy;
    });
  };

  // ========================================================================
  // VOCAL HYBRIDE
  // ========================================================================

  const startRecording = async () => {
    try {
      const currentInput = input;
      setInputBeforeRecord(currentInput);
      setLiveTranscript('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (audioChunksRef.current.length === 0) return;
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setTranscribing(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token || '';
          const formData = new FormData();
          formData.append('audio', blob, 'voice.webm');
          formData.append('token', token);
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
          if (!res.ok) throw new Error('Transcription échouée');
          const data = await res.json();
          const transcript = data.text || data.transcript || '';
          if (transcript) {
            setInput(prev => {
              const base = inputBeforeRecord || '';
              return base ? base + ' ' + transcript : transcript;
            });
            if (inputRef.current) {
              inputRef.current.focus();
              setTimeout(() => {
                if (inputRef.current) {
                  inputRef.current.style.height = 'auto';
                  inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
                }
              }, 0);
            }
          }
        } catch (err) {
          console.error('[AIAssistantChat] Transcription error:', err);
          alert('Erreur de transcription : ' + err.message);
          setInput(inputBeforeRecord);
        } finally {
          setTranscribing(false);
          setLiveTranscript('');
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'fr-FR';
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (event) => {
            let interim = '', final = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const t = event.results[i][0].transcript;
              if (event.results[i].isFinal) final += t + ' '; else interim += t;
            }
            setLiveTranscript(() => (final + interim).trim());
          };
          recognition.onerror = (e) => console.warn('[AIAssistantChat] Web Speech error:', e.error);
          speechRecognitionRef.current = recognition;
          recognition.start();
        } catch (e) {
          console.warn('[AIAssistantChat] Web Speech start failed:', e);
        }
      }
      setRecording(true);
    } catch (err) {
      console.error('[AIAssistantChat] Mic error:', err);
      alert('Impossible d\'accéder au micro : ' + err.message);
    }
  };

  const stopRecording = () => {
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch (e) {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const displayValue = recording
    ? (inputBeforeRecord + (inputBeforeRecord && liveTranscript ? ' ' : '') + liveTranscript)
    : input;

  const getContextLabel = () => {
    if (!activeContext) return null;
    if (activeContext.type === 'mandat' && activeContext.data) {
      return `Mandat : ${activeContext.data.nom || activeContext.data.adresse || 'sans nom'}`;
    }
    if (activeContext.type === 'client' && activeContext.data) {
      const c = activeContext.data;
      const nom = [c.prenom, c.nom].filter(Boolean).join(' ') || c.societe || 'sans nom';
      return `Client : ${nom}`;
    }
    return null;
  };
  const contextLabel = getContextLabel();

  const gradientStyle = {
    background: `linear-gradient(to bottom right, ${SAGE_DARK}, ${SAGE_DARKER})`
  };

  return (
    <>
      {floating && !open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir l'Assistant Patrimonia"
          style={gradientStyle}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full text-white shadow-xl hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden"
          style={{
            width: '420px', height: '600px',
            maxWidth: 'calc(100vw - 3rem)', maxHeight: 'calc(100vh - 3rem)',
            resize: 'both'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div style={gradientStyle} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-stone-900">Assistant Patrimonia</div>
                {contextLabel ? (
                  <div className="text-xs text-stone-500 truncate" title={contextLabel}>{contextLabel}</div>
                ) : (
                  <div className="text-xs text-stone-500">Cherche, propose, agit dans le CRM</div>
                )}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="p-1.5 hover:bg-stone-200 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-stone-600" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-stone-50">
            {messages.length === 0 && (
              <div className="text-center text-stone-400 text-sm mt-12">
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-stone-300" />
                <p>Pose-moi une question ou demande-moi de créer un mandat</p>
                {contextLabel ? (
                  <p className="text-xs mt-1">Ex : "Donne-moi un résumé"</p>
                ) : (
                  <p className="text-xs mt-1">Ex : "Crée un mandat 9 rue Hoche à Versailles"</p>
                )}
                <p className="text-xs mt-3 text-stone-400">Tu peux joindre PDF ou photos.</p>
              </div>
            )}

            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const hasProposal = msg.proposed_action;
              return (
                <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${hasProposal ? 'flex-col items-start gap-2' : ''}`}>
                  {msg.content && (
                    <div
                      style={isUser ? { backgroundColor: SAGE_DARK } : {}}
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? 'text-white rounded-br-sm'
                          : 'bg-white text-stone-900 border border-stone-200 rounded-bl-sm'
                      }`}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  )}

                  {hasProposal && (
                    <ProposalCard
                      action={msg.proposed_action}
                      onConfirm={(editData) => confirmAction(i, editData)}
                      onCancel={() => cancelAction(i)}
                      executing={msg.action_state?.executing}
                      executed={msg.action_state?.executed}
                      executedResult={msg.action_state?.result}
                      executedError={msg.action_state?.error}
                      profiles={profiles}
                    />
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Vignettes PJ */}
          {attachments.length > 0 && (
            <div className="px-3 pt-2 pb-1 border-t border-stone-100 bg-white flex-shrink-0">
              <div className="flex gap-2 flex-wrap">
                {attachments.map((att, idx) => (
                  <div key={idx} className="relative group flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-lg text-xs">
                    {att.type.startsWith('image/') ? (
                      <ImageIcon className="w-3.5 h-3.5 text-stone-500" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-stone-500" />
                    )}
                    <span className="max-w-[140px] truncate" title={att.name}>{att.name}</span>
                    <span className="text-stone-400">{formatSize(att.size)}</span>
                    <button onClick={() => removeAttachment(idx)} aria-label="Supprimer" className="ml-1 hover:bg-stone-200 rounded p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {uploadingFiles && (
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-stone-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Upload…</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-stone-200 bg-white p-3 flex-shrink-0">
            {recording && (
              <div className="flex items-center gap-2 mb-2 text-xs text-red-600">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span>Je t'écoute…{!SpeechRecognition && ' (visualisation directe indisponible sur ce navigateur)'}</span>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileInputRef} type="file" multiple accept="application/pdf,image/*" onChange={handleFilesSelected} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || recording || transcribing || uploadingFiles}
                aria-label="Joindre des fichiers"
                title="Joindre PDF ou photos"
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploadingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </button>

              <textarea
                ref={inputRef}
                value={displayValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={recording ? 'Parle, je t\'écoute…' : (transcribing ? 'Transcription…' : 'Tape ou parle…')}
                disabled={loading || recording || transcribing}
                rows={1}
                style={{ maxHeight: '120px', color: recording ? '#888' : undefined, fontStyle: recording ? 'italic' : undefined }}
                className="flex-1 resize-none px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 disabled:bg-stone-50 min-h-[36px]"
              />

              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={loading || transcribing}
                aria-label={recording ? 'Arrêter' : 'Enregistrer'}
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  recording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                onClick={sendMessage}
                disabled={(!input.trim() && attachments.length === 0) || loading || recording || transcribing || uploadingFiles}
                aria-label="Envoyer"
                style={(!input.trim() && attachments.length === 0) || loading || recording || transcribing || uploadingFiles ? {} : { backgroundColor: SAGE_DARK }}
                className="w-9 h-9 rounded-lg text-white disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-90"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
