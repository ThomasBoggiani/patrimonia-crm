'use client';
import React, { useState, useRef } from 'react';
import {
  Camera, Upload, Image as ImageIcon, X, Loader2, AlertCircle, Trash2, Eye, Star, GripVertical
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { compressImage } from '@/lib/photo-utils';

// ─────────────────────────────────────────────────────────────────
// @dnd-kit imports
// ─────────────────────────────────────────────────────────────────
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * PhotoUploader — composant réutilisable pour uploader, ordonner et marquer
 * une photo de couverture pour les mandats.
 *
 * Props :
 * - mandatId (string) : ID du mandat (obligatoire)
 * - photos (array) : photos existantes [{ url, name, source, uploaded_at, uploaded_by }]
 * - onChange (function) : appelé avec le nouveau tableau de photos
 * - storage ('supabase' | 'dropbox') : où stocker (défaut 'supabase')
 *
 * Logique :
 * - photos[0] = couverture (utilisée par les exports PDF)
 * - Drag & drop pour réordonner
 * - Bouton "étoile" pour mettre une photo en couverture (la place en photos[0])
 */
export default function PhotoUploader({ mandatId, photos = [], onChange, storage = 'supabase' }) {
  const { user, profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Détection mobile
  const isMobileDevice = typeof window !== 'undefined' &&
    (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768);

  // ─────────────────────────────────────────────────────────────
  // Configuration sensors @dnd-kit (souris + tactile + clavier)
  // ─────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // ne se déclenche qu'après 8px de drag
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 }, // long-press sur mobile
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ─────────────────────────────────────────────────────────────
  // Upload sur Supabase Storage
  // ─────────────────────────────────────────────────────────────
  async function uploadToSupabase(file) {
    const fileName = `${mandatId}/${Date.now()}-${file.name || 'photo.jpg'}`.replace(/[^a-zA-Z0-9._/-]/g, '-');

    const { data, error } = await supabase.storage
      .from('mandat-photos')
      .upload(fileName, file, {
        contentType: file.type || 'image/jpeg',
        upsert: false
      });

    if (error) throw error;

    const { data: urlData } = await supabase.storage
      .from('mandat-photos')
      .createSignedUrl(data.path, 60 * 60 * 24 * 365);

    return {
      url: urlData?.signedUrl,
      path: data.path,
      name: file.name || `photo-${Date.now()}.jpg`,
      source: 'supabase',
      uploaded_at: new Date().toISOString(),
      uploaded_by: profile ? `${profile.prenom} ${profile.nom}` : 'Utilisateur'
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Handler upload
  // ─────────────────────────────────────────────────────────────
  async function handleFiles(fileList) {
    setError(null);
    setUploading(true);

    try {
      const filesToProcess = Array.from(fileList);
      const newPhotos = [];

      for (const file of filesToProcess) {
        const compressed = await compressImage(file, {
          maxSize: 1920,
          quality: 0.8,
          maxFileSize: 2 * 1024 * 1024
        });

        let photo;
        if (storage === 'supabase') {
          photo = await uploadToSupabase(compressed);
        } else {
          throw new Error('Stockage Dropbox pas encore implémenté ici');
        }

        newPhotos.push(photo);
      }

      onChange([...photos, ...newPhotos]);
    } catch (e) {
      console.error('Erreur upload photo:', e);
      setError(e.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Supprimer une photo
  // ─────────────────────────────────────────────────────────────
  async function handleDelete(idx) {
    const photo = photos[idx];
    if (!confirm(`Supprimer ${photo.name} ?`)) return;

    if (photo.source === 'supabase' && photo.path) {
      try {
        await supabase.storage.from('mandat-photos').remove([photo.path]);
      } catch (e) {
        console.warn('Suppression storage échouée:', e);
      }
    }

    onChange(photos.filter((_, i) => i !== idx));
  }

  // ─────────────────────────────────────────────────────────────
  // Marquer une photo comme couverture (la place en première position)
  // ─────────────────────────────────────────────────────────────
  function handleSetCover(idx) {
    if (idx === 0) return; // déjà couverture
    const newPhotos = [...photos];
    const [photo] = newPhotos.splice(idx, 1);
    newPhotos.unshift(photo);
    onChange(newPhotos);
  }

  // ─────────────────────────────────────────────────────────────
  // Drag & drop : réordonner
  // ─────────────────────────────────────────────────────────────
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = photos.findIndex((p, i) => getPhotoId(p, i) === active.id);
    const newIndex = photos.findIndex((p, i) => getPhotoId(p, i) === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      onChange(arrayMove(photos, oldIndex, newIndex));
    }
  }

  // Pour @dnd-kit, chaque item a besoin d'un id unique stable
  function getPhotoId(photo, idx) {
    return photo.path || photo.url || `photo-${idx}`;
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  const photoIds = photos.map((p, i) => getPhotoId(p, i));

  return (
    <div className="space-y-3">
      {/* Inputs cachés */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
        className="hidden"
      />

      {/* Boutons upload */}
      <div className="flex flex-wrap gap-2">
        {isMobileDevice && (
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2.5 bg-ink-deep text-white rounded-lg text-sm font-medium hover:bg-ink disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            Prendre une photo
          </button>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-cream-dark text-ink rounded-lg text-sm font-medium hover:bg-cream-50 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {isMobileDevice ? 'Galerie' : 'Choisir des photos'}
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Aide drag & drop */}
      {photos.length > 1 && (
        <p className="text-xs text-ink/50 italic">
          💡 Glissez-déposez les photos pour les réorganiser. La première est utilisée comme couverture du PDF.
        </p>
      )}

      {/* Galerie miniatures avec drag & drop */}
      {photos.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={photoIds} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {photos.map((photo, idx) => (
                <SortablePhoto
                  key={getPhotoId(photo, idx)}
                  id={getPhotoId(photo, idx)}
                  photo={photo}
                  idx={idx}
                  isCover={idx === 0}
                  onPreview={() => setPreview(photo)}
                  onDelete={() => handleDelete(idx)}
                  onSetCover={() => handleSetCover(idx)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {photos.length === 0 && !uploading && (
        <div className="text-center py-6 border border-dashed border-cream-dark rounded-lg">
          <ImageIcon className="w-8 h-8 mx-auto text-cream-400 mb-1" />
          <p className="text-xs text-ink/60">Aucune photo pour le moment</p>
        </div>
      )}

      {/* Modal preview plein écran */}
      {preview && (
        <div
          className="fixed inset-0 bg-ink/90 z-50 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <button
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={preview.url}
            alt={preview.name}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur text-white px-3 py-1.5 rounded-full text-xs">
            {preview.name} · {preview.uploaded_by}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Photo sortable (avec drag handle)
// ─────────────────────────────────────────────────────────────────

function SortablePhoto({ id, photo, idx, isCover, onPreview, onDelete, onSetCover }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group aspect-square rounded-lg overflow-hidden border bg-cream-50 ${
        isCover ? 'border-amber-400 ring-2 ring-amber-200' : 'border-cream-dark'
      }`}
    >
      {/* Image */}
      <img
        src={photo.url}
        alt={photo.name}
        className="w-full h-full object-cover cursor-pointer"
        onClick={onPreview}
      />

      {/* Badge "Couverture" */}
      {isCover && (
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-2 py-0.5 bg-amber-400 text-ink-deep text-[10px] font-semibold uppercase tracking-wide rounded shadow">
          <Star className="w-2.5 h-2.5 fill-current" />
          Couverture
        </div>
      )}

      {/* Drag handle (poignée) — toujours visible en haut à droite */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 hover:bg-white rounded-md text-ink cursor-grab active:cursor-grabbing touch-none"
        title="Glisser pour réordonner"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {/* Boutons action (au survol) */}
      <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/20 transition-colors flex items-end justify-end p-1.5 gap-1 opacity-0 group-hover:opacity-100 pointer-events-none">
        <div className="flex gap-1 pointer-events-auto">
          {!isCover && (
            <button
              type="button"
              onClick={onSetCover}
              className="p-1.5 bg-white/90 hover:bg-amber-100 hover:text-amber-700 rounded-md text-ink"
              title="Définir comme couverture"
            >
              <Star className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onPreview}
            className="p-1.5 bg-white/90 hover:bg-white rounded-md text-ink"
            title="Voir en grand"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 bg-white/90 hover:bg-red-50 hover:text-red-600 rounded-md text-ink"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
