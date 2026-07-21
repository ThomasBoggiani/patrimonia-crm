'use client';

// components/VoiceNote.jsx
// Bouton « note vocale » réutilisable (mandat, client, …).
// Enregistre → transcrit (Whisper) → 1) enregistre la note dans l'historique
// (interactions) 2) injecte le texte dans l'assistant IA avec le bon contexte,
// pour qu'il propose de compléter la fiche. Thomas valide dans l'assistant.

import { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function VoiceNote({ entityType, entity, onSaved, compact = false }) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const label = entityType === 'mandat' ? 'ce mandat' : 'ce contact';

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); handleAudio(); };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      alert("Micro indisponible : " + e.message);
    }
  }

  function stop() {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
    setRecording(false);
  }

  async function handleAudio() {
    setBusy(true);
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      if (blob.size < 800) { setBusy(false); return; } // rien d'exploitable

      // 1) Transcription (la route exige le token)
      const { data: { session } } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append('audio', blob, 'note.webm');
      fd.append('token', session?.access_token || '');
      const tr = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const trj = await tr.json();
      const texte = (trj.text || '').trim();
      if (!trj.ok || !texte) { alert(trj.error || "La transcription n'a rien renvoyé."); setBusy(false); return; }

      // 2) Enregistre la note dans l'historique
      const { data: { user } } = await supabase.auth.getUser();
      const row = {
        type: 'note_vocale',
        resume: texte,
        created_by: user?.id || null,
        [entityType === 'mandat' ? 'mandat_id' : 'client_id']: entity.id,
      };
      await supabase.from('interactions').insert(row);

      // 3) Injecte dans l'assistant (avec contexte) pour proposer des mises à jour
      const consigne =
        `Note vocale à propos de ${label} : « ${texte} »\n\n` +
        `Résume en une phrase, puis propose de mettre à jour la fiche avec ce qui est exploitable ` +
        `(typologie de vente, s'il s'agit d'une simple estimation ou d'une vente, échéance/horizon de vente, ` +
        `budget, remarques). Ne modifie rien sans ma validation.`;
      window.dispatchEvent(new CustomEvent('assistant:ingest', {
        detail: { context: { type: entityType, data: entity }, text: consigne },
      }));

      onSaved?.(texte);
    } catch (e) {
      alert('Erreur note vocale : ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  const base = 'inline-flex items-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50';
  if (recording) {
    return (
      <button onClick={stop} className={`${base} ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} bg-red-600 text-white hover:bg-red-700`}>
        <Square className="w-3.5 h-3.5 fill-current" /> Arrêter
      </button>
    );
  }
  return (
    <button onClick={start} disabled={busy || !entity?.id} title="Laisser une note vocale"
      className={`${base} ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} bg-white border border-sage-light text-sage-darker hover:bg-sage-50`}>
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
      {busy ? 'Transcription…' : (compact ? 'Vocal' : 'Note vocale')}
    </button>
  );
}
