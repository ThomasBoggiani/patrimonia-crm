// ═══════════════════════════════════════════════════════════════════
// components/MandatAIAssistant.jsx — v2.0
// Sidebar IA avec streaming SSE + historique BDD persistant
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Copy, Check, FileText, Mail, Target, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const QUICK_ACTIONS = [
  { id: 'descriptif',     label: 'Descriptif',      icon: FileText, hint: 'Génère un descriptif marketing pour les portails' },
  { id: 'email_mandant',  label: 'Email mandant',   icon: Mail,     hint: 'Rédige un email de point d\'étape au vendeur' },
  { id: 'argumentaire',   label: 'Argumentaire',    icon: Target,   hint: 'Construit un argumentaire de vente avec objections' },
];

export default function MandatAIAssistant({ mandat }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState(''); // texte en cours de streaming
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingText, loading]);

  // Charger l'historique au premier ouverture du panneau
  useEffect(() => {
    if (!open || historyLoaded || !mandat?.id) return;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const res = await fetch(`/api/mandats/${mandat.id}/ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, mode: 'load' }),
        });

        const data = await res.json();
        if (data.ok && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch (e) {
        console.error('[AI] load history error:', e);
      } finally {
        setHistoryLoaded(true);
      }
    })();
  }, [open, historyLoaded, mandat?.id]);

  async function callAI({ action, message }) {
    if (!mandat?.id) return;
    setLoading(true);
    setStreamingText('');

    // Ajouter le message user dans la liste affichée
    const userVisible = action
      ? `[Action] ${QUICK_ACTIONS.find(a => a.id === action)?.label || action}`
      : message;

    setMessages(prev => [...prev, { role: 'user', content: userVisible, action: action || null }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '⚠️ Session expirée. Recharge la page et reconnecte-toi.',
        }]);
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/mandats/${mandat.id}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, message }),
      });

      // Vérifier le content-type : si JSON, c'est une erreur
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ Erreur : ${data.error || 'inconnue'}`,
        }]);
        setLoading(false);
        return;
      }

      // Stream SSE
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parser les events SSE (séparés par \n\n)
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // garder le buffer incomplet

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'delta') {
              accumulated += event.text;
              setStreamingText(accumulated);
            } else if (event.type === 'done') {
              // Finaliser : transférer le streamingText vers messages
              setMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
              setStreamingText('');
            } else if (event.type === 'error') {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: `⚠️ Erreur : ${event.error || 'inconnue'}`,
              }]);
              setStreamingText('');
            }
          } catch (e) {
            console.error('[AI] SSE parse error:', e);
          }
        }
      }
    } catch (err) {
      console.error('[AI] callAI error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Erreur réseau : ${err.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    callAI({ message: text });
  }

  function handleQuickAction(actionId) {
    if (loading) return;
    callAI({ action: actionId });
  }

  async function handleCopy(idx) {
    const msg = messages[idx];
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg.content);
      setMessages(prev => prev.map((m, i) => i === idx ? { ...m, copied: true } : m));
      setTimeout(() => {
        setMessages(prev => prev.map((m, i) => i === idx ? { ...m, copied: false } : m));
      }, 2000);
    } catch (e) {
      // ignore
    }
  }

  async function handleClear() {
    if (messages.length === 0) return;
    if (!confirm('Effacer définitivement la conversation ?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        await fetch(`/api/mandats/${mandat.id}/ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, mode: 'clear' }),
        });
      }
    } catch (e) {
      console.error('[AI] clear error:', e);
    }

    setMessages([]);
    setStreamingText('');
  }

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3.5 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          style={{
            backgroundColor: '#9CAF88',
            backgroundImage: 'linear-gradient(135deg, #9CAF88 0%, #7B8F6A 100%)',
          }}
          title="Ouvrir l'assistant IA"
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-sm font-medium">Assistant IA</span>
        </button>
      )}

      {/* Panneau coulissant */}
      {open && (
        <div className="fixed top-0 right-0 z-50 h-screen w-[420px] max-w-[95vw] bg-white border-l border-stone-200 shadow-2xl flex flex-col">
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b border-stone-200"
            style={{ backgroundColor: '#9CAF88' }}
          >
            <div className="flex items-center gap-2 text-white">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-semibold">Assistant IA</h3>
            </div>
            <div c
