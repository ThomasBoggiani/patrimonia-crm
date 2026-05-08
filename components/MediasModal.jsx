'use client';

import { useState } from 'react';
import { X, Plus, Trash2, ExternalLink, Video, Globe, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────
// Détection plateforme + URL d'embed
// ─────────────────────────────────────────────────────────
function detectPlatform(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('vimeo.com')) return 'vimeo';
  if (u.includes('matterport.com')) return 'matterport';
  if (u.includes('giraffe360.com') || u.includes('giraffe.com')) return 'giraffe360';
  if (u.includes('kuula.co')) return 'kuula';
  return 'other';
}

function getEmbedUrl(url, platform) {
  if (!url) return null;
  try {
    if (platform === 'youtube') {
      // Extract video ID
      let videoId = null;
      if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split(/[?&]/)[0];
      } else if (url.includes('youtube.com/watch')) {
        const params = new URL(url).searchParams;
        videoId = params.get('v');
      } else if (url.includes('youtube.com/embed/')) {
        videoId = url.split('youtube.com/embed/')[1].split(/[?&]/)[0];
      }
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    if (platform === 'vimeo') {
      const match = url.match(/vimeo\.com\/(\d+)/);
      return match ? `https://player.vimeo.com/video/${match[1]}` : null;
    }
    if (platform === 'matterport') {
      // Matterport URLs comme https://my.matterport.com/show/?m=ABC → utiliser tel quel en iframe
      return url.replace('matterport.com/show/', 'matterport.com/show/');
    }
    if (platform === 'giraffe360' || platform === 'kuula') {
      return url; // Embed direct
    }
    return null;
  } catch {
    return null;
  }
}

function platformLabel(platform) {
  const labels = {
    youtube: 'YouTube',
    vimeo: 'Vimeo',
    matterport: 'Matterport',
    giraffe360: 'Giraffe360',
    kuula: 'Kuula',
    other: 'Autre'
  };
  return labels[platform] || 'Autre';
}

