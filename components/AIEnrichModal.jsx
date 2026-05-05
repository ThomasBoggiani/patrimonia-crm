// ═══════════════════════════════════════════════════════════════════
// components/AIEnrichModal.jsx
// Modal d'enrichissement IA d'un mandat existant
// 3 onglets : Fichiers / Texte / Voix
// 2 modes : smart_update (par défaut) / prefill_empty_only
// Affiche un diff Avant/Après avant validation
// ═══════════════════════════════════════════════════════════════════

'use client';
import { useState, useRef } from 'react';
import { X, Sparkles, FileText, Mic, MicOff, Upload, Loader2, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const FIELD_LABELS = {
  nom: 'Nom du bien', adresse: 'Adresse', ville: 'Ville', type: 'Type', sous_type: 'Sous-type',
  surface: 'Surface (m²)', nb_pieces: 'Pièces', nb_chambres: 'Chambres', etage: 'Étage',
  annee_construction: 'Année construction', prix: 'Prix', prix_net_vendeur: 'Prix net vendeur',
  prix_m2: 'Prix au m²', honoraires_charge: 'Honoraires à charge', honoraires_taux: 'Honoraires (%)',
  honoraires_montant: 'Honoraires (€)', loyers_annuels: 'Loyers annuels', rendement: 'Rendement (%)',
  charges_annuelles: 'Charges annuelles', taxe_fonciere: 'Taxe foncière',
  dpe_consommation: 'DPE conso', dpe_emissions: 'DPE émissions', dpe_date: 'DPE (date)',
  mandat_numero: 'N° mandat', mandat_type: 'Type mandat', mandat_date_echeance: 'Échéance mandat',
  nb_lots: 'Nb lots', description: 'Description', commercialisation: 'Commercialisation',
};

function isEmpty(v) {
  return v === null || v === undefined || v === '';
}

function formatValue(v) {
  if (isEmpty(v)) return <span className="text-stone-400 italic">vide</span>;
  if (typeof v === 'number') return v.toLocaleString('fr-FR');
  if (typeof v === 'string' && v.length > 80) return v.slice(0, 80) + '…';
  return String(v);
}

/**
 * Resize image client-side (1600px max + JPEG q85). Évite timeouts Vercel et tokens Anthropic.
 */
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
          resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };
      img.onerror = () => reject(new Error('Image invalide'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Lecture fichier impossible'));
    reader.readAsDataURL(file);
  });
}

