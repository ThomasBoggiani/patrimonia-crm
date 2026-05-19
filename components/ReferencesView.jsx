// ═══════════════════════════════════════════════════════════════════
// components/ReferencesView.jsx
// 3e mode d'affichage dans l'onglet Mandats : bibliothèque de références
// ═══════════════════════════════════════════════════════════════════

'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Edit2, Trash2, Eye, EyeOff, Upload, Download, 
  Building2, MapPin, Calendar, Trophy, X, Loader2, FileSpreadsheet
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { 
  TYPOLOGIES_REFERENCE, 
  TRANCHES_PRIX_REFERENCE, 
  getTrancheFromPrix,
  getTypologieLabel,
  getTrancheLabel,
  getTypologieIcon
} from '@/lib/references-constants';
import { formatPrix, formatPrixCompact, toCamel, toSnake } from '@/lib/crm-constants';
import ReferenceForm from './ReferenceForm';
import ReferencesImportModal from './ReferencesImportModal';
import ReferencesImportFromSiteModal from './ReferencesImportFromSiteModal';

export default function ReferencesView() {
  const { user } = useAuth();
  const [references, setReferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTypologies, setFilterTypologies] = useState([]); // multi
  const [filterTranche, setFilterTranche] = useState('Tous');
  const [showConfidentiels, setShowConfidentiels] = useState(false);
  const [editingRef, setEditingRef] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showImportFromSite, setShowImportFromSite] = useState(false);

  useEffect(() => { loadReferences(); }, []);

  async function loadReferences() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('references_ventes')
        .select('*')
        .eq('actif', true)
        .order('date_vente', { ascending: false, nullsLast: true });
      if (!error) setReferences((data || []).map(toCamel));
    } catch (e) {
      console.error('Erreur chargement références:', e);
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return references.filter(r => {
      if (!showConfidentiels && r.confidentiel) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.nom || ''} ${r.adresse || ''} ${r.ville || ''} ${r.arrondissement || ''} ${r.commentaireCommercial || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterTypologies.length > 0) {
        const refTypos = r.typologies || [];
        const hasMatch = filterTypologies.some(t => refTypos.includes(t));
        if (!hasMatch) return false;
      }
      if (filterTranche !== 'Tous' && r.tranchePrix !== filterTranche) return false;
      return true;
    });
  }, [references, search, filterTypologies, filterTranche, showConfidentiels]);

  // Matrice de couverture pour aider à voir où il manque des références
  const couvertureMatrice = useMemo(() => {
    const matrice = {};
    for (const typo of TYPOLOGIES_REFERENCE) {
      matrice[typo.value] = {};
      for (const tr of TRANCHES_PRIX_REFERENCE) {
        matrice[typo.value][tr.value] = 0;
      }
    }
    for (const r of references) {
      if (r.confidentiel) continue;
      const typos = r.typologies || [];
      for (const t of typos) {
        if (matrice[t] && matrice[t][r.tranchePrix] !== undefined) {
          matrice[t][r.tranchePrix]++;
        }
      }
    }
    return matrice;
  }, [references]);

  const handleSave = async (refData) => {
    const snake = toSnake(refData);
    delete snake.created_at;
    delete snake.updated_at;
    delete snake.prix_m2; // calculé par trigger
    
    // Déduire la tranche de prix automatiquement
    if (snake.prix_vente && !snake.tranche_prix) {
      snake.tranche_prix = getTrancheFromPrix(parseFloat(snake.prix_vente));
    }
    
    try {
      if (refData.id) {
        snake.updated_by = user?.id;
        await supabase.from('references_ventes').update(snake).eq('id', refData.id);
      } else {
        delete snake.id;
        snake.created_by = user?.id;
        await supabase.from('references_ventes').insert(snake);
      }
      setEditingRef(null);
      setShowNew(false);
      loadReferences();
    } catch (e) {
      alert('Erreur sauvegarde : ' + e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette référence ? (Soft-delete : elle sera désactivée)')) return;
    await supabase.from('references_ventes').update({ actif: false }).eq('id', id);
    loadReferences();
  };

  const toggleConfidentiel = async (ref) => {
    await supabase
      .from('references_ventes')
      .update({ confidentiel: !ref.confidentiel })
      .eq('id', ref.id);
    loadReferences();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-sage-dark" />
      </div>
    );
  }

  return (
    <div>
      {/* Barre d'actions */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="text-sm text-stone-600">
          <span className="font-medium">{filtered.length}</span> référence{filtered.length > 1 ? 's' : ''}
          {filtered.length !== references.length && (
            <span className="text-stone-400"> sur {references.length} au total</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => setShowImportFromSite(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-sage-50 border border-sage-light text-sage-darker rounded-lg hover:bg-sage-100"
            title="Scrape automatiquement les ventes du site immeubles-patrimoine.fr"
          >
            🌐 Importer depuis le site I&P
          </button>
          <button 
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-cream-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Importer Excel
          </button>
          <button 
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-3 py-2 bg-ink-deep text-white rounded-lg hover:bg-stone-800 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nouvelle référence
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-cream-50 rounded-xl p-4 mb-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 relative min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Rechercher (nom, adresse, commentaire…)" 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" 
            />
          </div>
          <select 
            value={filterTranche} 
            onChange={e => setFilterTranche(e.target.value)} 
            className="px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900"
          >
            <option>Tous</option>
            {TRANCHES_PRIX_REFERENCE.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm cursor-pointer">
            <input 
              type="checkbox" 
              checked={showConfidentiels} 
              onChange={e => setShowConfidentiels(e.target.checked)} 
            />
            <span>Inclure confidentielles</span>
          </label>
        </div>

        {/* Typologies (multi-select pills) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-stone-500 mr-1">Typologies :</span>
          {TYPOLOGIES_REFERENCE.map(t => {
            const isActive = filterTypologies.includes(t.value);
            return (
              <button
                key={t.value}
                onClick={() => {
                  if (isActive) setFilterTypologies(filterTypologies.filter(x => x !== t.value));
                  else setFilterTypologies([...filterTypologies, t.value]);
                }}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  isActive 
                    ? 'bg-sage-100 text-sage-darker border-sage-light font-medium' 
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {t.icon} {t.label}
              </button>
            );
          })}
          {filterTypologies.length > 0 && (
            <button 
              onClick={() => setFilterTypologies([])}
              className="text-xs text-stone-400 hover:text-stone-700 underline"
            >
              Tout désélectionner
            </button>
          )}
        </div>
      </div>

      {/* Matrice de couverture (compacte) */}
      {references.length > 0 && (
        <details className="mb-4 bg-cream-50/50 rounded-xl border border-cream-dark overflow-hidden">
          <summary className="px-4 py-2.5 text-xs font-medium text-stone-700 cursor-pointer hover:bg-cream-100">
            📊 Matrice de couverture (typologies × tranches de prix)
          </summary>
          <div className="p-3 overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1 font-medium text-stone-600">Typologie</th>
                  {TRANCHES_PRIX_REFERENCE.map(t => (
                    <th key={t.value} className="text-center px-2 py-1 font-medium text-stone-600 min-w-[80px]">{t.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TYPOLOGIES_REFERENCE.map(typo => (
                  <tr key={typo.value} className="border-t border-cream-dark/30">
                    <td className="px-2 py-1.5 text-stone-700">{typo.icon} {typo.label}</td>
                    {TRANCHES_PRIX_REFERENCE.map(tr => {
                      const count = couvertureMatrice[typo.value]?.[tr.value] || 0;
                      const cls = count === 0 ? 'text-stone-300' : count === 1 ? 'text-amber-600' : 'text-emerald-700 font-medium';
                      return (
                        <td key={tr.value} className={`text-center px-2 py-1.5 ${cls}`}>
                          {count > 0 ? count : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-stone-400 mt-2 italic">
              Cible recommandée : au moins 2 références par case active (vert).
            </p>
          </div>
        </details>
      )}

      {/* Grille de références */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-stone-500 border border-cream-dark">
          {references.length === 0 ? (
            <>
              <Trophy className="w-12 h-12 mx-auto mb-3 text-stone-300" />
              <p className="text-sm mb-3">Aucune référence pour le moment</p>
              <p className="text-xs text-stone-400 mb-4">Ajoute tes plus belles ventes pour qu'elles apparaissent dans les avis de valeur</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <button onClick={() => setShowImportFromSite(true)} className="px-4 py-2 bg-sage-100 border border-sage-light text-sage-darker rounded-lg text-sm hover:bg-sage-200 font-medium">
                  🌐 Importer depuis le site I&P
                </button>
                <button onClick={() => setShowImport(true)} className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm hover:bg-cream-50">
                  Importer Excel
                </button>
                <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm">
                  Ajouter manuellement
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm">Aucune référence ne correspond aux filtres</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <ReferenceCard 
              key={r.id} 
              reference={r} 
              onEdit={() => setEditingRef(r)} 
              onDelete={() => handleDelete(r.id)} 
              onToggleConfidentiel={() => toggleConfidentiel(r)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {(editingRef || showNew) && (
        <ReferenceForm
          reference={editingRef}
          onSave={handleSave}
          onClose={() => { setEditingRef(null); setShowNew(false); }}
        />
      )}
      {showImport && (
        <ReferencesImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); loadReferences(); }}
        />
      )}
      {showImportFromSite && (
        <ReferencesImportFromSiteModal
          onClose={() => setShowImportFromSite(false)}
          onImported={() => { setShowImportFromSite(false); loadReferences(); }}
        />
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════
// ReferenceCard — Une carte de référence dans la grille
// ═══════════════════════════════════════════════════════════════════
function ReferenceCard({ reference: r, onEdit, onDelete, onToggleConfidentiel }) {
  const cover = (r.medias || []).find(m => m.type === 'photo' && m.isCover)?.url 
             || (r.medias || []).find(m => m.type === 'photo')?.url;
  const typos = r.typologies || [];

  return (
    <div className={`bg-white rounded-xl shadow-luxe border border-cream-dark overflow-hidden hover:shadow-luxe-hover transition-shadow ${r.confidentiel ? 'opacity-70' : ''}`}>
      {/* Photo */}
      <div className="aspect-[4/3] bg-cream-100 relative">
        {cover ? (
          <img src={cover} alt={r.nom} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cream-100 to-cream-200">
            <Building2 className="w-10 h-10 text-stone-300" />
          </div>
        )}
        {r.confidentiel && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-stone-900/80 text-white text-[10px] rounded-full flex items-center gap-1">
            <EyeOff className="w-2.5 h-2.5" /> Confidentielle
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          <button 
            onClick={onToggleConfidentiel}
            className="p-1.5 bg-white/90 hover:bg-white rounded text-stone-600 hover:text-stone-900"
            title={r.confidentiel ? 'Rendre visible' : 'Rendre confidentielle'}
          >
            {r.confidentiel ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={onEdit}
            className="p-1.5 bg-white/90 hover:bg-white rounded text-stone-600 hover:text-stone-900"
            title="Modifier"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={onDelete}
            className="p-1.5 bg-white/90 hover:bg-white rounded text-stone-600 hover:text-red-600"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Nom + adresse */}
        <div className="mb-2">
          <h3 className="font-medium text-stone-900 text-sm leading-tight mb-1">{r.nom}</h3>
          {r.adresse && (
            <p className="text-xs text-stone-500 flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{r.adresse}</span>
            </p>
          )}
        </div>

        {/* Typologies (pills) */}
        {typos.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {typos.map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-sage-50 text-sage-darker rounded-full border border-sage-light">
                {getTypologieIcon(t)} {getTypologieLabel(t)}
              </span>
            ))}
          </div>
        )}

        {/* Prix + surface */}
        <div className="flex items-baseline justify-between mb-2">
          <div className="font-display text-lg font-semibold text-stone-900">
            {formatPrixCompact(r.prixVente)}
          </div>
          {r.surface && (
            <div className="text-xs text-stone-500">
              {r.surface} m² · {r.prixM2 ? `${parseInt(r.prixM2).toLocaleString('fr-FR')} €/m²` : '—'}
            </div>
          )}
        </div>

        {/* Date + acquéreur */}
        <div className="flex items-center gap-3 text-xs text-stone-500 mb-2">
          {r.dateVente && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(r.dateVente).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
            </span>
          )}
          {r.typeAcquereur && (
            <span className="truncate">{r.typeAcquereur}</span>
          )}
        </div>

        {/* Commentaire commercial */}
        {r.commentaireCommercial && (
          <p className="text-xs text-stone-600 italic line-clamp-2 border-l-2 border-sage-light pl-2 mt-2">
            {r.commentaireCommercial}
          </p>
        )}
      </div>
    </div>
  );
}
