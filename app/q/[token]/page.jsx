'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, AlertCircle, Loader2, Home, ShoppingBag, ChevronRight } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function QuestionnairePublic() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [commercial, setCommercial] = useState(null);
  const [error, setError] = useState(null);

  // État du formulaire
  const [type, setType] = useState(''); // '' | 'acquereur' | 'vendeur'
  const [reponses, setReponses] = useState({});
  const [consentRgpd, setConsentRgpd] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorSubmit, setErrorSubmit] = useState(null);

  useEffect(() => {
    async function loadCommercial() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, prenom, nom')
        .eq('questionnaire_token', token)
        .maybeSingle();
      if (error || !data) {
        setError('Lien invalide ou expiré.');
      } else {
        setCommercial(data);
      }
      setLoading(false);
    }
    if (token) loadCommercial();
  }, [token]);

  const setField = (key, value) => setReponses(prev => ({ ...prev, [key]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorSubmit(null);
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
          reponses,
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
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="font-display text-2xl font-semibold text-stone-900 mb-2">Lien invalide</h1>
          <p className="text-stone-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="font-display text-2xl font-semibold text-stone-900 mb-3">Merci !</h1>
          <p className="text-stone-600 mb-2">
            Votre demande a bien été enregistrée.
          </p>
          <p className="text-stone-600">
            <strong>{commercial.prenom} {commercial.nom}</strong> vous recontactera très prochainement.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-stone-900 mb-2">
            Immeubles & Patrimoine
          </h1>
          <p className="text-stone-600">
            Questionnaire envoyé par <strong>{commercial.prenom} {commercial.nom}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 md:p-8 space-y-6">

          {/* Étape 1 : choix Acheter / Vendre */}
          <div>
            <label className="block text-sm font-medium text-stone-900 mb-3">
              Quel est votre projet ? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('acquereur')}
                className={`p-4 border-2 rounded-xl text-left transition ${
                  type === 'acquereur'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <ShoppingBag className={`w-6 h-6 mb-2 ${type === 'acquereur' ? 'text-emerald-600' : 'text-stone-400'}`} />
                <div className="font-medium text-stone-900">J'aimerais acheter</div>
                <div className="text-xs text-stone-500 mt-1">Investir dans un bien immobilier</div>
              </button>
              <button
                type="button"
                onClick={() => setType('vendeur')}
                className={`p-4 border-2 rounded-xl text-left transition ${
                  type === 'vendeur'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <Home className={`w-6 h-6 mb-2 ${type === 'vendeur' ? 'text-emerald-600' : 'text-stone-400'}`} />
                <div className="font-medium text-stone-900">J'aimerais vendre</div>
                <div className="text-xs text-stone-500 mt-1">Céder un bien immobilier</div>
              </button>
            </div>
          </div>

          {/* Section : coordonnées (toujours affichées si type choisi) */}
          {type && (
            <>
              <div className="pt-4 border-t border-stone-100">
                <h3 className="text-sm font-medium text-stone-900 mb-4">Vos coordonnées</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Prénom" required value={reponses.prenom} onChange={v => setField('prenom', v)} />
                  <Field label="Nom" required value={reponses.nom} onChange={v => setField('nom', v)} />
                  <Field label="Email" type="email" required value={reponses.email} onChange={v => setField('email', v)} />
                  <Field label="Téléphone" type="tel" value={reponses.telephone} onChange={v => setField('telephone', v)} />
                </div>
                <Field label="Société (optionnel)" value={reponses.societe} onChange={v => setField('societe', v)} />
              </div>

              {/* Section ACHETER */}
              {type === 'acquereur' && (
                <div className="pt-4 border-t border-stone-100">
                  <h3 className="text-sm font-medium text-stone-900 mb-4">Votre projet d'achat</h3>
                  <div className="space-y-3">
                    <SelectField
                      label="Vous êtes"
                      value={reponses.statut_personne}
                      onChange={v => setField('statut_personne', v)}
                      options={['Particulier', 'Société (SCI/holding)', 'Family Office', 'Institutionnel']}
                    />
                    <SelectField
                      label="Typologie recherchée"
                      value={reponses.typologie}
                      onChange={v => setField('typologie', v)}
                      options={['Immeuble entier', 'Lot d\'immeuble', 'Local commercial', 'Bureaux', 'Hôtel particulier', 'Autre']}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Budget minimum (€)" type="number" value={reponses.budget_min} onChange={v => setField('budget_min', v)} />
                      <Field label="Budget maximum (€)" type="number" value={reponses.budget_max} onChange={v => setField('budget_max', v)} />
                    </div>
                    <Field label="Rendement minimum souhaité (%)" type="number" value={reponses.rendement_min} onChange={v => setField('rendement_min', v)} />
                    <Field label="Zones recherchées" placeholder="Paris 6e, 7e, 8e..." value={reponses.zones} onChange={v => setField('zones', v)} />
                    <TextArea label="Critères spécifiques" placeholder="Patrimonial, libre, en bloc..." value={reponses.criteres_specifiques} onChange={v => setField('criteres_specifiques', v)} />
                  </div>
                </div>
              )}

              {/* Section VENDRE */}
              {type === 'vendeur' && (
                <div className="pt-4 border-t border-stone-100">
                  <h3 className="text-sm font-medium text-stone-900 mb-4">Votre bien à vendre</h3>
                  <div className="space-y-3">
                    <SelectField
                      label="Type de bien"
                      value={reponses.type_actif}
                      onChange={v => setField('type_actif', v)}
                      options={['Immeuble', 'Lot d\'immeuble', 'Local commercial', 'Bureaux', 'Hôtel particulier', 'Autre']}
                    />
                    <Field label="Adresse" required value={reponses.adresse} onChange={v => setField('adresse', v)} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Code postal" value={reponses.code_postal} onChange={v => setField('code_postal', v)} />
                      <Field label="Ville" value={reponses.ville} onChange={v => setField('ville', v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Surface (m²)" type="number" value={reponses.surface} onChange={v => setField('surface', v)} />
                      <Field label="Nombre de lots" type="number" value={reponses.nb_lots} onChange={v => setField('nb_lots', v)} />
                    </div>
                    <Field label="Prix demandé (€)" type="number" value={reponses.prix_demande} onChange={v => setField('prix_demande', v)} />
                    <Field label="Loyers annuels (€)" type="number" value={reponses.loyers_annuels} onChange={v => setField('loyers_annuels', v)} />
                    <TextArea label="Description du bien" placeholder="État, particularités, projet..." value={reponses.description} onChange={v => setField('description', v)} />
                  </div>
                </div>
              )}

              {/* Section RGPD */}
              <div className="pt-4 border-t border-stone-100 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentRgpd}
                    onChange={e => setConsentRgpd(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-stone-700">
                    <strong>J'accepte</strong> que mes données soient enregistrées par Immeubles & Patrimoine pour me recontacter dans le cadre de mon projet immobilier. <span className="text-red-500">*</span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentMarketing}
                    onChange={e => setConsentMarketing(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-stone-700">
                    Je souhaite recevoir des opportunités d'investissement par email (optionnel).
                  </span>
                </label>

                <p className="text-xs text-stone-500 pt-2">
                  Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données.
                  Plus d'informations dans notre <a href="/politique-confidentialite" target="_blank" rel="noopener" className="text-emerald-700 hover:underline">politique de confidentialité</a>.
                </p>
              </div>

              {errorSubmit && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>{errorSubmit}</div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !consentRgpd}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Envoyer ma demande
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </>
          )}
        </form>

        <p className="text-center text-xs text-stone-400 mt-6">
          Immeubles & Patrimoine &middot; <a href="/politique-confidentialite" className="hover:underline">Politique de confidentialité</a>
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false, placeholder = '' }) {
  return (
    <div>
      <label className="block text-xs text-stone-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, required = false }) {
  return (
    <div>
      <label className="block text-xs text-stone-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
      >
        <option value="">-- Sélectionner --</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder = '', required = false }) {
  return (
    <div>
      <label className="block text-xs text-stone-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      />
    </div>
  );
}
