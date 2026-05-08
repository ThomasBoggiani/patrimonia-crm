'use client';

import React, { useState, useEffect } from 'react';
import { Edit2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatPrixCompact } from '@/lib/crm-constants';

// ═══════════════════════════════════════════════════════════════════
// ReglagesSection - Panneau admin pour modifier les taux de commission
// ═══════════════════════════════════════════════════════════════════
export function ReglagesSection({ rates, setRates, userId }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rates);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    setDraft(rates);
  }, [rates]);

  const total = (parseFloat(draft.pourvoyeur) || 0) + (parseFloat(draft.vendeur) || 0) + (parseFloat(draft.agence) || 0);
  const isValid = Math.abs(total - 100) < 0.01;

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);

    const newValue = {
      pourvoyeur: parseFloat(draft.pourvoyeur) || 0,
      vendeur: parseFloat(draft.vendeur) || 0,
      agence: parseFloat(draft.agence) || 0,
      taux_commission: parseFloat(draft.taux_commission) || 5,
      tva: rates.tva || 20,
    };

    const { error } = await supabase
      .from('settings')
      .upsert({
        key: 'commission_rates',
        value: newValue,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (!error) {
      setRates(prev => ({ ...prev, ...newValue }));
      setSavedAt(new Date());
      setEditing(false);
    } else {
      alert('Erreur lors de la sauvegarde : ' + error.message);
    }
    setSaving(false);
  }

  function handleCancel() {
    setDraft(rates);
    setEditing(false);
  }

  return (
    <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-hidden mt-6">
      <div className="p-5 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-stone-900 flex items-center gap-2">Reglages</h2>
          <p className="text-xs text-stone-500 mt-1">Taux de commission appliques sur l'ensemble du CRM</p>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition"
          >
            <Edit2 className="w-3.5 h-3.5" /> Modifier
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-2">Pourvoyeur</div>
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={draft.pourvoyeur}
                  onChange={e => setDraft({ ...draft, pourvoyeur: e.target.value })}
                  className="w-full px-2 py-1 border border-blue-300 rounded text-2xl font-semibold text-blue-900 bg-white focus:outline-none focus:border-blue-500"
                />
                <span className="text-2xl font-semibold text-blue-900">%</span>
              </div>
            ) : (
              <div className="text-3xl font-semibold text-blue-900">{rates.pourvoyeur}<span className="text-xl">%</span></div>
            )}
            <div className="text-[10px] text-blue-600 mt-1">Apporteur du mandat</div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-2">Vendeur</div>
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={draft.vendeur}
                  onChange={e => setDraft({ ...draft, vendeur: e.target.value })}
                  className="w-full px-2 py-1 border border-amber-300 rounded text-2xl font-semibold text-amber-900 bg-white focus:outline-none focus:border-amber-500"
                />
                <span className="text-2xl font-semibold text-amber-900">%</span>
              </div>
            ) : (
              <div className="text-3xl font-semibold text-amber-900">{rates.vendeur}<span className="text-xl">%</span></div>
            )}
            <div className="text-[10px] text-amber-600 mt-1">Closer de la vente</div>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
            <div className="text-xs font-medium text-stone-700 uppercase tracking-wide mb-2">Agence</div>
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={draft.agence}
                  onChange={e => setDraft({ ...draft, agence: e.target.value })}
                  className="w-full px-2 py-1 border border-stone-300 rounded text-2xl font-semibold text-stone-900 bg-white focus:outline-none focus:border-stone-500"
                />
                <span className="text-2xl font-semibold text-stone-900">%</span>
              </div>
            ) : (
              <div className="text-3xl font-semibold text-stone-900">{rates.agence}<span className="text-xl">%</span></div>
            )}
            <div className="text-[10px] text-stone-600 mt-1">Part agence</div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="text-xs font-medium text-emerald-700 uppercase tracking-wide mb-2">Taux commission</div>
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" max="20" step="0.1"
                  value={draft.taux_commission}
                  onChange={e => setDraft({ ...draft, taux_commission: e.target.value })}
                  className="w-full px-2 py-1 border border-emerald-300 rounded text-2xl font-semibold text-emerald-900 bg-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-2xl font-semibold text-emerald-900">%</span>
              </div>
            ) : (
              <div className="text-3xl font-semibold text-emerald-900">{rates.taux_commission}<span className="text-xl">%</span></div>
            )}
            <div className="text-[10px] text-emerald-600 mt-1">% du HT</div>
          </div>
        </div>

        {editing && (
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            isValid ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {isValid ? (
              <span>La repartition fait bien <strong>100%</strong> (Pourvoyeur + Vendeur + Agence)</span>
            ) : (
              <span>La repartition doit faire <strong>100%</strong>. Total actuel : <strong>{total.toFixed(1)}%</strong></span>
            )}
          </div>
        )}

        {!editing && savedAt && (
          <div className="mt-4 p-3 rounded-lg flex items-center gap-2 text-sm bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span>Reglages mis a jour a {savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.</span>
          </div>
        )}

        <div className="mt-4 text-xs text-stone-500">
          <strong>Calcul :</strong> Prix TTC / {(1 + (rates.tva || 20) / 100).toFixed(2)} = HT &middot; Commission agence = HT x {rates.taux_commission}% &middot; Repartition Pourvoyeur {rates.pourvoyeur}% / Vendeur {rates.vendeur}% / Agence {rates.agence}%
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DashboardDirection - Vue manager pour TE/TB
// ═══════════════════════════════════════════════════════════════════
export function DashboardDirection({ mandats, deals, clients, todos, allProfiles = [] }) {
  const { user, profile } = useAuth();
  const [rates, setRates] = useState({ pourvoyeur: 30, vendeur: 30, agence: 40, taux_commission: 5, tva: 20 });
  const [periode, setPeriode] = useState('all');

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'commission_rates').single().then(({ data }) => {
      if (data?.value) setRates(prev => ({ ...prev, ...data.value }));
    });
  }, []);

  const commerciaux = allProfiles.filter(p =>
    ['Thomas', 'Lucas', 'Philippe'].includes(p.prenom)
  );

  function isInPeriode(mandatDate, periode) {
    if (periode === 'all') return true;
    if (!mandatDate) return false;
    const date = new Date(mandatDate);
    const now = new Date();
    if (periode === 'month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (periode === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      const dq = Math.floor(date.getMonth() / 3);
      return dq === q && date.getFullYear() === now.getFullYear();
    }
    if (periode === 'year') {
      return date.getFullYear() === now.getFullYear();
    }
    return true;
  }

  const mandatsFiltres = mandats.filter(m => isInPeriode(m.createdAt || m.created_at, periode));
  const mandatsActifs = mandatsFiltres.filter(m => !['Perdu', 'Vendu par autres'].includes(m.statut));

  function commissionMandat(m) {
    const prixTTC = parseFloat(m.prix) || 0;
    const prixHT = prixTTC / (1 + rates.tva / 100);
    return prixHT * (rates.taux_commission / 100);
  }

  const caGlobal = mandatsActifs.reduce((sum, m) => sum + (parseFloat(m.prix) || 0), 0);
  const commissionEncaissee = mandatsFiltres.filter(m => m.statut === 'Acte').reduce((sum, m) => sum + commissionMandat(m), 0);
  const commissionEnCours = mandatsFiltres.filter(m => m.statut === 'Promesse').reduce((sum, m) => sum + commissionMandat(m), 0);
  const commissionPotentielle = mandatsFiltres.filter(m => m.statut === 'Offre').reduce((sum, m) => sum + commissionMandat(m), 0);

  const STATUTS_PIPELINE = ['Sourcing', 'Analyse', 'Mandat signe', 'Commercialisation', 'Offre', 'Promesse', 'Acte'];
  const STATUTS_PIPELINE_BDD = ['Sourcing', 'Analyse', 'Mandat signé', 'Commercialisation', 'Offre', 'Promesse', 'Acte'];
  const pipelineParStatut = STATUTS_PIPELINE_BDD.map((statut, idx) => {
    const m = mandatsFiltres.filter(m => m.statut === statut);
    return {
      statut,
      labelDisplay: STATUTS_PIPELINE[idx],
      count: m.length,
      ca: m.reduce((sum, x) => sum + (parseFloat(x.prix) || 0), 0),
      commission: m.reduce((sum, x) => sum + commissionMandat(x), 0),
    };
  });

  const perfParCommercial = commerciaux.map(p => {
    const mandatsAsPourvoyeur = mandatsActifs.filter(m => m.pourvoyeurId === p.id);
    const mandatsAsVendeur = mandatsActifs.filter(m => m.vendeurId === p.id);
    let partTotal = 0;
    let partEncaissee = 0;
    mandatsActifs.forEach(m => {
      const comm = commissionMandat(m);
      const isPourvoyeur = m.pourvoyeurId === p.id;
      const isVendeur = m.vendeurId === p.id;
      let partMandat = 0;
      if (isPourvoyeur) partMandat += comm * (rates.pourvoyeur / 100);
      if (isVendeur) partMandat += comm * (rates.vendeur / 100);
      partTotal += partMandat;
      if (m.statut === 'Acte') partEncaissee += partMandat;
    });
    const tachesEnCours = (todos || []).filter(t =>
      t.assignedToUserId === p.id && t.statut !== 'Fait' && t.statut !== 'Termine' && t.statut !== 'Terminé'
    ).length;
    return {
      profile: p,
      nbMandatsPourvoyeur: mandatsAsPourvoyeur.length,
      nbMandatsVendeur: mandatsAsVendeur.length,
      partTotal,
      partEncaissee,
      tachesEnCours,
    };
  });
  perfParCommercial.sort((a, b) => b.partTotal - a.partTotal);

  const topAffaires = mandatsFiltres
    .filter(m => ['Promesse', 'Offre'].includes(m.statut))
    .map(m => {
      const pourv = allProfiles.find(p => p.id === m.pourvoyeurId);
      const vend = m.vendeurId ? allProfiles.find(p => p.id === m.vendeurId) : null;
      return {
        ...m,
        commission: commissionMandat(m),
        pourvoyeurNom: pourv ? `${pourv.prenom} ${pourv.nom}` : '-',
        vendeurNom: vend ? `${vend.prenom} ${vend.nom}` : null,
      };
    })
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 5);

  const STATUT_COLORS = {
    'Sourcing': 'bg-stone-100 text-stone-700',
    'Analyse': 'bg-blue-50 text-blue-700',
    'Mandat signé': 'bg-cyan-50 text-cyan-700',
    'Mandat signe': 'bg-cyan-50 text-cyan-700',
    'Commercialisation': 'bg-amber-50 text-amber-700',
    'Offre': 'bg-purple-50 text-purple-700',
    'Promesse': 'bg-indigo-50 text-indigo-700',
    'Acte': 'bg-emerald-50 text-emerald-700',
  };

  const PERIODES = [
    { id: 'month', label: 'Ce mois' },
    { id: 'quarter', label: 'Ce trimestre' },
    { id: 'year', label: 'Cette annee' },
    { id: 'all', label: 'Tout' },
  ];

  const periodeLabel = PERIODES.find(p => p.id === periode)?.label || 'Tout';

  return (
    <div className="p-6 max-w-none">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-stone-900 mb-1">Dashboard Direction</h1>
          <p className="text-stone-500 text-sm">Vue 360 de l'activite - {commerciaux.length} commerciaux &middot; {mandatsActifs.length} mandats actifs &middot; <span className="font-medium text-stone-700">{periodeLabel}</span></p>
        </div>
        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
          {PERIODES.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriode(p.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                periode === p.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {(() => {
        const now = new Date();
        const j30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const j15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

        const mandatsInactifs = mandatsActifs.filter(m => {
          const updatedAt = m.updatedAt || m.updated_at || m.createdAt || m.created_at;
          if (!updatedAt) return false;
          if (new Date(updatedAt) > j30) return false;
          const tachesMandat = (todos || []).filter(t =>
            t.lienType === 'mandat' && t.lienId === m.id &&
            t.createdAt && new Date(t.createdAt) > j30
          );
          return tachesMandat.length === 0;
        });

        const tachesEnRetard = (todos || []).filter(t => {
          if (t.statut === 'Fait' || t.statut === 'Termine' || t.statut === 'Terminé') return false;
          if (!t.echeance) return false;
          return new Date(t.echeance) < now;
        });

        const tachesSansEcheance = (todos || []).filter(t =>
          t.statut !== 'Fait' && t.statut !== 'Termine' && t.statut !== 'Terminé' && !t.echeance
        );

        const mandatsEcheanceProche = mandatsActifs.filter(m => {
          const ech = m.mandatDateEcheance || m.mandat_date_echeance;
          if (!ech) return false;
          const echDate = new Date(ech);
          return echDate > now && echDate < j15;
        });

        const mandatsIncomplets = mandatsActifs.filter(m => {
          const sansPhoto = !m.photos || m.photos.length === 0;
          const sansDesc = !m.description || m.description.trim().length < 50;
          return sansPhoto || sansDesc;
        });

        const alertes = [
          { count: mandatsInactifs.length, label: 'Mandats sans activite', sub: 'Pas de tache ni mise a jour depuis 30 jours', color: 'from-amber-50 to-amber-100 border-amber-200 text-amber-900', items: mandatsInactifs.slice(0, 3).map(m => m.nom) },
          { count: tachesEnRetard.length, label: 'Taches en retard', sub: 'Echeance depassee', color: 'from-red-50 to-red-100 border-red-200 text-red-900', items: tachesEnRetard.slice(0, 3).map(t => t.titre) },
          { count: tachesSansEcheance.length, label: 'Taches sans echeance', sub: 'A planifier', color: 'from-stone-50 to-stone-100 border-stone-200 text-stone-900', items: tachesSansEcheance.slice(0, 3).map(t => t.titre) },
          { count: mandatsEcheanceProche.length, label: 'Mandats expirent bientot', sub: 'Echeance dans moins de 15 jours', color: 'from-orange-50 to-orange-100 border-orange-200 text-orange-900', items: mandatsEcheanceProche.slice(0, 3).map(m => m.nom) },
          { count: mandatsIncomplets.length, label: 'Fiches mandat incompletes', sub: 'Sans photo ou description courte', color: 'from-blue-50 to-blue-100 border-blue-200 text-blue-900', items: mandatsIncomplets.slice(0, 3).map(m => m.nom) },
        ];

        const totalAlertes = alertes.reduce((s, a) => s + a.count, 0);

        if (totalAlertes === 0) {
          return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <div>
                <div className="font-medium text-emerald-900">Tout est sous controle</div>
                <div className="text-xs text-emerald-700">Aucune alerte active a signaler</div>
              </div>
            </div>
          );
        }

        return (
          <div className="mb-6">
            <h2 className="font-display text-lg font-semibold text-stone-900 mb-3 flex items-center gap-2">
              Points d'attention
              <span className="text-xs font-normal bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{totalAlertes}</span>
            </h2>
            <div className="grid grid-cols-5 gap-3">
              {alertes.map((a, i) => (
                <div key={i} className={`bg-gradient-to-br ${a.color} border rounded-xl p-3 ${a.count === 0 ? 'opacity-40' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-2xl font-semibold">{a.count}</span>
                  </div>
                  <div className="text-xs font-medium leading-tight">{a.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{a.sub}</div>
                  {a.count > 0 && a.items.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-current/10 text-[10px] space-y-0.5 opacity-80">
                      {a.items.map((item, j) => (
                        <div key={j} className="truncate">- {item}</div>
                      ))}
                      {a.count > 3 && <div className="italic">+ {a.count - 3} autre{a.count - 3 > 1 ? 's' : ''}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-luxe">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">CA portefeuille</div>
          <div className="text-2xl font-semibold text-stone-900">{formatPrixCompact(caGlobal)}</div>
          <div className="text-xs text-stone-500 mt-1">{mandatsActifs.length} mandats actifs &middot; TTC</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200 shadow-luxe">
          <div className="text-xs uppercase tracking-wide text-emerald-700 mb-1">Encaisse</div>
          <div className="text-2xl font-semibold text-emerald-900">{formatPrixCompact(commissionEncaissee)}</div>
          <div className="text-xs text-emerald-700 mt-1">Mandats a l'Acte</div>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-5 border border-indigo-200 shadow-luxe">
          <div className="text-xs uppercase tracking-wide text-indigo-700 mb-1">En cours</div>
          <div className="text-2xl font-semibold text-indigo-900">{formatPrixCompact(commissionEnCours)}</div>
          <div className="text-xs text-indigo-700 mt-1">Mandats a la Promesse</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200 shadow-luxe">
          <div className="text-xs uppercase tracking-wide text-purple-700 mb-1">Potentiel</div>
          <div className="text-2xl font-semibold text-purple-900">{formatPrixCompact(commissionPotentielle)}</div>
          <div className="text-xs text-purple-700 mt-1">Mandats a l'Offre</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-luxe border border-stone-200 p-5 mb-6">
        <h2 className="font-display text-lg font-semibold text-stone-900 mb-4">Pipeline commercial</h2>
        <div className="grid grid-cols-7 gap-2">
          {pipelineParStatut.map(({ statut, labelDisplay, count, ca }) => (
            <div key={statut} className={`rounded-lg p-3 ${STATUT_COLORS[statut] || 'bg-stone-100'}`}>
              <div className="text-[10px] uppercase tracking-wide opacity-70">{labelDisplay}</div>
              <div className="text-2xl font-semibold mt-0.5">{count}</div>
              {count > 0 && (
                <div className="text-[10px] mt-1 opacity-70">
                  {formatPrixCompact(ca)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-hidden mb-6">
        <div className="p-5 border-b border-stone-200">
          <h2 className="font-display text-lg font-semibold text-stone-900">Performances commerciaux</h2>
          <p className="text-xs text-stone-500 mt-1">Tries par part personnelle &middot; {periodeLabel}</p>
        </div>
        <table className="w-full">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Commercial</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Pourvoyeur</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Vendeur</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Taches</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Encaisse</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Total</th>
            </tr>
          </thead>
          <tbody>
            {perfParCommercial.map((perf, i) => (
              <tr key={perf.profile.id} className="border-t border-stone-100 hover:bg-stone-50/50">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-stone-900">{i + 1}. {perf.profile.prenom} {perf.profile.nom}</div>
                </td>
                <td className="text-center px-3 py-3 text-sm text-stone-700">{perf.nbMandatsPourvoyeur}</td>
                <td className="text-center px-3 py-3 text-sm text-stone-700">{perf.nbMandatsVendeur}</td>
                <td className="text-center px-3 py-3 text-sm">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${perf.tachesEnCours > 5 ? 'bg-red-50 text-red-700' : perf.tachesEnCours > 2 ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-600'}`}>
                    {perf.tachesEnCours}
                  </span>
                </td>
                <td className="text-right px-4 py-3 text-sm font-medium text-emerald-700">{formatPrixCompact(perf.partEncaissee)}</td>
                <td className="text-right px-4 py-3 text-sm font-semibold text-stone-900">{formatPrixCompact(perf.partTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-hidden">
        <div className="p-5 border-b border-stone-200">
          <h2 className="font-display text-lg font-semibold text-stone-900">Top affaires en cours</h2>
          <p className="text-xs text-stone-500 mt-1">Mandats a l'Offre ou a la Promesse &middot; {periodeLabel}</p>
        </div>
        {topAffaires.length === 0 ? (
          <div className="p-12 text-center text-stone-400 text-sm">Aucune affaire en cours sur cette periode</div>
        ) : (
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Mandat</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Statut</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Pourvoyeur</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Vendeur</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Prix TTC</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Commission</th>
              </tr>
            </thead>
            <tbody>
              {topAffaires.map(m => (
                <tr key={m.id} className="border-t border-stone-100 hover:bg-stone-50/50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-stone-900 truncate max-w-md">{m.nom}</div>
                    <div className="text-xs text-stone-500">{m.adresse}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUT_COLORS[m.statut]}`}>{m.statut}</span>
                  </td>
                  <td className="px-3 py-3 text-sm text-stone-700">{m.pourvoyeurNom}</td>
                  <td className="px-3 py-3 text-sm text-stone-700">{m.vendeurNom || <span className="text-stone-400 italic">-</span>}</td>
                  <td className="text-right px-4 py-3 text-sm text-stone-700">{formatPrixCompact(parseFloat(m.prix) || 0)}</td>
                  <td className="text-right px-4 py-3 text-sm font-semibold text-emerald-700">{formatPrixCompact(m.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ReglagesSection rates={rates} setRates={setRates} userId={user?.id} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RemunerationTab - Page Remuneration : commissions par commercial
// ═══════════════════════════════════════════════════════════════════
export function RemunerationTab({ mandats, allProfiles = [] }) {
  const { user, profile } = useAuth();
  const [rates, setRates] = useState({ pourvoyeur: 30, vendeur: 30, agence: 40, taux_commission: 5, tva: 20 });
  const [selectedUserId, setSelectedUserId] = useState(null);

  const isManagerLocal = profile?.role === 'admin' || profile?.role === 'directeur' ||
    (profile?.prenom === 'Thomas' && (profile?.nom === 'Ezquerra' || profile?.nom === 'Boggiani'));

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'commission_rates').single().then(({ data }) => {
      if (data?.value) {
        setRates(prev => ({ ...prev, ...data.value }));
      }
    });
  }, []);

  useEffect(() => {
    if (user && !selectedUserId) setSelectedUserId(user.id);
  }, [user, selectedUserId]);

  if (!selectedUserId) return <div className="p-8">Chargement...</div>;

  const targetProfile = allProfiles.find(p => p.id === selectedUserId);
  const isMe = selectedUserId === user?.id;

  const myMandats = mandats.filter(m =>
    m.pourvoyeurId === selectedUserId || m.vendeurId === selectedUserId
  );

  function computeCommission(m) {
    const prixTTC = parseFloat(m.prix) || 0;
    const prixHT = prixTTC / (1 + rates.tva / 100);
    const commissionAgence = prixHT * (rates.taux_commission / 100);
    const isPourvoyeur = m.pourvoyeurId === selectedUserId;
    const isVendeur = m.vendeurId === selectedUserId;
    let partPerso = 0;
    if (isPourvoyeur) partPerso += commissionAgence * (rates.pourvoyeur / 100);
    if (isVendeur) partPerso += commissionAgence * (rates.vendeur / 100);
    return { prixTTC, prixHT, commissionAgence, partPerso, isPourvoyeur, isVendeur };
  }

  const STATUTS_ENCAISSE = ['Acte'];
  const STATUTS_EN_COURS = ['Promesse'];
  const STATUTS_POTENTIEL = ['Offre'];
  const STATUTS_ALL = [...STATUTS_ENCAISSE, ...STATUTS_EN_COURS, ...STATUTS_POTENTIEL];

  const filteredMandats = myMandats.filter(m => STATUTS_ALL.includes(m.statut));

  let caTotal = 0;
  let commissionAgence = 0;
  let partEncaisse = 0;
  let partEnCours = 0;
  let partPotentiel = 0;

  for (const m of filteredMandats) {
    const calc = computeCommission(m);
    caTotal += calc.prixTTC;
    commissionAgence += calc.commissionAgence;
    if (STATUTS_ENCAISSE.includes(m.statut)) partEncaisse += calc.partPerso;
    if (STATUTS_EN_COURS.includes(m.statut)) partEnCours += calc.partPerso;
    if (STATUTS_POTENTIEL.includes(m.statut)) partPotentiel += calc.partPerso;
  }

  const partTotal = partEncaisse + partEnCours + partPotentiel;

  const statutColor = {
    'Acte': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Promesse': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Offre': 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className="p-6 max-w-none">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-semibold text-stone-900">Remuneration</h1>
          {targetProfile && (
            <span className="text-stone-500 text-sm">
              {isMe ? 'Mes commissions' : `${targetProfile.prenom} ${targetProfile.nom}`}
            </span>
          )}
        </div>

        {isManagerLocal && (
          <select
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value)}
            className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900"
          >
            {allProfiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.prenom} {p.nom}{p.id === user?.id ? ' (moi)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-4 p-3 bg-stone-50 border border-stone-200 rounded-lg flex items-center gap-4 text-xs text-stone-600 flex-wrap">
        <span>Calcul :</span>
        <span>Prix TTC / {(1 + rates.tva / 100).toFixed(2)} = HT</span>
        <span>&middot; Commission agence = HT x {rates.taux_commission}%</span>
        <span>&middot; Repartition : Pourvoyeur {rates.pourvoyeur}% + Vendeur {rates.vendeur}% + Agence {rates.agence}%</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-luxe">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">CA total participe</div>
          <div className="text-2xl font-semibold text-stone-900">{formatPrixCompact(caTotal)}</div>
          <div className="text-xs text-stone-500 mt-1">{filteredMandats.length} mandat{filteredMandats.length > 1 ? 's' : ''} &middot; TTC</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-luxe">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">Commission agence ({rates.taux_commission}% HT)</div>
          <div className="text-2xl font-semibold text-stone-900">{formatPrixCompact(commissionAgence)}</div>
          <div className="text-xs text-stone-500 mt-1">a partager 30/30/40</div>
        </div>
        <div className="bg-gradient-to-br from-sage-50 to-sage-100 rounded-xl p-5 border border-sage-200 shadow-luxe">
          <div className="text-xs uppercase tracking-wide text-sage-darker mb-1">Ma part (total)</div>
          <div className="text-2xl font-semibold text-sage-darker">{formatPrixCompact(partTotal)}</div>
          <div className="text-xs text-sage-dark mt-1">
            <span className="text-emerald-700 font-medium">{formatPrixCompact(partEncaisse)} encaisse</span>
            {' '}&middot;{' '}
            <span>{formatPrixCompact(partEnCours)} en cours</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Mandat</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Statut</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Mon role</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Prix TTC</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Commission ({rates.taux_commission}% HT)</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Ma part</th>
            </tr>
          </thead>
          <tbody>
            {filteredMandats.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-stone-500 text-sm">Aucun mandat eligible (Acte / Promesse / Offre)</td>
              </tr>
            ) : (
              filteredMandats.map(m => {
                const calc = computeCommission(m);
                const isPotentiel = STATUTS_POTENTIEL.includes(m.statut);
                const isEncaisse = STATUTS_ENCAISSE.includes(m.statut);
                return (
                  <tr key={m.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-stone-900 truncate max-w-md">{m.nom}</div>
                      <div className="text-xs text-stone-500 truncate">{m.adresse}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statutColor[m.statut] || 'bg-stone-100 text-stone-700 border-stone-200'}`}>{m.statut}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {calc.isPourvoyeur && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">Pourvoyeur</span>}
                        {calc.isVendeur && <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded-full border border-amber-200">Vendeur</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-stone-700">{formatPrixCompact(calc.prixTTC)}</td>
                    <td className="px-3 py-2 text-right text-sm text-stone-700">{formatPrixCompact(calc.commissionAgence)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className={`text-sm font-semibold ${isEncaisse ? 'text-emerald-700' : isPotentiel ? 'text-stone-400' : 'text-stone-900'}`}>
                        {formatPrixCompact(calc.partPerso)}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {filteredMandats.length > 0 && (
            <tfoot className="bg-stone-50 border-t-2 border-stone-200">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-stone-900">TOTAL</td>
                <td className="px-3 py-2 text-right text-sm font-semibold text-stone-900">{formatPrixCompact(caTotal)}</td>
                <td className="px-3 py-2 text-right text-sm font-semibold text-stone-900">{formatPrixCompact(commissionAgence)}</td>
                <td className="px-3 py-2 text-right text-sm font-semibold text-sage-darker">{formatPrixCompact(partTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
