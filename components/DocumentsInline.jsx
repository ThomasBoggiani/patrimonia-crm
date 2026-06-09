// ═══════════════════════════════════════════════════════════════════
// components/DocumentsInline.jsx
// Version inline pour la fiche mandat
// REFONTE v3 : import -> l'IA PROPOSE (sans écrire) -> modale de validation
//              (cases à cocher + valeurs éditables + conflits) -> Appliquer écrit.
//              Les fichiers sont rangés automatiquement (catégorie) dans tous les cas.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { X, Upload, Link2, Trash2, FileText, Image as ImageIcon, FileArchive, File, Download, ExternalLink, Loader2, FolderOpen, Sparkles, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CATEGORIES = [
  { id: 'mandat',         label: 'Mandat',              icon: '📋' },
  { id: 'diagnostics',    label: 'Diagnostics',         icon: '🔍' },
  { id: 'plans_photos',   label: 'Plans & photos HD',   icon: '🏠' },
  { id: 'notes',          label: 'Notes internes',      icon: '📝' },
  { id: 'mandant',        label: 'Mandant',             icon: '📜' },
  { id: 'autre',          label: 'Autre',               icon: '📦' },
];

function getFileIcon(mimeType) {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('rar')) return FileArchive;
  return File;
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return size.toFixed(size < 10 && i > 0 ? 1 : 0) + ' ' + units[i];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return ''; }
}

// Affichage lisible d'une valeur (null/vide -> tiret)
function displayVal(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return new Intl.NumberFormat('fr-FR').format(v);
  return String(v);
}

async function compressImage(file) {
  if (!file.type.startsWith('image/')) return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1920;
        let { width, height } = img;
        if (width > MAX_WIDTH) {
          height = (MAX_WIDTH / width) * height;
          width = MAX_WIDTH;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File([blob], file.name, { type: 'image/jpeg' });
          resolve(compressed.size < file.size ? compressed : file);
        }, 'image/jpeg', 0.8);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// ═══════════════════════════════════════════════════════════════════
// Drag & drop : parcours récursif des dossiers
// ═══════════════════════════════════════════════════════════════════
async function readEntryFile(entry) {
  return new Promise((resolve) => {
    entry.file((file) => resolve(file), () => resolve(null));
  });
}

async function readDirectory(dirReader) {
  return new Promise((resolve) => {
    const entries = [];
    const readBatch = () => {
      dirReader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(entries);
        } else {
          entries.push(...batch);
          readBatch();
        }
      }, () => resolve(entries));
    };
    readBatch();
  });
}

async function traverseEntry(entry, out) {
  if (!entry) return;
  if (entry.isFile) {
    const file = await readEntryFile(entry);
    if (file) out.push(file);
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    const entries = await readDirectory(reader);
    for (const child of entries) {
      await traverseEntry(child, out);
    }
  }
}

async function extractFilesFromDataTransfer(dataTransfer) {
  const items = dataTransfer.items;
  const out = [];
  if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
    const entries = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }
    for (const entry of entries) {
      await traverseEntry(entry, out);
    }
    if (out.length > 0) return out;
  }
  return Array.from(dataTransfer.files || []);
}

