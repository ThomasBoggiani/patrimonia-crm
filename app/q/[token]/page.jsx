// app/q/[token]/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  getQuestionnaireByType,
  getInitialAnswers,
  validateAnswers
} from '@/lib/questionnaires';
import { getSousTypesForFamille, familleHasSousTypes } from '@/lib/crm-constants';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function PublicQuestionnairePage() {
  const params = useParams();
  const token = params?.token;

  const [commercial, setCommercial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [type, setType] = useState(null);
  const [template, setTemplate] = useState(null);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState([]);

  const [consentRgpd, setConsentRgpd] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorSubmit, setErrorSubmit] = useState(null);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, prenom, nom')
        .eq('questionnaire_token', token)
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
      } else {
        setCommercial(data);
      }
      setLoading(false);
    })();
  }, [token]);

  function chooseType(newType) {
    const t = getQuestionnaireByType(newType);
    if (!t) return;
    setType(newType);
    setTemplate(t);
    setAnswers(getInitialAnswers(t));
    setErrors([]);
  }

  function resetType() {
    setType(null);
    setTemplate(null);
    setAnswers({});
    setErrors([]);
  }

  function updateAnswer(id, value) {
    setAnswers(a => ({ ...a, [id]: value }));
    setErrors(errs => errs.filter(e => e.field !== id));
  }

  // Pour les cascades : met à jour famille ET sous-type d'un coup
  function updateCascade(familleId, sousTypeId, { famille, sousType }) {
    setAnswers(a => ({ ...a, [familleId]: famille, [sousTypeId]: sousType }));
    setErrors(errs => errs.filter(e => e.field !== familleId));
  }

  async function handleSubmit() {
    setErrorSubmit(null);
    const errs = validateAnswers(template, answers);
    setErrors(errs);

    if (errs.length > 0) {
      const firstErr = document.getElementById(`field-${errs[0].field}`);
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!consentRgpd) {
      setErrorSubmit('Vous devez accepter la politique de confidentialité pour continuer.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/questionnaire-public/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          type,
          reponses: answers,
          consentement_rgpd: consentRgpd,
          consentement_marketing: consentMarketing
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      setSuccess(true);
    } catch (err) {
      setErrorSubmit(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Shell><div className="text-center py-20 text-stone-500">Chargement...</div></Shell>;
  }

  if (notFound) {
    return (
      <Shell>
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="font-display text-2xl font-semibold text-stone-900 mb-2">Lien invalide</h1>
          <p className="text-stone-500">
            Le lien semble incorrect ou expiré.<br />
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
          <h1 className="font-display text-3xl font-semibold text-stone-900 mb-3">Merci !</h1>
          <p className="text-stone-600 max-w-md mx-auto">
            Vos réponses ont bien été enregistrées.<br />
            <strong>{commercial.prenom} {commercial.nom}</strong> reviendra vers vous sous 24h.
          </p>
          <p className="text-stone-400 text-sm mt-6">
            &mdash; L'équipe Immeubles & Patrimoine
          </p>
        </div>
      </Shell>
    );
  }

  if (!type) {
    return (
      <Shell>
        <div className="text-center mb-8">
          <p className="text-stone-500 mb-2">
            Questionnaire envoyé par <strong>{commercial.prenom} {commercial.nom}</strong>
          </p>
          <h1 className="font-display text-3xl font-semibold text-stone-900 mb-3">
            Quel est votre projet ?
          </h1>
          <p className="text-stone-500">
            Sélectionnez votre démarche pour personnaliser le questionnaire
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => chooseType('acquereur')}
            className="p-6 border-2 border-stone-200 rounded-2xl text-left hover:border-stone-900 hover:shadow-md transition group"
          >
            <div className="text-4xl mb-3">🏢</div>
            <div className="font-display text-xl font-semibold text-stone-900 mb-1">
              J'aimerais acheter
            </div>
            <div className="text-sm text-stone-500">
              Investir dans un bien immobilier patrimonial
            </div>
          </button>
          <button
            onClick={() => chooseType('vendeur')}
            className="p-6 border-2 border-stone-200 rounded-2xl text-left hover:border-stone-900 hover:shadow-md transition group"
          >
            <div className="text-4xl mb-3">🔑</div>
            <div className="font-display text-xl font-semibold text-stone-900 mb-1">
              J'aimerais vendre
            </div>
            <div className="text-sm text-stone-500">
              Céder un bien immobilier de qualité
            </div>
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-2">
        <button
          onClick={resetType}
          className="text-xs text-stone-500 hover:text-stone-900 hover:underline"
        >
          &larr; Changer de projet
        </button>
      </div>
      <div className="mb-8">
        <p className="text-xs text-stone-500 mb-2">
          Questionnaire envoyé par <strong>{commercial.prenom} {commercial.nom}</strong>
        </p>
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
            {errors.map((e, i) => <li key={i}>{e.label}</li>)}
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
          onUpdateCascade={updateCascade}
        />
      ))}

      <div className="mt-8 pt-6 border-t border-stone-200 space-y-3">
        <h2 className="font-display text-lg font-semibold text-stone-900 mb-3">
          Protection de vos données
        </h2>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentRgpd}
            onChange={e => setConsentRgpd(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
          />
          <span className="text-sm text-stone-700">
            <strong>J'accepte</strong> que mes données soient enregistrées par Immeubles & Patrimoine
            pour me recontacter dans le cadre de mon projet immobilier. <span className="text-red-500">*</span>
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentMarketing}
            onChange={e => setConsentMarketing(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
          />
          <span className="text-sm text-stone-700">
            Je souhaite recevoir des opportunités d'investissement par email <span className="text-stone-400">(optionnel)</span>.
          </span>
        </label>

        <p className="text-xs text-stone-500 pt-2">
          Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données.
          Plus d'informations dans notre <a href="/politique-confidentialite" target="_blank" rel="noopener" className="text-stone-700 hover:underline">politique de confidentialité</a>.
        </p>
      </div>

      {errorSubmit && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {errorSubmit}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-stone-200 flex items-center justify-between gap-4">
        <p className="text-xs text-stone-400 flex-1">
          Vos données sont sécurisées et ne seront partagées qu'avec l'équipe Immeubles & Patrimoine.
        </p>
        <button
          onClick={handleSubmit}
          disabled={submitting || !consentRgpd}
          className="px-6 py-3 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
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

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-stone-50">
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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-8">
          {children}
        </div>
        <div className="text-center text-xs text-stone-400 mt-6">
          © {new Date().getFullYear()} Immeubles & Patrimoine &middot;{' '}
          <a href="/politique-confidentialite" className="hover:underline">Politique de confidentialité</a>
        </div>
      </main>
    </div>
  );
}

function SectionBlock({ section, answers, errors, onUpdate, onUpdateCascade }) {
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
        {section.questions.map(q => {
          // Affichage conditionnel via showIf
          if (typeof q.showIf === 'function' && !q.showIf(answers)) return null;
          return (
            <QuestionField
              key={q.id}
              q={q}
              value={answers[q.id]}
              sousTypeValue={q.sousTypeId ? answers[q.sousTypeId] : ''}
              error={errors.find(e => e.field === q.id)}
              onChange={(v) => onUpdate(q.id, v)}
              onChangeCascade={(payload) => onUpdateCascade(q.id, q.sousTypeId, payload)}
            />
          );
        })}
      </div>
    </div>
  );
}

function QuestionField({ q, value, sousTypeValue, error, onChange, onChangeCascade }) {
  const baseInput = `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 ${
    error ? 'border-red-300 bg-red-50' : 'border-stone-200 bg-white'
  }`;

  return (
    <div id={`field-${q.id}`}>
      <label className="block text-sm font-medium text-stone-700 mb-1">
        {q.label}
        {q.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {q.hint && <p className="text-xs text-stone-500 mb-2">{q.hint}</p>}

      {(q.type === 'text' || q.type === 'email' || q.type === 'tel' || q.type === 'date') && (
        <input
          type={q.type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder || ''}
          className={baseInput}
        />
      )}

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

      {q.type === 'textarea' && (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder || ''}
          rows={q.rows || 3}
          className={baseInput + ' font-sans'}
        />
      )}

      {q.type === 'select' && (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseInput}
        >
          <option value="">&mdash; Choisir &mdash;</option>
          {q.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )}

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

      {q.type === 'cascade' && q.tree && (
        <div className={`grid grid-cols-1 ${familleHasSousTypes(q.tree, value) ? 'sm:grid-cols-2' : ''} gap-3`}>
          <select
            value={value || ''}
            onChange={(e) => onChangeCascade({ famille: e.target.value, sousType: '' })}
            className={baseInput}
          >
            <option value="">&mdash; {q.labelFamille || 'Famille'} &mdash;</option>
            {Object.keys(q.tree).map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          {familleHasSousTypes(q.tree, value) && (
            <select
              value={sousTypeValue || ''}
              onChange={(e) => onChangeCascade({ famille: value, sousType: e.target.value })}
              className={baseInput}
            >
              <option value="">&mdash; {q.labelSousType || 'Sous-type'} &mdash;</option>
              {getSousTypesForFamille(q.tree, value).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error.message}</p>}
    </div>
  );
}
