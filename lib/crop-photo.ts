export interface PhotoRegion {
  topPercent: number;
  leftPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export function cropPhoto(base64: string, region: PhotoRegion): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const sx = (region.leftPercent / 100) * img.width;
      const sy = (region.topPercent / 100) * img.height;
      const sw = (region.widthPercent / 100) * img.width;
      const sh = (region.heightPercent / 100) * img.height;

      canvas.width = sw;
      canvas.height = sh;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = base64;
  });
}

/** Resize image to max dimension before upload to save storage/bandwidth */
export function resizeImage(base64: string, maxPx = 1600): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.src = base64;
  });
}
