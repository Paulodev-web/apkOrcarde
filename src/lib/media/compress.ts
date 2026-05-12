import * as ImageManipulator from 'expo-image-manipulator';

import { MEDIA_LIMITS } from '@/constants/limits';
import { captureException } from '@/lib/sentry';

type CompressResult = {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
};

export async function compressImage(uri: string): Promise<CompressResult> {
  try {
    const actions: ImageManipulator.Action[] = [];

    const source = await ImageManipulator.manipulateAsync(uri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    });

    const { width: origW, height: origH } = source;
    const maxW = MEDIA_LIMITS.IMAGE_MAX_WIDTH;
    const maxH = MEDIA_LIMITS.IMAGE_MAX_HEIGHT;

    if (origW > maxW || origH > maxH) {
      const scale = Math.min(maxW / origW, maxH / origH);
      actions.push({
        resize: {
          width: Math.round(origW * scale),
          height: Math.round(origH * scale),
        },
      });
    }

    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: MEDIA_LIMITS.IMAGE_JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    const fileInfo = await getFileSize(result.uri);

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      fileSize: fileInfo,
    };
  } catch (err) {
    captureException(err);

    return {
      uri,
      width: 0,
      height: 0,
      fileSize: 0,
    };
  }
}

async function getFileSize(uri: string): Promise<number> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch {
    return 0;
  }
}
