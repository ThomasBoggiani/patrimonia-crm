// ═══════════════════════════════════════════════════════════════════
// components/AICreateModal.jsx — v2.1
// Modal universel : Fichiers + Texte + Voix → 6 intentions
// Intentions : mandat | client | both | task | event | email | note
// ═══════════════════════════════════════════════════════════════════

'use client';
import { useState, useRef } from 'react';
import { X, Sparkles, FileText, Mic, MicOff, Upload, Loader2, Check, AlertCircle, Building2, User as UserIcon, GitMerge, CheckSquare, Calendar, Mail, StickyNote, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, getCurrentUserInitials } from '@/lib/auth';
import MergeMandatsModal from './MergeMandatsModal';

const TYPE_LABELS = {
  mandat: { label: 'Mandat (bien à vendre)', icon: Building2, color: 'sage' },
  client: { label: 'Client (acheteur)', icon: UserIcon, color: 'blue' },
  both: { label: 'Mandat + Client', icon: Sparkles, color: 'purple' },
  task: { label: 'Tâche / Rappel', icon: CheckSquare, color: 'amber' },
  event: { label: 'Rendez-vous', icon: Calendar, color: 'indigo' },
  email: { label: 'Email à rédiger', icon: Mail, color: 'cyan' },
  note: { label: 'Note libre', icon: StickyNote, color: 'stone' },
  unknown: { label: 'Indéterminé', icon: AlertCircle, color: 'stone' },
};

