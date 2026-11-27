package me.rutaquilla.app.updater;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativeUpdater")
public class NativeUpdaterPlugin extends Plugin {

    private static final String UPDATE_DIR = "updates";
    private static final String APK_FILENAME = "RutaQuilla-update.apk";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private File getApkFile() {
        File dir = new File(getContext().getCacheDir(), UPDATE_DIR);
        if (!dir.exists()) {
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
        }
        return new File(dir, APK_FILENAME);
    }

    private boolean canRequestInstalls() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return getContext().getPackageManager().canRequestPackageInstalls();
        }
        return true;
    }

    private void openUnknownSourcesSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
    }

    private void launchApkInstaller(File apkFile) {
        Context ctx = getContext();
        Uri contentUri = FileProvider.getUriForFile(
            ctx,
            ctx.getPackageName() + ".fileprovider",
            apkFile
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        ctx.startActivity(intent);
    }

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", canRequestInstalls());
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        openUnknownSourcesSettings();
        call.resolve();
    }

    @PluginMethod
    public void installDownloadedUpdate(PluginCall call) {
        File apkFile = getApkFile();
        if (!apkFile.exists() || apkFile.length() < 100_000L) {
            call.reject("No hay ninguna actualización descargada lista para instalar.");
            return;
        }
        if (!canRequestInstalls()) {
            openUnknownSourcesSettings();
            JSObject ret = new JSObject();
            ret.put("status", "permission_required");
            call.resolve(ret);
            return;
        }
        try {
            launchApkInstaller(apkFile);
            JSObject ret = new JSObject();
            ret.put("status", "installing");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("No se pudo abrir el instalador de Android: " + e.getMessage());
        }
    }

    @PluginMethod
    public void downloadAndInstallUpdate(PluginCall call) {
        String rawUrl = call.getString("url", "");
        if (rawUrl == null || !rawUrl.trim().startsWith("https://")) {
            call.reject("Enlace de actualización no válido.");
            return;
        }
        final String targetUrl = rawUrl.trim();

        executor.execute(() -> {
            HttpURLConnection conn = null;
            File tmpFile = null;
            try {
                File apkFile = getApkFile();
                if (apkFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    apkFile.delete();
                }
                tmpFile = new File(apkFile.getParentFile(), APK_FILENAME + ".tmp");
                if (tmpFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    tmpFile.delete();
                }

                String currentUrl = targetUrl;
                int redirects = 0;
                while (redirects < 5) {
                    URL url = new URL(currentUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.setInstanceFollowRedirects(false);
                    conn.setRequestProperty("User-Agent", "RutaQuilla-Android-Updater");
                    int code = conn.getResponseCode();
                    if (code == HttpURLConnection.HTTP_MOVED_PERM
                        || code == HttpURLConnection.HTTP_MOVED_TEMP
                        || code == 307
                        || code == 308) {
                        String location = conn.getHeaderField("Location");
                        conn.disconnect();
                        if (location == null || !location.startsWith("https://")) {
                            throw new IllegalStateException("Redirección de descarga no segura.");
                        }
                        currentUrl = location;
                        redirects++;
                        continue;
                    }
                    if (code < 200 || code >= 300) {
                        throw new IllegalStateException("Servidor respondió con estado " + code);
                    }
                    break;
                }

                if (conn == null) {
                    throw new IllegalStateException("No se pudo conectar al servidor.");
                }

                long totalBytes = conn.getContentLengthLong();
                long downloadedBytes = 0;
                int lastPercent = -1;

                try (InputStream in = new BufferedInputStream(conn.getInputStream());
                     FileOutputStream out = new FileOutputStream(tmpFile)) {
                    byte[] buffer = new byte[16 * 1024];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        downloadedBytes += read;
                        int percent = totalBytes > 0
                            ? (int) Math.min(99, (downloadedBytes * 100L) / totalBytes)
                            : 0;
                        if (percent != lastPercent && (percent % 2 == 0 || percent == 99)) {
                            lastPercent = percent;
                            JSObject prog = new JSObject();
                            prog.put("phase", "downloading");
                            prog.put("progress", percent);
                            prog.put("downloadedBytes", downloadedBytes);
                            prog.put("totalBytes", totalBytes);
                            notifyListeners("updateProgress", prog);
                        }
                    }
                    out.flush();
                }

                if (!tmpFile.exists() || tmpFile.length() < 100_000L) {
                    throw new IllegalStateException("El archivo descargado está incompleto.");
                }

                if (!tmpFile.renameTo(apkFile)) {
                    throw new IllegalStateException("No se pudo preparar el archivo para instalar.");
                }

                JSObject ready = new JSObject();
                ready.put("phase", "ready");
                ready.put("progress", 100);
                ready.put("downloadedBytes", apkFile.length());
                ready.put("totalBytes", apkFile.length());
                notifyListeners("updateProgress", ready);

                if (!canRequestInstalls()) {
                    if (getActivity() != null) {
                        getActivity().runOnUiThread(() -> {
                            openUnknownSourcesSettings();
                            JSObject ret = new JSObject();
                            ret.put("status", "permission_required");
                            ret.put("fileReady", true);
                            call.resolve(ret);
                        });
                    } else {
                        JSObject ret = new JSObject();
                        ret.put("status", "permission_required");
                        ret.put("fileReady", true);
                        call.resolve(ret);
                    }
                    return;
                }

                if (getActivity() != null) {
                    getActivity().runOnUiThread(() -> {
                        try {
                            launchApkInstaller(apkFile);
                            JSObject ret = new JSObject();
                            ret.put("status", "installing");
                            call.resolve(ret);
                        } catch (Exception e) {
                            call.reject("No se pudo iniciar la instalación: " + e.getMessage());
                        }
                    });
                } else {
                    launchApkInstaller(apkFile);
                    JSObject ret = new JSObject();
                    ret.put("status", "installing");
                    call.resolve(ret);
                }
            } catch (Exception e) {
                if (tmpFile != null && tmpFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    tmpFile.delete();
                }
                call.reject("No se pudo descargar la actualización: " + e.getMessage());
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }
}
