// app/q/[type]/[token]/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  getQuestionnaireByType,
  getInitialAnswers,
  validateAnswers
} from '@/lib/questionnaires';

// Client Supabase public (anon key) — la page est publique, pas d'auth user
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function PublicQuestionnairePage() {
  const params = useParams();
  const type = params?.type;
  const token = params?.token;

  const [questionnaire, setQuestionnaire] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [template, setTemplate] = useState(null);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Charge le questionnaire depuis Supabase via le token
  useEffect(() => {
    (async () => {
      if (!type || !token) return;

      const t = getQuestionnaireByType(type);
      if (!t) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setTemplate(t);
      setAnswers(getInitialAnswers(t));

      // Cherche le questionnaire en BDD via le lien (qui contient le token)
      const { data, error } = await supabase
        .from('questionnaires')
        .select('id, type, nom, lien, reponses')
        .ilike('lien', `%${token}%`)
        .maybeSingle();

      if (error || !data || data.type !== type) {
        setNotFound(true);
      } else {
        setQuestionnaire(data);
      }
      setLoading(false);
    })();
  }, [type, token]);

  // ─────────────────────────────────────────────────────
  // Soumission
  // ─────────────────────────────────────────────────────
  async function handleSubmit() {
    const errs = validateAnswers(template, answers);
    setErrors(errs);
    if (errs.length > 0) {
      // Scroll au premier champ en erreur
      const firstErr = document.getElementById(`field-${errs[0].field}`);
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      const newReponse = {
        submitted_at: new Date().toISOString(),
        answers
      };
      const updatedReponses = [...(questionnaire.reponses || []), newReponse];

      const { error: e } = await supabase
        .from('questionnaires')
        .update({ reponses: updatedReponses })
        .eq('id', questionnaire.id);

      if (e) throw e;

      // Crée une notification pour TB (et plus tard pour le créateur du questionnaire)
      const fullName = `${answers.prenom || ''} ${answers.nom || ''}`.trim() || 'Quelqu\'un';
      const TB_USER_ID = '90ab24e3-db96-4b87-b883-590603f88468'; // TB
      try {
        await supabase.from('notifications').insert({
          user_id: TB_USER_ID,
          type: 'questionnaire_response',
          titre: `Nouvelle réponse questionnaire ${type === 'acquereur' ? 'Acquéreur' : 'Vendeur'}`,
          message: `${fullName}${answers.email ? ' (' + answers.email + ')' : ''} a complété le questionnaire`,
          lue: false
        });
      } catch (notifErr) {
        // Pas bloquant, on log juste
        console.warn('[questionnaire] notif KO:', notifErr.message);
      }

      setSuccess(true);
    } catch (e) {
      alert('Erreur lors de l\'envoi : ' + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function updateAnswer(id, value) {
    setAnswers(a => ({ ...a, [id]: value }));
    setErrors(errs => errs.filter(e => e.field !== id));
  }

  // ─────────────────────────────────────────────────────
  // États : loading / notFound / success / form
  // ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <Shell>
        <div className="text-center py-20 text-stone-500">Chargement...</div>
      </Shell>
    );
  }

  if (notFound) {
    return (
      <Shell>
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="font-display text-2xl font-semibold text-stone-900 mb-2">
            Questionnaire introuvable
          </h1>
          <p className="text-stone-500">
            Le lien semble incorrect ou ce questionnaire a expiré.<br />
            Merci de contacter votre interlocuteur Immeubles & Patrimoine.
          </p>
        </div>
      </Shell>
    );
  }

  if (success) {
    return (
      <Shell>
        <div className="text-center py-20">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="font-display text-3xl font-semibold text-stone-900 mb-3">
            Merci !
          </h1>
          <p className="text-stone-600 max-w-md mx-auto">
            Vos réponses ont bien été enregistrées. Notre équipe reviendra
            vers vous sous 24h pour donner suite à votre démarche.
          </p>
          <p className="text-stone-400 text-sm mt-6">
            — L'équipe Immeubles & Patrimoine
          </p>
        </div>
      </Shell>
    );
  }

  // ─────────────────────────────────────────────────────
  // Formulaire
  // ─────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-stone-900 mb-2">
          {template.nom}
        </h1>
        <p className="text-stone-500">{template.description}</p>
      </div>

      {errors.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-sm font-medium text-red-800 mb-2">
            Merci de remplir les champs obligatoires :
          </div>
          <ul className="text-sm text-red-700 list-disc list-inside">
            {errors.map((e, i) => (
              <li key={i}>{e.label}</li>
            ))}
          </ul>
        </div>
      )}

      {template.sections.map(section => (
        <SectionBlock
          key={section.id}
          section={section}
          answers={answers}
          errors={errors}
          onUpdate={updateAnswer}
        />
      ))}

      <div className="mt-8 pt-6 border-t border-stone-200 flex items-center justify-between">
        <p className="text-xs text-stone-400">
          Vos données sont sécurisées et ne seront partagées qu'avec l'équipe
          Immeubles & Patrimoine.
        </p>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-6 py-3 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-50 flex items-center gap-2"
        >
          {submitting ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Envoi...
            </>
          ) : (
            'Envoyer mes réponses'
          )}
        </button>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────
