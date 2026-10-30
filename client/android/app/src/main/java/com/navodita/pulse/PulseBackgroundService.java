package com.navodita.pulse;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class PulseBackgroundService extends Service {
    private static final String TAG = "PulseBgService";
    public static final String CHANNEL_SERVICE_ID = "pulse_bg_keepalive";
    public static final String CHANNEL_MESSAGE_ID = "pulse_v4_messages";

    private volatile boolean isRunning = false;
    private Thread workerThread = null;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannels();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            stopForeground(true);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(9999);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    nm.deleteNotificationChannel(CHANNEL_SERVICE_ID);
                }
            }
        } catch (Exception ignored) {}
        stopSelf();
        return START_NOT_STICKY;
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                // Keep-alive silent channel
                NotificationChannel keepAliveChannel = new NotificationChannel(
                    CHANNEL_SERVICE_ID,
                    "Pulse Background Sync",
                    NotificationManager.IMPORTANCE_LOW
                );
                keepAliveChannel.setDescription("Keeps Pulse connected to deliver instant notifications");
                keepAliveChannel.setShowBadge(false);
                keepAliveChannel.enableLights(false);
                keepAliveChannel.enableVibration(false);
                nm.createNotificationChannel(keepAliveChannel);

                // High importance message channel
                NotificationChannel messageChannel = new NotificationChannel(
                    CHANNEL_MESSAGE_ID,
                    "Pulse Messages",
                    NotificationManager.IMPORTANCE_HIGH
                );
                messageChannel.setDescription("Incoming chat messages and alerts");
                messageChannel.enableLights(true);
                messageChannel.setLightColor(0xFF00E5FF);
                messageChannel.enableVibration(true);
                nm.createNotificationChannel(messageChannel);
            }
        }
    }

    private void startKeepAliveForeground() {
        createChannels();

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_SERVICE_ID)
            .setContentTitle("Pulse Chat")
            .setContentText("Connected in background")
            .setSmallIcon(R.drawable.ic_stat_pulse)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setContentIntent(pendingIntent)
            .setOngoing(true);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(9999, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(9999, builder.build());
            }
        } catch (Exception e) {
            Log.w(TAG, "startForeground error: " + e.getMessage());
        }
    }

    private synchronized void startWorker() {
        if (isRunning && workerThread != null && workerThread.isAlive()) {
            return;
        }
        isRunning = true;
        workerThread = new Thread(this::runStreamLoop, "PulseSSEWorker");
        workerThread.start();
    }

    private void runStreamLoop() {
        Log.i(TAG, "Starting background SSE stream loop...");
        while (isRunning) {
            SharedPreferences prefs = getSharedPreferences("pulse_prefs", Context.MODE_PRIVATE);
            String serverUrl = prefs.getString("server_url", "");
            String token = prefs.getString("token", "");

            if (serverUrl == null || serverUrl.trim().isEmpty() || token == null || token.trim().isEmpty()) {
                try {
                    Thread.sleep(5000);
                } catch (InterruptedException ignored) {}
                continue;
            }

            HttpURLConnection conn = null;
            BufferedReader reader = null;
            try {
                String base = serverUrl.trim().replaceAll("/api/?$", "");
                String streamUrl = base + "/api/push/stream";
                Log.d(TAG, "Connecting SSE to: " + streamUrl);

                URL url = new URL(streamUrl);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestProperty("Accept", "text/event-stream");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setRequestProperty("Cache-Control", "no-cache");
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(70000); // Server sends ping every 25s

                int responseCode = conn.getResponseCode();
                if (responseCode != 200) {
                    Log.w(TAG, "SSE returned response code: " + responseCode);
                    Thread.sleep(5000);
                    continue;
                }

                reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                String line;
                while (isRunning && (line = reader.readLine()) != null) {
                    line = line.trim();
                    if (line.startsWith("data: ")) {
                        String payload = line.substring(6).trim();
                        handleIncomingPayload(payload);
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "SSE connection error: " + e.getMessage());
            } finally {
                if (reader != null) {
                    try { reader.close(); } catch (Exception ignored) {}
                }
                if (conn != null) {
                    try { conn.disconnect(); } catch (Exception ignored) {}
                }
            }

            if (isRunning) {
                try {
                    Thread.sleep(3000);
                } catch (InterruptedException ignored) {}
            }
        }
        Log.i(TAG, "Background SSE stream loop stopped.");
    }

    private void handleIncomingPayload(String payload) {
        try {
            if (payload.isEmpty() || payload.equals(": ping")) return;
            JSONObject json = new JSONObject(payload);
            String type = json.optString("type", "");
            if ("connected".equals(type)) {
                Log.i(TAG, "SSE handshake successful.");
                return;
            }

            // If the user has the app open right now in the foreground,
            // let the web UI & socket handle it without posting duplicate notification
            if (MainActivity.isAppInForeground) {
                return;
            }

            String title = json.optString("title", "Pulse Message");
            String body = json.optString("body", "New message");
            JSONObject data = json.optJSONObject("data");

            String chatId = "default";
            String chatType = "user";
            if (data != null) {
                chatId = data.optString("chatId", "default");
                chatType = data.optString("chatType", "user");
            }

            showStackedNotification(chatId, chatType, title, body, data);
        } catch (Exception e) {
            Log.e(TAG, "handleIncomingPayload error: " + e.getMessage());
        }
    }

    private void showStackedNotification(String chatId, String chatType, String title, String body, @Nullable JSONObject data) {
        try {
            SharedPreferences stackPrefs = getSharedPreferences("pulse_bg_stacks", MODE_PRIVATE);
            String existingJson = stackPrefs.getString(chatId, "[]");
            JSONArray arr = new JSONArray(existingJson);
            arr.put(body);

            // Keep up to 10 messages in stack
            if (arr.length() > 10) {
                JSONArray trimmed = new JSONArray();
                for (int i = arr.length() - 10; i < arr.length(); i++) {
                    trimmed.put(arr.getString(i));
                }
                arr = trimmed;
            }
            stackPrefs.edit().putString(chatId, arr.toString()).apply();

            int count = arr.length();
            NotificationCompat.InboxStyle inboxStyle = new NotificationCompat.InboxStyle();
            if (count <= 7) {
                for (int i = 0; i < count; i++) {
                    inboxStyle.addLine(arr.getString(i));
                }
            } else {
                int earlier = count - 6;
                inboxStyle.addLine("+ " + earlier + " earlier messages");
                for (int i = count - 6; i < count; i++) {
                    inboxStyle.addLine(arr.getString(i));
                }
            }

            String notifTitle = count > 1 ? (title + " (" + count + " messages)") : title;
            inboxStyle.setBigContentTitle(notifTitle);

            Intent launchIntent = new Intent(this, MainActivity.class);
            launchIntent.setAction(Intent.ACTION_VIEW);
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            launchIntent.putExtra("chatId", chatId);
            launchIntent.putExtra("chatType", chatType);
            launchIntent.putExtra("type", "message");

            int notifId = Math.abs(chatId.hashCode());

            PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                notifId,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            NotificationCompat.Builder notifBuilder = new NotificationCompat.Builder(this, CHANNEL_MESSAGE_ID)
                .setContentTitle(notifTitle)
                .setContentText(body)
                .setStyle(inboxStyle)
                .setSmallIcon(R.drawable.ic_stat_pulse)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL);

            NotificationManagerCompat.from(this).notify(notifId, notifBuilder.build());
        } catch (Exception e) {
            Log.e(TAG, "showStackedNotification error: " + e.getMessage());
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Log.i(TAG, "onTaskRemoved: app swiped away, scheduling restart...");
        try {
            Intent restartServiceIntent = new Intent(getApplicationContext(), PulseBackgroundService.class);
            restartServiceIntent.setPackage(getPackageName());
            PendingIntent restartServicePendingIntent = PendingIntent.getService(
                getApplicationContext(),
                1,
                restartServiceIntent,
                PendingIntent.FLAG_ONE_SHOT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );
            AlarmManager alarmService = (AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmService != null) {
                alarmService.set(
                    AlarmManager.ELAPSED_REALTIME,
                    SystemClock.elapsedRealtime() + 1000,
                    restartServicePendingIntent
                );
            }
        } catch (Exception e) {
            Log.w(TAG, "onTaskRemoved alarm error: " + e.getMessage());
        }
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        if (workerThread != null) {
            workerThread.interrupt();
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

