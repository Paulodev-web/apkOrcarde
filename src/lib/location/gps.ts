import * as Location from 'expo-location';

import { POLE_LIMITS } from '@/constants/limits';
import { captureBreadcrumb } from '@/lib/sentry';

export type GpsReading = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export async function captureGps(): Promise<GpsReading | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      captureBreadcrumb('gps', 'Permission denied');
      return null;
    }

    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), POLE_LIMITS.GPS_TIMEOUT_MS),
      ),
    ]);

    if (!location) {
      captureBreadcrumb('gps', 'Timeout');
      return null;
    }

    captureBreadcrumb(
      'gps',
      `Got fix: ${location.coords.latitude.toFixed(5)},${location.coords.longitude.toFixed(5)} acc=${location.coords.accuracy?.toFixed(1) ?? '?'}m`,
    );

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? null,
    };
  } catch (err) {
    captureBreadcrumb('gps', `Error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
