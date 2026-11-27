import { registerPlugin } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { isNativeApp } from '../utils/platform';

const NativeUpdater = registerPlugin('NativeUpdater');

export const LOCAL_APP_VERSION = '2.1.2';
export const LOCAL_ANDROID_VERSION_CODE = 5;
export const DEFAULT_APK_DOWNLOAD_URL = 'https://rutaquilla.me/downloads/RutaQuilla.apk';

export const DEFAULT_RELEASE_NOTES = {
  versionName: LOCAL_APP_VERSION,
  androidVersionCode: LOCAL_ANDROID_VERSION_CODE,
  title: 'RutaQuilla 2.1.2 ya está disponible',
  summary: 'Indicadores más limpios para subir y bajar del bus, guía visual al caminar y trazados de rutas corregidos.',
  downloadUrl: DEFAULT_APK_DOWNLOAD_URL,
  publishedAt: '2026-11-27',
  highlights: [
    {
      category: 'Diseño',
      text: 'Pines más sutiles para indicar dónde subir y bajar del bus sin tapar el mapa ni tus puntos.',
    },
    {
      category: 'Rutas',
      text: 'Trazado peatonal moderno con distancia y tiempo al bajar hacia tu destino, además de guía en 3 pasos.',
    },
    {
      category: 'Mejoras',
      text: 'Corrección de recorridos de buses que presentaban cruces o giros irregulares en el mapa.',
    },
    {
      category: 'Seguridad',
      text: 'Actualización directa dentro de la app Android sin tener que salir al navegador.',
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
