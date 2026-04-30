// ═══════════════════════════════════════════════════════════════════
// components/DocumentsModal.jsx
// Modal documents avec analyse IA
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { X, Upload, Link2, Trash2, FileText, Image as ImageIcon, FileArchive, File, Download, ExternalLink, Loader2, FolderOpen, Sparkles } from 'lucide-react';
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

export default function DocumentsModal({ mandat, onClose, onUpdate }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkData, setLinkData] = useState({ nom: '', url: '', category: 'autre' });
  const [uploadCategory, setUploadCategory] = useState('autre');
  const [analyzingDocId, setAnalyzingDocId] = useState(null);
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [folderUploadProgress, setFolderUploadProgress] = useState(null); // { current, total, fileName }
  const folderInputRef = useRef(null);
  const fileInputRef = useRef(null);

  async function loadDocuments() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setLoading(false); return; }
      const res = await fetch('/api/mandats/' + mandat.id + '/documents?token=' + encodeURIComponent(token));
      const data = await res.json();
      if (!data.ok) {
        // Cas spécial : adresse non concordante
        if (data.error === 'address_mismatch') {
          const choice = confirm(
            'Adresse non concordante !\n\n' +
            'Adresse du mandat : ' + (data.currentAddress || 'aucune') + '\n' +
            'Adresse du document : ' + (data.extractedAddress || 'aucune') + '\n\n' +
            (data.potentialDuplicates?.length > 0
              ? 'Doublons potentiels trouvés :\n' + data.potentialDuplicates.map(m => '• ' + m.nom + ' (' + m.adresse + ')').join('\n') + '\n\n'
              : '') +
            'Veux-tu quand même appliquer les autres données du document à ce mandat ?'
          );
          if (choice) {
            // Renvoyer la requête avec un flag de bypass
            const res2 = await fetch('/api/mandats/' + mandat.id + '/analyze-document', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, storage_path: doc.storage_path, document_id: doc.id, force: true }),
            });
            const data2 = await res2.json();
            if (data2.ok) {
              setAnalyzeResult({
                filled: data2.filled || [],
                count: (data2.filled || []).length,
              });
            } else {
              setAnalyzeResult({ error: data2.error || 'Erreur inconnue' });
            }
          } else {
            setAnalyzeResult({ error: 'Analyse annulée (adresse non concordante)' });
          }
          return;
        }
        setAnalyzeResult({ error: data.error || 'Erreur inconnue' });
        return;
      }
    } catch (e) {
      console.error('[Docs] load error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDocuments(); }, [mandat?.id]);

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { alert('Session expirée'); return; }

      const cleanName = (file.name || 'file').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = mandat.id + '/' + Date.now() + '_' + cleanName;

      const { error: uploadErr } = await supabase.storage.from('mandat-docs').upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

      if (uploadErr) { alert('Erreur upload : ' + uploadErr.message); return; }

      const res = await fetch('/api/mandats/' + mandat.id + '/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          type: 'file_meta',
          category: uploadCategory,
          nom: file.name,
          storage_path: storagePath,
          taille_bytes: file.size,
          mime_type: file.type || 'application/octet-stream',
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        await supabase.storage.from('mandat-docs').remove([storagePath]);
        alert('Erreur enregistrement : ' + (data.error || 'inconnue'));
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

    setFolderUploadProgress({ current: 0, total: files.length, fileName: 'Catégorisation IA en cours...' });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { alert('Session expirée'); setFolderUploadProgress(null); return; }

      // 1. Catégoriser tous les fichiers en 1 appel IA
      const fileNames = files.map(f => f.name);
      const catRes = await fetch('/api/mandats/' + mandat.id + '/categorize-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, fileNames }),
      });
      const catData = await catRes.json();
      if (!catData.ok) {
        alert('Erreur catégorisation : ' + (catData.error || 'inconnue'));
        setFolderUploadProgress(null);
        return;
      }
      const categories = catData.categories || {};

      // 2. Upload chaque fichier
      let uploaded = 0;
      for (const file of files) {
        setFolderUploadProgress({ current: uploaded + 1, total: files.length, fileName: file.name });
        const cleanName = (file.name || 'file').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = mandat.id + '/' + Date.now() + '_' + uploaded + '_' + cleanName;
        const category = categories[file.name] || 'autre';

        const { error: uploadErr } = await supabase.storage.from('mandat-docs').upload(storagePath, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

        if (uploadErr) {
          console.error('[FolderUpload] Erreur upload:', file.name, uploadErr.message);
          continue;
        }

        await fetch('/api/mandats/' + mandat.id + '/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            type: 'file_meta',
            category,
            nom: file.name,
            storage_path: storagePath,
            taille_bytes: file.size,
            mime_type: file.type || 'application/octet-stream',
          }),
        });
        uploaded++;
      }

      setFolderUploadProgress(null);
      await loadDocuments();
      if (folderInputRef.current) folderInputRef.current.value = '';
    } catch (e) {
      alert('Erreur : ' + e.message);
      setFolderUploadProgress(null);
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
        body: JSON.stringify({
          token,
          type: 'link',
          nom: linkData.nom,
          url: linkData.url,
          category: linkData.category,
        }),
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

  async function handleAnalyze(doc) {
    if (!doc?.storage_path) {
      alert('Ce document n\u2019est pas un fichier analysable.');
      return;
    }
    setAnalyzingDocId(doc.id);
    setAnalyzeResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { alert('Session expirée'); return; }

      const res = await fetch('/api/mandats/' + mandat.id + '/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, storage_path: doc.storage_path, document_id: doc.id }),
      });
      const data = await res.json();
      if (!data.ok) {
        setAnalyzeResult({ error: data.error || 'Erreur inconnue' });
        return;
      }
      setAnalyzeResult({
        filled: data.filled || [],
        count: (data.filled || []).length,
      });
      if ((data.filled || []).length > 0 && typeof onUpdate === 'function') {
        onUpdate();
      }
    } catch (e) {
      setAnalyzeResult({ error: e.message });
    } finally {
      setAnalyzingDocId(null);
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-sage-dark" />
            <h2 className="font-display text-xl font-semibold text-stone-900">Documents</h2>
            <span className="text-sm text-stone-500">({documents.length})</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {folderUploadProgress && (
          <div className="px-6 py-3 border-b bg-sage-50 border-sage-200">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-sage-dark" />
              <span className="text-sage-darker font-medium">
                {folderUploadProgress.current === 0 ? 'Préparation...' : 'Upload ' + folderUploadProgress.current + '/' + folderUploadProgress.total}
              </span>
              <span className="text-stone-600 truncate">— {folderUploadProgress.fileName}</span>
            </div>
            <div className="mt-2 h-1.5 bg-sage-100 rounded-full overflow-hidden">
              <div className="h-full bg-sage-dark transition-all" style={{ width: (folderUploadProgress.total > 0 ? (folderUploadProgress.current / folderUploadProgress.total) * 100 : 0) + '%' }} />
            </div>
          </div>
        )}
        {analyzeResult && (
          <div className={`px-6 py-3 border-b ${analyzeResult.error ? 'bg-red-50 border-red-200' : 'bg-sage-50 border-sage-200'}`}>
            <div className="flex items-start gap-2">
              <Sparkles className={`w-4 h-4 mt-0.5 flex-shrink-0 ${analyzeResult.error ? 'text-red-600' : 'text-sage-dark'}`} />
              <div className="flex-1 text-sm">
                {analyzeResult.error ? (
                  <span className="text-red-700">Erreur : {analyzeResult.error}</span>
                ) : analyzeResult.count === 0 ? (
                  <span className="text-stone-700">L'IA a analysé le document mais tous les champs concernés sont déjà remplis.</span>
                ) : (
                  <span className="text-sage-darker font-medium">
                    {analyzeResult.count} champ{analyzeResult.count > 1 ? 's' : ''} mis à jour : {analyzeResult.filled.join(', ')}
                  </span>
                )}
              </div>
              <button onClick={() => setAnalyzeResult(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="px-6 py-3 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} className="px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white">
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 px-3 py-2 bg-stone-900 text-white rounded-lg text-sm hover:bg-stone-800 disabled:opacity-50">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Upload...' : 'Ajouter un fichier'}
            </button>
            <input type="file" ref={folderInputRef} onChange={handleFolderUpload} className="hidden" multiple webkitdirectory="" directory="" />
            <button onClick={() => folderInputRef.current?.click()} disabled={folderUploadProgress !== null} className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg text-sm hover:bg-stone-100 disabled:opacity-50">
              <Folder className="w-4 h-4" /> Importer un dossier ✨
            </button>
            <button onClick={() => setShowLinkForm(!showLinkForm)} className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg text-sm hover:bg-stone-100">
              <Link2 className="w-4 h-4" /> Ajouter un lien
            </button>
          </div>

          {showLinkForm && (
            <div className="mt-3 p-3 bg-white border border-stone-200 rounded-lg space-y-2">
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
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-12 text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Chargement...
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 text-stone-300" />
              <p className="text-sm">Aucun document pour ce mandat.</p>
              <p className="text-xs mt-1">Ajoute un fichier ou un lien ci-dessus.</p>
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
                            {doc.type === 'file' && doc.storage_path && (
                              <button onClick={() => handleAnalyze(doc)} disabled={analyzingDocId === doc.id} className="p-2 text-stone-500 hover:text-sage-dark hover:bg-sage-50 rounded disabled:opacity-50" title="Analyser avec l'IA">
                                {analyzingDocId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                              </button>
                            )}
                            {doc.type === 'file' && doc.signedUrl && (
                              <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded" title="Télécharger / Ouvrir">
                                <Download className="w-4 h-4" />
                              </a>
                            )}
                            {doc.type === 'link' && doc.url && (
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded" title="Ouvrir le lien">
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

        <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 text-xs text-stone-500 text-center">
          Stockage sécurisé Supabase · URLs signées valides 1h
        </div>
      </div>
    </div>
  );
}
