/**
 * Image compression utility for uploading photos
 */
export const compressImage = async (
  file: File, 
  maxWidth = 1200, 
  quality = 0.8,
  cropToSquare = false
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = img.width;
      let sourceHeight = img.height;
      let targetWidth = img.width;
      let targetHeight = img.height;

      if (cropToSquare) {
        const minDimension = Math.min(img.width, img.height);
        sourceX = (img.width - minDimension) / 2;
        sourceY = (img.height - minDimension) / 2;
        sourceWidth = minDimension;
        sourceHeight = minDimension;
        targetWidth = minDimension;
        targetHeight = minDimension;
      }

      if (targetWidth > maxWidth) {
        const scale = maxWidth / targetWidth;
        targetWidth = maxWidth;
        targetHeight = cropToSquare ? maxWidth : targetHeight * scale;
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(
        img,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, targetWidth, targetHeight
      );

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = URL.createObjectURL(file);
  });
};
