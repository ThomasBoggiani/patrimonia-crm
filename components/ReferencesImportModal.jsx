// ═══════════════════════════════════════════════════════════════════
// components/ReferencesImportFromSiteModal.jsx (v2 - gestion erreurs)
// ═══════════════════════════════════════════════════════════════════

'use client';
import React, { useState } from 'react';
import { X, Globe, Check, AlertCircle, Loader2, Building2, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getTypologieIcon, getTypologieLabel } from '@/lib/references-constants';

// Helper : parser une réponse en JSON même si le serveur renvoie du HTML d'erreur
async function safeJsonParse(res) {
  const text = await res.text();
  try {
    return { ok: true, data: JSON.parse(text), status: res.status };
  } catch (e) {
    // Pas du JSON : on extrait le 1er bout de texte lisible
    const preview = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
    return { 
      ok: false, 
      error: `Serveur a renvoyé du non-JSON (HTTP ${res.status}). Aperçu: "${preview}..."`,
      status: res.status,
      rawPreview: preview
    };
  }
}

export default function ReferencesImportFromSiteModal({ onClose, onImported }) {
  const [step, setStep] = useState('intro');
  const [fiches, setFiches] = useState([]);
  const [selectedUrls, setSelectedUrls] = useState(new Set());
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState(null);

  async function startPreview() {
    setStep('loading-preview');
    setErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setErrorMsg('Session expirée. Reconnecte-toi.'); setStep('error'); return; }

      const res = await fetch('/api/references/import-from-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, mode: 'preview' }),
      });

      const parsed = await safeJsonParse(res);
      
      if (!parsed.ok) {
        // Erreur côté serveur (HTML, 500, timeout, etc.)
        if (parsed.status === 504 || parsed.status === 524) {
          setErrorMsg(`Timeout serveur (HTTP ${parsed.status}). Le scraping prend trop de temps. Réessaye dans quelques secondes.`);
        } else if (parsed.status >= 500) {
          setErrorMsg(`Erreur serveur (HTTP ${parsed.status}). ${parsed.error}`);
        } else {
          setErrorMsg(parsed.error);
        }
        setStep('error');
        return;
      }

      if (!parsed.data.ok) {
        setErrorMsg(parsed.data.error || 'Erreur inconnue côté serveur');
        setStep('error');
        return;
      }

      const fichesData = parsed.data.fiches || [];
      if (fichesData.length === 0) {
        setErrorMsg('Aucune fiche extraite du site. Le site a peut-être changé de structure.');
        setStep('error');
        return;
      }

      setFiches(fichesData);
      setSelectedUrls(new Set(fichesData.map(f => f.url)));
      setStep('preview');
    } catch (e) {
      setErrorMsg(`Erreur réseau: ${e.message}`);
      setStep('error');
    }
  }

  async function startImport() {
    if (selectedUrls.size === 0) return;
    setStep('importing');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setErrorMsg('Session expirée'); setStep('error'); return; }

      const res = await fetch('/api/references/import-from-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token, 
          mode: 'import',
          selectedUrls: Array.from(selectedUrls)
        }),
      });
      
      const parsed = await safeJsonParse(res);
      if (!parsed.ok) {
        setErrorMsg(parsed.error);
        setStep('error');
        return;
      }
      
      setResult(parsed.data);
      setStep('done');
      
      if (parsed.data.created > 0) {
        setTimeout(() => onImported?.(), 2500);
      }
    } catch (e) {
      setErrorMsg(`Erreur réseau: ${e.message}`);
      setStep('error');
    }
  }

  function toggleSelection(url) {
    const newSet = new Set(selectedUrls);
    if (newSet.has(url)) newSet.delete(url);
    else newSet.add(url);
    setSelectedUrls(newSet);
  }

  function toggleAll() {
    if (selectedUrls.size === fiches.length) setSelectedUrls(new Set());
    else setSelectedUrls(new Set(fiches.map(f => f.url)));
  }

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-4xl w-full max-h-[92vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between p-6 border-b border-stone-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-sage-dark" />
              Importer depuis le site I&P
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">immeubles-patrimoine.fr/dernieres-ventes</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {step === 'intro' && (
            <div className="space-y-4">
              <div className="bg-sage-50 rounded-xl p-5 border border-sage-light">
                <h3 className="text-sm font-medium text-stone-900 mb-2">Comment ça marche</h3>
                <ol className="text-sm text-stone-700 space-y-1.5 list-decimal list-inside">
                  <li>On scanne la page <strong>Dernières ventes</strong> du site I&P</li>
                  <li>On extrait chaque vente (titre, surface, ville, photos)</li>
                  <li>Tu vois la <strong>liste complète</strong> et tu coches ce que tu veux garder</li>
                  <li>On crée les fiches dans le CRM avec les photos téléchargées</li>
                </ol>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 text-xs text-amber-900">
                <strong>⚠️ À noter :</strong> les <strong>prix</strong> et <strong>dates</strong> ne sont pas publiés sur le site. Les références seront créées avec un prix à 0 € : tu compléteras ensuite manuellement.
              </div>
              <button
                onClick={startPreview}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-ink-deep text-white rounded-xl hover:bg-ink font-medium"
              >
                <Globe className="w-4 h-4" />
                Lancer l'analyse du site
              </button>
            </div>
          )}

          {step === 'loading-preview' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-sage-dark mb-4" />
              <h3 className="font-display text-lg font-semibold text-stone-900 mb-1">Analyse en cours...</h3>
              <p className="text-sm text-stone-500">Scan de la page liste + extraction de chaque fiche</p>
              <p className="text-xs text-stone-400 mt-3">⏱️ Compte 30-60 secondes</p>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold text-stone-900">
                    {fiches.length} référence{fiches.length > 1 ? 's' : ''} trouvée{fiches.length > 1 ? 's' : ''}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {selectedUrls.size} sélectionnée{selectedUrls.size > 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={toggleAll} className="text-xs text-sage-dark hover:underline">
                  {selectedUrls.size === fiches.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto scrollbar-thin">
                {fiches.map(f => {
                  const isSelected = selectedUrls.has(f.url);
                  return (
                    <button
                      key={f.url}
                      onClick={() => toggleSelection(f.url)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        isSelected ? 'bg-sage-50 border-sage-light shadow-sm' : 'bg-white border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-cream-100">
                          {f.photos?.[0] ? (
                            <img src={f.photos[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Building2 className="w-6 h-6 text-stone-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelection(f.url)} className="mt-0.5 flex-shrink-0" onClick={e => e.stopPropagation()} />
                            <h4 className="text-sm font-medium text-stone-900 leading-tight line-clamp-2">{f.nom}</h4>
                          </div>
                          {f.ville && (
                            <p className="text-xs text-stone-500 flex items-center gap-1 mt-1 ml-5">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{f.ville}</span>
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 ml-5 flex-wrap">
                            {(f.typologies || []).slice(0, 2).map(t => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-white text-sage-darker rounded-full border border-sage-light">
                                {getTypologieIcon(t)} {getTypologieLabel(t)}
                              </span>
                            ))}
                            {f.surface && <span className="text-[10px] text-stone-500">{f.surface} m²</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-3 border-t border-stone-200">
                <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-stone-700 bg-white border border-stone-200 hover:bg-cream-100 rounded-lg">
                  Annuler
                </button>
                <button onClick={startImport} disabled={selectedUrls.size === 0} className="flex-1 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50">
                  Importer {selectedUrls.size} référence{selectedUrls.size > 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-sage-dark mb-4" />
              <h3 className="font-display text-lg font-semibold text-stone-900 mb-1">Import en cours...</h3>
              <p className="text-sm text-stone-500">Téléchargement des photos + création des fiches</p>
              <p className="text-xs text-stone-400 mt-3">⏱️ Compte ~2-3s par référence</p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-3">
              <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200 text-center">
                <Check className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
                <h3 className="text-base font-medium text-emerald-900 mb-1">
                  {result.created} référence{result.created > 1 ? 's' : ''} importée{result.created > 1 ? 's' : ''}
                </h3>
                {result.errors?.length > 0 && (
                  <p className="text-sm text-amber-700">{result.errors.length} échec{result.errors.length > 1 ? 's' : ''}</p>
                )}
              </div>
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-xs text-amber-900">
                💡 <strong>Prochaine étape :</strong> ouvre chaque référence pour saisir le prix et la date de vente.
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-3">
              <div className="bg-red-50 rounded-xl p-6 border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-red-900 mb-1">Erreur</h3>
                    <p className="text-xs text-red-700 break-words">{errorMsg}</p>
                  </div>
                </div>
              </div>
              <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 text-xs text-stone-600">
                <strong>💡 Que faire ?</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Si "Timeout" : réessaye dans quelques secondes</li>
                  <li>Si "Serveur a renvoyé du non-JSON" : le scraping a planté côté serveur (regarde les logs Vercel)</li>
                  <li>Si "Session expirée" : déconnecte-toi et reconnecte-toi</li>
                </ul>
              </div>
              <button onClick={() => setStep('intro')} className="w-full px-3 py-2 text-sm bg-white border border-red-200 text-red-700 rounded-lg hover:bg-red-100">
                Réessayer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
