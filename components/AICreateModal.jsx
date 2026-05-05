// ═══════════════════════════════════════════════════════════════════
// components/AICreateModal.jsx
// Modal unifié : Fichiers + Texte + Voix → Mandat / Client / Les 2
// ═══════════════════════════════════════════════════════════════════

'use client';
import { useState, useRef } from 'react';
import { X, Sparkles, FileText, Mic, MicOff, Upload, Loader2, Check, AlertCircle, Building2, User as UserIcon, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, getCurrentUserInitials } from '@/lib/auth';

const TYPE_LABELS = {
  mandat: { label: 'Mandat (bien à vendre)', icon: Building2, color: 'sage' },
  client: { label: 'Client (acheteur)', icon: UserIcon, color: 'blue' },
  both: { label: 'Mandat + Client', icon: Sparkles, color: 'purple' },
  unknown: { label: 'Indéterminé', icon: AlertCircle, color: 'stone' },
};

export default function AICreateModal({ open, onClose, defaultType, onCreated }) {
  const { profile } = useAuth();
  const myInitials = getCurrentUserInitials(profile) || 'TB';
  const [tab, setTab] = useState('text'); // 'files' | 'text' | 'audio'
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioTranscription, setAudioTranscription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [creating, setCreating] = useState(false);
  const [forcedType, setForcedType] = useState(null);
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
        // Upload chaque fichier sur storage et récup les paths
        const paths = [];
        for (const f of files) {
          const cleanName = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = '_ai-temp/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + cleanName;
          const { error: upErr } = await supabase.storage.from('mandat-docs').upload(path, f, {
            contentType: f.type || 'application/octet-stream',
            upsert: false,
          });
          if (!upErr) paths.push(path);
        }
        body.files = paths;
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
        setAnalyzing(false);
        return;
      }
      setResult(data);
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
    setAnalyzing(false);
  }

  async function handleCreate() {
    if (!result) return;
    setCreating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      const token = session?.access_token;
      if (!token) { setCreating(false); return; }

      const created = { mandat: null, client: null };

      if ((result.type === 'mandat' || result.type === 'both') && result.mandat) {
        // Filtrer les champs jsonb / non gérés
        const { description, ...mandatFields } = result.mandat;
        const { data: m, error: mErr } = await supabase.from('mandats').insert({
          ...mandatFields,
          description: description || null,
          statut: 'Sourcing',
          owner: myInitials,
          created_by: user?.id,
        }).select().single();
        if (mErr) {
          console.error('Erreur création mandat:', mErr);
          alert('Erreur création mandat : ' + mErr.message);
        } else {
          created.mandat = m;
        }
      }

      if ((result.type === 'client' || result.type === 'both') && result.client) {
        const { zones, typologies_recherchees, ...clientFields } = result.client;
        const { data: c, error: cErr } = await supabase.from('clients').insert({
          ...clientFields,
          zones: zones || [],
          typologies_recherchees: typologies_recherchees || [],
          statut: 'Actif',
          created_by: user?.id,
          owner: myInitials,
        }).select().single();
        if (cErr) {
          console.error('Erreur création client:', cErr);
          alert('Erreur création client : ' + cErr.message);
        } else {
          created.client = c;
        }
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
        // Transcription via API existante /api/analyze-voice (si elle existe)
        // Sinon, fallback : laisser l'utilisateur compléter manuellement
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
    // Utilise l'API analyze-voice existante si dispo
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      const res = await fetch('/api/analyze-voice', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok && data.transcription) {
        setAudioTranscription(data.transcription);
      }
    } catch (e) {
      console.warn('Transcription échouée, à compléter manuellement');
    }
  }

  const detectedType = forcedType || result?.type || 'unknown';
  const TypeIcon = TYPE_LABELS[detectedType]?.icon || AlertCircle;

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
              <p className="text-xs text-stone-500">Fichiers, texte ou voix — l'IA détecte et crée</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>

        {!result && (
          <>
            <div className="px-6 pt-4 flex gap-1 border-b border-stone-200">
              <TabButton active={tab === 'files'} onClick={() => setTab('files')} icon={Upload}>📁 Fichiers</TabButton>
              <TabButton active={tab === 'text'} onClick={() => setTab('text')} icon={FileText}>📝 Texte</TabButton>
              <TabButton active={tab === 'audio'} onClick={() => setTab('audio')} icon={Mic}>🎤 Voix</TabButton>
            </div>

            <div className="p-6">
              {tab === 'text' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-2">Colle ici le texte à analyser</label>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={8}
                    placeholder="Email d'un acheteur, conversation ChatGPT, note de RDV, fiche d'un bien..."
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark"
                  />
                  <p className="text-xs text-stone-500 mt-2">L'IA détectera s'il s'agit d'un mandat, d'un acheteur, ou des deux.</p>
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
              <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">Annuler</button>
              <button onClick={handleAnalyze} disabled={analyzing} className="flex items-center gap-2 px-4 py-2 bg-sage-dark text-white rounded-lg hover:bg-sage-darker disabled:opacity-50 text-sm">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {analyzing ? 'Analyse...' : 'Analyser avec l\'IA'}
              </button>
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
                {['mandat', 'client', 'both'].map(t => (
                  <button key={t} onClick={() => setForcedType(forcedType === t ? null : t)}
                    className={`text-xs px-2 py-0.5 rounded-full border ${forcedType === t || (!forcedType && result.type === t) ? 'bg-sage-100 border-sage-dark text-sage-darker font-medium' : 'bg-white border-stone-200 text-stone-600'}`}>
                    {TYPE_LABELS[t]?.label || t}
                  </button>
                ))}
              </div>
            </div>

            {(detectedType === 'mandat' || detectedType === 'both') && result.mandat && (
              <PreviewBlock title="📋 Mandat à créer" data={result.mandat} duplicates={result.duplicates?.mandat} />
            )}
            {(detectedType === 'client' || detectedType === 'both') && result.client && (
              <PreviewBlock title="👤 Client à créer" data={result.client} duplicates={result.duplicates?.client} />
            )}

            <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-stone-200">
              <button onClick={() => setResult(null)} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">← Retour</button>
              <button onClick={handleCreate} disabled={creating || detectedType === 'unknown'} className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 text-sm">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {creating ? 'Création...' : 'Créer ' + (detectedType === 'both' ? 'mandat + client' : detectedType)}
              </button>
            </div>
          </div>
        )}
      </div>
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

function PreviewBlock({ title, data, duplicates }) {
  const entries = Object.entries(data).filter(([k, v]) => v !== null && v !== undefined && v !== '');
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        {duplicates && duplicates.length > 0 && (
          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
            ⚠️ {duplicates.length} doublon(s) potentiel(s)
          </span>
        )}
      </div>
      <div className="bg-white border border-stone-200 rounded-lg p-3 space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-2 text-xs">
            <span className="text-stone-500 font-medium min-w-[120px]">{key} :</span>
            <span className="text-stone-900 flex-1">
              {Array.isArray(value) ? value.join(', ') : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
