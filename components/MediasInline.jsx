'use client';

import { useState, useRef } from 'react';
import { Plus, Trash2, ExternalLink, Video, Globe, AlertCircle, Loader2, Image as ImageIcon, FileText, Star, GripVertical, Upload, Check, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/photo-utils';

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
      let videoId = null;
      if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split(/[?&]/)[0];
      else if (url.includes('youtube.com/watch')) videoId = new URL(url).searchParams.get('v');
      else if (url.includes('youtube.com/embed/')) videoId = url.split('youtube.com/embed/')[1].split(/[?&]/)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    if (platform === 'vimeo') {
      const match = url.match(/vimeo\.com\/(\d+)/);
      return match ? `https://player.vimeo.com/video/${match[1]}` : null;
    }
    if (platform === 'matterport' || platform === 'giraffe360' || platform === 'kuula') return url;
    return null;
  } catch {
    return null;
  }
}

function platformLabel(platform) {
  return { youtube: 'YouTube', vimeo: 'Vimeo', matterport: 'Matterport', giraffe360: 'Giraffe360', kuula: 'Kuula', other: 'Autre' }[platform] || 'Autre';
}

// ─────────────────────────────────────────────────────────
// Composant principal INLINE — 4 sous-onglets
// ─────────────────────────────────────────────────────────
export default function MediasInline({ mandat, onUpdate }) {
  const [activeTab, setActiveTab] = useState('photos');
  const [previewMedia, setPreviewMedia] = useState(null);
  const [saving, setSaving] = useState(false);

  const medias = Array.isArray(mandat.medias) ? mandat.medias : [];
  const photos = medias.filter(m => m && m.type === 'photo').sort((a, b) => {
    if (a.cover && !b.cover) return -1;
    if (b.cover && !a.cover) return 1;
    return (a.ordre || 0) - (b.ordre || 0);
  });
  const plans = medias.filter(m => m && m.type === 'plan');
  const videos = medias.filter(m => m && m.type === 'video');
  const tours = medias.filter(m => m && (m.type === 'virtual_tour' || m.type === 'visite_virtuelle'));

  async function persistMedias(newMedias) {
    setSaving(true);
    try {
      const { error } = await supabase.from('mandats').update({ medias: newMedias }).eq('id', mandat.id);
      if (error) throw error;
      onUpdate?.();
    } catch (e) {
      alert('Erreur sauvegarde : ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  function replaceMediasOfType(type, newItems) {
    const others = medias.filter(m => {
      if (type === 'tour') return m.type !== 'virtual_tour' && m.type !== 'visite_virtuelle';
      return m.type !== type;
    });
    return [...others, ...newItems];
  }

  const tabs = [
    { id: 'photos', label: 'Photos', icon: ImageIcon, count: photos.length },
    { id: 'plans', label: 'Plans', icon: FileText, count: plans.length },
    { id: 'videos', label: 'Vidéos', icon: Video, count: videos.length },
    { id: 'tours', label: 'Visites virtuelles', icon: Globe, count: tours.length },
  ];

  return (
    <>
      {/* Sous-onglets */}
      <div className="flex gap-1 mb-4 border-b border-stone-200">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${active ? 'border-sage-dark text-sage-darker' : 'border-transparent text-stone-500 hover:text-stone-900'}`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-sage-100 text-sage-darker' : 'bg-stone-200 text-stone-600'}`}>
                {t.count}
              </span>
            </button>
          );
        })}
        {saving && <Loader2 className="w-4 h-4 animate-spin text-stone-400 ml-auto self-center" />}
      </div>

      {/* Contenu */}
      <div>
        {activeTab === 'photos' && (
          <PhotosTab
            mandat={mandat}
            photos={photos}
            onChange={(newPhotos) => persistMedias(replaceMediasOfType('photo', newPhotos))}
            saving={saving}
          />
        )}
        {activeTab === 'plans' && (
          <PlansTab
            mandat={mandat}
            plans={plans}
            onChange={(newPlans) => persistMedias(replaceMediasOfType('plan', newPlans))}
            onPreview={setPreviewMedia}
            saving={saving}
          />
        )}
        {activeTab === 'videos' && (
          <UrlSection
            kind="video"
            hint="YouTube, Vimeo, ou tout lien vidéo intégrable"
            placeholder="https://youtube.com/watch?v=..."
            items={videos}
            onChange={(newVideos) => persistMedias(replaceMediasOfType('video', newVideos))}
            onPreview={setPreviewMedia}
          />
        )}
        {activeTab === 'tours' && (
          <UrlSection
            kind="virtual_tour"
            hint="Matterport, Giraffe360, Kuula, ou tout lien 360°"
            placeholder="https://my.matterport.com/show/?m=..."
            items={tours}
            onChange={(newTours) => persistMedias(replaceMediasOfType('tour', newTours))}
            onPreview={setPreviewMedia}
          />
        )}
      </div>

      {previewMedia && <PreviewModal media={previewMedia} onClose={() => setPreviewMedia(null)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Onglet PHOTOS
// ─────────────────────────────────────────────────────────
function PhotosTab({ mandat, photos, onChange, saving }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newPhotos = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const compressed = await compressImage(file);
        const cleanName = (compressed.name || 'photo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${mandat.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${cleanName}`;
        const { error: upErr } = await supabase.storage.from('mandat-photos').upload(path, compressed, {
          contentType: compressed.type || 'image/jpeg',
          upsert: false,
        });
        if (upErr) { console.error('Upload échoué:', upErr); continue; }
        const { data: signed } = await supabase.storage.from('mandat-photos').createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
        if (signed?.signedUrl) {
          newPhotos.push({ url: signed.signedUrl, type: 'photo' });
        }
      }
      const startIdx = photos.length;
      const hasCover = photos.some(p => p.cover);
      const combined = [
        ...photos,
        ...newPhotos.map((p, i) => ({
          ...p,
          ordre: startIdx + i,
          cover: hasCover ? false : (startIdx + i === 0),
        }))
      ];
      onChange(combined);
    } catch (e) {
      alert('Erreur upload : ' + e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleDelete(idx) {
    if (!confirm('Supprimer cette photo ?')) return;
    const newPhotos = photos.filter((_, i) => i !== idx);
    const hasCover = newPhotos.some(p => p.cover);
    onChange(newPhotos.map((p, i) => ({
      ...p,
      ordre: i,
      cover: hasCover ? p.cover : i === 0,
    })));
  }

  function handleSetCover(idx) {
    onChange(photos.map((p, i) => ({ ...p, cover: i === idx, ordre: p.ordre ?? i })));
  }

  function handleTogglePlaquette(idx) {
    onChange(photos.map((p, i) => (i === idx ? { ...p, plaquette: !p.plaquette } : p)));
  }

  function setAllPlaquette(val) {
    onChange(photos.map((p) => ({ ...p, plaquette: val })));
  }

  const nbSelected = photos.filter((p) => p.plaquette).length;

  function handleDragStart(idx) { setDraggedIdx(idx); }
  function handleDragOver(e, idx) { e.preventDefault(); setDragOverIdx(idx); }
  function handleDragEnd() { setDraggedIdx(null); setDragOverIdx(null); }
  function handleDrop(e, dropIdx) {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIdx) { handleDragEnd(); return; }
    const newPhotos = [...photos];
    const [moved] = newPhotos.splice(draggedIdx, 1);
    newPhotos.splice(dropIdx, 0, moved);
    onChange(newPhotos.map((p, i) => ({ ...p, ordre: i })));
    handleDragEnd();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-stone-500">Glissez-déposez pour réordonner. La première est la photo de couverture par défaut.</p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-stone-900 text-white rounded-md hover:bg-stone-800 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Ajouter des photos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(Array.from(e.target.files || []))}
        />
      </div>

      {photos.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-sage-50 border border-sage-light rounded-lg">
          <BookOpen className="w-4 h-4 text-sage-darker flex-shrink-0" />
          <p className="text-xs text-stone-600 flex-1">
            {nbSelected > 0 ? (
              <><strong className="text-sage-darker">{nbSelected} photo{nbSelected > 1 ? 's' : ''}</strong> dans la plaquette. Bouton « Plaquette » en haut de chaque photo pour l'ajouter/retirer.</>
            ) : (
              <>Aucune sélection : les <strong>{photos.length} photos</strong> iront dans la plaquette. Clique sur le bouton <strong>« Plaquette »</strong> en haut des plus belles pour n'en garder qu'une sélection.</>
            )}
          </p>
          <button onClick={() => setAllPlaquette(true)} disabled={saving} className="text-xs px-2 py-1 rounded-md bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50">Tout</button>
          <button onClick={() => setAllPlaquette(false)} disabled={saving} className="text-xs px-2 py-1 rounded-md bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50">Aucune</button>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="text-sm text-stone-400 italic py-12 text-center bg-stone-50 rounded-lg border-2 border-dashed border-stone-200">
          Aucune photo. Cliquez sur « Ajouter des photos » pour commencer.
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {photos.map((p, idx) => (
            <div
              key={p.url + idx}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, idx)}
              className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-move
                ${p.cover ? 'border-amber-400 ring-2 ring-amber-200' : p.plaquette ? 'border-sage-dark' : 'border-stone-200'}
                ${dragOverIdx === idx && draggedIdx !== idx ? 'ring-2 ring-sage-dark scale-105' : ''}
                ${draggedIdx === idx ? 'opacity-50' : ''}
              `}
            >
              <img src={p.url} alt="" className={`w-full h-full object-cover ${p.plaquette ? '' : 'opacity-90'}`} />
              {p.cover && (
                <div className="absolute top-1.5 left-1.5 bg-amber-400 text-amber-900 text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 fill-current" /> Couverture
                </div>
              )}
              <div className="absolute top-1.5 right-1.5 flex gap-1 items-center">
                {/* Couverture + suppression : au survol */}
                {!p.cover && (
                  <button onClick={() => handleSetCover(idx)} title="Définir comme couverture" className="hidden group-hover:flex p-1.5 bg-white/95 rounded-md hover:bg-amber-50 shadow-sm">
                    <Star className="w-3.5 h-3.5 text-amber-600" />
                  </button>
                )}
                <button onClick={() => handleDelete(idx)} title="Supprimer" className="hidden group-hover:flex p-1.5 bg-white/95 rounded-md hover:bg-red-50 shadow-sm">
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                </button>
                {/* Plaquette : toujours visible */}
                <button
                  onClick={() => handleTogglePlaquette(idx)}
                  title={p.plaquette ? 'Retirer de la plaquette' : 'Ajouter à la plaquette'}
                  className={`flex items-center gap-1 pl-2 pr-2.5 py-1.5 rounded-md shadow-sm text-[11px] font-medium ${p.plaquette ? 'bg-sage-dark text-white hover:opacity-90' : 'bg-white/95 text-sage-darker hover:bg-sage-50'}`}
                >
                  {p.plaquette ? <Check className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                  {p.plaquette ? 'Incluse' : 'Plaquette'}
                </button>
              </div>
              <div className="absolute bottom-1.5 right-1.5 bg-stone-900/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                #{idx + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Onglet PLANS
// ─────────────────────────────────────────────────────────
function PlansTab({ mandat, plans, onChange, onPreview, saving }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newPlans = [];
      for (const file of files) {
        const compressed = await compressImage(file);
        const cleanName = (compressed.name || 'plan').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${mandat.id}/plans/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${cleanName}`;
        const { error: upErr } = await supabase.storage.from('mandat-photos').upload(path, compressed, {
          contentType: compressed.type || 'application/octet-stream',
          upsert: false,
        });
        if (upErr) { console.error('Upload échoué:', upErr); continue; }
        const { data: signed } = await supabase.storage.from('mandat-photos').createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
        if (signed?.signedUrl) {
          newPlans.push({
            type: 'plan',
            url: signed.signedUrl,
            nom: file.name,
            mime: file.type,
          });
        }
      }
      const combined = [...plans, ...newPlans.map((p, i) => ({ ...p, ordre: plans.length + i }))];
      onChange(combined);
    } catch (e) {
      alert('Erreur upload : ' + e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleDelete(idx) {
    if (!confirm('Supprimer ce plan ?')) return;
    const newPlans = plans.filter((_, i) => i !== idx).map((p, i) => ({ ...p, ordre: i }));
    onChange(newPlans);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-stone-500">PDF, images (JPG/PNG), ou tout fichier de plan.</p>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading || saving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-stone-900 text-white rounded-md hover:bg-stone-800 disabled:opacity-50">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Ajouter un plan
        </button>
        <input ref={fileInputRef} type="file" accept=".pdf,image/*" multiple className="hidden" onChange={(e) => handleFiles(Array.from(e.target.files || []))} />
      </div>

      {plans.length === 0 ? (
        <div className="text-sm text-stone-400 italic py-12 text-center bg-stone-50 rounded-lg border-2 border-dashed border-stone-200">
          Aucun plan ajouté.
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((p, idx) => {
            const isPdf = p.mime?.includes('pdf') || p.url?.toLowerCase().includes('.pdf');
            const isImage = p.mime?.startsWith('image') || /\.(jpg|jpeg|png|webp|gif)/i.test(p.url || '');
            return (
              <div key={p.url + idx} className="flex items-center gap-3 p-3 border border-stone-200 rounded-lg hover:bg-stone-50">
                <div className="w-12 h-12 rounded bg-stone-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {isImage ? <img src={p.url} alt="" className="w-full h-full object-cover" /> : <FileText className="w-5 h-5 text-stone-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-stone-900 truncate">{p.nom || `Plan ${idx + 1}`}</div>
                  <div className="text-xs text-stone-500">{isPdf ? 'PDF' : isImage ? 'Image' : 'Fichier'}</div>
                </div>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-stone-600 hover:bg-stone-100 rounded" title="Ouvrir">
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button onClick={() => handleDelete(idx)} className="p-1.5 text-stone-600 hover:text-red-600 hover:bg-red-50 rounded" title="Supprimer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Section URL (vidéos et visites virtuelles)
// ─────────────────────────────────────────────────────────
function UrlSection({ kind, hint, placeholder, items, onChange, onPreview }) {
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState('');

  function handleAdd() {
    if (!newTitle.trim() || !newUrl.trim()) {
      setError('Titre et URL obligatoires');
      return;
    }
    const platform = detectPlatform(newUrl);
    const newItem = {
      id: crypto.randomUUID(),
      type: kind,
      title: newTitle.trim(),
      url: newUrl.trim(),
      platform,
      created_at: new Date().toISOString(),
    };
    onChange([...items, newItem]);
    setNewTitle('');
    setNewUrl('');
    setShowForm(false);
    setError('');
  }

  function handleDelete(id) {
    if (!confirm('Supprimer ce média ?')) return;
    onChange(items.filter(m => m.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-stone-500">{hint}</p>
        <button onClick={() => { setShowForm(true); setNewTitle(''); setNewUrl(''); setError(''); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-stone-900 text-white rounded-md hover:bg-stone-800">
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="bg-sage-50 border border-sage-light rounded-xl p-4 space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Titre</label>
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm" placeholder={kind === 'video' ? 'Visite extérieure' : 'Visite Matterport 360'} />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">URL</label>
            <input type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono" />
            {newUrl && detectPlatform(newUrl) && (
              <div className="text-xs text-sage-dark mt-1">Plateforme : <strong>{platformLabel(detectPlatform(newUrl))}</strong></div>
            )}
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}</div>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-stone-700 bg-white border border-stone-200 rounded-md hover:bg-stone-50">Annuler</button>
            <button onClick={handleAdd} className="px-3 py-1.5 text-sm bg-sage-dark text-white rounded-md hover:bg-sage-darker flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Ajouter</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-sm text-stone-400 italic py-12 text-center bg-stone-50 rounded-lg border-2 border-dashed border-stone-200">
          Aucun élément ajouté.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(media => {
            const platform = media.platform || detectPlatform(media.url);
            const canEmbed = !!getEmbedUrl(media.url, platform);
            return (
              <div key={media.id || media.url} className="border border-stone-200 rounded-lg p-3 flex items-center gap-3 hover:bg-stone-50">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-stone-900 truncate">{media.title || media.url}</div>
                  <div className="text-xs text-stone-500 flex items-center gap-2 truncate">
                    <span className="px-1.5 py-0.5 rounded-full bg-sage-50 text-sage-darker">{platformLabel(platform)}</span>
                    <span className="truncate">{media.url}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {canEmbed && (
                    <button onClick={() => onPreview(media)} className="p-1.5 text-stone-600 hover:bg-stone-100 rounded" title="Aperçu">
                      <Globe className="w-4 h-4" />
                    </button>
                  )}
                  <a href={media.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-stone-600 hover:bg-stone-100 rounded" title="Ouvrir">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button onClick={() => handleDelete(media.id)} className="p-1.5 text-stone-600 hover:text-red-600 hover:bg-red-50 rounded" title="Supprimer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
            <div className="font-medium text-sm">{media.title || media.url}</div>
            <div className="text-xs text-stone-500">{platformLabel(platform)}</div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="aspect-video bg-stone-900">
          {embedUrl ? (
            <iframe src={embedUrl} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; xr-spatial-tracking; fullscreen" allowFullScreen title={media.title} />
          ) : (
            <div className="flex items-center justify-center h-full text-white text-sm">
              Aperçu non disponible. <a href={media.url} target="_blank" rel="noopener noreferrer" className="underline ml-2">Ouvrir</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
