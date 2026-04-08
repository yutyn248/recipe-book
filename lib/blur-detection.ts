/**
 * Laplacian variance method for blur detection.
 * Returns a sharpness score from 0 to 100.
 * Below threshold = blurry.
 */
export function detectBlur(imageElement: HTMLImageElement): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const maxSize = 400;
  const scale = Math.min(maxSize / imageElement.width, maxSize / imageElement.height, 1);
  canvas.width = imageElement.width * scale;
  canvas.height = imageElement.height * scale;

  ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const grayscale = toGrayscale(imageData);
  const laplacian = applyLaplacian(grayscale, canvas.width, canvas.height);
  const variance = computeVariance(laplacian);

  // Normalize to 0-100 scale (empirically tuned)
  const normalized = Math.min(100, (variance / 500) * 100);
  return Math.round(normalized);
}

function toGrayscale(imageData: ImageData): number[] {
  const data = imageData.data;
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return gray;
}

function applyLaplacian(gray: number[], width: number, height: number): number[] {
  const kernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];
  const result: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = gray[(y + ky) * width + (x + kx)];
          sum += pixel * kernel[(ky + 1) * 3 + (kx + 1)];
        }
      }
      result.push(sum);
    }
  }
  return result;
}

function computeVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return variance;
}

/**
 * Average luminance detection.
 * Returns brightness 0–255. Below threshold = too dark.
 */
export function detectBrightness(imageElement: HTMLImageElement): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const maxSize = 200;
  const scale = Math.min(maxSize / imageElement.width, maxSize / imageElement.height, 1);
  canvas.width = imageElement.width * scale;
  canvas.height = imageElement.height * scale;
  ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return sum / (data.length / 4);
}