// Sous-composant : structure de page (header + contenu)
// ─────────────────────────────────────────────────────────
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header simple */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <img
            src="/logo-light.png"
            alt="Immeubles & Patrimoine"
            className="w-10 h-10"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div>
            <div className="font-display text-lg font-semibold text-stone-900">
              Immeubles & Patrimoine
            </div>
            <div className="text-xs text-stone-500">
              Investissement immobilier patrimonial
            </div>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
          {children}
        </div>
        <div className="text-center text-xs text-stone-400 mt-6">
          © {new Date().getFullYear()} Immeubles & Patrimoine
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Section (groupe de questions)
// ─────────────────────────────────────────────────────────
function SectionBlock({ section, answers, errors, onUpdate }) {
  return (
    <div className="mb-8">
      <div className="mb-4 pb-2 border-b border-stone-200">
        <h2 className="font-display text-xl font-semibold text-stone-900">
          {section.titre}
        </h2>
        {section.description && (
          <p className="text-sm text-stone-500 mt-1">{section.description}</p>
        )}
      </div>
      <div className="space-y-4">
        {section.questions.map(q => (
          <QuestionField
            key={q.id}
            q={q}
            value={answers[q.id]}
            error={errors.find(e => e.field === q.id)}
            onChange={(v) => onUpdate(q.id, v)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Champ individuel (text/email/number/select/multiselect/textarea)
// ─────────────────────────────────────────────────────────
function QuestionField({ q, value, error, onChange }) {
  const baseInput = `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 ${
    error ? 'border-red-300 bg-red-50' : 'border-stone-200 bg-white'
  }`;

  return (
    <div id={`field-${q.id}`}>
      <label className="block text-sm font-medium text-stone-700 mb-1">
        {q.label}
        {q.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {q.hint && (
        <p className="text-xs text-stone-500 mb-2">{q.hint}</p>
      )}

      {/* Champs texte simples */}
      {(q.type === 'text' || q.type === 'email' || q.type === 'tel') && (
        <input
          type={q.type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder || ''}
          className={baseInput}
        />
      )}

      {/* Number */}
      {q.type === 'number' && (
        <div className="relative">
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={q.placeholder || ''}
            step={q.step || '1'}
            min="0"
            className={baseInput + (q.unit ? ' pr-12' : '')}
          />
          {q.unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
              {q.unit}
            </span>
          )}
        </div>
      )}

      {/* Textarea */}
      {q.type === 'textarea' && (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder || ''}
          rows={q.rows || 3}
          className={baseInput + ' font-sans'}
        />
      )}

      {/* Select */}
      {q.type === 'select' && (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseInput}
        >
          <option value="">— Choisir —</option>
          {q.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {/* Multiselect (boutons toggle) */}
      {q.type === 'multiselect' && (
        <div className="flex flex-wrap gap-2 mt-1">
          {q.options.map(opt => {
            const selected = (value || []).includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const arr = value || [];
                  onChange(selected ? arr.filter(x => x !== opt) : [...arr, opt]);
                }}
                className={`px-3 py-1.5 text-xs rounded-full border transition ${
                  selected
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 mt-1">{error.message}</p>
      )}
    </div>
  );
}
