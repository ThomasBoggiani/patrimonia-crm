// ═══════════════════════════════════════════════════════════════════
// components/ClientAnalysisPanel.jsx
// Panneau d'analyse IA stratégique d'un client
// 4 blocs structurés : profil affiné, sujets sensibles, signaux d'achat, action recommandée
// Persistance via table client_analyses + badge "périmée" si nouveaux échanges
// ═══════════════════════════════════════════════════════════════════

'use client';
import { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle, Target, AlertTriangle, TrendingUp, Lightbulb, RefreshCw, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const MATURITE_COLORS = {
  'Froide': 'bg-blue-50 text-blue-800 border-blue-200',
  'Tiède': 'bg-amber-50 text-amber-800 border-amber-200',
  'Chaude': 'bg-orange-50 text-orange-800 border-orange-200',
  'Très chaude': 'bg-red-50 text-red-800 border-red-200',
};

const PRIORITE_COLORS = {
  'Haute': 'bg-red-100 text-red-800 border-red-300',
  'Moyenne': 'bg-amber-100 text-amber-800 border-amber-300',
  'Basse': 'bg-stone-100 text-stone-700 border-stone-300',
};

export default function ClientAnalysisPanel({ client }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [newEventsCount, setNewEventsCount] = useState(0);

  useEffect(() => {
    if (client?.id) loadExistingAnalysis();
  }, [client?.id]);

  async function loadExistingAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');

      const res = await fetch(`/api/clients/${client.id}/analyze?token=${token}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Erreur de chargement');
      setAnalysis(data.analysis);
      setIsStale(data.is_stale || false);
      setNewEventsCount(data.new_events_count || 0);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function runAnalysis() {
    setAnalyzing(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');

      const res = await fetch(`/api/clients/${client.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Erreur d\'analyse');
      setAnalysis(data.analysis);
      setIsStale(false);
      setNewEventsCount(0);
    } catch (e) {
      setError(e.message);
    }
    setAnalyzing(false);
  }

  // Garde de sortie si client pas encore prêt — APRÈS les hooks
  if (!client || !client.id) {
    return null;
  }
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-cream-dark p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-sage-dark mx-auto" />
      </div>
    );
  }

  // Cas 1 : pas d'analyse → CTA pour générer
  if (!analysis) {
    return (
      <div className="bg-white rounded-xl border border-cream-dark p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-sage-100 to-sage-200 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-sage-darker" />
        </div>
        <h3 className="font-display text-xl font-semibold text-ink mb-2">Analyse IA stratégique</h3>
        <p className="text-sm text-ink/60 mb-5 max-w-md mx-auto">
          Lance une analyse approfondie de ce client à partir de tout son historique : emails, interactions, deals précédents, questionnaire complété.
        </p>
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-sage-dark text-white rounded-lg hover:bg-sage-darker disabled:opacity-50 text-sm font-medium"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {analyzing ? 'Analyse en cours...' : 'Analyser ce client'}
        </button>
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Cas 2 : analyse existe → affichage
  const profilAffine = analysis.profil_affine || {};
  const sujetsSensibles = analysis.sujets_sensibles || {};
  const signauxAchat = analysis.signaux_achat || {};
  const actionRecommandee = analysis.action_recommandee || {};
  const dataSources = analysis.data_sources || {};
  const createdAt = analysis.created_at ? new Date(analysis.created_at) : null;
  const maturite = signauxAchat.maturite_estimee || '';
  const priorite = actionRecommandee.priorite || 'Moyenne';

  return (
    <div className="space-y-4">
      {/* Header analyse */}
      <div className="bg-white rounded-xl border border-cream-dark p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sage-100 to-sage-200 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-sage-darker" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">Analyse IA stratégique</h3>
            <div className="text-xs text-ink/60 flex items-center gap-2 flex-wrap">
              {createdAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Générée le {createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à {createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <span className="text-ink/40">·</span>
              <span>
                {dataSources.nb_interactions || 0} interaction{(dataSources.nb_interactions || 0) > 1 ? 's' : ''}
                {' · '}
                {dataSources.nb_deals || 0} deal{(dataSources.nb_deals || 0) > 1 ? 's' : ''}
                {' · '}
                {dataSources.nb_emails || 0} email{(dataSources.nb_emails || 0) > 1 ? 's' : ''}
                {dataSources.has_questionnaire && ' · questionnaire'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isStale && (
            <span className="text-xs px-3 py-1.5 bg-amber-50 text-amber-800 rounded-full border border-amber-200 flex items-center gap-1.5">
              ⚠️ Analyse périmée ({newEventsCount} nouveau{newEventsCount > 1 ? 'x' : ''} échange{newEventsCount > 1 ? 's' : ''})
            </span>
          )}
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-cream-dark text-ink rounded-lg hover:bg-cream-50 text-xs font-medium disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {analyzing ? 'Rafraîchissement...' : 'Rafraîchir'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><div>{error}</div>
        </div>
      )}

      {/* Bloc 1 — Action recommandée (priorité haut) */}
      <div className="bg-gradient-to-br from-sage-50 to-emerald-50 rounded-xl border border-sage-light p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-sage-darker" />
          <h4 className="font-display text-lg font-semibold text-sage-darker">Action recommandée</h4>
          {priorite && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITE_COLORS[priorite] || PRIORITE_COLORS['Moyenne']} font-medium`}>
              Priorité {priorite.toLowerCase()}
            </span>
          )}
        </div>
        {actionRecommandee.action ? (
          <>
            <p className="text-base text-ink font-medium mb-2">{actionRecommandee.action}</p>
            {actionRecommandee.argumentaire && (
              <p className="text-sm text-ink/70 italic">{actionRecommandee.argumentaire}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-ink/50 italic">Aucune action particulière à mener pour le moment.</p>
        )}
      </div>

      {/* Bloc 2 — Profil affiné */}
      <div className="bg-white rounded-xl border border-cream-dark p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-blue-700" />
          <h4 className="font-display text-lg font-semibold text-ink">Profil affiné</h4>
        </div>
        {profilAffine.synthese && (
          <p className="text-sm text-ink mb-3">{profilAffine.synthese}</p>
        )}
        {Array.isArray(profilAffine.criteres_reels) && profilAffine.criteres_reels.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-semibold text-ink/60 uppercase tracking-wide mb-1.5">Critères réellement recherchés</div>
            <div className="flex flex-wrap gap-1.5">
              {profilAffine.criteres_reels.map((c, i) => (
                <span key={i} className="text-xs px-2.5 py-1 bg-blue-50 text-blue-800 rounded-full border border-blue-200">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {profilAffine.ecart_avec_declare && (
          <div className="mt-3 pt-3 border-t border-cream">
            <div className="text-xs font-semibold text-ink/60 uppercase tracking-wide mb-1">Écart avec ce qui a été déclaré</div>
            <p className="text-sm text-ink/80 italic">{profilAffine.ecart_avec_declare}</p>
          </div>
        )}
      </div>

      {/* Bloc 3 — Signaux d'achat */}
      <div className="bg-white rounded-xl border border-cream-dark p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-emerald-700" />
          <h4 className="font-display text-lg font-semibold text-ink">Signaux d'achat</h4>
          {maturite && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ${MATURITE_COLORS[maturite.split(' ')[0]] || MATURITE_COLORS['Tiède']} font-medium`}>
              {maturite.split('—')[0].trim()}
            </span>
          )}
        </div>
        {signauxAchat.synthese && (
          <p className="text-sm text-ink mb-3">{signauxAchat.synthese}</p>
        )}
        {Array.isArray(signauxAchat.interets_marques) && signauxAchat.interets_marques.length > 0 && (
          <div className="mb-2">
            <div className="text-xs font-semibold text-ink/60 uppercase tracking-wide mb-1.5">Intérêts marqués</div>
            <div className="flex flex-wrap gap-1.5">
              {signauxAchat.interets_marques.map((c, i) => (
                <span key={i} className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                  ✓ {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {maturite && maturite.includes('—') && (
          <div className="mt-3 pt-3 border-t border-cream">
            <p className="text-xs text-ink/70 italic">{maturite.split('—').slice(1).join('—').trim()}</p>
          </div>
        )}
      </div>

      {/* Bloc 4 — Sujets sensibles */}
      <div className="bg-white rounded-xl border border-cream-dark p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-700" />
          <h4 className="font-display text-lg font-semibold text-ink">Sujets sensibles</h4>
        </div>
        {sujetsSensibles.synthese && (
          <p className="text-sm text-ink mb-3">{sujetsSensibles.synthese}</p>
        )}
        {Array.isArray(sujetsSensibles.motifs_refus_recurrents) && sujetsSensibles.motifs_refus_recurrents.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-semibold text-ink/60 uppercase tracking-wide mb-1.5">Motifs de refus récurrents</div>
            <div className="flex flex-wrap gap-1.5">
              {sujetsSensibles.motifs_refus_recurrents.map((c, i) => (
                <span key={i} className="text-xs px-2.5 py-1 bg-red-50 text-red-800 rounded-full border border-red-200">
                  ✕ {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {Array.isArray(sujetsSensibles.a_eviter) && sujetsSensibles.a_eviter.length > 0 && (
          <div className="mt-3 pt-3 border-t border-cream">
            <div className="text-xs font-semibold text-ink/60 uppercase tracking-wide mb-1.5">À éviter</div>
            <ul className="space-y-1">
              {sujetsSensibles.a_eviter.map((c, i) => (
                <li key={i} className="text-sm text-ink/80 flex items-start gap-2">
                  <span className="text-red-600 flex-shrink-0">→</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
