// ═══════════════════════════════════════════════════════════════════
// app/api/transcribe/route.js
// Transcription audio → texte via Whisper (OpenAI)
// ═══════════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function verifyToken(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const token = formData.get('token');
    const audioFile = formData.get('audio');

    const user = await verifyToken(token);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Auth requise' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!audioFile || !(audioFile instanceof Blob)) {
      return new Response(JSON.stringify({ ok: false, error: 'Fichier audio requis' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Whisper accepte directement un Blob/File
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'fr', // français forcé pour meilleure qualité métier
    });

    return new Response(JSON.stringify({
      ok: true,
      text: transcription.text || '',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[/api/transcribe] Erreur:', err);
    return new Response(JSON.stringify({
      ok: false,
      error: 'Erreur transcription',
      details: err.message,
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