// ─────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────
export default function MediasModal({ mandat, onClose, onUpdate }) {
  const medias = mandat.medias || [];
  const videos = medias.filter(m => m.type === 'video');
  const tours = medias.filter(m => m.type === 'virtual_tour');

  const [showAddForm, setShowAddForm] = useState(null); // null | 'video' | 'virtual_tour'
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [previewMedia, setPreviewMedia] = useState(null);

  async function handleAdd() {
    if (!newTitle.trim() || !newUrl.trim()) {
      setError('Titre et URL obligatoires');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const platform = detectPlatform(newUrl);
      const newMedia = {
        id: crypto.randomUUID(),
        type: showAddForm,
        title: newTitle.trim(),
        url: newUrl.trim(),
        platform,
        created_at: new Date().toISOString()
      };
      const updated = [...medias, newMedia];
      const { error: e } = await supabase
        .from('mandats')
        .update({ medias: updated })
        .eq('id', mandat.id);
      if (e) throw e;
      setNewTitle('');
      setNewUrl('');
      setShowAddForm(null);
      onUpdate?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(mediaId) {
    if (!confirm('Supprimer ce média ?')) return;
    try {
      const updated = medias.filter(m => m.id !== mediaId);
      const { error: e } = await supabase
        .from('mandats')
        .update({ medias: updated })
        .eq('id', mandat.id);
      if (e) throw e;
      onUpdate?.();
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <Video className="w-5 h-5 text-sage-dark" />
              Médias enrichis
              <span className="text-sm font-normal text-stone-500">· {mandat.nom}</span>
            </h3>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-2xl leading-none">×</button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Vidéos */}
            <Section
              icon={Video}
              title="Vidéos"
              hint="YouTube, Vimeo, ou tout lien vidéo"
              items={videos}
              onAdd={() => { setShowAddForm('video'); setNewTitle(''); setNewUrl(''); setError(''); }}
              onPreview={setPreviewMedia}
              onDelete={handleDelete}
            />

            {/* Visites virtuelles */}
            <Section
              icon={Globe}
              title="Visites virtuelles"
              hint="Matterport, Giraffe360, Kuula, ou tout lien 360°"
              items={tours}
              onAdd={() => { setShowAddForm('virtual_tour'); setNewTitle(''); setNewUrl(''); setError(''); }}
              onPreview={setPreviewMedia}
              onDelete={handleDelete}
            />

            {/* Form d'ajout */}
            {showAddForm && (
              <div className="bg-sage-50 border border-sage-light rounded-xl p-4 space-y-3">
                <div className="font-medium text-sm text-sage-darker">
                  {showAddForm === 'video' ? '🎥 Ajouter une vidéo' : '🌐 Ajouter une visite virtuelle'}
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Titre</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={showAddForm === 'video' ? 'Visite extérieure' : 'Visite Matterport 360°'}
                    autoFocus
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">URL</label>
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder={showAddForm === 'video' ? 'https://youtube.com/watch?v=...' : 'https://my.matterport.com/show/?m=...'}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono"
                  />
                  {newUrl && detectPlatform(newUrl) && (
                    <div className="text-xs text-sage-dark mt-1">
                      Plateforme détectée : <strong>{platformLabel(detectPlatform(newUrl))}</strong>
                    </div>
                  )}
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowAddForm(null)}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm text-stone-700 bg-white border border-stone-200 rounded-md hover:bg-stone-50 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm bg-sage-dark text-white rounded-md hover:bg-sage-darker disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Ajouter
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-stone-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-stone-900 text-white rounded-lg hover:bg-stone-800"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* Modale d'aperçu (iframe) */}
      {previewMedia && <PreviewModal media={previewMedia} onClose={() => setPreviewMedia(null)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Section (vidéos / visites virtuelles)
// ─────────────────────────────────────────────────────────
function Section({ icon: Icon, title, hint, items, onAdd, onPreview, onDelete }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-display text-base font-semibold flex items-center gap-2">
            <Icon className="w-4 h-4 text-sage-dark" />
            {title}
            <span className="text-sm font-normal text-stone-500">({items.length})</span>
          </h4>
          <p className="text-xs text-stone-500 mt-0.5">{hint}</p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-stone-900 text-white rounded-md hover:bg-stone-800"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-stone-400 italic py-4 text-center bg-stone-50 rounded-lg">
          Aucun média ajouté pour l'instant.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(media => (
            <MediaCard
              key={media.id}
              media={media}
              onPreview={() => onPreview(media)}
              onDelete={() => onDelete(media.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Carte d'un média
// ─────────────────────────────────────────────────────────
function MediaCard({ media, onPreview, onDelete }) {
  const platform = media.platform || detectPlatform(media.url);
  const canEmbed = !!getEmbedUrl(media.url, platform);

  return (
    <div className="border border-stone-200 rounded-lg p-3 flex items-center gap-3 hover:bg-stone-50 transition">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-stone-900 truncate">{media.title}</div>
        <div className="text-xs text-stone-500 flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded-full bg-sage-50 text-sage-darker">
            {platformLabel(platform)}
          </span>
          <span className="truncate">{media.url}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {canEmbed && (
          <button
            onClick={onPreview}
            className="p-1.5 text-stone-600 hover:bg-stone-100 rounded"
            title="Aperçu intégré"
          >
            <Globe className="w-4 h-4" />
          </button>
        )}
        
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-stone-600 hover:bg-stone-100 rounded"
          title="Ouvrir dans un nouvel onglet"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        <button
          onClick={onDelete}
          className="p-1.5 text-stone-600 hover:text-red-600 hover:bg-red-50 rounded"
          title="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Modale d'aperçu (iframe full screen)
// ─────────────────────────────────────────────────────────
function PreviewModal({ media, onClose }) {
  const platform = media.platform || detectPlatform(media.url);
  const embedUrl = getEmbedUrl(media.url, platform);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200">
          <div>
            <div className="font-medium text-sm">{media.title}</div>
            <div className="text-xs text-stone-500">{platformLabel(platform)}</div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-2xl leading-none">×</button>
        </div>
        <div className="aspect-video bg-stone-900">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; xr-spatial-tracking; fullscreen"
              allowFullScreen
              title={media.title}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white text-sm">
              Aperçu non disponible. <a href={media.url} target="_blank" rel="noopener noreferrer" className="underline ml-2">Ouvrir le lien</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
