'use client';
import React, { useState, useRef } from 'react';
import { Camera, Loader2, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * Composant d'upload de photo de profil.
 * - Resize côté client en max 512x512 (canvas) avant upload (évite les images 5Mo)
 * - Stocke dans le bucket Supabase 'avatars' avec le pattern {profileId}/{timestamp}.jpg
 * - onUploaded(url) appelé avec la nouvelle URL publique
 * - onRemoved() appelé après suppression
 */
export default function AvatarUpload({ profileId, currentUrl, prenom = '', nom = '', size = 'lg', onUploaded, onRemoved, editable = true }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const sizes = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-14 h-14 text-sm',
    lg: 'w-24 h-24 text-2xl',
    xl: 'w-32 h-32 text-3xl',
  };
  const sizeClasses = sizes[size] || sizes.lg;
  const initials = `${(prenom?.[0] || '?').toUpperCase()}${(nom?.[0] || '').toUpperCase()}`;

  const resizeImage = (file, maxSize = 512) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Erreur conversion image'));
          resolve(blob);
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('Image invalide'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Lecture fichier impossible'));
    reader.readAsDataURL(file);
  });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Format non supporté (JPG/PNG uniquement)');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const blob = await resizeImage(file, 512);
      const fileName = `${profileId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      // Cache-busting : ajouter ?t=timestamp pour forcer le navigateur à recharger
      const finalUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: finalUrl })
        .eq('id', profileId);
      if (updateError) throw updateError;

      onUploaded?.(finalUrl);
    } catch (err) {
      console.error('Upload avatar erreur:', err);
      setError(err.message || 'Échec upload');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!confirm('Supprimer la photo de profil ?')) return;
    setUploading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', profileId);
      if (updateError) throw updateError;
      onRemoved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative group">
        <div className={`${sizeClasses} rounded-full overflow-hidden flex items-center justify-center font-medium text-white gradient-sage-dark flex-shrink-0`}>
          {currentUrl ? (
            <img src={currentUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-full bg-ink/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity disabled:cursor-wait"
            title="Changer la photo"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />

      {editable && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs text-sage-dark hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <Upload className="w-3 h-3" /> {currentUrl ? 'Changer' : 'Téléverser'}
          </button>
          {currentUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="text-xs text-red-600 hover:underline flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> Retirer
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 max-w-[200px] text-center">{error}</div>
      )}
    </div>
  );
}
