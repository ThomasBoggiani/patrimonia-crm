// lib/photo-utils.js — VERSION CORRIGÉE
//
// Compresse une image (File ou Blob) en JPEG à qualité réduite.
// Garde les proportions, max 1600 px sur le plus grand côté, qualité 0.78.
// Retourne un Blob compressé.
//
// Skip uniquement si l'image est déjà petite ET basse résolution.

export async function compressImage(file, options = {}) {
  const {
    maxSize = 1600,
    quality = 0.78,
    skipIfSmallerThan = 500 * 1024, // skip si < 500 Ko ET résolution OK
    mimeType = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erreur lecture fichier'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image illisible'));
      img.onload = () => {
        const originalSize = file.size;
        let { width, height } = img;
        const needsResize = width > maxSize || height > maxSize;
        const needsRecompress = file.type !== mimeType || file.size > skipIfSmallerThan;

        // Skip seulement si déjà petit ET bonne résolution ET bon format
        if (!needsResize && !needsRecompress) {
          console.log(`[compressImage] Skip (déjà optimal) : ${file.name} ${(originalSize / 1024).toFixed(0)} Ko`);
          resolve(file);
          return;
        }

        if (needsResize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Erreur compression'));
            blob.name = file.name?.replace(/\.\w+$/, '.jpg') || `photo-${Date.now()}.jpg`;
            const ratio = ((1 - blob.size / originalSize) * 100).toFixed(0);
            console.log(
              `[compressImage] ${file.name} : ${(originalSize / 1024).toFixed(0)} Ko → ${(blob.size / 1024).toFixed(0)} Ko (-${ratio}%) ${img.width}×${img.height} → ${width}×${height}`
            );
            resolve(blob);
          },
          mimeType,
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function isMobile() {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
}