export default function AIEnrichModal({ open, mandatId, mandatLabel, defaultMode = 'smart_update', onClose, onApplied }) {
  const [tab, setTab] = useState('text');
  const [mode, setMode] = useState(defaultMode);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioTranscription, setAudioTranscription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [applying, setApplying] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState({}); // { fieldKey: true }
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
    setSelectedKeys({});
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setResult(null);
    setSelectedKeys({});

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { alert('Session expirée'); setAnalyzing(false); return; }

      const body = { token, mandatId, mode };

      if (tab === 'text') {
        if (!text.trim()) { alert('Colle du texte à analyser'); setAnalyzing(false); return; }
        body.text = text;
      } else if (tab === 'audio') {
        if (!audioTranscription.trim()) { alert('Enregistre une note vocale'); setAnalyzing(false); return; }
        body.audioTranscription = audioTranscription;
      } else if (tab === 'files') {
        if (files.length === 0) { alert('Ajoute au moins 1 fichier'); setAnalyzing(false); return; }

        // Resize images
        setProgress({ label: 'Optimisation des fichiers', current: 0, total: files.length });
        const optimizedFiles = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          setProgress({ label: 'Optimisation des fichiers', current: i + 1, total: files.length });
          if (f.type.startsWith('image/')) {
            try { optimizedFiles.push(await resizeImage(f)); }
            catch { optimizedFiles.push(f); }
          } else {
            optimizedFiles.push(f);
          }
        }

        // Upload Storage
        setProgress({ label: 'Téléversement', current: 0, total: optimizedFiles.length });
        const paths = [];
        for (let i = 0; i < optimizedFiles.length; i++) {
          const f = optimizedFiles[i];
          setProgress({ label: 'Téléversement', current: i + 1, total: optimizedFiles.length });
          const cleanName = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = '_ai-temp/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + cleanName;
          const { error: upErr } = await supabase.storage.from('mandat-docs').upload(path, f, {
            contentType: f.type || 'application/octet-stream',
            upsert: false,
          });
          if (!upErr) paths.push(path);
        }

        if (paths.length === 0) {
          alert("Échec d'upload de tous les fichiers");
          setProgress(null);
          setAnalyzing(false);
          return;
        }
        body.files = paths;
        setProgress({ label: 'Analyse par l\'IA', current: 0, total: 0 });
      }

      const res = await fetch('/api/ai-enrich', {
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

      // Pré-cocher tous les champs proposés par défaut
      const preselect = {};
      for (const k of Object.keys(data.updates || {})) preselect[k] = true;
      setSelectedKeys(preselect);
      setResult(data);
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
    setProgress(null);
    setAnalyzing(false);
  }

  async function handleApply() {
    if (!result) return;
    const updates = {};
    for (const [k, v] of Object.entries(result.updates || {})) {
      if (selectedKeys[k]) updates[k] = v;
    }
    if (Object.keys(updates).length === 0) {
      alert('Coche au moins un champ pour appliquer.');
      return;
    }

    setApplying(true);
    try {
      const { error } = await supabase.from('mandats').update(updates).eq('id', mandatId);
      if (error) throw error;
      onApplied?.(updates);
      reset();
      onClose();
    } catch (e) {
      alert('Erreur application : ' + e.message);
    } finally {
      setApplying(false);
    }
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
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      const res = await fetch('/api/analyze-voice', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok && data.transcription) setAudioTranscription(data.transcription);
    } catch (e) {
      console.warn('Transcription échouée');
    }
  }

  const updatesEntries = Object.entries(result?.updates || {});

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-2xl w-full max-h-[92vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sage-100 to-sage-200 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-sage-darker" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold text-stone-900 truncate">Enrichir avec l'IA</h2>
              <p className="text-xs text-stone-500 truncate">{mandatLabel || 'Mandat existant'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>

        {!result && (
          <>
            {/* Choix mode */}
            <div className="px-5 pt-4">
              <div className="flex gap-1.5 p-1 bg-stone-100 rounded-lg">
                <button onClick={() => setMode('smart_update')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    mode === 'smart_update' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-600 hover:text-stone-900'
                  }`}>
                  ✨ MAJ intelligente
                </button>
                <button onClick={() => setMode('prefill_empty_only')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    mode === 'prefill_empty_only' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-600 hover:text-stone-900'
                  }`}>
                  📝 Pré-remplir vides
                </button>
              </div>
              <p className="text-[11px] text-stone-500 mt-1.5 px-1">
                {mode === 'smart_update'
                  ? "L'IA peut écraser des champs si elle a une info plus précise"
                  : "L'IA ne touche QUE les champs vides, jamais d'écrasement"}
              </p>
            </div>

            {/* Tabs */}
            <div className="px-5 pt-3 flex gap-1 border-b border-stone-200">
              <TabButton active={tab === 'files'} onClick={() => setTab('files')}>📁 Fichiers</TabButton>
              <TabButton active={tab === 'text'} onClick={() => setTab('text')}>📝 Texte</TabButton>
              <TabButton active={tab === 'audio'} onClick={() => setTab('audio')}>🎤 Voix</TabButton>
            </div>

            <div className="p-5">
              {tab === 'text' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-2">Colle ici un email, une annonce, des notes…</label>
                  <textarea value={text} onChange={e => setText(e.target.value)} rows={8}
                    placeholder="Ex: 'Le vendeur me confirme un prix net de 380k, surface 65m² selon ses derniers diagnostics, DPE D...'"
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark" />
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
                      <div className="text-xs font-semibold text-stone-700">{files.length} fichier(s) :</div>
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
                    <p className="text-sm font-medium text-stone-900 mt-3">{recording ? 'Enregistrement…' : audioBlob ? 'Recommencer' : "Démarrer l'enregistrement"}</p>
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

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-stone-200 bg-stone-50">
              {progress ? (
                <div className="flex items-center gap-3 flex-1">
                  <Loader2 className="w-4 h-4 animate-spin text-sage-dark flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-stone-700 mb-1 flex items-center justify-between gap-2">
                      <span className="truncate">{progress.label}</span>
                      {progress.total > 0 && <span className="text-stone-500">{progress.current}/{progress.total}</span>}
                    </div>
                    {progress.total > 0 && (
                      <div className="h-1 bg-stone-200 rounded-full overflow-hidden">
                        <div className="h-full bg-sage-dark transition-all duration-200"
                          style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">Annuler</button>
                  <button onClick={handleAnalyze} disabled={analyzing}
                    className="flex items-center gap-2 px-4 py-2 bg-sage-dark text-white rounded-lg hover:bg-sage-darker disabled:opacity-50 text-sm">
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {analyzing ? 'Analyse…' : "Analyser avec l'IA"}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* RÉSULTAT — vue diff */}
        {result && (
          <div className="p-5">
            <div className="mb-4 p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Sparkles className="w-4 h-4 text-sage-dark" />
                <span className="font-medium text-stone-900">{updatesEntries.length} champ(s) à modifier</span>
                {result.confidence > 0 && <span className="text-xs text-stone-500">({Math.round(result.confidence * 100)}%)</span>}
              </div>
              {result.reasoning && <p className="text-xs text-stone-600">{result.reasoning}</p>}
            </div>

            {updatesEntries.length === 0 && (
              <div className="text-center py-8">
                <Check className="w-10 h-10 text-sage-dark mx-auto mb-3" />
                <h3 className="font-display text-lg font-semibold text-stone-900 mb-1">Aucune modification proposée</h3>
                <p className="text-sm text-stone-600">L'IA n'a rien trouvé à enrichir avec ce contenu.</p>
              </div>
            )}

            {updatesEntries.length > 0 && (
              <div className="border border-stone-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[40px_140px_1fr_1fr] bg-stone-50 border-b border-stone-200 text-xs font-semibold uppercase tracking-wide text-stone-700">
                  <div className="px-2 py-2"></div>
                  <div className="px-3 py-2">Champ</div>
                  <div className="px-3 py-2 border-l border-stone-200">Avant</div>
                  <div className="px-3 py-2 border-l border-stone-200 bg-sage-50/50">Après (IA)</div>
                </div>
                {updatesEntries.map(([key, newVal], i) => {
                  const exVal = result.currentValues?.[key];
                  const checked = !!selectedKeys[key];
                  return (
                    <div key={key} className={`grid grid-cols-[40px_140px_1fr_1fr] text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'} border-b border-stone-100 last:border-b-0`}>
                      <div className="px-2 py-2.5 flex items-center justify-center">
                        <input type="checkbox" checked={checked}
                          onChange={() => setSelectedKeys(prev => ({ ...prev, [key]: !prev[key] }))}
                          className="w-4 h-4 accent-sage-dark cursor-pointer" />
                      </div>
                      <div className="px-3 py-2.5 font-medium text-stone-700 text-xs flex items-center">
                        {FIELD_LABELS[key] || key}
                      </div>
                      <div className="px-3 py-2.5 border-l border-stone-200 text-xs text-stone-600">
                        {formatValue(exVal)}
                      </div>
                      <div className="px-3 py-2.5 border-l border-stone-200 bg-sage-50/30 text-xs text-stone-900 font-medium">
                        {formatValue(newVal)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-stone-200">
              <button onClick={() => { setResult(null); setSelectedKeys({}); }} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">← Retour</button>
              <button onClick={handleApply} disabled={applying || updatesEntries.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 text-sm">
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {applying ? 'Application…' : `Appliquer ${Object.values(selectedKeys).filter(Boolean).length} changement(s)`}
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
    <button onClick={onClick} className={`px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${active ? 'border-sage-dark text-sage-darker bg-sage-50/50' : 'border-transparent text-stone-500 hover:text-stone-900 hover:bg-stone-50'}`}>
      {children}
    </button>
  );
}
