'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, X, Check, AlertCircle, CheckCircle2, Sparkles, Info, RotateCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TYPES_ACTIF, TYPOLOGIES_CLIENT, ZONES } from '@/lib/crm-constants';

export default function VoiceNoteModal({ existingClients, onClose, onSuccess }) {
  const [step, setStep] = useState('ready'); // ready | recording | transcribing | processing | review | saving
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [editedData, setEditedData] = useState(null);
  const [supported, setSupported] = useState(true);
  
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'fr-FR';

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t + ' ';
        else interimText += t;
      }
      if (finalText) setTranscript(prev => prev + finalText);
      setInterim(interimText);
    };

    recognition.onerror = (event) => {
      console.error('Erreur recognition:', event.error);
      if (event.error === 'not-allowed') setError("Accès au microphone refusé. Autorisez-le dans les paramètres de votre navigateur.");
      else if (event.error === 'no-speech') { /* silence, on ignore */ }
      else setError(`Erreur de reconnaissance vocale : ${event.error}`);
    };

    recognition.onend = () => {
      // Arrêt auto : si on était en enregistrement, on redémarre (continuous peut couper après silences)
      if (recognitionRef.current?.keepGoing) {
        try { recognition.start(); } catch (e) {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch (e) {}
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = () => {
    setError(null);
    setTranscript('');
    setInterim('');
    setElapsed(0);
    setStep('recording');
    
    if (recognitionRef.current) {
      recognitionRef.current.keepGoing = true;
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Déjà démarré, on ignore
      }
    }
    
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const stopRecording = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.keepGoing = false;
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    
    setInterim('');
    const finalTranscript = transcript.trim();
    
    if (!finalTranscript || finalTranscript.length < 10) {
      setError("Enregistrement trop court. Recommencez en parlant au moins quelques secondes.");
      setStep('ready');
      return;
    }
    
    setStep('processing');
    await processTranscript(finalTranscript);
  };

  const processTranscript = async (text) => {
    try {
      const response = await fetch('/api/analyze-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          existingClients: existingClients.map(c => ({
            id: c.id, nom: c.nom, prenom: c.prenom, societe: c.societe
          }))
        })
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${response.status}`);
      }
      
      const parsed = await response.json();
      setResult(parsed);
      
      // Pré-remplissage des données éditables
      if (parsed.action === 'update' && parsed.matchedClientId) {
        const existing = existingClients.find(c => c.id === parsed.matchedClientId);
        setEditedData({ ...existing, ...Object.fromEntries(
          Object.entries(parsed.fields || {}).filter(([_, v]) => v !== null && v !== undefined && v !== '')
        )});
      } else {
        setEditedData({
          nom: '', prenom: '', societe: '', tel: '', email: '',
          typologie: 'Foncières', nature: 'Privée', budgetMin: 0, budgetMax: 0,
          rendementMin: 0, zones: [], typologiesRecherchees: [],
          statut: 'Actif', maturite: 'Moyen', origine: 'Apporteur', owner: 'JD',
          ...Object.fromEntries(
            Object.entries(parsed.fields || {}).filter(([_, v]) => v !== null && v !== undefined && v !== '')
          )
        });
      }
      
      setStep('review');
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de l'analyse");
      setStep('ready');
    }
  };

  const saveResult = async () => {
    setStep('saving');
    try {
      const toSnake = (obj) => {
        const r = {};
        for (const k in obj) {
          if (k === 'id' || k === 'createdAt' || k === 'updatedAt') continue;
          const sk = k.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
          r[sk] = obj[k];
        }
        return r;
      };
      
      let clientId;
      
      if (result.action === 'update' && result.matchedClientId) {
        await supabase.from('clients').update(toSnake(editedData)).eq('id', result.matchedClientId);
        clientId = result.matchedClientId;
      } else {
        const { data } = await supabase.from('clients').insert(toSnake(editedData)).select().single();
        clientId = data.id;
      }
      
      // Ajout de l'interaction
      if (result.interaction && clientId) {
        await supabase.from('interactions').insert({
          client_id: clientId,
          date: new Date().toISOString().split('T')[0],
          type: result.interaction.type || 'Appel',
          resume: result.interaction.resume || transcript.trim(),
          next_step: result.interaction.nextStep || null,
          date_next_step: result.interaction.dateNextStep || null
        });
      }
      
      onSuccess(result.action, clientId);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erreur sauvegarde');
      setStep('review');
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const updateField = (k, v) => setEditedData(prev => ({ ...prev, [k]: v }));
  const toggleArrayField = (k, v) => setEditedData(prev => {
    const arr = prev[k] || [];
    return { ...prev, [k]: arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v] };
  });

  return (
    <div className="fixed inset-0 bg-ink/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-stone-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-display text-2xl font-semibold text-stone-900 flex items-center gap-2">
              <Mic className="w-6 h-6 text-sage-dark" /> Note vocale
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">Claude écoute, transcrit et structure en fiche client</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          {!supported && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
              <div className="font-medium mb-1">Navigateur non supporté</div>
              <div>Votre navigateur ne supporte pas la reconnaissance vocale. Utilisez Chrome, Edge ou Safari (versions récentes).</div>
            </div>
          )}

          {error && supported && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {step === 'ready' && supported && (
            <div className="text-center py-8">
              <button onClick={startRecording}
                className="w-24 h-24 rounded-full gradient-sage-dark text-white shadow-lg hover:scale-105 transition-transform flex items-center justify-center mx-auto mb-6">
                <Mic className="w-10 h-10" />
              </button>
              <h3 className="font-display text-xl font-semibold text-stone-900 mb-2">Prêt à enregistrer</h3>
              <p className="text-sm text-stone-600 max-w-md mx-auto mb-4">
                Cliquez sur le microphone et racontez naturellement votre échange : nom du contact, société, budget, critères recherchés, prochaine étape…
              </p>
              <div className="mt-6 bg-stone-50 rounded-lg p-4 text-left max-w-md mx-auto">
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-600 mb-2 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Exemple
                </div>
                <p className="text-xs text-stone-700 italic leading-relaxed">
                  "Je viens de voir Philippe Durand de Foncière Parisienne. Budget 5 à 15 millions, cherche des immeubles haussmanniens à Paris, rendement 4,5% minimum. Décision rapide, à rappeler la semaine prochaine."
                </p>
              </div>
            </div>
          )}

          {step === 'recording' && (
            <div className="text-center py-8">
              <button onClick={stopRecording}
                className="w-24 h-24 rounded-full bg-red-500 text-white shadow-lg animate-pulse flex items-center justify-center mx-auto mb-6">
                <Square className="w-8 h-8 fill-current" />
              </button>
              <div className="font-display text-2xl font-semibold text-stone-900 mb-1 tabular-nums">{formatTime(elapsed)}</div>
              <p className="text-sm text-stone-600 mb-6">Parlez naturellement… Cliquez pour arrêter</p>
              <div className="bg-stone-50 rounded-lg p-4 max-h-48 overflow-y-auto text-left">
                {transcript || interim ? (
                  <p className="text-sm text-stone-800 leading-relaxed">
                    {transcript}<span className="text-stone-400 italic">{interim}</span>
                  </p>
                ) : (
                  <p className="text-sm text-stone-400 italic">En attente de votre voix…</p>
                )}
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-sage-dark animate-spin mx-auto mb-4" />
              <div className="font-display text-lg font-semibold text-stone-900 mb-1">Claude structure votre note…</div>
              <div className="text-sm text-stone-500">Extraction des informations et détection de doublons</div>
            </div>
          )}

          {step === 'review' && result && editedData && (
            <div className="space-y-4">
              {/* Bandeau action détectée */}
              <div className={`p-4 rounded-xl border ${
                result.action === 'update' 
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div className="flex items-start gap-3">
                  {result.action === 'update' ? (
                    <RotateCw className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className={`font-medium text-sm ${result.action === 'update' ? 'text-blue-900' : 'text-emerald-900'}`}>
                      {result.action === 'update' 
                        ? '🔄 Fiche existante détectée — sera enrichie'
                        : '✨ Nouvelle fiche client sera créée'}
                    </div>
                    <div className={`text-xs mt-0.5 ${result.action === 'update' ? 'text-blue-800' : 'text-emerald-800'}`}>
                      {result.summary}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transcription */}
              <details className="bg-stone-50 rounded-lg p-3 text-sm">
                <summary className="cursor-pointer text-stone-600 font-medium">Voir la transcription brute</summary>
                <p className="mt-2 text-stone-700 italic leading-relaxed">"{transcript.trim()}"</p>
              </details>

              {/* Données structurées éditables */}
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-600">Fiche client</div>
                
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={editedData.prenom || ''} onChange={e => updateField('prenom', e.target.value)} placeholder="Prénom"
                    className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
                  <input type="text" value={editedData.nom || ''} onChange={e => updateField('nom', e.target.value)} placeholder="Nom"
                    className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
                </div>
                
                <input type="text" value={editedData.societe || ''} onChange={e => updateField('societe', e.target.value)} placeholder="Société"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
                
                <div className="grid grid-cols-2 gap-3">
                  <input type="tel" value={editedData.tel || ''} onChange={e => updateField('tel', e.target.value)} placeholder="Téléphone"
                    className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
                  <input type="email" value={editedData.email || ''} onChange={e => updateField('email', e.target.value)} placeholder="Email"
                    className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-stone-500 uppercase block mb-1">Typologie</label>
                    <select value={editedData.typologie || 'Foncières'} onChange={e => updateField('typologie', e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                      {TYPOLOGIES_CLIENT.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 uppercase block mb-1">Maturité</label>
                    <select value={editedData.maturite || 'Moyen'} onChange={e => updateField('maturite', e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                      <option>Haute</option><option>Moyen</option><option>Basse</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-stone-500 uppercase block mb-1">Budget min (€)</label>
                    <input type="number" value={editedData.budgetMin || 0} onChange={e => updateField('budgetMin', +e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 uppercase block mb-1">Budget max (€)</label>
                    <input type="number" value={editedData.budgetMax || 0} onChange={e => updateField('budgetMax', +e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 uppercase block mb-1">Rdt min (%)</label>
                    <input type="number" step="0.1" value={editedData.rendementMin || 0} onChange={e => updateField('rendementMin', +e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-stone-500 uppercase block mb-1">Zones</label>
                  <div className="flex flex-wrap gap-2">
                    {ZONES.map(z => (
                      <button key={z} type="button" onClick={() => toggleArrayField('zones', z)}
                        className={`px-3 py-1 text-xs rounded-full border ${(editedData.zones || []).includes(z) ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}>{z}</button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-stone-500 uppercase block mb-1">Typologies recherchées</label>
                  <div className="flex flex-wrap gap-2">
                    {TYPES_ACTIF.map(t => (
                      <button key={t} type="button" onClick={() => toggleArrayField('typologiesRecherchees', t)}
                        className={`px-3 py-1 text-xs rounded-full border ${(editedData.typologiesRecherchees || []).includes(t) ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}>{t}</button>
                    ))}
                  </div>
                </div>

                {/* Interaction qui sera créée */}
                {result.interaction && (
                  <div className="mt-4 p-4 bg-sage-50 border border-sage-light rounded-xl">
                    <div className="text-xs font-semibold uppercase tracking-wide text-sage-darker mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Interaction qui sera ajoutée à l'historique
                    </div>
                    <div className="text-sm text-stone-800 mb-1"><span className="font-medium">{result.interaction.type}</span> du {new Date().toLocaleDateString('fr-FR')}</div>
                    <div className="text-xs text-stone-700 italic mb-1">"{result.interaction.resume}"</div>
                    {result.interaction.nextStep && (
                      <div className="text-xs text-sage-darker mt-2 font-medium">
                        → Prochaine action : {result.interaction.nextStep}
                        {result.interaction.dateNextStep && ` (${new Date(result.interaction.dateNextStep).toLocaleDateString('fr-FR')})`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'saving' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-sage-dark animate-spin mx-auto mb-4" />
              <div className="font-display text-lg font-semibold text-stone-900">Enregistrement…</div>
            </div>
          )}
        </div>

        {step === 'review' && (
          <div className="flex gap-2 justify-end p-6 border-t border-stone-200 bg-stone-50 sticky bottom-0">
            <button onClick={() => { setStep('ready'); setTranscript(''); setResult(null); setEditedData(null); }}
              className="px-4 py-2 text-sm text-stone-700 hover:bg-cream-200 rounded-lg">Recommencer</button>
            <button onClick={saveResult} className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Valider et enregistrer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