async function resizeImage(file, maxSize = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Conversion canvas → blob échouée'));
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const newFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
          resolve(newFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => reject(new Error('Image invalide ou corrompue'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Lecture fichier impossible'));
    reader.readAsDataURL(file);
  });
}

export default function AICreateModal({ open, onClose, defaultType, onCreated }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState('text');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioTranscription, setAudioTranscription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [creating, setCreating] = useState(false);
  const [forcedType, setForcedType] = useState(null);
  const [mergeWith, setMergeWith] = useState(null);
  const [showEmailEditor, setShowEmailEditor] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  if (!open) return null;

  function reset() {
    setText('');
    setFiles([]);
    setAudioBlob(null);
    setAudioTranscription('');
    setResult(null);
    setForcedType(null);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { alert('Session expirée'); setAnalyzing(false); return; }

      const body = { token, mode: tab };

      if (tab === 'text') {
        if (!text.trim()) { alert('Colle du texte à analyser'); setAnalyzing(false); return; }
        body.text = text;
      } else if (tab === 'audio') {
        if (!audioTranscription.trim()) { alert('Enregistre une note vocale'); setAnalyzing(false); return; }
        body.audioTranscription = audioTranscription;
      } else if (tab === 'files') {
        if (files.length === 0) { alert('Ajoute au moins 1 fichier'); setAnalyzing(false); return; }

        setProgress({ label: 'Optimisation des fichiers', current: 0, total: files.length });
        const optimizedFiles = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          setProgress({ label: 'Optimisation des fichiers', current: i + 1, total: files.length });
          if (f.type.startsWith('image/')) {
            try {
              const optimized = await resizeImage(f, 1600, 0.85);
              optimizedFiles.push(optimized);
            } catch (err) {
              optimizedFiles.push(f);
            }
          } else {
            optimizedFiles.push(f);
          }
        }

        setProgress({ label: 'Téléversement vers le cloud', current: 0, total: optimizedFiles.length });
        const paths = [];
        const uploadErrors = [];
        for (let i = 0; i < optimizedFiles.length; i++) {
          const f = optimizedFiles[i];
          setProgress({ label: 'Téléversement vers le cloud', current: i + 1, total: optimizedFiles.length });
          const cleanName = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = '_ai-temp/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + cleanName;
          const { error: upErr } = await supabase.storage.from('mandat-docs').upload(path, f, {
            contentType: f.type || 'application/octet-stream',
            upsert: false,
          });
          if (upErr) {
            uploadErrors.push(`${f.name} : ${upErr.message}`);
          } else {
            paths.push(path);
          }
        }

        if (paths.length === 0) {
          setProgress(null);
          alert('Aucun fichier n\'a pu être téléversé.\n\nDétails :\n' + uploadErrors.join('\n'));
          setAnalyzing(false);
          return;
        }
        if (uploadErrors.length > 0) {
          const proceed = confirm(`${uploadErrors.length} fichier(s) en échec, ${paths.length} OK.\n\nContinuer ?`);
          if (!proceed) { setProgress(null); setAnalyzing(false); return; }
        }

        body.files = paths;
        setProgress({ label: 'Analyse par l\'IA', current: 0, total: 0 });
      }

      if (forcedType) body.forceType = forcedType;

      const res = await fetch('/api/ai-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        alert('Erreur analyse : ' + (data.error || 'inconnue'));
        setProgress(null);
        setAnalyzing(false);
        return;
      }
      setResult(data);
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
    setProgress(null);
    setAnalyzing(false);
  }

  async function handleCreate() {
    if (!result) return;

    // Pour email, on ouvre la modal de validation au lieu de créer directement
    if (result.type === 'email' && result.email) {
      setShowEmailEditor(true);
      return;
    }

    setCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const created = { mandat: null, client: null, task: null, event: null, email: null, note: null };

      // ─── MANDAT ───
      if ((result.type === 'mandat' || result.type === 'both') && result.mandat) {
        const ALLOWED_MANDAT_COLUMNS = [
          'nom', 'adresse', 'ville', 'marche', 'type', 'sous_type',
          'surface', 'nb_pieces', 'nb_chambres', 'etage', 'annee_construction',
          'prix', 'prix_net_vendeur', 'prix_m2',
          'honoraires_charge', 'honoraires_taux', 'honoraires_montant',
          'loyers_annuels', 'rendement', 'rendement_optimise', 'charges_annuelles', 'taxe_fonciere',
          'dpe_consommation', 'dpe_emissions', 'dpe_date',
          'mandat_numero', 'mandat_type', 'mandat_date_echeance',
          'nb_lots', 'description', 'commercialisation', 'statut'
        ];
        const filteredMandat = {};
        for (const k of ALLOWED_MANDAT_COLUMNS) {
          if (result.mandat[k] !== undefined) filteredMandat[k] = result.mandat[k];
        }
        const { data: m, error: mErr } = await supabase.from('mandats').insert({
          ...filteredMandat,
          statut: filteredMandat.statut || 'Sourcing',
          owner: profile ? getCurrentUserInitials(profile) : 'TB',
          created_by: user?.id,
        }).select().single();
        if (mErr) { alert('Erreur création mandat : ' + mErr.message); } else { created.mandat = m; }
      }

      // ─── CLIENT ───
      if ((result.type === 'client' || result.type === 'both') && result.client) {
        const ALLOWED_CLIENT_COLUMNS = [
          'nom', 'prenom', 'societe', 'tel', 'email',
          'typologie', 'nature',
          'budget_min', 'budget_max', 'rendement_min',
          'zones', 'typologies_recherchees',
          'statut', 'maturite', 'origine', 'owner', 'source',
          'details_recherche', 'date_naissance'
        ];
        const filteredClient = {};
        for (const k of ALLOWED_CLIENT_COLUMNS) {
          if (result.client[k] !== undefined) filteredClient[k] = result.client[k];
        }
        const { data: c, error: cErr } = await supabase.from('clients').insert({
          ...filteredClient,
          zones: filteredClient.zones || [],
          typologies_recherchees: filteredClient.typologies_recherchees || [],
          statut: filteredClient.statut || 'Actif',
          created_by: user?.id,
          owner: filteredClient.owner || (profile ? getCurrentUserInitials(profile) : 'TB'),
        }).select().single();
        if (cErr) { alert('Erreur création client : ' + cErr.message); } else { created.client = c; }
      }

      // ─── TASK ───
      if (result.type === 'task' && result.task) {
        const taskData = {
          titre: result.task.titre || 'Tâche sans titre',
          priorite: result.task.priorite || 'Moyenne',
          statut: 'À faire',
          echeance: result.task.echeance || null,
          assignee: profile ? `${profile.prenom || ''} ${profile.nom || ''}`.trim() : null,
          assigned_to_user_id: user?.id || null,
          created_by: user?.id || null,
          lien_type: result.task.lien_type || null,
          lien_id: result.task.linked_id || null,
        };
        const { data: t, error: tErr } = await supabase.from('todos').insert(taskData).select().single();
        if (tErr) { alert('Erreur création tâche : ' + tErr.message); } else {
          created.task = t;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('todos-changed'));
          }
        }
      }

      // ─── EVENT (RDV Outlook via Microsoft Graph) ───
      if (result.type === 'event' && result.event) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token) throw new Error('Session expirée');

          const participantsList = Array.isArray(result.event.participants)
            ? result.event.participants.filter(p => p && p.includes('@'))
            : [];

          const eventBody = {
            titre: result.event.titre || 'Nouveau RDV',
            description: result.event.description || '',
            debut: result.event.date_debut,
            fin: result.event.date_fin,
            lieu: result.event.lieu || '',
            participants: participantsList,
            allDay: false,
          };

          const res = await fetch('/api/microsoft/events', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(eventBody),
          });

          const data = await res.json();
          if (!res.ok) {
            if (data.code === 'NOT_CONNECTED') {
              alert('Microsoft Outlook n\'est pas connecté.\n\nVa dans Paramètres → Intégrations pour le connecter, puis recommence.');
            } else {
              alert('Erreur création RDV Outlook : ' + (data.error || 'inconnue'));
            }
          } else {
            created.event = data.event;
          }
        } catch (e) {
          alert('Erreur RDV : ' + e.message);
        }
      }

      // ─── NOTE (placeholder) ───
      if (result.type === 'note' && result.note) {
        alert('La création de notes arrivera dans la prochaine session.\n\nContenu proposé :\n\n' + (result.note.contenu || ''));
      }

      if (onCreated) onCreated(created);
      reset();
      onClose();
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
    setCreating(false);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        await transcribe(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setRecording(true);
    } catch (e) {
      alert('Permission micro refusée : ' + e.message);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function transcribe(blob) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const formData = new FormData();
      if (token) formData.append('token', token);
      formData.append('audio', blob, 'recording.webm');
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok && data.text) {
        setAudioTranscription(data.text);
      }
    } catch (e) {
      console.warn('Transcription échouée');
    }
  }

  const detectedType = forcedType || result?.type || 'unknown';
  const TypeIcon = TYPE_LABELS[detectedType]?.icon || AlertCircle;
  const isImplemented = ['mandat', 'client', 'both', 'task', 'event', 'email'].includes(detectedType);

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-2xl w-full max-h-[92vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between p-6 border-b border-stone-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sage-100 to-sage-200 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-sage-darker" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-stone-900">Créer avec l'IA</h2>
              <p className="text-xs text-stone-500">L'IA détecte l'intention et propose l'action adaptée</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>

        {!result && (
          <>
            <div className="px-6 pt-4 flex gap-1 border-b border-stone-200">
              <TabButton active={tab === 'files'} onClick={() => setTab('files')}>📁 Fichiers</TabButton>
              <TabButton active={tab === 'text'} onClick={() => setTab('text')}>📝 Texte</TabButton>
              <TabButton active={tab === 'audio'} onClick={() => setTab('audio')}>🎤 Voix</TabButton>
            </div>

            <div className="p-6">
              {tab === 'text' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-2">Décris ce que tu veux créer</label>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={8}
                    placeholder="Exemples :
- Un mandat à partir d'un email : « Je vends mon immeuble 9 rue Hoche... »
- Un acheteur : « Mme Dupont cherche un T3 Paris 8e budget 1M€ »
- Une tâche : « Rappelle-moi vendredi d'appeler Philippe »
- Un RDV : « Visite immeuble Versailles jeudi 14h avec Judith »
- Un email : « Rédige un mail à Philippe pour faire le point sur le mandat »
- Une note : « Note : le DPE doit être refait avant commercialisation »"
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark"
                  />
                  <p className="text-xs text-stone-500 mt-2">L'IA détecte automatiquement l'intention : mandat, client, tâche, RDV, email ou note.</p>
                </div>
              )}

              {tab === 'files' && (
                <div>
                  <input type="file" ref={fileInputRef} onChange={e => setFiles(Array.from(e.target.files || []))} className="hidden" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" />
                  <button onClick={() => fileInputRef.current?.click()} className="w-full p-8 border-2 border-dashed border-sage-light bg-sage-50/50 rounded-xl hover:bg-sage-50 transition-colors text-center">
                    <Upload className="w-8 h-8 mx-auto text-sage-dark mb-2" />
                    <p className="text-sm font-medium text-stone-900">Cliquez pour sélectionner</p>
                    <p className="text-xs text-stone-500 mt-1">PDF, Word, JPG, PNG (max 10 fichiers)</p>
                  </button>
                  {files.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="text-xs font-semibold text-stone-700">{files.length} fichier(s) sélectionné(s) :</div>
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-stone-600 p-2 bg-stone-50 rounded">
                          <FileText className="w-3 h-3" />
                          <span className="truncate flex-1">{f.name}</span>
                          <span className="text-stone-400">{Math.round(f.size / 1024)} KB</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'audio' && (
                <div>
                  <div className="text-center p-8 border-2 border-dashed border-sage-light bg-sage-50/50 rounded-xl">
                    {recording ? (
                      <button onClick={stopRecording} className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center mx-auto hover:bg-red-600 animate-pulse">
                        <MicOff className="w-8 h-8" />
                      </button>
                    ) : (
                      <button onClick={startRecording} className="w-20 h-20 rounded-full bg-sage-dark text-white flex items-center justify-center mx-auto hover:bg-sage-darker">
                        <Mic className="w-8 h-8" />
                      </button>
                    )}
                    <p className="text-sm font-medium text-stone-900 mt-3">{recording ? 'Enregistrement...' : audioBlob ? 'Recommencer' : 'Démarrer l\'enregistrement'}</p>
                  </div>

                  {audioTranscription && (
                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-stone-700 mb-1">Transcription (modifiable) :</label>
                      <textarea value={audioTranscription} onChange={e => setAudioTranscription(e.target.value)} rows={5}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark" />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-stone-200 bg-stone-50">
              {progress ? (
                <div className="flex items-center gap-3 flex-1">
                  <Loader2 className="w-4 h-4 animate-spin text-sage-dark flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-stone-700 mb-1 flex items-center justify-between gap-2">
                      <span className="truncate">{progress.label}</span>
                      {progress.total > 0 && <span className="text-stone-500 flex-shrink-0">{progress.current}/{progress.total}</span>}
                    </div>
                    {progress.total > 0 && (
                      <div className="h-1 bg-stone-200 rounded-full overflow-hidden">
                        <div className="h-full bg-sage-dark transition-all duration-200" style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">Annuler</button>
                  <button onClick={handleAnalyze} disabled={analyzing} className="flex items-center gap-2 px-4 py-2 bg-sage-dark text-white rounded-lg hover:bg-sage-darker disabled:opacity-50 text-sm">
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {analyzing ? 'Analyse...' : 'Analyser avec l\'IA'}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {result && (
          <div className="p-6">
            <div className="mb-4 p-3 bg-stone-50 border border-stone-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <TypeIcon className="w-4 h-4 text-stone-700" />
                <div className="text-sm font-medium text-stone-900">Détecté : {TYPE_LABELS[detectedType]?.label}</div>
                {result.confidence > 0 && <span className="text-xs text-stone-500">({Math.round(result.confidence * 100)}%)</span>}
              </div>
              {result.reasoning && <p className="text-xs text-stone-600">{result.reasoning}</p>}

              <div className="mt-2 flex gap-1 flex-wrap">
                <span className="text-xs text-stone-500 self-center">Forcer :</span>
                {['mandat', 'client', 'both', 'task', 'event', 'email', 'note'].map(t => (
                  <button key={t} onClick={() => setForcedType(forcedType === t ? null : t)}
                    className={`text-xs px-2 py-0.5 rounded-full border ${forcedType === t || (!forcedType && result.type === t) ? 'bg-sage-100 border-sage-dark text-sage-darker font-medium' : 'bg-white border-stone-200 text-stone-600'}`}>
                    {TYPE_LABELS[t]?.label || t}
                  </button>
                ))}
              </div>
            </div>

            {(detectedType === 'mandat' || detectedType === 'both') && result.mandat && (
              <PreviewBlock title="📋 Mandat à créer" data={result.mandat} duplicates={result.duplicates?.mandat} duplicateType="mandat" onMerge={(dupId, dupLabel) => setMergeWith({ id: dupId, label: dupLabel })} />
            )}
            {(detectedType === 'client' || detectedType === 'both') && result.client && (
              <PreviewBlock title="👤 Client à créer" data={result.client} duplicates={result.duplicates?.client} duplicateType="client" />
            )}
            {detectedType === 'task' && result.task && (
              <PreviewBlock title="✅ Tâche à créer" data={result.task} />
            )}
            {detectedType === 'event' && result.event && (
              <>
                <PreviewBlock title="📅 RDV à créer dans Outlook" data={result.event} />
                <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                  💡 Le RDV sera créé dans ton calendrier Outlook avec les participants en invitation.
                </div>
              </>
            )}
            {detectedType === 'email' && result.email && (
              <>
                <PreviewBlock title="✉️ Email à rédiger" data={result.email} />
                <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                  💡 Tu pourras relire et modifier l'email avant de l'envoyer.
                </div>
              </>
            )}
            {detectedType === 'note' && result.note && (
              <>
                <PreviewBlock title="📝 Note à enregistrer" data={result.note} />
                <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  ⚠️ Stockage de notes arrive prochainement.
                </div>
              </>
            )}

            {/* Suggestions de liens (pour task/event/email/note) */}
            {result.link_suggestions && result.link_suggestions.suggestions && result.link_suggestions.suggestions.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-xs font-semibold text-blue-900 mb-1.5">💡 Liens possibles trouvés en BDD :</div>
                <div className="space-y-1">
                  {result.link_suggestions.suggestions.map(s => {
                    const label = s.nom || `${s.prenom || ''} ${s.nom || ''}`.trim() || s.societe;
                    const sub = s.adresse || s.email || s.societe || '';
                    return (
                      <div key={s.id} className="text-xs text-blue-900">
                        <span className="font-medium">{label}</span>
                        {sub && <span className="text-blue-700 ml-2">· {sub}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-stone-200">
              <button onClick={() => setResult(null)} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">← Retour</button>
              <button onClick={handleCreate} disabled={creating || detectedType === 'unknown'} className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 text-sm">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {creating ? 'Création...' : isImplemented ? (detectedType === 'email' ? 'Préparer l\'email →' : 'Créer ' + (TYPE_LABELS[detectedType]?.label || detectedType)) : 'Aperçu (pas encore créable)'}
              </button>
            </div>
          </div>
        )}
      </div>

      {mergeWith && (
        <MergeMandatsModal
          existingMandatId={mergeWith.id}
          newData={result?.mandat || {}}
          onClose={() => setMergeWith(null)}
          onMerged={(mandatId, updates) => {
            setMergeWith(null);
            if (onCreated) onCreated({ mandat: { id: mandatId, ...updates }, client: null, merged: true });
            reset();
            onClose();
          }}
        />
      )}

      {showEmailEditor && result?.email && (
        <EmailEditorModal
          initialEmail={result.email}
          linkSuggestions={result.link_suggestions?.suggestions || []}
          onClose={() => setShowEmailEditor(false)}
          onSent={() => {
            setShowEmailEditor(false);
            if (onCreated) onCreated({ email: result.email });
            reset();
            onClose();
          }}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${active ? 'border-sage-dark text-sage-darker bg-sage-50/50' : 'border-transparent text-stone-500 hover:text-stone-900 hover:bg-stone-50'}`}>
      {children}
    </button>
  );
}

function PreviewBlock({ title, data, duplicates, duplicateType, onMerge }) {
  const entries = Object.entries(data).filter(([k, v]) => v !== null && v !== undefined && v !== '' && k !== 'marche' && k !== 'lien_hint' && k !== 'lien_type');
  const marcheLabel = data.marche === 'b2c' ? 'Habitation (B2C)' : data.marche === 'b2b' ? 'Investissement (B2B)' : null;
  const hasDuplicates = Array.isArray(duplicates) && duplicates.length > 0;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
          {marcheLabel && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${data.marche === 'b2b' ? 'bg-sage-100 text-sage-darker' : 'bg-blue-100 text-blue-800'}`}>
              {marcheLabel}
            </span>
          )}
        </div>
        {hasDuplicates && (
          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
            ⚠️ {duplicates.length} doublon(s) potentiel(s)
          </span>
        )}
      </div>

      {hasDuplicates && (
        <div className="mb-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="text-xs font-semibold text-amber-900 mb-1.5">Fiches déjà en BDD :</div>
          <div className="space-y-1">
            {duplicates.map(d => {
              const isMandat = duplicateType === 'mandat';
              const label = isMandat
                ? (d.nom || d.adresse || 'Mandat sans nom')
                : (`${d.prenom || ''} ${d.nom || ''}`.trim() || d.email || 'Client');
              const sub = isMandat
                ? [d.adresse, d.ville, d.prix ? `${(d.prix / 1000).toFixed(0)}k€` : null].filter(Boolean).join(' · ')
                : [d.societe, d.email, d.tel].filter(Boolean).join(' · ');
              return (
                <div key={d.id} className="flex items-center gap-2 p-2 bg-white rounded border border-amber-100 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-900 truncate">{label}</div>
                    {sub && <div className="text-[11px] text-stone-500 truncate">{sub}</div>}
                  </div>
                  {isMandat && onMerge && (
                    <button onClick={() => onMerge(d.id, label)} className="flex items-center gap-1 px-2 py-1 bg-sage-dark text-white rounded text-[11px] hover:bg-sage-darker font-medium flex-shrink-0">
                      <GitMerge className="w-3 h-3" /> Fusionner
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-lg p-3 space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-2 text-xs">
            <span className="text-stone-500 font-medium min-w-[120px]">{key} :</span>
            <span className="text-stone-900 flex-1">
              {Array.isArray(value) ? value.join(', ') : (typeof value === 'object' ? JSON.stringify(value) : String(value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EmailEditorModal — éditeur + envoi via /api/microsoft/emails
// ═══════════════════════════════════════════════════════════════
function EmailEditorModal({ initialEmail, linkSuggestions = [], onClose, onSent }) {
  // Résoudre le destinataire : si l'IA a donné un email valide, on le prend
  // Sinon, on regarde dans les link_suggestions pour trouver un email
  const findInitialDestinataire = () => {
    const dest = initialEmail.destinataire || '';
    if (dest.includes('@')) return dest;
    // Sinon, prendre le premier client suggéré qui a un email
    const clientWithEmail = linkSuggestions.find(s => s.email);
    return clientWithEmail?.email || '';
  };

  const [destinataire, setDestinataire] = useState(findInitialDestinataire());
  const [objet, setObjet] = useState(initialEmail.objet || '');
  const [corps, setCorps] = useState(initialEmail.corps || '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  // Détection client lié (pour journaliser l'interaction)
  const linkedClient = linkSuggestions.find(s => s.email && s.email.toLowerCase() === destinataire.toLowerCase()) ||
                       linkSuggestions.find(s => s.prenom || s.nom);

  async function handleSend() {
    if (!destinataire.trim() || !destinataire.includes('@')) {
      alert('Destinataire invalide. Saisis une adresse email valide.');
      return;
    }
    if (!objet.trim()) {
      alert('Objet requis.');
      return;
    }
    if (!corps.trim()) {
      alert('Corps du mail vide.');
      return;
    }

    if (!confirm(`Envoyer cet email à ${destinataire} ?\n\nUne fois envoyé, il ne pourra pas être annulé.`)) return;

    setSending(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');

      // Convertir le corps en HTML simple (préserver les retours à la ligne)
      const htmlContent = corps
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

      const body = {
        to: destinataire,
        subject: objet,
        content: htmlContent,
      };
      if (linkedClient?.id) body.clientId = linkedClient.id;

      const res = await fetch('/api/microsoft/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'NOT_CONNECTED') {
          throw new Error('Microsoft Outlook n\'est pas connecté. Va dans Paramètres → Intégrations.');
        }
        throw new Error(data.error || 'Erreur d\'envoi');
      }
      onSent();
    } catch (e) {
      setError(e.message);
    }
    setSending(false);
  }

  return (
    <div className="fixed inset-0 bg-stone-900/70 flex items-center justify-center z-[60] p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-2xl w-full max-h-[92vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-stone-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-200 flex items-center justify-center">
              <Mail className="w-5 h-5 text-cyan-700" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-stone-900">Relire et envoyer</h2>
              <p className="text-xs text-stone-500">Vérifie le contenu avant l'envoi via Outlook</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><div>{error}</div>
          </div>
        )}

        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">À :</label>
            <input
              type="email"
              value={destinataire}
              onChange={e => setDestinataire(e.target.value)}
              placeholder="email@example.com"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark"
            />
            {linkedClient && (
              <div className="text-[11px] text-sage-darker mt-1">
                💡 Lié au client : {linkedClient.prenom} {linkedClient.nom}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Objet :</label>
            <input
              type="text"
              value={objet}
              onChange={e => setObjet(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Corps du mail :</label>
            <textarea
              value={corps}
              onChange={e => setCorps(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark font-mono"
            />
          </div>

          <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
            ⚠️ Cet email sera envoyé immédiatement via ton compte Outlook. Tu ne pourras pas le rappeler.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-stone-200 bg-stone-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">Annuler</button>
          <button onClick={handleSend} disabled={sending} className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 text-sm">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Envoi en cours...' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}
