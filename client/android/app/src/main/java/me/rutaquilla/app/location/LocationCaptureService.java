package me.rutaquilla.app.location;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import java.util.ArrayList;
import java.util.List;

import me.rutaquilla.app.MainActivity;
import me.rutaquilla.app.R;

public class LocationCaptureService extends Service {
    public static final String ACTION_START = "me.rutaquilla.app.action.START_CAPTURE";
    public static final String ACTION_UPDATE_COUNT = "me.rutaquilla.app.action.UPDATE_COUNT";
    public static final String ACTION_STOP = "me.rutaquilla.app.action.STOP_CAPTURE";

    public static final String EXTRA_ROUTE_NAME = "routeName";
    public static final String EXTRA_COMPANY = "company";
    public static final String EXTRA_POINTS = "points";

    private static final String CHANNEL_ID = "rutaquilla_gps_capture";
    private static final int NOTIFICATION_ID = 7401;
    private static final int MAX_BUFFER_POINTS = 2500;

    public static class CapturedPoint {
        public final double lat;
        public final double lng;
        public final float accuracy;
        public final long timestamp;

        public CapturedPoint(double lat, double lng, float accuracy, long timestamp) {
            this.lat = lat;
            this.lng = lng;
            this.accuracy = accuracy;
            this.timestamp = timestamp;
        }
    }

    public interface PointListener {
        void onPoint(CapturedPoint point);
    }

    private static final List<CapturedPoint> buffer = new ArrayList<>();
    private static volatile PointListener activeListener;

    public static void setListener(@Nullable PointListener listener) {
        activeListener = listener;
    }

    public static List<CapturedPoint> drainBufferedPoints() {
        synchronized (buffer) {
            List<CapturedPoint> copy = new ArrayList<>(buffer);
            buffer.clear();
            return copy;
        }
    }

    public static void clearBuffer() {
        synchronized (buffer) {
            buffer.clear();
        }
    }

    private LocationManager locationManager;
    private LocationListener locationListener;
    private PowerManager.WakeLock wakeLock;
    private String currentRouteName = "Ruta en vivo";
    private String currentCompany = "RutaQuilla";
    private int displayedPoints = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;

        if (ACTION_STOP.equals(action)) {
            stopLocationUpdates();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_UPDATE_COUNT.equals(action) && intent != null) {
            displayedPoints = intent.getIntExtra(EXTRA_POINTS, displayedPoints);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(NOTIFICATION_ID, buildNotification(displayedPoints));
            }
            return START_STICKY;
        }

        if (intent != null) {
            String rn = intent.getStringExtra(EXTRA_ROUTE_NAME);
            String co = intent.getStringExtra(EXTRA_COMPANY);
            if (rn != null && !rn.trim().isEmpty()) currentRouteName = rn.trim();
            if (co != null && !co.trim().isEmpty()) currentCompany = co.trim();
        }

        clearBuffer();
        displayedPoints = 0;

        int fgType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(0), fgType);

        acquireWakeLock();
        startLocationUpdates();

        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Captura GPS de rutas",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Mantiene activo el rastreo GPS mientras grabas un recorrido.");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(int points) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, openIntent, piFlags);

        String subText = points > 0
            ? currentRouteName + " (" + points + " puntos)"
            : currentRouteName + " · " + currentCompany;

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("RutaQuilla · Grabando recorrido")
            .setContentText(subText)
            .setSmallIcon(R.mipmap.ic_launcher_round)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
            .setContentIntent(contentIntent)
            .build();
    }

    private void acquireWakeLock() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "RutaQuilla::GpsCaptureWakeLock");
                    wakeLock.setReferenceCounted(false);
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(3 * 60 * 60 * 1000L);
            }
        } catch (Exception ignored) {}
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
    }

    private void startLocationUpdates() {
        if (locationManager == null) return;
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED
            && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        if (locationListener != null) {
            return;
        }

        locationListener = new LocationListener() {
            @Override
            public void onLocationChanged(@NonNull Location location) {
                CapturedPoint pt = new CapturedPoint(
                    location.getLatitude(),
                    location.getLongitude(),
                    location.hasAccuracy() ? location.getAccuracy() : 20f,
                    location.getTime() > 0 ? location.getTime() : System.currentTimeMillis()
                );

                synchronized (buffer) {
                    if (buffer.size() < MAX_BUFFER_POINTS) {
                        buffer.add(pt);
                    }
                }

                PointListener listener = activeListener;
                if (listener != null) {
                    listener.onPoint(pt);
                }
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {}

            @Override
            public void onProviderEnabled(@NonNull String provider) {}

            @Override
            public void onProviderDisabled(@NonNull String provider) {}
        };

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    3000L,
                    5f,
                    locationListener,
                    Looper.getMainLooper()
                );
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    6000L,
                    12f,
                    locationListener,
                    Looper.getMainLooper()
                );
            }
        } catch (SecurityException ignored) {}
    }

    private void stopLocationUpdates() {
        if (locationManager != null && locationListener != null) {
            try {
                locationManager.removeUpdates(locationListener);
            } catch (Exception ignored) {}
            locationListener = null;
        }
        releaseWakeLock();
    }

    @Override
    public void onDestroy() {
        stopLocationUpdates();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
