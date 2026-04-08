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

/** JPEGファイルのEXIF Orientationタグを読み取る（1=正常、6=時計回り90°、8=反時計回り90°、3=180°） */
function readExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  // SOIマーカー確認
  if (view.byteLength < 2 || view.getUint16(0, false) !== 0xFFD8) return 1;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset, false);
    offset += 2;
    if (marker === 0xFFE1) {
      // APP1: EXIFヘッダー確認
      const segmentLength = view.getUint16(offset, false);
      if (offset + 4 > view.byteLength) break;
      const exifHeader = view.getUint32(offset + 2, false);
      if (exifHeader !== 0x45786966) { offset += segmentLength; continue; } // "Exif"
      const tiffStart = offset + 6;
      if (tiffStart + 8 > view.byteLength) break;
      const littleEndian = view.getUint16(tiffStart, false) === 0x4949;
      const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
      const ifdStart = tiffStart + ifdOffset;
      if (ifdStart + 2 > view.byteLength) break;
      const entries = view.getUint16(ifdStart, littleEndian);
      for (let i = 0; i < entries; i++) {
        const entryOffset = ifdStart + 2 + i * 12;
        if (entryOffset + 12 > view.byteLength) break;
        const tag = view.getUint16(entryOffset, littleEndian);
        if (tag === 0x0112) {
          return view.getUint16(entryOffset + 8, littleEndian);
        }
      }
      break;
    } else if ((marker & 0xFF00) === 0xFF00) {
      offset += view.getUint16(offset, false);
    } else {
      break;
    }
  }
  return 1;
}

/**
 * ファイルをEXIF向きを考慮してリサイズしたbase64を返す。
 * 一部のモバイルブラウザはcanvas描画時にEXIF回転を無視するため、明示的に補正する。
 */
export function resizeWithOrientation(file: File, maxPx = 1200): Promise<string> {
  return new Promise((resolve) => {
    // ArrayBufferでEXIF向きを読む
    const bufReader = new FileReader();
    bufReader.onload = (bufEvent) => {
      const orientation = readExifOrientation(bufEvent.target?.result as ArrayBuffer);

      // DataURLで画像を読む
      const dataReader = new FileReader();
      dataReader.onload = (dataEvent) => {
        const raw = dataEvent.target?.result as string;
        const img = new Image();
        img.onload = () => {
          // 90/270度回転の場合は幅と高さを入れ替える
          const swap = orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8;
          const srcW = img.width;
          const srcH = img.height;
          const logicalW = swap ? srcH : srcW;
          const logicalH = swap ? srcW : srcH;

          const scale = Math.min(maxPx / logicalW, maxPx / logicalH, 1);
          const outW = Math.round(logicalW * scale);
          const outH = Math.round(logicalH * scale);

          const canvas = document.createElement("canvas");
          canvas.width = outW;
          canvas.height = outH;
          const ctx = canvas.getContext("2d")!;

          // EXIF向きに合わせてcanvasを変換
          ctx.save();
          switch (orientation) {
            case 2: ctx.transform(-1, 0, 0,  1, outW, 0);           break; // 水平反転
            case 3: ctx.transform(-1, 0, 0, -1, outW, outH);        break; // 180°
            case 4: ctx.transform( 1, 0, 0, -1, 0,    outH);        break; // 垂直反転
            case 5: ctx.transform( 0, 1, 1,  0, 0,    0);           break; // 転置
            case 6: ctx.transform( 0, 1,-1,  0, outW, 0);           break; // 時計回り90°
            case 7: ctx.transform( 0,-1,-1,  0, outW, outH);        break; // 反時計+反転
            case 8: ctx.transform( 0,-1, 1,  0, 0,    outH);        break; // 反時計回り90°
            // 1: そのまま
          }
          ctx.drawImage(img, 0, 0, srcW * scale, srcH * scale);
          ctx.restore();

          resolve(canvas.toDataURL("image/jpeg", 0.72));
        };
        img.src = raw;
      };
      dataReader.readAsDataURL(file);
    };
    bufReader.readAsArrayBuffer(file);
  });
}

/** Resize image to max dimension before upload to save storage/bandwidth */
export function resizeImage(base64: string, maxPx = 1200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.src = base64;
  });
}
