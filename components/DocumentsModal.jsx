// ═══════════════════════════════════════════════════════════════════
// components/DocumentsModal.jsx
// Modal de gestion des documents d'un mandat
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { X, Upload, Link2, Trash2, FileText, Image as ImageIcon, FileArchive, File, Download, ExternalLink, Loader2, FolderOpen } from 'lucide-react';
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
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit'
    });
  } catch { return ''; }
}

export default function DocumentsModal({ mandat, onClose }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkData, setLinkData] = useState({ nom: '', url: '', category: 'autre' });
  const [uploadCategory, setUploadCategory] = useState('autre');
  const fileInputRef = useRef(null);

  async function loadDocuments() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await fetch('/api/mandats/' + mandat.id + '/documents?token=' + encodeURIComponent(token));
      const data = await res.json();
      if (data.ok) {
        setDocuments(data.documents || []);
      }
    } catch (e) {
      console.error('[Docs] load error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, [mandat?.id]);

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        alert('Session expirée');
        return;
      }
      const formData = new FormData();
      formData.append('token', token);
      formData.append('file', file);
      formData.append('category', uploadCategory);
      formData.append('nom', file.name);

      const res = await fetch('/api/mandats/' + mandat.id + '/documents', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.ok) {
        alert('Erreur upload : ' + (data.error || 'inconnue'));
        return;
      }
      await loadDocuments();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (e) {
      alert('Erreur : ' + e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleAddLink() {
    if (!linkData.nom.trim() || !linkData.url.trim()) {
      alert('Nom et URL requis');
      return;
    }
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
      if (!data.ok) {
        alert('Erreur : ' + (data.error || 'inconnue'));
        return;
      }
      setLinkData({ nom: '', url: '', category: 'autre' });
      setShowLinkForm(false);
      await loadDocuments();
    } catch (e) {
      alert('Erreur : ' + e.message);
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
      if (!data.ok) {
        alert('Erreur suppression');
        return;
      }
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
            <button onClick={() => setShowLinkForm(!showLinkForm)} className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg text-sm hover:bg-stone-100">
              <Link2 className="w-4 h-4" />
              Ajouter un lien
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
                <button
                  onClick={() => {
                    setShowLinkForm(false);
                    setLinkData({ nom: '', url: '', category: 'autre' });
                  }}
                  className="px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded text-sm hover:bg-stone-100"
                >
                  Annuler
                </button>
