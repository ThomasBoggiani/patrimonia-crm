'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, X, Check, AlertCircle, CheckSquare, Calendar, FileText, Users, Sparkles, Repeat, MapPin, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export default function GlobalVoiceModal({ mandats, clients, onClose, onSuccess }) {
  const [step, setStep] = useState('ready'); // ready | recording | processing | review | saving
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [editedTaches, setEditedTaches] = useState([]);
  const [editedReunion, setEditedReunion] = useState(null);
  const [editedCR, setEditedCR] = useState(null);
  const [editedNote, setEditedNote] = useState(null);
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
      if (event.error === 'not-allowed') setError("Accès au microphone refusé. Autorisez-le dans les paramètres.");
      else if (event.error !== 'no-speech') setError(`Erreur : ${event.error}`);
    };

    recognition.onend = () => {
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
      try { recognitionRef.current.start(); } catch (e) {}
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
      setError("Enregistrement trop court.");
      setStep('ready');
      return;
    }
    setStep('processing');
    await processTranscript(finalTranscript);
  };

  const processTranscript = async (text) => {
    try {
      const response = await fetch('/api/analyze-global-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          existingMandats: mandats.map(m => ({ id: m.id, nom: m.nom, adresse: m.adresse })),
          existingClients: clients.map(c => ({ id: c.id, nom: c.nom, prenom: c.prenom, societe: c.societe }))
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${response.status}`);
      }
      const parsed = await response.json();
      setResult(parsed);
      
      if (parsed.taches) setEditedTaches(parsed.taches);
      if (parsed.reunionRecurrente) setEditedReunion(parsed.reunionRecurrente);
      if (parsed.compteRendu) setEditedCR(parsed.compteRendu);
      if (parsed.noteLibre) setEditedNote(parsed.noteLibre);
      
      setStep('review');
    } catch (err) {
      setError(err.message || "Erreur analyse");
      setStep('ready');
    }
  };

  const saveResult = async () => {
    setStep('saving');
    try {
      // MODE TÂCHES
      if (result.mode === 'taches' && editedTaches.length > 0) {
        const todosToInsert = editedTaches.map(t => ({
          titre: t.titre,
          priorite: t.priorite || 'Moyenne',
          statut: 'À faire',
          echeance: t.dateEcheance || null,
          assignee: t.assignee || null,
          lien_type: t.lien_type || null,
          lien_id: t.lien_id || null
        }));
        await supabase.from('todos').insert(todosToInsert);
      }
      
      // MODE RÉUNION RÉCURRENTE
      if (result.mode === 'reunion_recurrente' && editedReunion) {
        await supabase.from('evenements_recurrents').insert({
          titre: editedReunion.titre,
          description: editedReunion.description,
          frequence: editedReunion.frequence || 'Hebdomadaire',
          jour_semaine: editedReunion.jourSemaine,
          jour_mois: editedReunion.jourMois,
          heure: editedReunion.heure,
          duree_minutes: editedReunion.dureeMinutes || 60,
          lieu: editedReunion.lieu,
          participants: editedReunion.participants || [],
          actif: true
        });
      }
      
      // MODE COMPTE-RENDU
      if (result.mode === 'compte_rendu' && editedCR) {
        const { data: note } = await supabase.from('notes_globales').insert({
          type: 'Compte-rendu',
          titre: editedCR.titre,
          contenu: editedCR.contenu,
          transcription_originale: transcript.trim(),
          participants: editedCR.participants || [],
          decisions: editedCR.decisions || []
        }).select().single();
        
        // Actions → tâches liées à la note
        if (editedCR.actions && editedCR.actions.length > 0 && note) {
          const todos = editedCR.actions.map(a => ({
            titre: a.titre,
            priorite: a.priorite || 'Moyenne',
            statut: 'À faire',
            echeance: a.dateEcheance || null,
            assignee: a.assignee || null,
            note_globale_id: note.id
          }));
          await supabase.from('todos').insert(todos);
        }
      }
      
      // MODE NOTE LIBRE
      if (result.mode === 'note_libre' && editedNote) {
        await supabase.from('notes_globales').insert({
          type: 'Note libre',
          titre: editedNote.titre,
          contenu: editedNote.contenu,
          transcription_originale: transcript.trim()
        });
      }
      
      onSuccess(result.mode, {
        tachesCount: editedTaches.length,
        reunion: !!editedReunion,
        actionsCount: editedCR?.actions?.length || 0
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erreur sauvegarde');
      setStep('review');
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const updateTache = (i, k, v) => setEditedTaches(prev => prev.map((t, idx) => idx === i ? { ...t, [k]: v } : t));
  const deleteTache = (i) => setEditedTaches(prev => prev.filter((_, idx) => idx !== i));
  const addTache = () => setEditedTaches(prev => [...prev, { titre: '', priorite: 'Moyenne', dateEcheance: new Date().toISOString().split('T')[0], assignee: null }]);

  const updateReunion = (k, v) => setEditedReunion(prev => ({ ...prev, [k]: v }));

  const updateCRAction = (i, k, v) => setEditedCR(prev => ({
    ...prev, actions: prev.actions.map((a, idx) => idx === i ? { ...a, [k]: v } : a)
  }));
  const deleteCRAction = (i) => setEditedCR(prev => ({
    ...prev, actions: prev.actions.filter((_, idx) => idx !== i)
  }));

  const modeIcon = {
    taches: CheckSquare,
    reunion_recurrente: Repeat,
    compte_rendu: Users,
    note_libre: FileText
  }[result?.mode] || Sparkles;

  const ModeIcon = modeIcon;

  return (
    <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-cream-dark sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink flex items-center gap-2">
              <Mic className="w-6 h-6 text-sage-dark" /> Note vocale
            </h2>
            <p className="text-xs text-sage-dark mt-0.5">Tâches, réunions, comptes-rendus — Claude détecte automatiquement</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-ink"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          {!supported && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
              <div className="font-medium mb-1">Navigateur non supporté</div>
              <div>Utilisez Chrome, Edge ou Safari récents.</div>
            </div>
          )}

          {error && supported && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* ÉTAPE READY */}
          {step === 'ready' && supported && (
            <div className="text-center py-6">
              <button onClick={startRecording}
                className="w-24 h-24 rounded-full gradient-sage-dark text-white shadow-lg hover:scale-105 transition-transform flex items-center justify-center mx-auto mb-6">
                <Mic className="w-10 h-10" />
              </button>
              <h3 className="font-display text-xl font-semibold text-ink mb-2">Parlez naturellement</h3>
              <p className="text-sm text-ink/70 max-w-md mx-auto mb-5">
                Claude comprend 4 types de notes et agit en conséquence.
              </p>
              
              <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto text-left">
                <div className="p-3 bg-cream-50 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckSquare className="w-3.5 h-3.5 text-sage-dark" />
                    <span className="text-xs font-medium text-ink">Tâches</span>
                  </div>
                  <p className="text-[11px] text-ink/60 italic leading-snug">"Je dois rappeler Durand demain et envoyer le mandat à Sophie."</p>
                </div>
                <div className="p-3 bg-cream-50 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Repeat className="w-3.5 h-3.5 text-sage-dark" />
                    <span className="text-xs font-medium text-ink">Réunions</span>
                  </div>
                  <p className="text-[11px] text-ink/60 italic leading-snug">"Réunion équipe tous les mardis à 11h, salle Penthièvre."</p>
                </div>
                <div className="p-3 bg-cream-50 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5 text-sage-dark" />
                    <span className="text-xs font-medium text-ink">Compte-rendu</span>
                  </div>
                  <p className="text-[11px] text-ink/60 italic leading-snug">"Point avec Thomas : on arrête Rivoli, Pierre rappelle vendredi."</p>
                </div>
                <div className="p-3 bg-cream-50 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileText className="w-3.5 h-3.5 text-sage-dark" />
                    <span className="text-xs font-medium text-ink">Note libre</span>
                  </div>
                  <p className="text-[11px] text-ink/60 italic leading-snug">"Idée : newsletter mensuelle avec les biens off-market."</p>
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE RECORDING */}
          {step === 'recording' && (
            <div className="text-center py-8">
              <button onClick={stopRecording}
                className="w-24 h-24 rounded-full bg-red-500 text-white shadow-lg animate-pulse flex items-center justify-center mx-auto mb-6">
                <Square className="w-8 h-8 fill-current" />
              </button>
              <div className="font-display text-2xl font-semibold text-ink mb-1 tabular-nums">{formatTime(elapsed)}</div>
              <p className="text-sm text-ink/70 mb-6">Parlez naturellement… Cliquez pour arrêter</p>
              <div className="bg-cream-50 rounded-lg p-4 max-h-48 overflow-y-auto text-left">
                {transcript || interim ? (
                  <p className="text-sm text-ink leading-relaxed">
                    {transcript}<span className="text-stone-400 italic">{interim}</span>
                  </p>
                ) : (
                  <p className="text-sm text-stone-400 italic">En attente de votre voix…</p>
                )}
              </div>
            </div>
          )}

          {/* ÉTAPE PROCESSING */}
          {step === 'processing' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-sage-dark animate-spin mx-auto mb-4" />
              <div className="font-display text-lg font-semibold text-ink mb-1">Claude analyse votre note…</div>
              <div className="text-sm text-ink/60">Détection du type et extraction</div>
            </div>
          )}

          {/* ÉTAPE REVIEW */}
          {step === 'review' && result && (
            <div className="space-y-4">
              {/* Bandeau mode détecté */}
              <div className="p-4 rounded-xl bg-sage-50 border border-sage-light">
                <div className="flex items-start gap-3">
                  <ModeIcon className="w-5 h-5 text-sage-dark flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-sage-darker">
                      {result.mode === 'taches' && `📋 ${editedTaches.length} tâche${editedTaches.length > 1 ? 's' : ''} détectée${editedTaches.length > 1 ? 's' : ''}`}
                      {result.mode === 'reunion_recurrente' && '🔄 Réunion récurrente détectée'}
                      {result.mode === 'compte_rendu' && `📝 Compte-rendu de réunion${editedCR?.actions?.length ? ` (+${editedCR.actions.length} action${editedCR.actions.length > 1 ? 's' : ''})` : ''}`}
                      {result.mode === 'note_libre' && '💭 Note libre'}
                    </div>
                    <div className="text-xs text-sage-darker/80 mt-0.5">{result.summary}</div>
                  </div>
                </div>
              </div>

              {/* Transcription brute */}
              <details className="bg-cream-50 rounded-lg p-3 text-sm">
                <summary className="cursor-pointer text-ink/70 font-medium text-xs">Voir la transcription brute</summary>
                <p className="mt-2 text-ink/80 italic leading-relaxed text-xs">« {transcript.trim()} »</p>
              </details>

              {/* MODE TÂCHES */}
              {result.mode === 'taches' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wide text-sage-dark">Tâches à créer</div>
                    <button onClick={addTache} className="text-xs text-sage-dark hover:underline">+ Ajouter</button>
                  </div>
                  {editedTaches.map((t, i) => (
                    <div key={i} className="border border-cream-dark rounded-lg p-3 space-y-2">
                      <div className="flex gap-2">
                        <input 
                          type="text" value={t.titre} onChange={e => updateTache(i, 'titre', e.target.value)}
                          placeholder="Titre de la tâche"
                          className="flex-1 px-3 py-1.5 border border-cream-dark rounded text-sm focus:outline-none focus:border-sage" 
                        />
                        <button onClick={() => deleteTache(i)} className="text-stone-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <select 
                          value={t.priorite || 'Moyenne'} onChange={e => updateTache(i, 'priorite', e.target.value)}
                          className="px-2 py-1 border border-cream-dark rounded text-xs"
                        >
                          <option>Haute</option><option>Moyenne</option><option>Basse</option>
                        </select>
                        <input 
                          type="date" value={t.dateEcheance || ''} onChange={e => updateTache(i, 'dateEcheance', e.target.value)}
                          className="px-2 py-1 border border-cream-dark rounded text-xs"
                        />
                        <input 
                          type="text" value={t.assignee || ''} onChange={e => updateTache(i, 'assignee', e.target.value)}
                          placeholder="Pour (facultatif)"
                          className="px-2 py-1 border border-cream-dark rounded text-xs"
                        />
                      </div>
                      {t.contexte && <div className="text-[10px] text-stone-500 italic">{t.contexte}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* MODE RÉUNION RÉCURRENTE */}
              {result.mode === 'reunion_recurrente' && editedReunion && (
                <div className="border border-cream-dark rounded-lg p-4 space-y-3">
                  <input 
                    type="text" value={editedReunion.titre || ''} onChange={e => updateReunion('titre', e.target.value)}
                    placeholder="Titre de la réunion"
                    className="w-full px-3 py-2 border border-cream-dark rounded text-sm font-medium"
                  />
                  <textarea 
                    value={editedReunion.description || ''} onChange={e => updateReunion('description', e.target.value)}
                    placeholder="Description (facultatif)" rows={2}
                    className="w-full px-3 py-2 border border-cream-dark rounded text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-ink/70 block mb-1">Fréquence</label>
                      <select 
                        value={editedReunion.frequence} onChange={e => updateReunion('frequence', e.target.value)}
                        className="w-full px-2 py-1.5 border border-cream-dark rounded text-sm"
                      >
                        <option>Hebdomadaire</option><option>Bi-hebdomadaire</option><option>Mensuelle</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-ink/70 block mb-1">{editedReunion.frequence === 'Mensuelle' ? 'Jour du mois' : 'Jour de la semaine'}</label>
                      {editedReunion.frequence === 'Mensuelle' ? (
                        <input type="number" min="1" max="31" value={editedReunion.jourMois || 1} 
                          onChange={e => updateReunion('jourMois', +e.target.value)}
                          className="w-full px-2 py-1.5 border border-cream-dark rounded text-sm" />
                      ) : (
                        <select value={editedReunion.jourSemaine ?? 1} onChange={e => updateReunion('jourSemaine', +e.target.value)}
                          className="w-full px-2 py-1.5 border border-cream-dark rounded text-sm">
                          {JOURS.map((j, idx) => <option key={idx} value={idx}>{j}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-ink/70 block mb-1">Heure</label>
                      <input type="time" value={editedReunion.heure || '09:00'} onChange={e => updateReunion('heure', e.target.value)}
                        className="w-full px-2 py-1.5 border border-cream-dark rounded text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-ink/70 block mb-1">Durée (min)</label>
                      <input type="number" value={editedReunion.dureeMinutes || 60} onChange={e => updateReunion('dureeMinutes', +e.target.value)}
                        className="w-full px-2 py-1.5 border border-cream-dark rounded text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-ink/70 block mb-1">Lieu</label>
                      <input type="text" value={editedReunion.lieu || ''} onChange={e => updateReunion('lieu', e.target.value)}
                        className="w-full px-2 py-1.5 border border-cream-dark rounded text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-ink/70 block mb-1">Participants (séparés par des virgules)</label>
                    <input 
                      type="text" 
                      value={(editedReunion.participants || []).join(', ')} 
                      onChange={e => updateReunion('participants', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      className="w-full px-2 py-1.5 border border-cream-dark rounded text-sm" 
                    />
                  </div>
                </div>
              )}

              {/* MODE COMPTE-RENDU */}
              {result.mode === 'compte_rendu' && editedCR && (
                <div className="space-y-3">
                  <div className="border border-cream-dark rounded-lg p-4 space-y-2">
                    <input 
                      type="text" value={editedCR.titre || ''} onChange={e => setEditedCR({ ...editedCR, titre: e.target.value })}
                      placeholder="Titre du compte-rendu"
                      className="w-full px-3 py-2 border border-cream-dark rounded text-sm font-medium"
                    />
                    <div>
                      <label className="text-xs text-ink/70 block mb-1">Participants</label>
                      <input 
                        type="text" 
                        value={(editedCR.participants || []).join(', ')} 
                        onChange={e => setEditedCR({ ...editedCR, participants: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        className="w-full px-2 py-1.5 border border-cream-dark rounded text-sm" 
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink/70 block mb-1">Résumé</label>
                      <textarea 
                        value={editedCR.contenu || ''} onChange={e => setEditedCR({ ...editedCR, contenu: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-cream-dark rounded text-sm"
                      />
                    </div>
                    {editedCR.decisions && editedCR.decisions.length > 0 && (
                      <div>
                        <label className="text-xs text-ink/70 block mb-1">Décisions prises</label>
                        <div className="bg-cream-50 rounded p-2 space-y-1">
                          {editedCR.decisions.map((d, i) => (
                            <div key={i} className="text-xs text-ink flex items-start gap-1.5">
                              <span className="text-sage-dark">•</span><span>{d}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {editedCR.actions && editedCR.actions.length > 0 && (
                    <div className="border border-sage-light rounded-lg p-3 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-sage-dark">Actions qui seront créées ({editedCR.actions.length})</div>
                      {editedCR.actions.map((a, i) => (
                        <div key={i} className="flex gap-2 items-start p-2 bg-sage-50 rounded">
                          <div className="flex-1 space-y-1.5">
                            <input 
                              type="text" value={a.titre} onChange={e => updateCRAction(i, 'titre', e.target.value)}
                              className="w-full px-2 py-1 border border-cream-dark rounded text-xs"
                            />
                            <div className="grid grid-cols-3 gap-1.5">
                              <select value={a.priorite || 'Moyenne'} onChange={e => updateCRAction(i, 'priorite', e.target.value)}
                                className="px-1.5 py-0.5 border border-cream-dark rounded text-[11px]">
                                <option>Haute</option><option>Moyenne</option><option>Basse</option>
                              </select>
                              <input type="date" value={a.dateEcheance || ''} onChange={e => updateCRAction(i, 'dateEcheance', e.target.value)}
                                className="px-1.5 py-0.5 border border-cream-dark rounded text-[11px]" />
                              <input type="text" value={a.assignee || ''} onChange={e => updateCRAction(i, 'assignee', e.target.value)}
                                placeholder="Pour"
                                className="px-1.5 py-0.5 border border-cream-dark rounded text-[11px]" />
                            </div>
                          </div>
                          <button onClick={() => deleteCRAction(i)} className="text-stone-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* MODE NOTE LIBRE */}
              {result.mode === 'note_libre' && editedNote && (
                <div className="border border-cream-dark rounded-lg p-4 space-y-2">
                  <input 
                    type="text" value={editedNote.titre || ''} onChange={e => setEditedNote({ ...editedNote, titre: e.target.value })}
                    placeholder="Titre"
                    className="w-full px-3 py-2 border border-cream-dark rounded text-sm font-medium"
                  />
                  <textarea 
                    value={editedNote.contenu || ''} onChange={e => setEditedNote({ ...editedNote, contenu: e.target.value })}
                    rows={5}
                    className="w-full px-3 py-2 border border-cream-dark rounded text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* ÉTAPE SAVING */}
          {step === 'saving' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-sage-dark animate-spin mx-auto mb-4" />
              <div className="font-display text-lg font-semibold text-ink">Enregistrement…</div>
            </div>
          )}
        </div>

        {/* Boutons */}
        {step === 'review' && (
          <div className="flex gap-2 justify-end p-6 border-t border-cream-dark bg-cream-50 sticky bottom-0">
            <button onClick={() => { setStep('ready'); setTranscript(''); setResult(null); }}
              className="px-4 py-2 text-sm text-ink/70 hover:bg-cream-200 rounded-lg">Recommencer</button>
            <button onClick={saveResult} className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Valider et enregistrer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
