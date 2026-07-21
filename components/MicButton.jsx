'use client';

// components/MicButton.jsx
// Petit bouton micro réutilisable : dicte → transcrit (Whisper) → renvoie le
// texte via onText (à ajouter/insérer dans un champ). Retour en direct pendant
// la dictée (SpeechRecognition du navigateur), transcription finale = Whisper.

import { useState, useRef } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function MicButton({ onText, compact = false, title = 'Dicter' }) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState('');
  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const recRef = useRef(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); transcrire(); };
      mrRef.current = mr; mr.start(); setRecording(true); setLive('');
      const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
      if (SR) {
        try {
          const rec = new SR();
          rec.lang = 'fr-FR'; rec.continuous = true; rec.interimResults = true;
          rec.onresult = (ev) => { let t = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) t += ev.results[i][0].transcript; setLive(t); };
          rec.onerror = () => {};
          recRef.current = rec; rec.start();
        } catch { /* pas de live */ }
      }
    } catch (e) { alert('Micro indisponible : ' + e.message); }
  }
  function stop() {
    if (mrRef.current && mrRef.current.state !== 'inactive') mrRef.current.stop();
    if (recRef.current) { try { recRef.current.stop(); } catch {} recRef.current = null; }
    setRecording(false); setLive('');
  }
  async function transcrire() {
    setBusy(true);
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      if (blob.size < 800) { setBusy(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append('audio', blob, 'dicta.webm');
      fd.append('token', session?.access_token || '');
      const r = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const j = await r.json();
      if (j.ok && j.text) onText?.(j.text.trim());
      else alert(j.error || "La transcription n'a rien renvoyé.");
    } catch (e) { alert('Erreur transcription : ' + e.message); }
    finally { setBusy(false); }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={recording ? stop : start} disabled={busy} title={title}
        className={`inline-flex items-center gap-1.5 rounded-lg text-xs font-medium ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} ${recording ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white border border-sage-light text-sage-darker hover:bg-sage-50'} disabled:opacity-50`}>
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : recording ? <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
        {recording ? 'Arrêter' : (busy ? '…' : 'Dicter')}
      </button>
      {recording && <span className="text-[11px] text-red-600 italic max-w-[260px] truncate">{live || 'À l\'écoute…'}</span>}
    </span>
  );
}
