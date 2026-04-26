// ═══════════════════════════════════════════════════════════════════
// components/PdfExportButtons.jsx
// 
// 3 boutons à intégrer dans la fiche mandat (CRM) :
//   - 📄 Plaquette acheteur
//   - 📊 Rapport vendeur  → ouvre une modal pour choisir la période
//   - 🗂️ Fiche interne
// 
// Usage dans la fiche mandat :
//   <PdfExportButtons mandatId={mandat.id} mandatNom={mandat.nom} />
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';

export default function PdfExportButtons({ mandatId, mandatNom, isOffMarket }) {
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [loading, setLoading] = useState(null); // 'plaquette' | 'rapport' | 'interne' | null

  function downloadPdf(template, params = {}) {
    setLoading(template);
    const queryString = new URLSearchParams({ template, ...params }).toString();
    const url = `/api/mandats/${mandatId}/pdf?${queryString}`;

    // Ouvre dans un nouvel onglet pour aperçu + téléchargement
    window.open(url, '_blank');

    // Reset l'état loading après 1 sec
    setTimeout(() => setLoading(null), 1000);
  }

  function handlePlaquette() {
    downloadPdf('plaquette');
  }

  function handleRapport(period) {
    downloadPdf('rapport', { start: period.start, end: period.end });
    setShowPeriodModal(false);
  }

  function handleInterne() {
    downloadPdf('interne');
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Bouton Plaquette Acheteur */}
      <button
        onClick={handlePlaquette}
        disabled={loading !== null}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded border border-sage-300 bg-white text-ink-900 hover:bg-sage-50 disabled:opacity-50 transition"
      >
        {loading === 'plaquette' ? (
          <Spinner />
        ) : (
          <span>📄</span>
        )}
        <span>Plaquette acheteur</span>
        {isOffMarket && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-ink-900 text-amber-200 font-semibold tracking-wider">
            OFF-MARKET
          </span>
        )}
      </button>

      {/* Bouton Rapport Vendeur */}
      <button
        onClick={() => setShowPeriodModal(true)}
        disabled={loading !== null}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded border border-sage-300 bg-white text-ink-900 hover:bg-sage-50 disabled:opacity-50 transition"
      >
        {loading === 'rapport' ? <Spinner /> : <span>📊</span>}
        <span>Rapport vendeur</span>
      </button>

      {/* Bouton Fiche Interne */}
      <button
        onClick={handleInterne}
        disabled={loading !== null}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded border border-sage-300 bg-white text-ink-900 hover:bg-sage-50 disabled:opacity-50 transition"
      >
        {loading === 'interne' ? <Spinner /> : <span>🗂️</span>}
        <span>Fiche interne</span>
      </button>

      {/* Modal de choix période */}
      {showPeriodModal && (
        <PeriodPickerModal
          mandatNom={mandatNom}
          onConfirm={handleRapport}
          onCancel={() => setShowPeriodModal(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MODAL DE SÉLECTION DE PÉRIODE
// ─────────────────────────────────────────────────────────────────

function PeriodPickerModal({ mandatNom, onConfirm, onCancel }) {
  // Dates par défaut : derniers 30 jours
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [start, setStart] = useState(thirtyDaysAgo.toISOString().slice(0, 10));
  const [end, setEnd] = useState(today.toISOString().slice(0, 10));

  function presetLastMonth() {
    const today = new Date();
    const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    setStart(firstDayLastMonth.toISOString().slice(0, 10));
    setEnd(lastDayLastMonth.toISOString().slice(0, 10));
  }

  function presetLastQuarter() {
    const today = new Date();
    const start = new Date();
    start.setMonth(today.getMonth() - 3);
    setStart(start.toISOString().slice(0, 10));
    setEnd(today.toISOString().slice(0, 10));
  }

  function presetSinceSignature() {
    // Approximation : depuis 1 an (à ajuster avec la vraie date_signature)
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    setStart(oneYearAgo.toISOString().slice(0, 10));
    setEnd(today.toISOString().slice(0, 10));
  }

  function handleSubmit() {
    if (!start || !end) {
      alert('Veuillez sélectionner les deux dates');
      return;
    }
    if (start > end) {
      alert('La date de début doit être antérieure à la date de fin');
      return;
    }
    onConfirm({ start, end });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-ink-900 mb-1">
          Rapport vendeur
        </h2>
        <p className="text-sm text-muted mb-4">
          {mandatNom ? `Pour le bien : ${mandatNom}` : ''}
        </p>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={presetLastMonth}
            className="text-xs px-2 py-1 rounded border border-sage-300 hover:bg-sage-50"
          >
            Mois dernier
          </button>
          <button
            type="button"
            onClick={presetLastQuarter}
            className="text-xs px-2 py-1 rounded border border-sage-300 hover:bg-sage-50"
          >
            Trimestre
          </button>
          <button
            type="button"
            onClick={presetSinceSignature}
            className="text-xs px-2 py-1 rounded border border-sage-300 hover:bg-sage-50"
          >
            Depuis 1 an
          </button>
        </div>

        {/* Champs date */}
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Du
            </label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full px-3 py-2 border border-sage-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sage-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Au
            </label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full px-3 py-2 border border-sage-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sage-500"
            />
          </div>
        </div>

        {/* Boutons */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border border-sage-300 hover:bg-sage-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-sm rounded bg-ink-900 text-white hover:bg-ink-700"
          >
            Générer le rapport
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SPINNER
// ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
