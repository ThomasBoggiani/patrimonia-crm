// Compresse une image (File ou Blob) en JPEG à qualité réduite
// Garde les proportions, max 1920px sur le plus grand côté, qualité 0.8
// Retourne un Blob compressé
export async function compressImage(file, options = {}) {
  const { 
    maxSize = 1920,        // taille max du plus grand côté en pixels
    quality = 0.8,          // qualité JPEG (0-1)
    maxFileSize = 2 * 1024 * 1024,  // 2 Mo
    mimeType = 'image/jpeg'
  } = options;

  // Si l'image est déjà petite et au bon format, on ne fait rien
  if (file.size < maxFileSize && file.type === mimeType) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erreur lecture fichier'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image illisible'));
      img.onload = () => {
        // Calculer les nouvelles dimensions en gardant les proportions
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        // Dessiner sur un canvas pour compresser
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir en blob avec la qualité demandée
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Erreur compression'));
            // Donner un nom au blob (les blobs n'ont pas de name par défaut)
            blob.name = file.name?.replace(/\.\w+$/, '.jpg') || `photo-${Date.now()}.jpg`;
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

// Convertit un File/Blob en base64 (pour APIs comme Anthropic)
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // sans le préfixe data:image/...;base64,
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Détecte si le navigateur est sur mobile (pour adapter l'UI)
export function isMobile() {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
}
