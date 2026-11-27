import { App as CapacitorApp } from '@capacitor/app';
import { isNativeApp } from '../utils/platform';

export const LOCAL_APP_VERSION = '2.1.0';
export const LOCAL_ANDROID_VERSION_CODE = 3;
export const DEFAULT_APK_DOWNLOAD_URL = 'https://rutaquilla.me/downloads/RutaQuilla.apk';

export const DEFAULT_RELEASE_NOTES = {
  versionName: LOCAL_APP_VERSION,
  androidVersionCode: LOCAL_ANDROID_VERSION_CODE,
  title: 'RutaQuilla 2.1.0 ya está disponible',
  summary: 'Interfaz más cómoda en celular, accesos rápidos a tus lugares favoritos y avisos claros de cada mejora.',
  downloadUrl: DEFAULT_APK_DOWNLOAD_URL,
  publishedAt: '2026-11-27',
  highlights: [
    {
      category: 'Diseño',
      text: 'Barra superior más limpia en celulares para leer el nombre y navegar con comodidad.',
    },
    {
      category: 'Rutas',
      text: 'Guarda tu Casa y Trabajo para calcular tu ruta con un solo toque.',
    },
    {
      category: 'Seguridad',
      text: 'Protección reforzada de cuentas y detección automática de nuevas versiones.',
    },
    {
      category: 'Mejoras',
      text: 'Aviso discreto cuando navegas sin conexión usando tus rutas guardadas.',
    },
  ],
};

export function compareSemver(a, b) {
  const partsA = String(a || '0.0.0').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const partsB = String(b || '0.0.0').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(partsA.length, partsB.length, 3);
  for (let i = 0; i < len; i += 1) {
    const va = partsA[i] || 0;
    const vb = partsB[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export async function getInstalledVersionInfo() {
  if (!isNativeApp()) {
    return {
      isNative: false,
      versionName: LOCAL_APP_VERSION,
      versionCode: LOCAL_ANDROID_VERSION_CODE,
    };
  }
  try {
    const info = await CapacitorApp.getInfo();
    const versionName = String(info?.version || LOCAL_APP_VERSION).trim() || LOCAL_APP_VERSION;
    const parsedCode = Number.parseInt(info?.build, 10);
    return {
      isNative: true,
      versionName,
      versionCode: Number.isFinite(parsedCode) && parsedCode > 0 ? parsedCode : LOCAL_ANDROID_VERSION_CODE,
    };
  } catch {
    return {
      isNative: true,
      versionName: LOCAL_APP_VERSION,
      versionCode: LOCAL_ANDROID_VERSION_CODE,
    };
  }
}

export function isAndroidUpdateAvailable(installedInfo, appRelease) {
  if (!isNativeApp() || !appRelease) return false;
  const localCode = Number(installedInfo?.versionCode) || LOCAL_ANDROID_VERSION_CODE;
  const remoteCode = Number(appRelease.androidVersionCode) || 0;
  if (remoteCode > localCode) return true;
  if (remoteCode === localCode) {
    return compareSemver(appRelease.versionName, installedInfo?.versionName || LOCAL_APP_VERSION) > 0;
  }
  return false;
}
