// app/q/[token]/page.jsx
// v3 (25 mai 2026) — refonte UX :
// - Barre de progression sticky à gauche qui suit le scroll
// - Sélecteur "familles_with_subs" : catégories + sous-boutons en grille (tout visible)
// - Budget smart : formatage auto avec espaces + pills de suggestion (300k, 1M€, etc.)
// - Type "file" : upload PJ vers bucket Supabase
// - Header avec chip "3 minutes"
// - Toutes sections affichées sur une page (scroll continu)

'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  getQuestionnaire,
  getInitialAnswers,
  validateAnswers
} from '@/lib/questionnaires';
import { getSousTypesForFamille, familleHasSousTypes } from '@/lib/crm-constants';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PITCH_BUCKET = 'assistant-attachments';
const PITCH_FOLDER = 'questionnaires';

// ─────────────────────────────────────────────────────────
// Helpers formatage budget
// ─────────────────────────────────────────────────────────
function formatMoneyInput(raw) {
  if (raw === '' || raw === null || raw === undefined) return '';
  const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
  if (isNaN(n)) return '';
  return n.toLocaleString('fr-FR');
}

function parseMoneyInput(formatted) {
  if (!formatted) return '';
  const cleaned = String(formatted).replace(/[^0-9]/g, '');
  if (!cleaned) return '';
  return cleaned;
}

const BUDGET_SUGGESTIONS = [
  { label: '300 000', value: 300000 },
  { label: '500 000', value: 500000 },
  { label: '1 M€', value: 1000000 },
  { label: '3 M€', value: 3000000 },
  { label: '5 M€', value: 5000000 },
  { label: '10 M€', value: 10000000 },
  { label: '20 M€', value: 20000000 },
];

