import { registerPlugin } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { isNativeApp } from '../utils/platform';

const NativeUpdater = registerPlugin('NativeUpdater');

export const LOCAL_APP_VERSION = '2.1.3';
export const LOCAL_ANDROID_VERSION_CODE = 6;
export const DEFAULT_APK_DOWNLOAD_URL = 'https://rutaquilla.me/downloads/RutaQuilla.apk';

export const DEFAULT_RELEASE_NOTES = {
  versionName: LOCAL_APP_VERSION,
  androidVersionCode: LOCAL_ANDROID_VERSION_CODE,
  title: 'RutaQuilla 2.1.3 ya está disponible',
  summary: 'Guía visual para instalar la app en Android sin dudas y activación automática de actualizaciones en un paso.',
  downloadUrl: DEFAULT_APK_DOWNLOAD_URL,
  publishedAt: '2026-11-27',
  highlights: [
    {
      category: 'Mejoras',
      text: 'Tutorial paso a paso al descargar RutaQuilla desde la web móvil para que instalar sea rápido y claro.',
    },
    {
      category: 'Seguridad',
      text: 'Guía de permiso único dentro de la app Android que desaparece automáticamente una vez activado.',
    },
    {
      category: 'Diseño',
      text: 'Pines más sutiles para indicar dónde subir y bajar del bus, además de guía visual de caminata.',
    },
    {
      category: 'Rutas',
      text: 'Recorridos urbanos verificados para evitar trazados irregulares en el mapa.',
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

export async function checkCanInstallPackages() {
  if (!isNativeApp()) {
    return { supported: false, granted: true };
  }
  try {
    const res = await NativeUpdater.canInstallPackages();
    return { supported: true, granted: Boolean(res?.granted) };
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (/not implemented|UNIMPLEMENTED|does not have/i.test(msg)) {
      return { supported: false, granted: false };
    }
    return { supported: false, granted: false };
  }
}

export async function openAndroidInstallPermissionSettings() {
  if (!isNativeApp()) return;
  try {
    await NativeUpdater.openInstallPermissionSettings();
  } catch {
    // Ignorado en versiones antiguas sin el plugin nativo
  }
}

export async function startInAppAndroidUpdate(url, onProgress) {
  if (!isNativeApp()) {
    return { status: 'unsupported' };
  }
  let listenerHandle = null;
  try {
    if (typeof onProgress === 'function') {
      listenerHandle = await NativeUpdater.addListener('updateProgress', onProgress);
    }
    const result = await NativeUpdater.downloadAndInstallUpdate({ url });
    return result || { status: 'installing' };
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (/not implemented|UNIMPLEMENTED|does not have/i.test(msg)) {
      return { status: 'unsupported' };
    }
    throw err;
  } finally {
    if (listenerHandle && typeof listenerHandle.remove === 'function') {
      try {
        await listenerHandle.remove();
      } catch {
        // Ignorado
      }
    }
  }
}

export async function retryInstallDownloadedUpdate() {
  if (!isNativeApp()) return { status: 'unsupported' };
  return NativeUpdater.installDownloadedUpdate();
}
