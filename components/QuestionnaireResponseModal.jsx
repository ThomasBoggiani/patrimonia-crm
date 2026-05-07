// components/QuestionnaireResponseModal.jsx
'use client';

import { useState } from 'react';
import { X, UserPlus, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  getQuestionnaireByType,
  answersToClient,
  answersToMandat
} from '@/lib/questionnaires';

export default function QuestionnaireResponseModal({
  isOpen,
  onClose,
  questionnaire,    // { id, type, nom, reponses }
  response,         // { submitted_at, answers, imported_client_id?, imported_mandat_id? }
  onImported        // callback (importedRecord) => void
}) {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !questionnaire || !response) return null;

  const template = getQuestionnaireByType(questionnaire.type);
  const isAcquereur = questionnaire.type === 'acquereur';
  const alreadyImported = response.imported_client_id || response.imported_mandat_id;

  // ─────────────────────────────────────────────────────
  // Import dans le CRM
  // ─────────────────────────────────────────────────────
  async function handleImport() {
    setImporting(true);
    setError('');
    try {
      let importedId = null;
      let importedKey = null;

      if (isAcquereur) {
        const clientData = answersToClient(response.answers);
        clientData.created_by = user?.id;
        const { data, error: e } = await supabase
          .from('clients')
          .insert(clientData)
          .select()
          .single();
        if (e) throw e;
        importedId = data.id;
        importedKey = 'imported_client_id';
      } else {
        // Vendeur → mandat
        const mandatData = answersToMandat(response.answers);
        mandatData.created_by = user?.id;
        // ⚠️ La table mandats utilise camelCase qui doit être converti en snake_case
        // si tu utilises toSnake() ailleurs. Pour rester safe, on insert avec les noms tels quels
        // et on verra si Supabase accepte (sinon il faudra adapter)
        const { data, error: e } = await supabase
          .from('mandats')
          .insert(mandatData)
          .select()
          .single();
        if (e) throw e;
        importedId = data.id;
        importedKey = 'imported_mandat_id';
      }

      // Marquer cette réponse comme importée dans le JSONB
      const updatedReponses = (questionnaire.reponses || []).map(r =>
        r.submitted_at === response.submitted_at
          ? { ...r, [importedKey]: importedId, imported_at: new Date().toISOString(), imported_by: user?.id }
          : r
      );
      await supabase
        .from('questionnaires')
        .update({ reponses: updatedReponses })
        .eq('id', questionnaire.id);

      onImported?.({ id: importedId, type: isAcquereur ? 'client' : 'mandat' });
      onClose();
    } catch (e) {
      console.error('[ImportQuestionnaire]', e);
      setError(e.message || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  }

  // ─────────────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────────────
  const submittedDate = new Date(response.submitted_at).toLocaleString('fr-FR');
  const importedDate = response.imported_at ? new Date(response.imported_at).toLocaleString('fr-FR') : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <div>
            <h3 className="font-display text-lg font-semibold">
              Réponse au questionnaire {isAcquereur ? 'Acquéreur' : 'Vendeur'}
            </h3>
            <div className="text-xs text-stone-500 mt-0.5">
              Soumise le {submittedDate}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Statut import */}
        {alreadyImported && (
          <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span className="text-emerald-900">
              ✓ Déjà importé dans le CRM
              {importedDate && <span className="text-emerald-700 text-xs ml-2">— le {importedDate}</span>}
            </span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {template?.sections.map(section => (
            <div key={section.id}>
              <h4 className="font-display text-base font-semibold text-stone-900 mb-2 pb-1 border-b border-stone-100">
                {section.titre}
              </h4>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
                {section.questions.map(q => {
                  const v = response.answers[q.id];
                  const display = formatAnswer(v, q);
                  return (
                    <div key={q.id} className="flex flex-col">
                      <dt className="text-xs text-stone-500">{q.label}</dt>
                      <dd className={`text-sm ${display === '—' ? 'text-stone-400 italic' : 'text-stone-900'}`}>
                        {display}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </div>

        {error && (
          <div className="mx-6 mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 bg-stone-50 rounded-b-2xl flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 text-sm text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 disabled:opacity-50"
          >
            Fermer
          </button>
          {!alreadyImported && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-2 text-sm bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 flex items-center gap-2"
            >
              {importing ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Import en cours...
                </>
              ) : isAcquereur ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  Créer le client dans le CRM
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4" />
                  Créer le mandat dans le CRM
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Helper d'affichage d'une réponse selon le type de question
// ─────────────────────────────────────────────────────────
function formatAnswer(v, q) {
  if (v === null || v === undefined || v === '') return '—';
  if (q.type === 'multiselect') {
    if (!Array.isArray(v) || v.length === 0) return '—';
    return v.join(', ');
  }
  if (q.type === 'number') {
    if (v === '' || isNaN(Number(v))) return '—';
    const formatted = Number(v).toLocaleString('fr-FR');
    return q.unit ? `${formatted} ${q.unit}` : formatted;
  }
  if (q.type === 'date') {
    try {
      return new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return String(v);
    }
  }
  return String(v);
}
