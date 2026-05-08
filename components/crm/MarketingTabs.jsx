'use client';

import React, { useState, useMemo } from 'react';
import {
  Mail, Plus, Send, FileQuestion, Eye, Circle,
  Copy, QrCode, Trash2, ChevronRight, Check, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toCamel, ZONES, TYPES_ACTIF, TYPOLOGIES_CLIENT } from '@/lib/crm-constants';
import { Field } from '@/components/crm/SharedComponents';
import QuestionnaireResponseModal from '@/components/QuestionnaireResponseModal';

// ═══════════════════════════════════════════════════════════════════
// EmailingsTab - Campagnes emailing avec segmentation
// ═══════════════════════════════════════════════════════════════════
export function EmailingsTab({ campagnes, reload, clients }) {
  const [showNew, setShowNew] = useState(false);
  const [segment, setSegment] = useState({ typologies: [], zones: [], budgetMin: 0, budgetMax: 100000000, typologiesRecherchees: [] });
  const [newCampagne, setNewCampagne] = useState({ nom: '', sujet: '', corps: '' });

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      if (segment.typologies.length && !segment.typologies.includes(c.typologie)) return false;
      if (segment.zones.length && !(c.zones || []).some(z => segment.zones.includes(z))) return false;
      if (parseFloat(c.budgetMax) < segment.budgetMin || parseFloat(c.budgetMin) > segment.budgetMax) return false;
      if (segment.typologiesRecherchees.length && !(c.typologiesRecherchees || []).some(t => segment.typologiesRecherchees.includes(t))) return false;
      return true;
    });
  }, [clients, segment]);

  const toggleSegment = (key, value) => {
    const arr = segment[key];
    setSegment({ ...segment, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] });
  };

  const createCampagne = async () => {
    if (!newCampagne.nom) return;
    await supabase.from('campagnes').insert({
      nom: newCampagne.nom,
      sujet: newCampagne.sujet,
      corps: newCampagne.corps,
      segment: [segment.typologies.join('+'), segment.zones.join('+')].filter(Boolean).join(' - ') || 'Tous',
      nb_destinataires: filteredClients.length
    });
    setNewCampagne({ nom: '', sujet: '', corps: '' });
    setShowNew(false);
    reload();
  };

  const sendCampagne = async (id) => {
    await supabase.from('campagnes').update({
      statut: 'Envoyée',
      date_envoi: new Date().toISOString().split('T')[0],
      taux: Math.floor(20 + Math.random() * 30)
    }).eq('id', id);
    reload();
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">Emailings & Sourcing</h1>
          <p className="text-stone-500">Segmentez vos acquéreurs et activez-les sur les bons actifs</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-2 px-4 py-2.5 bg-ink-deep text-white rounded-lg hover:bg-stone-800 text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouvelle campagne
        </button>
      </div>

      {showNew && (
        <div className="bg-white rounded-xl p-6 shadow-luxe border border-stone-200 mb-6">
          <h2 className="font-display text-xl font-semibold text-stone-900 mb-4">Créer une campagne ciblée</h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <Field label="Nom de la campagne"><input type="text" value={newCampagne.nom} onChange={e => setNewCampagne({...newCampagne, nom: e.target.value})} placeholder="Ex : Hôtels IDF Q2" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
              <Field label="Sujet"><input type="text" value={newCampagne.sujet} onChange={e => setNewCampagne({...newCampagne, sujet: e.target.value})} placeholder="Ex : Nouvelles opportunités" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
              <Field label="Corps du message"><textarea value={newCampagne.corps} onChange={e => setNewCampagne({...newCampagne, corps: e.target.value})} rows={6} placeholder="Cher {prenom}..." className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900 font-mono" /></Field>
            </div>
            <div className="space-y-4">
              <Field label="Typologies">
                <div className="flex flex-wrap gap-2">
                  {TYPOLOGIES_CLIENT.map(t => (
                    <button key={t} onClick={() => toggleSegment('typologies', t)}
                      className={`px-3 py-1 text-xs rounded-full border ${segment.typologies.includes(t) ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}>{t}</button>
                  ))}
                </div>
              </Field>
              <Field label="Zones">
                <div className="flex flex-wrap gap-2">
                  {ZONES.map(z => (
                    <button key={z} onClick={() => toggleSegment('zones', z)}
                      className={`px-3 py-1 text-xs rounded-full border ${segment.zones.includes(z) ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}>{z}</button>
                  ))}
                </div>
              </Field>
              <Field label="Typologies d'actifs recherchées">
                <div className="flex flex-wrap gap-2">
                  {TYPES_ACTIF.map(t => (
                    <button key={t} onClick={() => toggleSegment('typologiesRecherchees', t)}
                      className={`px-3 py-1 text-xs rounded-full border ${segment.typologiesRecherchees.includes(t) ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}>{t}</button>
                  ))}
                </div>
              </Field>
              <div className="bg-stone-50 rounded-lg p-4">
                <div className="text-xs text-stone-500 uppercase mb-1">Destinataires matchés</div>
                <div className="font-display text-3xl font-semibold text-stone-900">{filteredClients.length}</div>
                <div className="text-xs text-stone-500 mt-1">contacts selon vos critères</div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-cream-dark">
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Annuler</button>
            <button onClick={createCampagne} className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">Créer la campagne</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {campagnes.map(c => (
          <div key={c.id} className="bg-white rounded-xl p-5 shadow-luxe border border-cream-dark">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-stone-700" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="font-display text-lg font-semibold text-stone-900">{c.nom}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.statut === 'Envoyée' ? 'bg-emerald-50 text-emerald-700' : 'bg-cream-100 text-ink/80'
                  }`}>{c.statut}</span>
                </div>
                <div className="text-sm text-stone-500 mb-3">{c.segment}</div>
                <div className="flex items-center gap-5 text-sm">
                  <div><span className="text-stone-500">Destinataires:</span> <span className="font-medium">{c.nbDestinataires}</span></div>
                  {c.dateEnvoi && <div><span className="text-stone-500">Envoyée le:</span> <span className="font-medium">{new Date(c.dateEnvoi).toLocaleDateString('fr-FR')}</span></div>}
                  {c.taux > 0 && <div><span className="text-stone-500">Ouverture:</span> <span className="font-medium text-emerald-700">{c.taux}%</span></div>}
                </div>
              </div>
              <div>
                {c.statut === 'Brouillon' ? (
                  <button onClick={() => sendCampagne(c.id)} className="flex items-center gap-1.5 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">
                    <Send className="w-3.5 h-3.5" /> Envoyer
                  </button>
                ) : (
                  <div className="text-right">
                    <div className="font-display text-2xl font-semibold text-stone-900">{c.taux}%</div>
                    <div className="text-xs text-stone-500">ouverture</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {campagnes.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-stone-200 text-stone-500 text-sm">
            Aucune campagne
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// QuestionnaireCard - Carte questionnaire avec liste des réponses dépliable
// ═══════════════════════════════════════════════════════════════════
function QuestionnaireCard({ q, onShowQR, onDelete, onOpenResponse, onReload }) {
  const [expanded, setExpanded] = useState(false);
  const responses = q.reponses || [];
  const nbResponses = responses.length;
  const nbImported = responses.filter(r => r.imported_client_id || r.imported_mandat_id).length;
  const nbToImport = nbResponses - nbImported;

  return (
    <div className="bg-white rounded-xl shadow-luxe border border-cream-dark overflow-hidden">
      <div className="p-4 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          q.type === 'vendeur' ? 'bg-sage-100 text-sage-dark' : 'bg-emerald-100 text-emerald-700'
        }`}>
          <FileQuestion className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-stone-900">{q.nom}</div>
          <div className="text-xs text-stone-500 truncate font-mono">{q.lien}</div>
        </div>

        {nbResponses > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded-md"
          >
            <span className="font-semibold">{nbResponses}</span> réponse{nbResponses > 1 ? 's' : ''}
            {nbToImport > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-purple-600 text-white text-[10px] rounded-full">
                {nbToImport} à importer
              </span>
            )}
            <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        )}
        {nbResponses === 0 && (
          <span className="text-xs text-stone-400">Aucune réponse</span>
        )}

        <button onClick={() => navigator.clipboard.writeText(q.lien)} className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg" title="Copier le lien">
          <Copy className="w-4 h-4" />
        </button>
        <button onClick={() => onShowQR(q)} className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg" title="QR Code">
          <QrCode className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(q.id)} className="p-2 text-stone-600 hover:text-red-600 hover:bg-red-50 rounded-lg">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {expanded && nbResponses > 0 && (
        <div className="border-t border-cream-dark bg-stone-50/50 divide-y divide-cream-dark">
          {responses
            .slice()
            .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
            .map((r, i) => {
              const a = r.answers || {};
              const fullName = `${a.prenom || ''} ${a.nom || ''}`.trim() || '(sans nom)';
              const submittedDate = new Date(r.submitted_at);
              const isImported = r.imported_client_id || r.imported_mandat_id;
              return (
                <div key={i} className="p-3 flex items-center gap-3 hover:bg-white">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-stone-900 truncate">
                      {fullName}
                      {a.societe && <span className="text-stone-500 font-normal"> &middot; {a.societe}</span>}
                    </div>
                    <div className="text-xs text-stone-500 truncate">
                      {a.email || ''}
                      {a.tel && ` · ${a.tel}`}
                    </div>
                    <div className="text-[10px] text-stone-400 mt-0.5">
                      Soumis le {submittedDate.toLocaleString('fr-FR')}
                    </div>
                  </div>

                  {isImported ? (
                    <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Importé
                    </span>
                  ) : (
                    <button
                      onClick={() => onOpenResponse(r)}
                      className="text-xs px-3 py-1.5 bg-stone-900 text-white rounded-md hover:bg-stone-800"
                    >
                      Voir & importer
                    </button>
                  )}

                  <button
                    onClick={() => onOpenResponse(r)}
                    className="text-xs px-2 py-1.5 text-stone-600 hover:bg-stone-100 rounded-md"
                    title="Voir les détails"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// QuestionnairesTab - Vue principale avec templates et liens générés
// ═══════════════════════════════════════════════════════════════════
export function QuestionnairesTab({ questionnaires, reload }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState(null);

  const templates = {
    vendeur: {
      nom: 'Questionnaire Vendeur',
      color: 'amber',
      description: 'Qualification du bien et des attentes vendeur',
      sections: [
        { titre: 'Le bien', questions: ['Type et adresse', 'Surface totale et répartition', 'État général (toiture, façade, parties communes)', 'Travaux prévus ou à prévoir', 'Composition locative (lots, commerces)'] },
        { titre: 'Financier', questions: ['Prix de vente souhaité', 'Loyers annuels HC/HT', 'Taxe foncière', 'Charges annuelles', 'Rendement cible'] },
        { titre: 'Attentes & timing', questions: ['Type de commercialisation souhaitée', 'Timing de vente', "Contraintes particulières (locataires, préemption, indivision)", 'Exclusivité ou mandat simple'] }
      ]
    },
    acquereur: {
      nom: "Questionnaire Acquéreur",
      color: 'emerald',
      description: 'Profil investisseur et critères',
      sections: [
        { titre: "Identité", questions: ['Nom / Société', 'Typologie (Foncière, MDB, Family Office...)', 'Nature juridique', 'Personne de contact'] },
        { titre: 'Critères', questions: ["Type d'actifs recherchés", 'Budget min / max', 'Rendement minimum', 'Zones géographiques', 'Stratégie (Core, Value-add, Opportuniste)'] },
        { titre: 'Maturité & process', questions: ['Horizon de décision', 'Financement (cash, crédit, mixte)', "Historique d'acquisitions", 'Équipe & décisionnaires'] }
      ]
    }
  };

  const sendQuestionnaire = async (type) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://patrimonia-crm.vercel.app';
    const lien = `${baseUrl}/q/${type}/${Math.random().toString(36).slice(2, 10)}`;
    const { data } = await supabase.from('questionnaires').insert({
      type, nom: templates[type].nom, lien
    }).select().single();
    setShowQR(toCamel(data));
    reload();
  };

  const deleteQ = async (id) => {
    await supabase.from('questionnaires').delete().eq('id', id);
    reload();
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">Questionnaires</h1>
        <p className="text-stone-500">Qualifiez vendeurs & acquéreurs avec des formulaires structurés</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {Object.entries(templates).map(([key, t]) => (
          <div key={key} className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
            <div className={`inline-flex w-12 h-12 rounded-xl mb-4 items-center justify-center ${
              t.color === 'amber' ? 'bg-sage-100 text-sage-dark' : 'bg-emerald-100 text-emerald-700'
            }`}>
              <FileQuestion className="w-6 h-6" />
            </div>
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-1">{t.nom}</h2>
            <p className="text-sm text-stone-500 mb-4">{t.description}</p>
            <div className="mb-4">
              <div className="text-xs text-stone-500 uppercase mb-2 font-medium">Structure</div>
              {t.sections.map(s => (
                <div key={s.titre} className="text-sm text-stone-700 flex items-center gap-2 mb-1">
                  <Circle className="w-1.5 h-1.5 fill-current text-stone-400" />
                  {s.titre} <span className="text-stone-400 text-xs">({s.questions.length})</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedTemplate(key)} className="flex-1 px-3 py-2 bg-stone-100 text-stone-800 rounded-lg text-sm hover:bg-cream-200 flex items-center justify-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Aperçu
              </button>
              <button onClick={() => sendQuestionnaire(key)} className="flex-1 px-3 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-stone-800 flex items-center justify-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> Générer un lien
              </button>
            </div>
          </div>
        ))}
      </div>

      {questionnaires.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-900 mb-4">Liens générés</h2>
          <div className="space-y-3">
            {questionnaires.map(q => (
              <QuestionnaireCard
                key={q.id}
                q={q}
                onShowQR={setShowQR}
                onDelete={deleteQ}
                onOpenResponse={(r) => { setSelectedQuestionnaire(q); setSelectedResponse(r); }}
                onReload={reload}
              />
            ))}
          </div>
        </div>
      )}

      <QuestionnaireResponseModal
        isOpen={!!selectedResponse}
        onClose={() => { setSelectedResponse(null); setSelectedQuestionnaire(null); }}
        questionnaire={selectedQuestionnaire}
        response={selectedResponse}
        onImported={(imported) => {
          alert(`${imported.type === 'client' ? 'Client' : 'Mandat'} créé avec succès dans le CRM`);
          reload();
        }}
      />

      {selectedTemplate && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={() => setSelectedTemplate(null)}>
          <div className="bg-white rounded-xl shadow-luxe-hover max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-cream-dark">
              <h2 className="font-display text-2xl font-semibold text-stone-900">{templates[selectedTemplate].nom}</h2>
              <button onClick={() => setSelectedTemplate(null)}><X className="w-5 h-5 text-stone-500" /></button>
            </div>
            <div className="p-6 space-y-6">
              {templates[selectedTemplate].sections.map(s => (
                <div key={s.titre}>
                  <h3 className="font-display text-lg font-semibold text-stone-900 mb-3">{s.titre}</h3>
                  <div className="space-y-2">
                    {s.questions.map((q, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-stone-700 p-3 bg-stone-50 rounded-lg">
                        <span className="text-stone-400 font-mono">{String(i+1).padStart(2, '0')}</span>
                        <span>{q}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showQR && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={() => setShowQR(null)}>
          <div className="bg-white rounded-xl shadow-luxe-hover max-w-md w-full p-8 text-center" onClick={e => e.stopPropagation()}>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mb-4">{showQR.nom}</h2>
            <div className="bg-stone-100 rounded-xl p-6 mb-4">
              <div className="w-48 h-48 mx-auto bg-white rounded-lg flex items-center justify-center relative overflow-hidden">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {Array.from({ length: 225 }).map((_, i) => {
                    const hash = ((String(showQR.id || '').charCodeAt(i % (String(showQR.id || 'x').length)) * (i + 1)) % 7);
                    if (hash < 3) return null;
                    return <rect key={i} x={(i % 15) * 6 + 5} y={Math.floor(i / 15) * 6 + 5} width="5" height="5" fill="#1c1917" />;
                  })}
                  <rect x="5" y="5" width="20" height="20" fill="none" stroke="#1c1917" strokeWidth="3" />
                  <rect x="75" y="5" width="20" height="20" fill="none" stroke="#1c1917" strokeWidth="3" />
                  <rect x="5" y="75" width="20" height="20" fill="none" stroke="#1c1917" strokeWidth="3" />
                  <rect x="12" y="12" width="6" height="6" fill="#1c1917" />
                  <rect x="82" y="12" width="6" height="6" fill="#1c1917" />
                  <rect x="12" y="82" width="6" height="6" fill="#1c1917" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-stone-500 font-mono mb-4 break-all">{showQR.lien}</p>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(showQR.lien)} className="flex-1 px-4 py-2 bg-stone-100 text-stone-800 rounded-lg text-sm hover:bg-cream-200 flex items-center justify-center gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Copier le lien
              </button>
              <button onClick={() => setShowQR(null)} className="flex-1 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
