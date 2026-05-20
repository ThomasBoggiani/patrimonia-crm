// ═══════════════════════════════════════════════════════════════════
// components/DocumentsInline.jsx
// Version inline de DocumentsModal pour affichage dans la fiche mandat
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { X, Upload, Link2, Trash2, FileText, Image as ImageIcon, FileArchive, File, Download, ExternalLink, Loader2, FolderOpen, Sparkles, Folder } from 'lucide-react';
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

export default function DocumentsInline({ mandat, onUpdate }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkData, setLinkData] = useState({ nom: '', url: '', category: 'autre' });
  const [uploadCategory, setUploadCategory] = useState('autre');
  const [importProgress, setImportProgress] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

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

  async function uploadOneFile(file, token, category, applyToMandat) {
    const cleanName = (file.name || 'file').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = mandat.id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + cleanName;

    const { error: uploadErr } = await supabase.storage.from('mandat-docs').upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (uploadErr) {
      return { ok: false, error: uploadErr.message };
    }

    let aiCategory = category || 'autre';
    let filledFields = [];
    if (applyToMandat) {
      try {
        const aiRes = await fetch('/api/mandats/' + mandat.id + '/import-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, storage_path: storagePath, applyToMandat: true }),
        });
        const aiData = await aiRes.json();
        if (aiData.ok) {
          aiCategory = aiData.category || aiCategory;
          filledFields = aiData.filled || [];
        }
      } catch (e) {
        console.warn('[upload] AI analyze failed:', e.message);
      }
    }

    const res = await fetch('/api/mandats/' + mandat.id + '/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        type: 'file_meta',
        category: aiCategory,
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
    return { ok: true, category: aiCategory, filled: filledFields };
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { alert('Session expirée'); return; }

      const compressed = await compressImage(file);
      const result = await uploadOneFile(compressed, token, uploadCategory, false);
      if (!result.ok) {
        alert('Erreur upload : ' + result.error);
        return;
      }
      await loadDocuments();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      alert('Erreur : ' + e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleFolderUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setImportResult(null);
    setImportProgress({ current: 0, total: files.length, fileName: 'Préparation...', totalFilled: 0 });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { alert('Session expirée'); setImportProgress(null); return; }

      let totalFilled = 0;
      let categoriesByLabel = {};
      let errors = 0;

      const BATCH_SIZE = 3;
      let processed = 0;
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(async (file) => {
          const compressed = await compressImage(file);
          setImportProgress({ current: processed + 1, total: files.length, fileName: file.name, totalFilled });
          const result = await uploadOneFile(compressed, token, 'autre', true);
          processed++;
          return result;
        }));
        for (const r of results) {
          if (r.ok) {
            totalFilled += (r.filled?.length || 0);
            const label = CATEGORIES.find(c => c.id === r.category)?.label || 'Autre';
            categoriesByLabel[label] = (categoriesByLabel[label] || 0) + 1;
          } else {
            errors++;
          }
        }
        setImportProgress({ current: processed, total: files.length, fileName: 'Batch ' + (Math.floor(i / BATCH_SIZE) + 1), totalFilled });
        if (i + BATCH_SIZE < files.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      setImportProgress(null);
      setImportResult({
        total: files.length,
        success: files.length - errors,
        errors,
        totalFilled,
        categoriesByLabel,
      });
      await loadDocuments();
      if (folderInputRef.current) folderInputRef.current.value = '';
      if (totalFilled > 0 && typeof onUpdate === 'function') onUpdate();
    } catch (e) {
      alert('Erreur : ' + e.message);
      setImportProgress(null);
    }
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
    if (newUrl === null) return; // Annulé
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

  return (
    <>
      {/* Barre d'actions */}
      <div className="flex items-center gap-2 flex-wrap mb-4 pb-3 border-b border-stone-100">
        <input type="file" ref={folderInputRef} onChange={handleFolderUpload} className="hidden" multiple webkitdirectory="" directory="" />
        <button onClick={() => folderInputRef.current?.click()} disabled={importProgress !== null} className="flex items-center gap-2 px-3 py-2 bg-sage-dark text-white rounded-lg text-sm hover:bg-sage-darker disabled:opacity-50">
          <Folder className="w-4 h-4" /> Importer un dossier ✨
        </button>

        <span className="text-stone-300">|</span>

        <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} className="px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white">
          {CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg text-sm hover:bg-stone-100 disabled:opacity-50">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Upload...' : 'Fichier seul'}
        </button>
        <button onClick={() => setShowLinkForm(!showLinkForm)} className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg text-sm hover:bg-stone-100">
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
            📁 Lier un dossier Dropbox
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
              Import {importProgress.current}/{importProgress.total}
            </span>
            <span className="text-stone-600 truncate">— {importProgress.fileName}</span>
          </div>
          <div className="mt-2 h-1.5 bg-sage-100 rounded-full overflow-hidden">
            <div className="h-full bg-sage-dark transition-all" style={{ width: (importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0) + '%' }} />
          </div>
        </div>
      )}

      {/* Résultat import */}
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
                  ✨ {importResult.totalFilled} champ(s) du mandat mis à jour automatiquement
                </div>
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

      {/* Contenu */}
      <div>
        {loading ? (
          <div className="text-center py-12 text-stone-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Chargement...
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 text-stone-400">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 text-stone-300" />
            <p className="text-sm">Aucun document pour ce mandat.</p>
            <p className="text-xs mt-1">Importe un dossier ou ajoute des fichiers.</p>
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
        ✨ L'IA catégorise et extrait les données automatiquement lors de l'import dossier
      </div>
    </>
  );
}
