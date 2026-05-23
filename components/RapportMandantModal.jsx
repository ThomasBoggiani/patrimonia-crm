// ═══════════════════════════════════════════════════════════════════
// components/RapportMandantModal.jsx — v1
// Modal pour configurer & générer le rapport d'activité mandant.
// L'utilisateur saisit la période, profil acquéreurs, retours, prochaines actions, évolution.
// Bouton "Prévisualiser" → ouvre le PDF dans un onglet.
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { X, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function RapportMandantModal({ mandat, onClose }) {
  // Période : mois dernier par défaut
  const today = new Date();
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const monthLabels = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const defaultLabel = `${monthLabels[lastMonthStart.getMonth()]} ${lastMonthStart.getFullYear()}`;

  const [periodLabel, setPeriodLabel] = useState(defaultLabel);
  const [periodStart, setPeriodStart] = useState(lastMonthStart.toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(lastMonthEnd.toISOString().slice(0, 10));
  const [profilAcquereurs, setProfilAcquereurs] = useState('');
  const [retoursText, setRetoursText] = useState('');
  const [prochainesText, setProchainesText] = useState('');
  const [evol1Label, setEvol1Label] = useState('');
  const [evol1Value, setEvol1Value] = useState('');
  const [evol2Label, setEvol2Label] = useState('');
  const [evol2Value, setEvol2Value] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function generatePdf() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Session expirée');
        setLoading(false);
        return;
      }

      const retours = retoursText.split('\n').map(s => s.trim()).filter(Boolean);
      const prochaines = prochainesText.split('\n').map(s => s.trim()).filter(Boolean);
      const evolution = [];
      if (evol1Label && evol1Value) evolution.push({ label: evol1Label, value: evol1Value });
      if (evol2Label && evol2Value) evolution.push({ label: evol2Label, value: evol2Value });
      evolution.push({ label: periodLabel, value: '—', current: true });

      const body = {
        period: { label: periodLabel, start: periodStart, end: periodEnd },
        profilAcquereurs,
        retours,
        prochaines,
        evolution,
      };

      const res = await fetch(`/api/mandats/${mandat.id}/rapport-mandant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Erreur génération : ${t}`);
      }

      // PDF binaire → on l'ouvre via blob URL
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setLoading(false);
    } catch (e) {
      console.error('[RapportMandantModal] Erreur:', e);
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h2 className="font-display text-lg font-semibold text-stone-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-sage-dark" />
            Rapport d'activité mandant
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="text-xs text-stone-500 mb-2">
            Bien : <span className="font-medium text-stone-700">{mandat.nom}</span>
          </div>

          {/* Période */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">Période</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={periodLabel}
                onChange={e => setPeriodLabel(e.target.value)}
                placeholder="ex: Avril 2026"
                className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark"
              />
              <input
                type="date"
                value={periodStart}
                onChange={e => setPeriodStart(e.target.value)}
                className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark"
              />
              <input
                type="date"
                value={periodEnd}
                onChange={e => setPeriodEnd(e.target.value)}
                className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark"
              />
            </div>
            <p className="text-[10px] text-stone-400 mt-1">
              Les stats (envois, appels, visites, vues) seront calculées automatiquement sur cette période.
            </p>
          </div>

          {/* Profil acquéreurs */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">Profil des acquéreurs intéressés</label>
            <textarea
              value={profilAcquereurs}
              onChange={e => setProfilAcquereurs(e.target.value)}
              placeholder="ex : 70% investisseurs, 30% acquéreurs résidentiels. Budget moyen 2,7 M€."
              rows={3}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark"
            />
          </div>

          {/* Retours acquéreurs */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              Retours des acquéreurs <span className="text-stone-400 font-normal">(1 verbatim par ligne)</span>
            </label>
            <textarea
              value={retoursText}
              onChange={e => setRetoursText(e.target.value)}
              placeholder={`Très bel emplacement, mais le DPE C est un point à améliorer\nLe rendement est intéressant, manque des plans pour se projeter\nPrix légèrement au-dessus du marché`}
              rows={4}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark"
            />
          </div>

          {/* Prochaines actions */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              Prochaines actions prévues <span className="text-stone-400 font-normal">(1 action par ligne)</span>
            </label>
            <textarea
              value={prochainesText}
              onChange={e => setProchainesText(e.target.value)}
              placeholder={`Mise à jour des plans cadastraux\nCampagne ciblée auprès des investisseurs Île-de-France\nReprise photos professionnelles`}
              rows={4}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark"
            />
          </div>

          {/* Évolution */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              Évolution <span className="text-stone-400 font-normal">(comparatif 2 mois précédents)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid grid-cols-2 gap-1">
                <input
                  type="text"
                  value={evol1Label}
                  onChange={e => setEvol1Label(e.target.value)}
                  placeholder="Février"
                  className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark"
                />
                <input
                  type="text"
                  value={evol1Value}
                  onChange={e => setEvol1Value(e.target.value)}
                  placeholder="5 visites"
                  className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark"
                />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <input
                  type="text"
                  value={evol2Label}
                  onChange={e => setEvol2Label(e.target.value)}
                  placeholder="Mars"
                  className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark"
                />
                <input
                  type="text"
                  value={evol2Value}
                  onChange={e => setEvol2Value(e.target.value)}
                  placeholder="4 visites"
                  className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-sage-dark"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-stone-200 bg-stone-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={generatePdf}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-sage-darker text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#3d4d3d' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Prévisualiser le PDF
          </button>
        </div>
      </div>
    </div>
  );
}
