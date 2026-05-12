import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { MEDIA_LIMITS } from '@/constants/limits';
import type { MediaAsset } from '@/types';

import { compressImage } from './compress';

export async function pickImage(source: 'camera' | 'gallery'): Promise<MediaAsset | null> {
  const hasPermission = await requestPermission(source);
  if (!hasPermission) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const compressed = await compressImage(asset.uri);

  const ext = asset.fileName?.split('.').pop() ?? 'jpg';
  const fileName = asset.fileName ?? `foto_${Date.now()}.${ext}`;

  return {
    uri: compressed.uri,
    type: 'image',
    fileName,
    mimeType: asset.mimeType ?? 'image/jpeg',
    fileSize: compressed.fileSize || asset.fileSize || 0,
    width: compressed.width || asset.width,
    height: compressed.height || asset.height,
  };
}

export async function pickVideo(source: 'camera' | 'gallery'): Promise<MediaAsset | null> {
  const hasPermission = await requestPermission(source);
  if (!hasPermission) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['videos'],
    videoMaxDuration: MEDIA_LIMITS.VIDEO_MAX_DURATION_SECONDS,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    allowsEditing: false,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const ext = asset.fileName?.split('.').pop() ?? 'mp4';
  const fileName = asset.fileName ?? `video_${Date.now()}.${ext}`;

  return {
    uri: asset.uri,
    type: 'video',
    fileName,
    mimeType: asset.mimeType ?? 'video/mp4',
    fileSize: asset.fileSize || 0,
    width: asset.width,
    height: asset.height,
    durationSeconds: asset.duration ? Math.round(asset.duration / 1000) : undefined,
  };
}

async function requestPermission(source: 'camera' | 'gallery'): Promise<boolean> {
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permissao necessaria',
        'O app precisa de acesso a camera para tirar fotos. Habilite nas configuracoes do dispositivo.',
      );
      return false;
    }
    return true;
  }

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permissao necessaria',
      'O app precisa de acesso a galeria para selecionar midias. Habilite nas configuracoes do dispositivo.',
    );
    return false;
  }
  return true;
}
