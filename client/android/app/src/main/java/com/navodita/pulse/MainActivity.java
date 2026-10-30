package com.navodita.pulse;

import android.content.Intent;
import android.os.Bundle;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static volatile boolean isAppInForeground = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register custom native plugins
        registerPlugin(PulseNativePlugin.class);
        PulseFirebaseMessagingService.ensureNotificationChannel(this);

        super.onCreate(savedInstanceState);

        // Explicitly request POST_NOTIFICATIONS permission on Android 13+ (API 33+)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }

        // Cancel and delete any legacy foreground keepalive notification (ID 9999)
        try {
            android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(android.content.Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(9999);
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    nm.deleteNotificationChannel("pulse_bg_keepalive");
                }
            }
            stopService(new android.content.Intent(this, PulseBackgroundService.class));
        } catch (Exception ignored) {}

        // Request exemption from battery optimization so background FCM wakeups arrive when app is closed
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            try {
                android.os.PowerManager pm = (android.os.PowerManager) getSystemService(android.content.Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    android.content.Intent batteryIntent = new android.content.Intent(
                        android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                    );
                    batteryIntent.setData(android.net.Uri.parse("package:" + getPackageName()));
                    startActivity(batteryIntent);
                }
            } catch (Exception ignored) {}
        }

        // Prevent Android system bars (status bar & gesture bar) from overlapping the webview
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content), (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(0, insets.top, 0, insets.bottom);
            return windowInsets;
        });

        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String chatId = intent.getStringExtra("chatId");
        String chatType = intent.getStringExtra("chatType");
        if (chatId != null && !chatId.isEmpty() && !"default".equals(chatId)) {
            final String cId = chatId;
            final String cType = chatType != null ? chatType : "user";
            PulseFirebaseMessagingService.clearStackForChat(this, cId);
            getBridge().getWebView().postDelayed(() -> {
                try {
                    String js = "window.dispatchEvent(new CustomEvent('pulse:open-chat', { detail: { chatId: '" + cId + "', chatType: '" + cType + "', type: 'message' } }));";
                    getBridge().getWebView().evaluateJavascript(js, null);
                } catch (Exception ignored) {}
            }, 1200);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        isAppInForeground = true;
    }

    @Override
    public void onPause() {
        super.onPause();
        isAppInForeground = false;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isAppInForeground = false;
    }
}
