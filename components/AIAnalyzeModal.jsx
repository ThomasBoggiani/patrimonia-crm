// ═══════════════════════════════════════════════════════════════════
// components/AIAnalyzeModal.jsx
// Modale "Analyser avec l'IA" — analyse complète d'un mandat
//
// 3 phases :
//  1. Confirmation (avant lancement)
//  2. Loading (IA en cours)
//  3. Rapport final en 5 sections + diff de validation
// ═══════════════════════════════════════════════════════════════════

'use client';
import { useState } from 'react';
import {
  X, Sparkles, Loader2, Check, AlertCircle, FileText, Users, Target, Lightbulb,
  ListTodo, ArrowRight, Zap, Eye
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const FIELD_LABELS = {
  nom: 'Nom du bien', adresse: 'Adresse', ville: 'Ville', type: 'Type', sous_type: 'Sous-type',
  surface: 'Surface (m²)', nb_pieces: 'Pièces', nb_chambres: 'Chambres', etage: 'Étage',
  annee_construction: 'Année construction', prix: 'Prix annoncé TTC', prix_net_vendeur: 'Prix net vendeur',
  prix_m2: 'Prix au m²', honoraires_charge: 'Honoraires à charge', honoraires_taux: 'Honoraires (%)',
  honoraires_montant: 'Honoraires (€)', loyers_annuels: 'Loyers annuels', rendement: 'Rendement (%)',
  charges_annuelles: 'Charges annuelles', taxe_fonciere: 'Taxe foncière',
  dpe_consommation: 'DPE conso', dpe_emissions: 'DPE émissions', dpe_date: 'DPE (date)',
  mandat_numero: 'N° mandat', mandat_type: 'Type mandat', mandat_date_echeance: 'Échéance mandat',
  nb_lots: 'Nb lots', description: 'Description', commercialisation: 'Commercialisation',
};

function isEmpty(v) {
  return v === null || v === undefined || v === '';
}

function formatValue(v) {
  if (isEmpty(v)) return <span className="text-stone-400 italic">vide</span>;
  if (typeof v === 'number') return v.toLocaleString('fr-FR');
  if (typeof v === 'string' && v.length > 100) return v.slice(0, 100) + '…';
  return String(v);
}

export default function AIAnalyzeModal({ open, mandatId, mandatLabel, onClose, onCompleted }) {
  // 'idle' = avant lancement, 'analyzing' = en cours, 'done' = rapport prêt
  const [phase, setPhase] = useState('idle');
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [selectedProposed, setSelectedProposed] = useState({});
  const [applyingProposed, setApplyingProposed] = useState(false);
  const [proposedApplied, setProposedApplied] = useState(false);

  if (!open) return null;

  function reset() {
    setPhase('idle');
    setReport(null);
    setError(null);
    setSelectedProposed({});
    setProposedApplied(false);
  }

  async function launchAnalysis() {
    setPhase('analyzing');
    setError(null);
    setReport(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');

      const res = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, mandatId }),
      });
      const data = await res.json();

      if (!data.ok) throw new Error(data.error || 'Erreur inconnue');

      // Pré-cocher tous les champs proposés (l'utilisateur peut décocher)
      const initialSelection = {};
      for (const k of Object.keys(data.proposed || {})) initialSelection[k] = true;
      setSelectedProposed(initialSelection);

      setReport(data);
      setPhase('done');

      // Notifier le parent qu'il y a eu des modifs (pour reload)
      onCompleted?.({ autoApplied: true, hasProposed: Object.keys(data.proposed || {}).length > 0 });
    } catch (e) {
      setError(e.message);
      setPhase('idle');
    }
  }

  async function applyProposed() {
    if (!report?.proposed) return;
    const updates = {};
    for (const [k, v] of Object.entries(report.proposed)) {
      if (selectedProposed[k]) updates[k] = v;
    }
    if (Object.keys(updates).length === 0) return;

    setApplyingProposed(true);
    try {
      const { error: upErr } = await supabase.from('mandats').update(updates).eq('id', mandatId);
      if (upErr) throw upErr;
      setProposedApplied(true);
      onCompleted?.({ autoApplied: false, proposedApplied: true });
    } catch (e) {
      setError('Erreur application : ' + e.message);
    } finally {
      setApplyingProposed(false);
    }
  }

  const autoFilledKeys = Object.keys(report?.autoFilled || {});
  const proposedKeys = Object.keys(report?.proposed || {});
  const tasksCount = (report?.tasksCreated || []).length;

  return (
    <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-3xl w-full max-h-[92vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sage-100 to-sage-200 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-sage-darker" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold text-stone-900 truncate">Analyser avec l'IA</h2>
              <p className="text-xs text-stone-500 truncate">{mandatLabel || 'Mandat'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>

        {/* PHASE IDLE — confirmation avant lancement */}
        {phase === 'idle' && (
          <div className="p-6">
            <div className="text-center mb-6">
              <Zap className="w-12 h-12 text-sage-dark mx-auto mb-3" />
              <h3 className="font-display text-xl font-semibold text-stone-900 mb-2">Analyse complète du mandat</h3>
              <p className="text-sm text-stone-600 max-w-md mx-auto">
                L'IA va lire <strong>tous les documents attachés</strong> à ce mandat et produire un rapport complet en 5 volets.
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 space-y-2.5 text-sm">
              <Step icon={FileText} text="Mise à jour automatique des champs vides de la fiche" />
              <Step icon={ListTodo} text="Création des tâches actionnables (assignées au pourvoyeur)" />
              <Step icon={Users} text="Identification des clients potentiels en BDD + profils-types" />
              <Step icon={Target} text="Stratégies de commercialisation (off-market, canaux)" />
              <Step icon={Lightbulb} text="Brief stratégique (forces, faiblesses, questions vendeur)" />
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Annuler</button>
              <button onClick={launchAnalysis}
                className="flex items-center gap-2 px-5 py-2 bg-sage-dark text-white rounded-lg hover:bg-sage-darker text-sm font-medium">
                <Sparkles className="w-4 h-4" /> Lancer l'analyse
              </button>
            </div>
          </div>
        )}

        {/* PHASE ANALYZING — loading */}
        {phase === 'analyzing' && (
          <div className="p-12 flex flex-col items-center text-center">
            <Loader2 className="w-12 h-12 animate-spin text-sage-dark mb-4" />
            <h3 className="font-display text-lg font-semibold text-stone-900 mb-1">L'IA analyse le mandat…</h3>
            <p className="text-sm text-stone-600">Lecture des documents, analyse stratégique, suggestions de tâches</p>
            <p className="text-xs text-stone-400 mt-2">Cela peut prendre 15-45 secondes</p>
          </div>
        )}

        {/* PHASE DONE — rapport */}
        {phase === 'done' && report && (
          <div className="p-5 space-y-5">

            {/* Bandeau récap */}
            <div className="bg-gradient-to-br from-sage-50 to-cream-50 border border-sage-light rounded-lg p-4">
              <div className="flex items-start gap-2 mb-2">
                <Check className="w-5 h-5 text-sage-darker flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-stone-900 text-sm">Analyse terminée</div>
                  <div className="text-xs text-stone-600 mt-0.5">
                    {report.docsAnalyzed} document(s) analysé(s)
                    {report.confidence > 0 && ` · Confiance : ${Math.round(report.confidence * 100)}%`}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                <Stat label="Champs remplis" value={autoFilledKeys.length} color="emerald" />
                <Stat label="À valider" value={proposedKeys.length} color="amber" />
                <Stat label="Tâches créées" value={tasksCount} color="indigo" />
                <Stat label="Clients matchés" value={(report.matchingClients || []).length} color="violet" />
              </div>
              {report.reasoning && (
                <p className="text-xs text-stone-600 mt-3 italic">💡 {report.reasoning}</p>
              )}
            </div>

            {/* SECTION 1 — Champs auto-remplis */}
            {autoFilledKeys.length > 0 && (
              <Section icon={Zap} title="Champs auto-remplis" subtitle="Champs vides remplis automatiquement par l'IA" color="emerald">
                <div className="border border-stone-200 rounded-lg overflow-hidden bg-white">
                  {autoFilledKeys.map((k, i) => (
                    <div key={k} className={`grid grid-cols-[140px_1fr] text-xs ${i % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'} border-b border-stone-100 last:border-b-0`}>
                      <div className="px-3 py-2 font-medium text-stone-700 text-[11px]">{FIELD_LABELS[k] || k}</div>
                      <div className="px-3 py-2 text-stone-900 border-l border-stone-100">{formatValue(report.autoFilled[k])}</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* SECTION 2 — Champs proposés (à valider) */}
            {proposedKeys.length > 0 && (
              <Section icon={Eye} title="Modifications proposées" subtitle="Ces champs étaient déjà remplis. Coche ceux que tu veux remplacer." color="amber">
                {proposedApplied ? (
                  <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3 flex items-center gap-2">
                    <Check className="w-4 h-4" /> Modifications appliquées !
                  </div>
                ) : (
                  <>
                    <div className="border border-stone-200 rounded-lg overflow-hidden bg-white">
                      <div className="grid grid-cols-[40px_140px_1fr_1fr] bg-stone-50 border-b border-stone-200 text-[10px] font-semibold uppercase tracking-wide text-stone-700">
                        <div className="px-2 py-1.5"></div>
                        <div className="px-3 py-1.5">Champ</div>
                        <div className="px-3 py-1.5 border-l border-stone-200">Avant</div>
                        <div className="px-3 py-1.5 border-l border-stone-200 bg-amber-50/50">Proposé</div>
                      </div>
                      {proposedKeys.map((k, i) => (
                        <div key={k} className={`grid grid-cols-[40px_140px_1fr_1fr] text-xs ${i % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'} border-b border-stone-100 last:border-b-0`}>
                          <div className="px-2 py-2 flex items-center justify-center">
                            <input type="checkbox" checked={!!selectedProposed[k]}
                              onChange={() => setSelectedProposed(prev => ({ ...prev, [k]: !prev[k] }))}
                              className="w-3.5 h-3.5 accent-sage-dark cursor-pointer" />
                          </div>
                          <div className="px-3 py-2 font-medium text-stone-700 text-[11px]">{FIELD_LABELS[k] || k}</div>
                          <div className="px-3 py-2 border-l border-stone-100 text-stone-600">{formatValue(report.currentValues?.[k])}</div>
                          <div className="px-3 py-2 border-l border-stone-100 bg-amber-50/30 font-medium text-stone-900">{formatValue(report.proposed[k])}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button onClick={applyProposed} disabled={applyingProposed || Object.values(selectedProposed).filter(Boolean).length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm">
                        {applyingProposed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Appliquer {Object.values(selectedProposed).filter(Boolean).length} modification(s)
                      </button>
                    </div>
                  </>
                )}
              </Section>
            )}

            {/* SECTION 3 — Tâches créées */}
            {tasksCount > 0 && (
              <Section icon={ListTodo} title={`${tasksCount} tâche(s) créée(s)`}
                subtitle={report.assignedTo ? `Assignées à ${report.assignedTo}` : 'Tâches non assignées (pas de pourvoyeur)'} color="indigo">
                <div className="space-y-1.5">
                  {report.tasksCreated.map((t, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 bg-white border border-stone-200 rounded-lg text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                        t.priorite === 'Haute' ? 'bg-red-500' :
                        t.priorite === 'Moyenne' ? 'bg-amber-500' : 'bg-stone-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-stone-900">{t.titre}</div>
                        {t.echeance && <div className="text-[10px] text-stone-500 mt-0.5">📅 {t.echeance}</div>}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        t.priorite === 'Haute' ? 'bg-red-100 text-red-700' :
                        t.priorite === 'Moyenne' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600'
                      }`}>
                        {t.priorite}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* SECTION 4 — Clients potentiels */}
            {(report.matchingClients?.length > 0 || report.targetProfiles?.length > 0) && (
              <Section icon={Users} title="Profils acheteurs" color="violet">
                {report.matchingClients?.length > 0 && (
                  <>
                    <div className="text-xs font-semibold text-stone-700 mb-1.5">📍 Clients en BDD compatibles ({report.matchingClients.length})</div>
                    <div className="space-y-1.5 mb-3">
                      {report.matchingClients.map((c, i) => (
                        <div key={i} className="p-2.5 bg-violet-50 border border-violet-200 rounded-lg text-xs">
                          <div className="font-medium text-stone-900">Client BDD</div>
                          <div className="text-[11px] text-stone-600 mt-0.5">{c.raison}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {report.targetProfiles?.length > 0 && (
                  <>
                    <div className="text-xs font-semibold text-stone-700 mb-1.5">🎯 Profils-types à cibler</div>
                    <div className="space-y-1.5">
                      {report.targetProfiles.map((p, i) => (
                        <div key={i} className="p-2.5 bg-white border border-stone-200 rounded-lg text-xs">
                          <div className="font-medium text-stone-900">{p.type}</div>
                          {p.raison && <div className="text-[11px] text-stone-600 mt-0.5">{p.raison}</div>}
                          {p.canaux?.length > 0 && (
                            <div className="text-[10px] text-stone-500 mt-1">Canaux : {p.canaux.join(' · ')}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Section>
            )}

            {/* SECTION 5 — Stratégies */}
            {report.strategies?.length > 0 && (
              <Section icon={Target} title="Stratégies de commercialisation" color="rose">
                <ul className="space-y-1.5">
                  {report.strategies.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-stone-700 p-2 bg-white border border-stone-200 rounded">
                      <ArrowRight className="w-3 h-3 text-rose-600 flex-shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* SECTION 6 — Brief stratégique */}
            {report.brief && (report.brief.synthese || report.brief.forces?.length || report.brief.faiblesses?.length) && (
              <Section icon={Lightbulb} title="Brief stratégique" subtitle="Ajouté à la description du mandat" color="sage">
                {report.brief.synthese && (
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded text-xs text-stone-700 italic mb-3">
                    {report.brief.synthese}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {report.brief.forces?.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-emerald-700 mb-1">✅ Forces</div>
                      <ul className="text-[11px] text-stone-700 space-y-0.5">
                        {report.brief.forces.map((f, i) => <li key={i}>• {f}</li>)}
                      </ul>
                    </div>
                  )}
                  {report.brief.faiblesses?.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-amber-700 mb-1">⚠️ Points d'attention</div>
                      <ul className="text-[11px] text-stone-700 space-y-0.5">
                        {report.brief.faiblesses.map((f, i) => <li key={i}>• {f}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
                {report.brief.questions_vendeur?.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-stone-700 mb-1">❓ Questions à poser au vendeur</div>
                    <ul className="text-[11px] text-stone-700 space-y-0.5">
                      {report.brief.questions_vendeur.map((q, i) => <li key={i}>• {q}</li>)}
                    </ul>
                  </div>
                )}
              </Section>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="pt-4 border-t border-stone-200 flex justify-between gap-2">
              <button onClick={() => { reset(); }} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">
                ← Nouvelle analyse
              </button>
              <button onClick={() => { onClose(); reset(); }}
                className="flex items-center gap-2 px-5 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 text-sm">
                <Check className="w-4 h-4" /> Terminer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({ icon: Icon, text }) {
  return (
    <div className="flex items-start gap-2 text-stone-700">
      <Icon className="w-4 h-4 text-sage-dark flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

function Stat({ label, value, color }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    amber: 'bg-amber-50 text-amber-900 border-amber-200',
    indigo: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    violet: 'bg-violet-50 text-violet-900 border-violet-200',
  };
  return (
    <div className={`p-2 rounded-lg border text-center ${colors[color] || colors.emerald}`}>
      <div className="text-lg font-display font-semibold leading-none">{value}</div>
      <div className="text-[10px] mt-0.5 opacity-80">{label}</div>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, color = 'sage', children }) {
  const colors = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
    indigo: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    violet: 'text-violet-700 bg-violet-50 border-violet-200',
    rose: 'text-rose-700 bg-rose-50 border-rose-200',
    sage: 'text-sage-darker bg-sage-50 border-sage-light',
  };
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-stone-500 leading-tight">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
