'use client';
import React, { useState } from 'react';
import { Sparkles, Loader2, X, Check, AlertCircle, Building2, Users, CheckSquare, RotateCw, FileText, Plus, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const PLACEHOLDER_EXEMPLES = `Collez ici n'importe quel contenu pertinent :

• Une conversation ChatGPT avec des infos sur un bien ou un acquéreur
• Un email reçu (copier le contenu)  
• Une note personnelle ou compte-rendu de RDV
• Une analyse rédigée sur un immeuble
• Un profil d'investisseur que vous avez noté

Claude va détecter ce dont il s'agit, chercher si la fiche existe déjà, 
et vous proposer soit de l'enrichir soit d'en créer une nouvelle.`;

export default function SmartImportModal({ mandats, clients, onClose, onSuccess }) {
  const [step, setStep] = useState('input'); // input | processing | review | saving
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [editedMandat, setEditedMandat] = useState(null);
  const [editedClient, setEditedClient] = useState(null);
  const [selectedActions, setSelectedActions] = useState(new Set());
  const [doMandat, setDoMandat] = useState(true);
  const [doClient, setDoClient] = useState(true);

  const handleFileRead = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['txt', 'md', 'json', 'csv'].includes(ext)) {
      setError("Ce format n'est pas supporté ici. Pour un PDF ou DOCX, utilisez plutôt l'import dédié dans le formulaire « Nouveau mandat » qui sait lire ces documents. Pour un ChatGPT export (.zip), extrayez d'abord les fichiers.");
      return;
    }
    try {
      const content = await file.text();
      setText(content.slice(0, 50000)); // limite raisonnable
    } catch (err) {
      setError("Impossible de lire le fichier : " + err.message);
    }
  };

  const processText = async () => {
    if (text.trim().length < 20) {
      setError("Le contenu est trop court pour être analysé (minimum 20 caractères).");
      return;
    }
    setStep('processing');
    setError(null);
    try {
      const response = await fetch('/api/smart-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          existingMandats: mandats.map(m => ({ id: m.id, nom: m.nom, adresse: m.adresse, ville: m.ville })),
          existingClients: clients.map(c => ({ id: c.id, nom: c.nom, prenom: c.prenom, societe: c.societe }))
        })
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${response.status}`);
      }
      
      const parsed = await response.json();
      setResult(parsed);
      
      // Pré-remplir les données éditables
      if (parsed.mandat?.action === 'update' && parsed.mandat.matchedId) {
        const existing = mandats.find(m => m.id === parsed.mandat.matchedId);
        setEditedMandat({ ...existing, ...Object.fromEntries(
          Object.entries(parsed.mandat.fields || {}).filter(([_, v]) => v !== null && v !== undefined && v !== '')
        )});
      } else if (parsed.mandat?.action === 'create') {
        setEditedMandat({
          nom: '', adresse: '', ville: '', type: "Immeuble d'habitation",
          prix: 0, prixM2: 0, surface: 0, loyersAnnuels: 0, rendement: 0, nbLots: 0,
          contact: '', tel: '', description: '',
          statut: 'Analyse', commercialisation: 'Off-market',
          ...Object.fromEntries(
            Object.entries(parsed.mandat.fields || {}).filter(([_, v]) => v !== null && v !== undefined && v !== '')
          )
        });
      }
      
      if (parsed.client?.action === 'update' && parsed.client.matchedId) {
        const existing = clients.find(c => c.id === parsed.client.matchedId);
        setEditedClient({ ...existing, ...Object.fromEntries(
          Object.entries(parsed.client.fields || {}).filter(([_, v]) => v !== null && v !== undefined && v !== '')
        )});
      } else if (parsed.client?.action === 'create') {
        setEditedClient({
          nom: '', prenom: '', societe: '', tel: '', email: '',
          typologie: 'Foncières', nature: 'Privée',
          budgetMin: 0, budgetMax: 0, rendementMin: 0,
          zones: [], typologiesRecherchees: [],
          statut: 'Actif', maturite: 'Moyen', origine: 'Apporteur', owner: 'TB',
          ...Object.fromEntries(
            Object.entries(parsed.client.fields || {}).filter(([_, v]) => v !== null && v !== undefined && v !== '')
          )
        });
      }

      // Cocher par défaut les actions Haute et Moyenne
      const autoSel = new Set();
      (parsed.actions || []).forEach((a, i) => {
        if (a.priorite === 'Haute' || a.priorite === 'Moyenne') autoSel.add(i);
      });
      setSelectedActions(autoSel);

      // Par défaut on fait ce que Claude propose
      setDoMandat(parsed.mandat?.action !== 'none' && parsed.mandat?.action);
      setDoClient(parsed.client?.action !== 'none' && parsed.client?.action);

      setStep('review');
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de l'analyse");
      setStep('input');
    }
  };

  const saveAll = async () => {
    setStep('saving');
    try {
      const toSnake = (obj) => {
        const r = {};
        for (const k in obj) {
          if (k === 'id' || k === 'createdAt' || k === 'updatedAt' || k === 'created_at' || k === 'updated_at') continue;
          const sk = k.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
          if (obj[k] !== undefined) r[sk] = obj[k];
        }
        return r;
      };
      
      let mandatId = null;
      let clientId = null;
      
      // Mandat
      if (doMandat && result.mandat?.action !== 'none' && editedMandat) {
        if (result.mandat.action === 'update' && result.mandat.matchedId) {
          await supabase.from('mandats').update(toSnake(editedMandat)).eq('id', result.mandat.matchedId);
          mandatId = result.mandat.matchedId;
        } else {
          const data = toSnake(editedMandat);
          data.alerts = result.mandat.alerts || [];
          data.highlights = result.mandat.highlights || [];
          const { data: created } = await supabase.from('mandats').insert(data).select().single();
          if (created) mandatId = created.id;
        }
      }
      
      // Client
      if (doClient && result.client?.action !== 'none' && editedClient) {
        if (result.client.action === 'update' && result.client.matchedId) {
          await supabase.from('clients').update(toSnake(editedClient)).eq('id', result.client.matchedId);
          clientId = result.client.matchedId;
        } else {
          const { data: created } = await supabase.from('clients').insert(toSnake(editedClient)).select().single();
          if (created) clientId = created.id;
        }
        
        // Ajouter interaction datée
        if (clientId && result.client.interaction) {
          await supabase.from('interactions').insert({
            client_id: clientId,
            date: new Date().toISOString().split('T')[0],
            type: result.client.interaction.type || 'Note',
            resume: result.client.interaction.resume || text.slice(0, 300),
            next_step: result.client.interaction.nextStep || null,
            date_next_step: result.client.interaction.dateNextStep || null
          });
        }
      }
      
      // Actions cochées
      const actionsToCreate = (result.actions || []).filter((_, i) => selectedActions.has(i));
      if (actionsToCreate.length > 0) {
        const todosToInsert = actionsToCreate.map(a => {
          const echeance = new Date();
          echeance.setDate(echeance.getDate() + (a.echeanceJours || 7));
          let lien_type = null, lien_id = null;
          if (a.linkedTo === 'mandat' && mandatId) { lien_type = 'mandat'; lien_id = mandatId; }
          else if (a.linkedTo === 'client' && clientId) { lien_type = 'client'; lien_id = clientId; }
          else if (mandatId) { lien_type = 'mandat'; lien_id = mandatId; }
          else if (clientId) { lien_type = 'client'; lien_id = clientId; }
          return {
            titre: a.titre,
            priorite: a.priorite || 'Moyenne',
            statut: 'À faire',
            echeance: echeance.toISOString().split('T')[0],
            lien_type,
            lien_id
          };
        });
        await supabase.from('todos').insert(todosToInsert);
      }
      
      onSuccess({ mandatId, clientId, tasksCreated: actionsToCreate.length });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erreur sauvegarde');
      setStep('review');
    }
  };

  const updateMandat = (k, v) => setEditedMandat(prev => ({ ...prev, [k]: v }));
  const updateClient = (k, v) => setEditedClient(prev => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-cream-dark sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-sage-dark" /> Import intelligent
            </h2>
            <p className="text-xs text-sage-dark mt-0.5">Collez n'importe quel contenu — Claude détecte, classe et propose</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-ink"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          {/* ETAPE 1 : SAISIE */}
          {step === 'input' && (
            <div className="space-y-4">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-sage-dark mb-2">
                  Contenu à analyser
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={PLACEHOLDER_EXEMPLES}
                  rows={14}
                  className="w-full px-4 py-3 border border-cream-dark rounded-lg text-sm font-mono focus:outline-none focus:border-sage resize-y"
                />
                <div className="flex items-center justify-between mt-1.5 text-xs text-stone-500">
                  <span>{text.length} caractères</span>
                  {text.length > 0 && (
                    <button onClick={() => setText('')} className="text-sage-dark hover:underline">Effacer</button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-cream-dark"></div>
                <span className="text-xs text-stone-500 uppercase">ou</span>
                <div className="flex-1 h-px bg-cream-dark"></div>
              </div>

              <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-sage-light rounded-lg cursor-pointer hover:bg-sage-50 text-sm text-ink">
                <FileText className="w-4 h-4" />
                <span>Charger un fichier texte (.txt, .md, .json, .csv)</span>
                <input 
                  type="file" 
                  accept=".txt,.md,.json,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0])}
                />
              </label>
              
              <div className="p-3 rounded-lg bg-cream-100 text-xs text-ink/70 leading-relaxed">
                <div className="font-medium text-ink mb-1 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> À noter</div>
                Pour importer un PDF ou DOCX (plaquette, fiche immeuble), utilisez l'import dédié dans le formulaire « Nouveau mandat ». Cette fenêtre est optimisée pour les textes bruts : conversations, emails, notes.
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-ink/70 hover:bg-cream-100 rounded-lg">Annuler</button>
                <button 
                  onClick={processText}
                  disabled={text.trim().length < 20}
                  className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:bg-stone-300 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" /> Analyser
                </button>
              </div>
            </div>
          )}

          {/* ETAPE 2 : LOADING */}
          {step === 'processing' && (
            <div className="text-center py-16">
              <Loader2 className="w-12 h-12 text-sage-dark animate-spin mx-auto mb-4" />
              <div className="font-display text-lg font-semibold text-ink mb-1">Claude analyse votre contenu</div>
              <div className="text-sm text-sage-dark">Détection du type, recherche de doublons, extraction des informations</div>
            </div>
          )}

          {/* ETAPE 3 : REVIEW */}
          {step === 'review' && result && (
            <div className="space-y-4">
              {/* Bandeau résumé */}
              <div className={`p-4 rounded-xl border ${
                result.primaryType === 'unclear' 
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-sage-50 border-sage-light'
              }`}>
                <div className="flex items-start gap-3">
                  <Sparkles className={`w-5 h-5 flex-shrink-0 mt-0.5 ${result.primaryType === 'unclear' ? 'text-amber-700' : 'text-sage-dark'}`} />
                  <div className="flex-1">
                    <div className={`font-medium text-sm ${result.primaryType === 'unclear' ? 'text-amber-900' : 'text-sage-darker'}`}>
                      {result.primaryType === 'mandat' && '📁 Contenu identifié comme mandat'}
                      {result.primaryType === 'client' && '👤 Contenu identifié comme client'}
                      {result.primaryType === 'both' && '📁 + 👤 Mandat et client détectés'}
                      {result.primaryType === 'unclear' && '⚠️ Contenu ambigu'}
                    </div>
                    <div className={`text-xs mt-0.5 ${result.primaryType === 'unclear' ? 'text-amber-800' : 'text-sage-darker'}`}>
                      {result.summary}
                    </div>
                    {result.confidence && (
                      <div className="text-[10px] mt-1 uppercase tracking-wide text-stone-500">
                        Confiance : {result.confidence === 'high' ? 'Élevée' : result.confidence === 'medium' ? 'Moyenne' : 'Faible'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section mandat */}
              {editedMandat && result.mandat?.action !== 'none' && (
                <div className="border border-cream-dark rounded-xl overflow-hidden">
                  <div className="p-3 bg-cream-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={doMandat} 
                        onChange={e => setDoMandat(e.target.checked)}
                        className="accent-[#5A6948]" 
                      />
                      <Building2 className="w-4 h-4 text-sage-dark" />
                      <span className="text-sm font-medium text-ink">
                        {result.mandat.action === 'update' ? '🔄 Mandat existant à enrichir' : '✨ Nouveau mandat à créer'}
                      </span>
                    </div>
                    {result.mandat.matchConfidence && (
                      <span className="text-[10px] uppercase tracking-wide text-stone-500">
                        Match {result.mandat.matchConfidence}
                      </span>
                    )}
                  </div>
                  {doMandat && (
                    <div className="p-4 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={editedMandat.nom || ''} onChange={e => updateMandat('nom', e.target.value)} placeholder="Nom du bien" className="px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                        <input type="text" value={editedMandat.ville || ''} onChange={e => updateMandat('ville', e.target.value)} placeholder="Ville" className="px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                      </div>
                      <input type="text" value={editedMandat.adresse || ''} onChange={e => updateMandat('adresse', e.target.value)} placeholder="Adresse" className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                      <div className="grid grid-cols-3 gap-2">
                        <input type="number" value={editedMandat.prix || 0} onChange={e => updateMandat('prix', +e.target.value)} placeholder="Prix €" className="px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                        <input type="number" value={editedMandat.surface || 0} onChange={e => updateMandat('surface', +e.target.value)} placeholder="Surface m²" className="px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                        <input type="number" step="0.01" value={editedMandat.rendement || 0} onChange={e => updateMandat('rendement', +e.target.value)} placeholder="Rdt %" className="px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={editedMandat.contact || ''} onChange={e => updateMandat('contact', e.target.value)} placeholder="Contact propriétaire" className="px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                        <input type="text" value={editedMandat.tel || ''} onChange={e => updateMandat('tel', e.target.value)} placeholder="Téléphone" className="px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                      </div>
                      {editedMandat.description && (
                        <textarea value={editedMandat.description || ''} onChange={e => updateMandat('description', e.target.value)} rows={2} className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Section client */}
              {editedClient && result.client?.action !== 'none' && (
                <div className="border border-cream-dark rounded-xl overflow-hidden">
                  <div className="p-3 bg-cream-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={doClient} 
                        onChange={e => setDoClient(e.target.checked)}
                        className="accent-[#5A6948]" 
                      />
                      <Users className="w-4 h-4 text-sage-dark" />
                      <span className="text-sm font-medium text-ink">
                        {result.client.action === 'update' ? '🔄 Client existant à enrichir' : '✨ Nouveau client à créer'}
                      </span>
                    </div>
                    {result.client.matchConfidence && (
                      <span className="text-[10px] uppercase tracking-wide text-stone-500">
                        Match {result.client.matchConfidence}
                      </span>
                    )}
                  </div>
                  {doClient && (
                    <div className="p-4 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={editedClient.prenom || ''} onChange={e => updateClient('prenom', e.target.value)} placeholder="Prénom" className="px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                        <input type="text" value={editedClient.nom || ''} onChange={e => updateClient('nom', e.target.value)} placeholder="Nom" className="px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                      </div>
                      <input type="text" value={editedClient.societe || ''} onChange={e => updateClient('societe', e.target.value)} placeholder="Société" className="w-full px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="tel" value={editedClient.tel || ''} onChange={e => updateClient('tel', e.target.value)} placeholder="Téléphone" className="px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                        <input type="email" value={editedClient.email || ''} onChange={e => updateClient('email', e.target.value)} placeholder="Email" className="px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input type="number" value={editedClient.budgetMin || 0} onChange={e => updateClient('budgetMin', +e.target.value)} placeholder="Budget min €" className="px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                        <input type="number" value={editedClient.budgetMax || 0} onChange={e => updateClient('budgetMax', +e.target.value)} placeholder="Budget max €" className="px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                        <input type="number" step="0.1" value={editedClient.rendementMin || 0} onChange={e => updateClient('rendementMin', +e.target.value)} placeholder="Rdt min %" className="px-3 py-2 border border-cream-dark rounded-lg text-sm" />
                      </div>
                      {result.client.interaction && (
                        <div className="p-3 bg-sage-50 rounded-lg">
                          <div className="text-[10px] uppercase tracking-wide text-sage-dark font-semibold mb-1">
                            Interaction qui sera ajoutée à l'historique
                          </div>
                          <div className="text-xs text-ink">
                            <span className="font-medium">{result.client.interaction.type}</span> du {new Date().toLocaleDateString('fr-FR')}
                          </div>
                          <div className="text-xs text-ink/70 italic mt-1">« {result.client.interaction.resume} »</div>
                          {result.client.interaction.nextStep && (
                            <div className="text-xs text-sage-darker mt-1.5 font-medium">
                              → {result.client.interaction.nextStep}
                              {result.client.interaction.dateNextStep && ` (${new Date(result.client.interaction.dateNextStep).toLocaleDateString('fr-FR')})`}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {result.actions && result.actions.length > 0 && (
                <div className="border border-sage-light rounded-xl overflow-hidden">
                  <div className="p-3 bg-sage-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-sage-dark" />
                      <span className="text-sm font-medium text-ink">
                        Actions de suivi ({selectedActions.size}/{result.actions.length})
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedActions(new Set(result.actions.map((_,i) => i)))} className="text-[10px] text-sage-dark hover:underline">Tout cocher</button>
                      <button onClick={() => setSelectedActions(new Set())} className="text-[10px] text-stone-500 hover:underline">Tout décocher</button>
                    </div>
                  </div>
                  <div className="p-3 space-y-1.5">
                    {result.actions.map((a, i) => (
                      <label key={i} className="flex items-start gap-2 p-2 rounded-md hover:bg-cream-100 cursor-pointer">
                        <input type="checkbox" 
                          checked={selectedActions.has(i)}
                          onChange={() => {
                            const s = new Set(selectedActions);
                            if (s.has(i)) s.delete(i); else s.add(i);
                            setSelectedActions(s);
                          }}
                          className="mt-0.5 accent-[#5A6948]" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-ink">{a.titre}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              a.priorite === 'Haute' ? 'bg-red-50 text-red-700' : 
                              a.priorite === 'Moyenne' ? 'bg-amber-50 text-amber-700' : 
                              'bg-cream-100 text-stone-600'
                            }`}>{a.priorite}</span>
                            <span className="text-[10px] text-stone-500">{a.echeanceJours}j</span>
                            {a.linkedTo && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-sage-50 text-sage-darker">
                                → {a.linkedTo}
                              </span>
                            )}
                          </div>
                          {a.motif && <div className="text-[10px] text-stone-500 mt-0.5 italic">{a.motif}</div>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ETAPE 4 : SAVING */}
          {step === 'saving' && (
            <div className="text-center py-16">
              <Loader2 className="w-12 h-12 text-sage-dark animate-spin mx-auto mb-4" />
              <div className="font-display text-lg font-semibold text-ink">Enregistrement…</div>
            </div>
          )}
        </div>

        {/* Footer boutons review */}
        {step === 'review' && (
          <div className="flex gap-2 justify-between p-6 border-t border-cream-dark bg-cream-50 sticky bottom-0">
            <button 
              onClick={() => { setStep('input'); setResult(null); setEditedMandat(null); setEditedClient(null); }}
              className="px-4 py-2 text-sm text-ink/70 hover:bg-cream-200 rounded-lg"
            >
              ← Modifier le texte
            </button>
            <button 
              onClick={saveAll}
              disabled={!doMandat && !doClient && selectedActions.size === 0}
              className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:bg-stone-300 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> 
              Valider
              {(() => {
                const parts = [];
                if (doMandat && result.mandat?.action !== 'none') parts.push(result.mandat.action === 'create' ? '+1 mandat' : 'mandat');
                if (doClient && result.client?.action !== 'none') parts.push(result.client.action === 'create' ? '+1 client' : 'client');
                if (selectedActions.size > 0) parts.push(`+${selectedActions.size} tâche${selectedActions.size > 1 ? 's' : ''}`);
                return parts.length > 0 ? ` (${parts.join(', ')})` : '';
              })()}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
