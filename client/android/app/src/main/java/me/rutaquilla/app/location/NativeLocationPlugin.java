package me.rutaquilla.app.location;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.List;

@CapacitorPlugin(
    name = "NativeLocation",
    permissions = {
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION
            }
        ),
        @Permission(
            alias = "notifications",
            strings = {
                Manifest.permission.POST_NOTIFICATIONS
            }
        )
    }
)
public class NativeLocationPlugin extends Plugin {

    private boolean isLocationServiceEnabled() {
        LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return false;
        return lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
            || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
    }

    @PluginMethod
    public void checkAndRequestPermissions(PluginCall call) {
        boolean backgroundCapture = call.getBoolean("backgroundCapture", false);
        boolean locGranted = getPermissionState("location") == PermissionState.GRANTED;
        boolean needNotif = backgroundCapture
            && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState("notifications") != PermissionState.GRANTED;

        if (locGranted && !needNotif) {
            resolvePermissionStatus(call);
            return;
        }

        if (needNotif && !locGranted) {
            requestPermissionForAliases(new String[]{"location", "notifications"}, call, "onPermissionResult");
        } else if (!locGranted) {
            requestPermissionForAlias("location", call, "onPermissionResult");
        } else {
            requestPermissionForAlias("notifications", call, "onPermissionResult");
        }
    }

    @PermissionCallback
    private void onPermissionResult(PluginCall call) {
        resolvePermissionStatus(call);
    }

    private void resolvePermissionStatus(PluginCall call) {
        boolean granted = getPermissionState("location") == PermissionState.GRANTED;
        boolean gpsEnabled = isLocationServiceEnabled();

        JSObject res = new JSObject();
        res.put("granted", granted);
        res.put("gpsEnabled", gpsEnabled);
        res.put("canAskAgain", true);
        if (!granted) {
            res.put("message", "Debes permitir el acceso a la ubicación para usar el mapa y grabar rutas.");
        } else if (!gpsEnabled) {
            res.put("message", "El GPS del teléfono está apagado. Actívalo para continuar.");
        } else {
            res.put("message", "");
        }
        call.resolve(res);
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        JSObject res = new JSObject();
        res.put("ok", true);
        call.resolve(res);
    }

    @PluginMethod
    public void startForegroundCapture(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Permiso de ubicación requerido para grabar la ruta.", "PERMISSION_DENIED");
            return;
        }

        String routeName = call.getString("routeName", "Ruta en vivo");
        String company = call.getString("company", "RutaQuilla");

        LocationCaptureService.setListener(point -> {
            JSObject payload = new JSObject();
            payload.put("lat", point.lat);
            payload.put("lng", point.lng);
            payload.put("accuracy", point.accuracy);
            payload.put("timestamp", point.timestamp);
            notifyListeners("locationUpdate", payload);
        });

        Intent serviceIntent = new Intent(getContext(), LocationCaptureService.class);
        serviceIntent.setAction(LocationCaptureService.ACTION_START);
        serviceIntent.putExtra(LocationCaptureService.EXTRA_ROUTE_NAME, routeName);
        serviceIntent.putExtra(LocationCaptureService.EXTRA_COMPANY, company);

        ContextCompat.startForegroundService(getContext(), serviceIntent);

        JSObject res = new JSObject();
        res.put("started", true);
        call.resolve(res);
    }

    @PluginMethod
    public void updateCaptureNotification(PluginCall call) {
        int points = call.getInt("points", 0);
        Intent intent = new Intent(getContext(), LocationCaptureService.class);
        intent.setAction(LocationCaptureService.ACTION_UPDATE_COUNT);
        intent.putExtra(LocationCaptureService.EXTRA_POINTS, points);
        try {
            getContext().startService(intent);
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void stopForegroundCapture(PluginCall call) {
        LocationCaptureService.setListener(null);
        List<LocationCaptureService.CapturedPoint> buffered = LocationCaptureService.drainBufferedPoints();

        Intent stopIntent = new Intent(getContext(), LocationCaptureService.class);
        try {
            getContext().stopService(stopIntent);
        } catch (Exception ignored) {}

        JSArray arr = new JSArray();
        for (LocationCaptureService.CapturedPoint pt : buffered) {
            JSObject obj = new JSObject();
            obj.put("lat", pt.lat);
            obj.put("lng", pt.lng);
            obj.put("accuracy", pt.accuracy);
            obj.put("timestamp", pt.timestamp);
            arr.put(obj);
        }

        JSObject res = new JSObject();
        res.put("stopped", true);
        res.put("bufferedPoints", arr);
        call.resolve(res);
    }

    @Override
    protected void handleOnDestroy() {
        LocationCaptureService.setListener(null);
        super.handleOnDestroy();
    }
}