export default function DocumentsInline({ mandat, onUpdate }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkData, setLinkData] = useState({ nom: '', url: '', category: 'autre' });
  const [importProgress, setImportProgress] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // ─── Modale de validation des changements proposés ───
  // proposalState : null | { changes: [{key,label,current,proposed,sources:[]}], note }
  const [proposalState, setProposalState] = useState(null);
  // Sélection + valeurs éditées dans la modale : { [key]: { checked, value } }
  const [reviewRows, setReviewRows] = useState({});
  const [applying, setApplying] = useState(false);

  const importInputRef = useRef(null);
  const dragCounter = useRef(0);

  async function loadDocuments() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setLoading(false); return; }
      const res = await fetch('/api/mandats/' + mandat.id + '/documents?token=' + encodeURIComponent(token));
      const data = await res.json();
      if (data.ok) { setDocuments(data.documents || []); }
    } catch (e) {
      console.error('[Docs] load error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDocuments(); }, [mandat?.id]);

  // Upload d'un fichier + enregistrement metadata. Renvoie aussi storage_path pour l'analyse.
  async function uploadOneFile(file, token) {
    const cleanName = (file.name || 'file').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = mandat.id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + cleanName;

    const { error: uploadErr } = await supabase.storage.from('mandat-docs').upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (uploadErr) {
      return { ok: false, error: uploadErr.message };
    }
    return { ok: true, storagePath, file };
  }

  // Enregistre la metadata du document avec sa catégorie (après analyse)
  async function saveDocMeta(file, storagePath, category, token) {
    const res = await fetch('/api/mandats/' + mandat.id + '/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        type: 'file_meta',
        category: category || 'autre',
        nom: file.name,
        storage_path: storagePath,
        taille_bytes: file.size,
        mime_type: file.type || 'application/octet-stream',
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      await supabase.storage.from('mandat-docs').remove([storagePath]);
      return { ok: false, error: data.error || 'Erreur enregistrement' };
    }
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  // IMPORT : upload + analyse en mode 'propose' (aucune écriture mandat)
  // Puis on fusionne tous les changements et on ouvre la modale.
  // ═══════════════════════════════════════════════════════════════════
  async function importFiles(files) {
    if (!files || files.length === 0) return;

    setImportResult(null);
    setProposalState(null);
    setImportProgress({ current: 0, total: files.length, fileName: 'Préparation...' });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { alert('Session expirée'); setImportProgress(null); return; }

      // Map des changements fusionnés : key -> { key, label, current, proposed, sources:[fileName] }
      const mergedChanges = {};
      const notes = [];
      let errors = 0;
      const categoriesByLabel = {};

      let processed = 0;
      for (const file of files) {
        const compressed = await compressImage(file);
        setImportProgress({ current: processed + 1, total: files.length, fileName: file.name });

        // 1. Upload
        const up = await uploadOneFile(compressed, token);
        if (!up.ok) { errors++; processed++; continue; }

        // 2. Analyse en mode 'propose' (pas d'écriture)
        let category = 'autre';
        try {
          const aiRes = await fetch('/api/mandats/' + mandat.id + '/import-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, storage_path: up.storagePath, mode: 'propose' }),
          });
          const aiData = await aiRes.json();
          if (aiData.ok) {
            category = aiData.category || 'autre';
            if (aiData.note) notes.push(aiData.note);
            for (const ch of (aiData.changes || [])) {
              if (!mergedChanges[ch.key]) {
                mergedChanges[ch.key] = { ...ch, sources: [file.name] };
              } else {
                // Conflit : un autre doc propose déjà une valeur pour ce champ
                const existing = mergedChanges[ch.key];
                existing.sources.push(file.name);
                if (existing.proposed !== ch.proposed) {
                  existing.conflict = existing.conflict || [{ value: existing.proposed, source: existing.sources[0] }];
                  existing.conflict.push({ value: ch.proposed, source: file.name });
                }
              }
            }
          }
        } catch (e) {
          console.warn('[import] AI propose failed:', e.message);
        }

        // 3. Range le fichier (metadata + catégorie) — toujours, indépendamment des champs
        const meta = await saveDocMeta(compressed, up.storagePath, category, token);
        if (meta.ok) {
          const label = CATEGORIES.find(c => c.id === category)?.label || 'Autre';
          categoriesByLabel[label] = (categoriesByLabel[label] || 0) + 1;
        } else {
          errors++;
        }
        processed++;
      }

      setImportProgress(null);
      await loadDocuments();
      if (importInputRef.current) importInputRef.current.value = '';

      const changesArr = Object.values(mergedChanges);

      if (changesArr.length > 0) {
        // Ouvre la modale de validation
        const initRows = {};
        for (const ch of changesArr) {
          initRows[ch.key] = { checked: true, value: ch.proposed };
        }
        setReviewRows(initRows);
        setProposalState({
          changes: changesArr,
          note: notes.length > 0 ? notes.join(' ') : null,
          summary: { total: files.length, errors, categoriesByLabel },
        });
      } else {
        // Aucun champ proposé : juste un récap de rangement
        setImportResult({
          total: files.length,
          success: files.length - errors,
          errors,
          categoriesByLabel,
          note: notes.length > 0 ? notes.join(' ') : null,
        });
      }
    } catch (e) {
      alert('Erreur : ' + e.message);
      setImportProgress(null);
    }
  }

  // ═══ Applique les changements cochés dans le mandat (écriture Supabase directe) ═══
  async function applyChanges() {
    if (!proposalState) return;
    setApplying(true);
    try {
      const updates = {};
      for (const ch of proposalState.changes) {
        const row = reviewRows[ch.key];
        if (row && row.checked) {
          updates[ch.key] = row.value;
        }
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('mandats').update(updates).eq('id', mandat.id);
        if (error) { alert('Erreur sauvegarde : ' + error.message); setApplying(false); return; }
      }
      const appliedCount = Object.keys(updates).length;
      setProposalState(null);
      setReviewRows({});
      setImportResult({
        total: proposalState.summary?.total || 0,
        success: (proposalState.summary?.total || 0) - (proposalState.summary?.errors || 0),
        errors: proposalState.summary?.errors || 0,
        categoriesByLabel: proposalState.summary?.categoriesByLabel || {},
        totalFilled: appliedCount,
        note: proposalState.note,
      });
      if (typeof onUpdate === 'function') onUpdate();
    } catch (e) {
      alert('Erreur : ' + e.message);
    } finally {
      setApplying(false);
    }
  }

  function cancelProposal() {
    // Les fichiers sont déjà rangés ; on abandonne juste les changements de champs.
    setProposalState(null);
    setReviewRows({});
    setImportResult({
      total: proposalState?.summary?.total || 0,
      success: (proposalState?.summary?.total || 0) - (proposalState?.summary?.errors || 0),
      errors: proposalState?.summary?.errors || 0,
      categoriesByLabel: proposalState?.summary?.categoriesByLabel || {},
      totalFilled: 0,
      note: proposalState?.note,
    });
  }

  // Picker classique (bouton)
  async function handleImportInput(event) {
    const files = Array.from(event.target.files || []);
    await importFiles(files);
  }

  // Drag & drop
  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (importProgress !== null) return;
    const files = await extractFilesFromDataTransfer(e.dataTransfer);
    if (files.length > 0) {
      await importFiles(files);
    }
  }

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleAddLink() {
    if (!linkData.nom.trim() || !linkData.url.trim()) { alert('Nom et URL requis'); return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch('/api/mandats/' + mandat.id + '/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, type: 'link', ...linkData }),
      });
      const data = await res.json();
      if (!data.ok) { alert('Erreur : ' + (data.error || 'inconnue')); return; }
      setLinkData({ nom: '', url: '', category: 'autre' });
      setShowLinkForm(false);
      await loadDocuments();
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
  }

  async function handleLinkDropbox() {
    const currentUrl = mandat.dropboxFolderUrl || mandat.dropbox_folder_url || '';
    const newUrl = prompt(
      currentUrl ? 'Modifier le lien Dropbox du dossier :' : 'Collez le lien Dropbox du dossier :',
      currentUrl
    );
    if (newUrl === null) return;
    const trimmed = newUrl.trim();
    if (trimmed && !trimmed.startsWith('https://')) {
      alert('Le lien doit commencer par https://');
      return;
    }
    try {
      const { error } = await supabase
        .from('mandats')
        .update({ dropbox_folder_url: trimmed || null })
        .eq('id', mandat.id);
      if (error) throw error;
      if (typeof onUpdate === 'function') onUpdate();
    } catch (e) {
      alert('Erreur sauvegarde : ' + e.message);
    }
  }

  async function handleDelete(docId) {
    if (!confirm('Supprimer ce document définitivement ?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch('/api/mandats/' + mandat.id + '/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, document_id: docId }),
      });
      const data = await res.json();
      if (!data.ok) { alert('Erreur suppression'); return; }
      await loadDocuments();
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
  }

  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    docs: documents.filter(d => d.category === cat.id),
  })).filter(cat => cat.docs.length > 0);

  const isImporting = importProgress !== null;
  const checkedCount = Object.values(reviewRows).filter(r => r.checked).length;

  return (
    <>
      {/* Barre d'actions */}
      <div className="flex items-center gap-2 flex-wrap mb-4 pb-3 border-b border-stone-100">
        <input
          type="file"
          ref={importInputRef}
          onChange={handleImportInput}
          className="hidden"
          multiple
        />
        <button
          onClick={() => importInputRef.current?.click()}
          disabled={isImporting}
          className="flex items-center gap-2 px-4 py-2 bg-sage-dark text-white rounded-lg text-sm hover:bg-sage-darker disabled:opacity-50 font-medium"
        >
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isImporting ? 'Import en cours...' : 'Importer'}
        </button>

        <span className="text-stone-300">|</span>

        <button
          onClick={() => setShowLinkForm(!showLinkForm)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg text-sm hover:bg-stone-100"
        >
          <Link2 className="w-4 h-4" /> Lien
        </button>

        {mandat.dropboxFolderUrl || mandat.dropbox_folder_url ? (
          <div className="flex items-center gap-1 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <a href={mandat.dropboxFolderUrl || mandat.dropbox_folder_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline">
              📁 Dossier Dropbox lié
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button onClick={handleLinkDropbox} className="ml-2 text-xs text-amber-600 hover:text-amber-800 underline" title="Modifier le lien">Modifier</button>
          </div>
        ) : (
          <button onClick={handleLinkDropbox} className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm hover:bg-amber-100" title="Lier un dossier Dropbox">
            📁 Dropbox
          </button>
        )}
      </div>

      {/* Formulaire de lien */}
      {showLinkForm && (
        <div className="mb-4 p-3 bg-stone-50 border border-stone-200 rounded-lg space-y-2">
          <input type="text" placeholder="Nom du document" value={linkData.nom} onChange={e => setLinkData({ ...linkData, nom: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded text-sm" />
          <input type="text" placeholder="https://..." value={linkData.url} onChange={e => setLinkData({ ...linkData, url: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded text-sm" />
          <select value={linkData.category} onChange={e => setLinkData({ ...linkData, category: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded text-sm bg-white">
            {CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={handleAddLink} className="flex-1 px-3 py-2 bg-stone-900 text-white rounded text-sm hover:bg-stone-800">Ajouter</button>
            <button onClick={() => { setShowLinkForm(false); setLinkData({ nom: '', url: '', category: 'autre' }); }} className="px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded text-sm hover:bg-stone-100">Annuler</button>
          </div>
        </div>
      )}

      {/* Progression import */}
      {importProgress && (
        <div className="mb-4 p-3 bg-sage-50 border border-sage-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-sage-dark flex-shrink-0" />
            <span className="text-sage-darker font-medium">
              Lecture {importProgress.current}/{importProgress.total}
            </span>
            <span className="text-stone-600 truncate">— {importProgress.fileName}</span>
          </div>
          <div className="mt-2 h-1.5 bg-sage-100 rounded-full overflow-hidden">
            <div className="h-full bg-sage-dark transition-all" style={{ width: (importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0) + '%' }} />
          </div>
        </div>
      )}

      {/* Résultat import (récap final après application ou si rien à valider) */}
      {importResult && (
        <div className="mb-4 p-3 bg-sage-50 border border-sage-200 rounded-lg">
          <div className="flex items-start gap-2 text-sm">
            <Sparkles className="w-4 h-4 mt-0.5 text-sage-dark flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sage-darker font-medium">
                Import terminé : {importResult.success}/{importResult.total} fichiers
              </div>
              <div className="text-stone-700 mt-0.5">
                {Object.entries(importResult.categoriesByLabel).map(([label, count]) => label + ' (' + count + ')').join(' · ')}
              </div>
              {importResult.totalFilled > 0 && (
                <div className="text-sage-darker mt-1">
                  ✨ {importResult.totalFilled} champ(s) du mandat mis à jour
                </div>
              )}
              {importResult.note && (
                <div className="text-amber-700 mt-1 text-xs">ℹ️ {importResult.note}</div>
              )}
              {importResult.errors > 0 && (
                <div className="text-red-600 mt-0.5">
                  {importResult.errors} fichier(s) en erreur
                </div>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="text-stone-400 hover:text-stone-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Zone de contenu + drag & drop global */}
      <div
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        className={`relative rounded-xl transition-colors ${isDragging ? 'ring-2 ring-sage-dark ring-offset-2 bg-sage-50/40' : ''}`}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-sage-50/80 border-2 border-dashed border-sage-dark rounded-xl pointer-events-none">
            <div className="text-center">
              <Upload className="w-10 h-10 mx-auto mb-2 text-sage-dark" />
              <p className="text-sm font-medium text-sage-darker">Déposez vos fichiers ou dossiers ici</p>
              <p className="text-xs text-sage-dark mt-0.5">L'IA propose les mises à jour, vous validez</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-stone-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Chargement...
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 text-stone-400 border-2 border-dashed border-stone-200 rounded-xl">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 text-stone-300" />
            <p className="text-sm">Aucun document pour ce mandat.</p>
            <p className="text-xs mt-1">Glissez-déposez des fichiers ou un dossier ici, ou cliquez sur <strong>Importer</strong>.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(cat => (
              <div key={cat.id}>
                <h3 className="text-xs uppercase tracking-wide text-stone-500 font-semibold mb-2 flex items-center gap-1.5">
                  <span>{cat.icon}</span> {cat.label}
                  <span className="text-stone-400 normal-case font-normal">({cat.docs.length})</span>
                </h3>
                <div className="space-y-2">
                  {cat.docs.map(doc => {
                    const Icon = doc.type === 'link' ? Link2 : getFileIcon(doc.mime_type);
                    return (
                      <div key={doc.id} className="flex items-center gap-3 p-3 bg-white border border-stone-200 rounded-lg hover:bg-stone-50">
                        <Icon className="w-5 h-5 text-stone-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-stone-900 truncate">{doc.nom}</div>
                          <div className="text-xs text-stone-500 flex items-center gap-2 mt-0.5">
                            {doc.type === 'file' ? <span>{formatBytes(doc.taille_bytes)}</span> : <span className="text-stone-400">Lien externe</span>}
                            <span>•</span>
                            <span>{formatDate(doc.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {doc.type === 'file' && doc.signedUrl && (
                            <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded" title="Télécharger">
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          {doc.type === 'link' && doc.url && (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded" title="Ouvrir">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button onClick={() => handleDelete(doc.id)} className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded" title="Supprimer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-stone-100 text-xs text-stone-500 text-center">
        ✨ L'IA lit les documents et vous propose les mises à jour à valider
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MODALE DE VALIDATION DES CHANGEMENTS PROPOSÉS
          ═══════════════════════════════════════════════════════════════ */}
      {proposalState && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-4" onClick={cancelProposal}>
          <div className="bg-white rounded-xl shadow-luxe-hover max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-stone-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sage-dark" />
                <div>
                  <h2 className="font-display text-lg font-semibold text-stone-900">Mises à jour proposées</h2>
                  <p className="text-xs text-stone-500">Vérifiez, corrigez si besoin, puis appliquez.</p>
                </div>
              </div>
              <button onClick={cancelProposal} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5">
              {proposalState.note && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-xs">ℹ️ {proposalState.note}</div>
              )}

              <div className="space-y-2">
                {proposalState.changes.map(ch => {
                  const row = reviewRows[ch.key] || { checked: true, value: ch.proposed };
                  return (
                    <div key={ch.key} className={`flex items-center gap-3 p-2.5 rounded-lg border ${row.checked ? 'border-sage-light bg-sage-50/40' : 'border-stone-200 bg-stone-50 opacity-60'}`}>
                      <input
                        type="checkbox"
                        checked={row.checked}
                        onChange={e => setReviewRows(prev => ({ ...prev, [ch.key]: { ...row, checked: e.target.checked } }))}
                        className="accent-[#5d6e5d] flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-stone-700">{ch.label}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-stone-400 line-through truncate max-w-[120px]" title={displayVal(ch.current)}>{displayVal(ch.current)}</span>
                          <span className="text-stone-400">→</span>
                          <input
                            type="text"
                            value={row.value ?? ''}
                            onChange={e => setReviewRows(prev => ({ ...prev, [ch.key]: { ...row, value: e.target.value } }))}
                            disabled={!row.checked}
                            className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs text-stone-900 focus:outline-none focus:border-stone-400 disabled:bg-stone-100"
                          />
                        </div>
                        {ch.conflict && (
                          <div className="text-[11px] text-amber-700 mt-1">
                            ⚠️ Valeurs différentes selon les documents : {ch.conflict.map(c => `${displayVal(c.value)} (${c.source})`).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 justify-end p-5 border-t border-stone-200 bg-stone-50 sticky bottom-0">
              <button onClick={cancelProposal} disabled={applying} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg disabled:opacity-50">
                Ne rien appliquer
              </button>
              <button onClick={applyChanges} disabled={applying || checkedCount === 0} className="flex items-center gap-2 px-4 py-2 bg-sage-dark text-white rounded-lg text-sm hover:bg-sage-darker disabled:opacity-50">
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Appliquer {checkedCount} modification{checkedCount > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
