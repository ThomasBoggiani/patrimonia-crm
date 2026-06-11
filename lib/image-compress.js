// lib/image-compress.js
// Compression d'image côté navigateur (canvas, sans dépendance externe).
// Redimensionne à maxWidth/maxHeight et ré-encode en JPEG qualité réglable.
// Une photo pro de 15 Mo descend typiquement à ~300-600 Ko sans perte visible.

/**
 * Compresse un fichier image.
 * @param {File} file - le fichier image d'origine
 * @param {Object} opts - { maxDimension=1920, quality=0.82, mimeType='image/jpeg' }
 * @returns {Promise<File>} - un nouveau File compressé (ou l'original si non-image / échec)
 */
export async function compressImage(file, opts = {}) {
  const {
    maxDimension = 1920,
    quality = 0.82,
    mimeType = 'image/jpeg',
  } = opts;

  // Ne traite que les images bitmap. HEIC non géré par canvas → on laisse passer tel quel.
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  if (file.type === 'image/heic' || file.type === 'image/heif') return file;

  try {
    const dataUrl = await readFileAsDataURL(file);
    const img = await loadImage(dataUrl);

    let { width, height } = img;
    // Calcule les nouvelles dimensions en gardant le ratio
    if (width > maxDimension || height > maxDimension) {
      if (width >= height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, mimeType, quality)
    );

    if (!blob) return file; // échec → on garde l'original

    // Si la compression n'a rien gagné (petite image déjà légère), garder l'original
    if (blob.size >= file.size) return file;

    // Renomme en .jpg puisqu'on ré-encode en JPEG
    const newName = file.name.replace(/\.(png|jpe?g|webp|gif|bmp)$/i, '') + '.jpg';
    return new File([blob], newName, { type: mimeType, lastModified: Date.now() });
  } catch (e) {
    console.warn('[compressImage] échec, upload de l\'original:', e?.message);
    return file; // en cas d'erreur, on n'empêche pas l'upload
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