// ─────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────
export default function PublicQuestionnairePage() {
  const params = useParams();
  const token = params?.token;

  const [commercial, setCommercial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [marche, setMarche] = useState(null);
  const [type, setType] = useState(null);
  const [template, setTemplate] = useState(null);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState([]);

  const [consentRgpd, setConsentRgpd] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorSubmit, setErrorSubmit] = useState(null);

  // Progression
  const [activeSectionId, setActiveSectionId] = useState(null);
  const sectionRefs = useRef({});

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, prenom, nom')
        .eq('questionnaire_token', token)
        .maybeSingle();
      if (error || !data) setNotFound(true);
      else setCommercial(data);
      setLoading(false);
    })();
  }, [token]);

  // Observe le scroll pour mettre à jour la section active
  useEffect(() => {
    if (!template) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.getAttribute('data-section-id');
          if (id) setActiveSectionId(id);
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, [template]);

  function chooseType(newType) {
    const t = getQuestionnaire(newType, marche);
    if (!t) return;
    setType(newType);
    setTemplate(t);
    setAnswers(getInitialAnswers(t));
    setErrors([]);
    setActiveSectionId(t.sections[0]?.id || null);
  }

  function resetAll() {
    setMarche(null);
    setType(null);
    setTemplate(null);
    setAnswers({});
    setErrors([]);
  }

  function backToType() {
    setType(null);
    setTemplate(null);
    setAnswers({});
    setErrors([]);
  }

  function updateAnswer(id, value) {
    setAnswers(a => ({ ...a, [id]: value }));
    setErrors(errs => errs.filter(e => e.field !== id));
  }

  function updateCascade(familleId, sousTypeId, { famille, sousType }) {
    setAnswers(a => ({ ...a, [familleId]: famille, [sousTypeId]: sousType }));
    setErrors(errs => errs.filter(e => e.field !== familleId));
  }

  // Toggle famille (familles_with_subs) — coche/décoche + reset subs si décoche
  function toggleFamille(q, famille) {
    setAnswers(a => {
      const familles = a[q.id] || [];
      const isOn = familles.includes(famille);
      const newFamilles = isOn ? familles.filter(f => f !== famille) : [...familles, famille];

      const updates = { ...a, [q.id]: newFamilles };
      // Si on décoche, on vide les sous-types associés
      if (isOn && q.subKeys && q.subKeys[famille]) {
        updates[q.subKeys[famille]] = [];
      }
      return updates;
    });
    setErrors(errs => errs.filter(e => e.field !== q.id));
  }

  function toggleSousType(subKey, sousType, famille) {
    setAnswers(a => {
      const arr = a[subKey] || [];
      const isOn = arr.includes(sousType);
      const newSubs = isOn ? arr.filter(s => s !== sousType) : [...arr, sousType];

      // Auto-gère la présence de la famille dans familles_recherchees
      const updates = { ...a, [subKey]: newSubs };
      if (famille) {
        const familles = a.familles_recherchees || [];
        if (newSubs.length > 0 && !familles.includes(famille)) {
          // Au moins 1 sous-type coché → famille présente
          updates.familles_recherchees = [...familles, famille];
        } else if (newSubs.length === 0 && familles.includes(famille)) {
          // Plus aucun sous-type → famille retirée
          updates.familles_recherchees = familles.filter(f => f !== famille);
        }
      }
      return updates;
    });
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
      setErrorSubmit('Vous devez accepter la politique de confidentialité.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/questionnaire-public/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, type, marche,
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

  if (loading) return <Shell><div className="text-center py-20 text-stone-500">Chargement...</div></Shell>;

  if (notFound) {
    return (
      <Shell>
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="font-display text-2xl font-semibold text-stone-900 mb-2">Lien invalide</h1>
          <p className="text-stone-500">Le lien semble incorrect ou expiré.</p>
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
        </div>
      </Shell>
    );
  }

  // ÉTAPE 1 : choix du marché
  if (!marche) {
    return (
      <Shell>
        <div className="text-center mb-8">
          <p className="text-stone-500 mb-2">
            Questionnaire de <strong>{commercial.prenom} {commercial.nom}</strong>
          </p>
          <h1 className="font-display text-3xl font-semibold text-stone-900 mb-3">
            Quel type de projet ?
          </h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setMarche('b2b')}
            className="p-6 border-2 border-stone-200 rounded-2xl text-left hover:border-stone-900 hover:shadow-md transition"
          >
            <div className="text-4xl mb-3">🏢</div>
            <div className="font-display text-xl font-semibold text-stone-900 mb-1">
              Investissement immobilier
            </div>
            <div className="text-sm text-stone-500">
              Immeubles, hôtels, locaux commerciaux, terrains...
            </div>
          </button>
          <button
            onClick={() => setMarche('b2c')}
            className="p-6 border-2 border-stone-200 rounded-2xl text-left hover:border-stone-900 hover:shadow-md transition"
          >
            <div className="text-4xl mb-3">🏠</div>
            <div className="font-display text-xl font-semibold text-stone-900 mb-1">
              Habitation
            </div>
            <div className="text-sm text-stone-500">
              Appartement, maison, hôtel particulier
            </div>
          </button>
        </div>
      </Shell>
    );
  }

  // ÉTAPE 2 : choix acquéreur/vendeur
  if (!type) {
    return (
      <Shell>
        <div className="mb-2">
          <button onClick={resetAll} className="text-xs text-stone-500 hover:text-stone-900 hover:underline">
            &larr; Changer de marché
          </button>
        </div>
        <div className="text-center mb-8">
          <p className="text-stone-500 mb-2">
            {marche === 'b2b' ? 'Investissement' : 'Habitation'}
          </p>
          <h1 className="font-display text-3xl font-semibold text-stone-900 mb-3">
            Vous souhaitez ?
          </h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => chooseType('acquereur')}
            className="p-6 border-2 border-stone-200 rounded-2xl text-left hover:border-stone-900 hover:shadow-md transition"
          >
            <div className="text-4xl mb-3">🛒</div>
            <div className="font-display text-xl font-semibold text-stone-900 mb-1">Acheter</div>
            <div className="text-sm text-stone-500">
              {marche === 'b2b' ? 'Investir dans un actif' : 'Trouver mon futur logement'}
            </div>
          </button>
          <button
            onClick={() => chooseType('vendeur')}
            className="p-6 border-2 border-stone-200 rounded-2xl text-left hover:border-stone-900 hover:shadow-md transition"
          >
            <div className="text-4xl mb-3">🔑</div>
            <div className="font-display text-xl font-semibold text-stone-900 mb-1">Vendre</div>
            <div className="text-sm text-stone-500">
              {marche === 'b2b' ? 'Céder un actif d\'investissement' : 'Vendre mon bien'}
            </div>
          </button>
        </div>
      </Shell>
    );
  }

  // ÉTAPE 3 : formulaire complet
  const activeIdx = template.sections.findIndex(s => s.id === activeSectionId);
  const progressPct = activeIdx >= 0 ? ((activeIdx + 1) / template.sections.length) * 100 : 0;

  return (
    <Shell wide>
      <div className="mb-2">
        <button onClick={backToType} className="text-xs text-stone-500 hover:text-stone-900 hover:underline">
          &larr; Retour
        </button>
      </div>

      {/* HEADER avec chip durée */}
      <div className="mb-8">
        <p className="text-xs text-stone-500 mb-2">
          Questionnaire de <strong>{commercial.prenom} {commercial.nom}</strong>
        </p>
        <h1 className="font-display text-3xl font-semibold text-stone-900 mb-2">{template.nom}</h1>
        <div className="flex items-center gap-3 flex-wrap text-stone-500">
          {template.duree_estimee && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-50 text-sage-darker text-xs font-medium border border-sage-light">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {template.duree_estimee}
            </span>
          )}
          <span className="text-sm">{template.description}</span>
        </div>
      </div>

      {/* LAYOUT : barre progression sticky + content */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-8">

        {/* BARRE DE PROGRESSION STICKY */}
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <h3 className="text-[11px] uppercase tracking-wide text-stone-400 font-semibold mb-3">Progression</h3>
            <div className="h-1 bg-stone-100 rounded-full mb-3 overflow-hidden">
              <div
                className="h-full bg-sage-dark transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <ol className="space-y-1">
              {template.sections.map((s, idx) => {
                const isActive = s.id === activeSectionId;
                const isDone = idx < activeIdx;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => sectionRefs.current[s.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition ${
                        isActive
                          ? 'bg-sage-50 text-sage-darker font-medium'
                          : isDone
                            ? 'text-stone-700 hover:bg-stone-50'
                            : 'text-stone-500 hover:bg-stone-50'
                      }`}
                    >
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] flex-shrink-0 border ${
                        isActive
                          ? 'bg-sage-100 border-sage-dark text-sage-darker'
                          : isDone
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : 'bg-white border-stone-200 text-stone-400'
                      }`}>
                        {isDone ? '✓' : idx + 1}
                      </span>
                      <span className="truncate">{s.titre}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>

        {/* CONTENT */}
        <div>
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

          {template.sections.map((section, idx) => (
            <div
              key={section.id}
              data-section-id={section.id}
              ref={el => { sectionRefs.current[section.id] = el; }}
            >
              <SectionBlock
                section={section}
                sectionNumber={idx + 1}
                answers={answers}
                errors={errors}
                onUpdate={updateAnswer}
                onUpdateCascade={updateCascade}
                onToggleFamille={toggleFamille}
                onToggleSousType={toggleSousType}
                token={token}
              />
            </div>
          ))}

          {/* CONSENTEMENT + SUBMIT */}
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
              Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression.
              Plus d'infos dans notre <a href="/politique-confidentialite" target="_blank" rel="noopener" className="text-stone-700 hover:underline">politique de confidentialité</a>.
            </p>
          </div>

          {errorSubmit && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errorSubmit}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-stone-200 flex items-center justify-between gap-4">
            <p className="text-xs text-stone-400 flex-1">
              Vos données ne seront partagées qu'avec l'équipe Immeubles & Patrimoine.
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
              ) : 'Envoyer mes réponses'}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────
// Shell
// ─────────────────────────────────────────────────────────
function Shell({ children, wide = false }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className={`${wide ? 'max-w-5xl' : 'max-w-3xl'} mx-auto px-6 py-4 flex items-center gap-3`}>
          <img src="/logo-light.png" alt="" className="w-10 h-10"
               onError={(e) => { e.target.style.display = 'none'; }} />
          <div>
            <div className="font-display text-lg font-semibold text-stone-900">Immeubles & Patrimoine</div>
            <div className="text-xs text-stone-500">Investissement immobilier patrimonial</div>
          </div>
        </div>
      </header>
      <main className={`${wide ? 'max-w-5xl' : 'max-w-3xl'} mx-auto px-4 sm:px-6 py-10`}>
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

// ─────────────────────────────────────────────────────────
// SectionBlock
// ─────────────────────────────────────────────────────────
function SectionBlock({ section, sectionNumber, answers, errors, onUpdate, onUpdateCascade, onToggleFamille, onToggleSousType, token }) {
  const visibleQuestions = section.questions.filter(q =>
    typeof q.showIf !== 'function' || q.showIf(answers)
  );
  if (visibleQuestions.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="mb-4 pb-3 border-b border-stone-200 flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-sage-100 text-sage-darker text-sm font-semibold flex-shrink-0">
          {sectionNumber}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl font-semibold text-stone-900">{section.titre}</h2>
          {section.description && <p className="text-sm text-stone-500 mt-0.5">{section.description}</p>}
        </div>
      </div>
      <div className="space-y-5">
        {visibleQuestions.map(q => (
          <QuestionField
            key={q.id}
            q={q}
            value={answers[q.id]}
            answers={answers}
            sousTypeValue={q.sousTypeId ? answers[q.sousTypeId] : ''}
            error={errors.find(e => e.field === q.id)}
            onChange={(v) => onUpdate(q.id, v)}
            onChangeCascade={(payload) => onUpdateCascade(q.id, q.sousTypeId, payload)}
            onToggleFamille={(famille) => onToggleFamille(q, famille)}
            onToggleSousType={onToggleSousType}
            token={token}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// QuestionField
// ─────────────────────────────────────────────────────────
function QuestionField({ q, value, answers, sousTypeValue, error, onChange, onChangeCascade, onToggleFamille, onToggleSousType, token }) {
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
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">{q.unit}</span>
          )}
        </div>
      )}

      {q.type === 'money' && (
        <MoneyInput q={q} value={value} onChange={onChange} error={error} />
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
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={baseInput}>
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

      {/* v3 : families_with_subs — cartes blanches avec badge titre flottant (style V2) */}
      {q.type === 'families_with_subs' && q.tree && (
        <div className="space-y-5 mt-6">
          {(q.order || Object.keys(q.tree)).map(famille => {
            const sousTypes = q.tree[famille];
            if (!sousTypes) return null;
            const familles = value || [];
            const subKey = q.subKeys?.[famille];
            const subValues = subKey ? (answers[subKey] || []) : [];
            const hasSubs = Array.isArray(sousTypes) && sousTypes.length > 0;
            const isFamilleSelected = familles.includes(famille);

            // Famille sans sous-types (Terrains, Parking) → on regroupe en fin (cf. ligne dédiée ci-dessous)
            if (!hasSubs) return null;

            // Famille avec sous-types : carte blanche avec badge titre flottant en haut
            return (
              <div
                key={famille}
                className="relative bg-white border border-sage-light rounded-2xl px-5 pt-7 pb-5"
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-sage-50 border border-sage-light rounded-full text-sm font-medium text-sage-darker whitespace-nowrap">
                  {famille}
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {sousTypes.map(s => {
                    const subSelected = subValues.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onToggleSousType(subKey, s, famille)}
                        className={`px-5 py-2.5 text-sm rounded-full border transition min-w-[140px] ${
                          subSelected
                            ? 'bg-sage-dark text-white border-sage-dark font-medium'
                            : 'bg-white text-stone-700 border-stone-200 hover:border-sage-dark hover:text-sage-darker'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Familles sans sous-types regroupées en bas (Terrains, Parking) */}
          {(() => {
            const orderList = q.order || Object.keys(q.tree);
            const noSubFams = orderList.filter(f => {
              const subs = q.tree[f];
              return subs && subs.length === 0;
            });
            if (noSubFams.length === 0) return null;
            const familles = value || [];
            return (
              <div className="relative bg-white border border-sage-light rounded-2xl px-5 pt-7 pb-5">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-sage-50 border border-sage-light rounded-full text-sm font-medium text-sage-darker whitespace-nowrap">
                  Autres
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {noSubFams.map(f => {
                    const isOn = familles.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => onToggleFamille(f)}
                        className={`px-5 py-2.5 text-sm rounded-full border transition min-w-[140px] ${
                          isOn
                            ? 'bg-sage-dark text-white border-sage-dark font-medium'
                            : 'bg-white text-stone-700 border-stone-200 hover:border-sage-dark hover:text-sage-darker'
                        }`}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
      {/* NOUVEAU : file (upload PJ) */}
      {q.type === 'file' && (
        <FileInput q={q} value={value} onChange={onChange} token={token} />
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error.message}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MoneyInput : format auto + suggestions
// ─────────────────────────────────────────────────────────
function MoneyInput({ q, value, onChange, error }) {
  const baseInput = `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 font-tabular ${
    error ? 'border-red-300 bg-red-50' : 'border-stone-200 bg-white'
  }`;

  const handleChange = (e) => {
    const cleaned = parseMoneyInput(e.target.value);
    onChange(cleaned);
  };

  const handlePillClick = (suggestion) => {
    onChange(String(suggestion.value));
  };

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={formatMoneyInput(value)}
          onChange={handleChange}
          placeholder={q.placeholder || ''}
          className={baseInput + (q.unit ? ' pr-9' : '')}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
        {q.unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400 pointer-events-none">{q.unit}</span>
        )}
      </div>
      <div className="flex gap-1.5 flex-wrap mt-1.5">
        {BUDGET_SUGGESTIONS.map(s => (
          <button
            key={s.value}
            type="button"
            onClick={() => handlePillClick(s)}
            className="px-2.5 py-1 text-[11px] rounded-full border border-stone-200 bg-white text-stone-600 hover:border-sage-dark hover:text-sage-darker transition"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// FileInput : upload PJ vers Supabase Storage
// ─────────────────────────────────────────────────────────
function FileInput({ q, value, onChange, token }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limite 10 Mo
    if (file.size > 10 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 10 Mo)');
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${PITCH_FOLDER}/${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from(PITCH_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });

      if (uploadErr) throw uploadErr;

      const { data: signed, error: signedErr } = await supabase.storage
        .from(PITCH_BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 30); // 30j

      if (signedErr) throw signedErr;

      onChange({
        name: file.name,
        size: file.size,
        type: file.type,
        path,
        url: signed.signedUrl
      });
    } catch (err) {
      console.error('[Upload PJ]', err);
      setError(err.message || 'Erreur upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = () => onChange(null);
  const fileObj = value;

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={q.accept || '*'}
        onChange={handleFile}
        className="hidden"
        id={`file-${q.id}`}
      />
      {!fileObj ? (
        <label
          htmlFor={`file-${q.id}`}
          className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg text-sm cursor-pointer transition ${
            uploading
              ? 'border-stone-300 text-stone-400'
              : 'border-stone-300 text-stone-600 hover:border-sage-dark hover:bg-sage-50/30'
          }`}
        >
          {uploading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
              Upload en cours...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Choisir un fichier (PDF, image, Word)
            </>
          )}
        </label>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2.5 bg-sage-50/40 border border-sage-light rounded-lg">
          <svg className="w-5 h-5 text-sage-dark flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-stone-900 truncate">{fileObj.name}</div>
            <div className="text-xs text-stone-500">
              {(fileObj.size / 1024 < 1024)
                ? `${(fileObj.size / 1024).toFixed(0)} Ko`
                : `${(fileObj.size / 1024 / 1024).toFixed(1)} Mo`}
            </div>
          </div>
          <button
            type="button"
            onClick={removeFile}
            className="text-stone-400 hover:text-red-600"
            aria-label="Supprimer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
