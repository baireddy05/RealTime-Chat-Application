package com.navodita.pulse;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static volatile boolean isAppInForeground = false;
    public static volatile String activeChatId = null;
    public static volatile String pendingChatId = null;
    public static volatile String pendingChatType = null;
    public static volatile String pendingSenderName = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register custom native plugins
        registerPlugin(PulseNativePlugin.class);
        PulseFirebaseMessagingService.ensureNotificationChannel(this);

        super.onCreate(savedInstanceState);

        // Explicitly request RECORD_AUDIO, CAMERA and POST_NOTIFICATIONS permissions for calls and alerts
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            java.util.List<String> perms = new java.util.ArrayList<>();
            if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                perms.add(android.Manifest.permission.RECORD_AUDIO);
            }
            if (checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                perms.add(android.Manifest.permission.CAMERA);
            }
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    perms.add(android.Manifest.permission.POST_NOTIFICATIONS);
                }
            }
            if (!perms.isEmpty()) {
                requestPermissions(perms.toArray(new String[0]), 101);
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

        // Request exemption from battery optimization once on fresh install (state saved so cold starts do not repeatedly prompt)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            try {
                android.content.SharedPreferences sp = getSharedPreferences("pulse_prefs", android.content.Context.MODE_PRIVATE);
                boolean prompted = sp.getBoolean("battery_opt_prompted", false);
                if (!prompted) {
                    android.os.PowerManager pm = (android.os.PowerManager) getSystemService(android.content.Context.POWER_SERVICE);
                    if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                        sp.edit().putBoolean("battery_opt_prompted", true).apply();
                        android.content.Intent batteryIntent = new android.content.Intent(
                            android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                        );
                        batteryIntent.setData(android.net.Uri.parse("package:" + getPackageName()));
                        startActivity(batteryIntent);
                    }
                }
            } catch (Exception ignored) {}
        }

        // Enable true edge-to-edge layout so webview extends behind translucent/transparent system bars
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }

        // Configure WebRTC & permissions on the WebView
        if (getBridge() != null && getBridge().getWebView() != null) {
            android.webkit.WebView webView = getBridge().getWebView();
            webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
            webView.setWebChromeClient(new PulseWebChromeClient(getBridge()));
            webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);
            webView.setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);

            webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
                try {
                    android.app.DownloadManager.Request req = new android.app.DownloadManager.Request(Uri.parse(url));
                    req.setMimeType(mimetype);
                    String cookies = android.webkit.CookieManager.getInstance().getCookie(url);
                    req.addRequestHeader("cookie", cookies);
                    req.addRequestHeader("User-Agent", userAgent);
                    req.setDescription("Downloading file...");
                    String filename = android.webkit.URLUtil.guessFileName(url, contentDisposition, mimetype);
                    req.setTitle(filename);
                    req.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    req.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, filename);
                    android.app.DownloadManager dm = (android.app.DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.enqueue(req);
                        android.widget.Toast.makeText(getApplicationContext(), "Downloading " + filename + "...", android.widget.Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception e) {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW);
                        i.setData(Uri.parse(url));
                        startActivity(i);
                    } catch (Exception ignored) {}
                }
            });

            webView.post(() -> {
                try {
                    android.view.View parent = (android.view.View) webView.getParent();
                    if (parent != null) {
                        ViewCompat.setOnApplyWindowInsetsListener(parent, (v, insets) -> {
                            v.setPadding(0, 0, 0, 0);
                            return insets;
                        });
                        webView.requestApplyInsets();
                    }
                } catch (Exception ignored) {}
            });
        }

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
        String senderName = intent.getStringExtra("senderName");
        String type = intent.getStringExtra("type");

        // Inspect Uri data if passed like pulse://chat/user/123?senderName=rithwik or pulse://call/123
        Uri data = intent.getData();
        if (data != null && "pulse".equals(data.getScheme())) {
            java.util.List<String> segments = data.getPathSegments();
            String host = data.getHost();
            if ("chat".equals(host) && segments != null && segments.size() >= 2) {
                chatType = segments.get(0);
                chatId = segments.get(1);
                String qSender = data.getQueryParameter("senderName");
                if (qSender != null && !qSender.isEmpty()) {
                    senderName = qSender;
                }
            } else if ("call".equals(host) && segments != null && !segments.isEmpty()) {
                type = "call";
                dispatchOpenCallToWebView(segments.get(0), "video");
                intent.setData(null);
                return;
            }
        }

        String callerId = intent.getStringExtra("callerId");
        if ("call".equals(type) || (callerId != null && !callerId.isEmpty())) {
            String callType = intent.getStringExtra("callType");
            dispatchOpenCallToWebView(callerId != null ? callerId : "", callType != null ? callType : "video");
            intent.removeExtra("callerId");
            intent.removeExtra("type");
            return;
        }

        if (chatId != null && !chatId.isEmpty() && !"default".equals(chatId)) {
            android.util.Log.i("PulseMainActivity", "handleIntent: opening chat " + chatId + " (" + chatType + ")");
            final String cId = chatId;
            final String cType = chatType != null ? chatType : "user";
            final String sName = senderName != null ? senderName : "";

            pendingChatId = cId;
            pendingChatType = cType;
            pendingSenderName = sName;
            activeChatId = cId;

            try {
                getSharedPreferences("pulse_active_chat", android.content.Context.MODE_PRIVATE)
                    .edit()
                    .putString("pending_chat_id", cId)
                    .putString("pending_chat_type", cType)
                    .putString("pending_sender_name", sName)
                    .apply();
            } catch (Exception ignored) {}

            // Clear intent data so routine resumes don't re-trigger
            intent.removeExtra("chatId");
            intent.setData(null);

            PulseFirebaseMessagingService.clearStackForChat(this, cId);
            dispatchOpenChatToWebView(cId, cType, sName);
        }
    }

    private void dispatchOpenChatToWebView(final String cId, final String cType, final String sName) {
        String jsonPayload;
        try {
            org.json.JSONObject obj = new org.json.JSONObject();
            obj.put("chatId", cId != null ? cId : "");
            obj.put("chatType", cType != null ? cType : "user");
            obj.put("senderName", sName != null ? sName : "");
            obj.put("type", "message");
            jsonPayload = obj.toString();
        } catch (Exception e) {
            jsonPayload = "{\"chatId\":\"" + (cId != null ? cId : "") + "\",\"chatType\":\"" + (cType != null ? cType : "user") + "\",\"type\":\"message\"}";
        }

        final String js = "(function() {" +
            "var d = " + jsonPayload + ";" +
            "window.__PULSE_PENDING_OPEN_CHAT__ = d;" +
            "if (window.__PULSE_ACTIVE_OPEN_CHAT__ === d.chatId && (Date.now() - (window.__PULSE_ACTIVE_OPEN_TIME__ || 0)) < 3000) { return; }" +
            "if (typeof window.pulseOpenChat === 'function') {" +
            "  window.__PULSE_ACTIVE_OPEN_CHAT__ = d.chatId;" +
            "  window.__PULSE_ACTIVE_OPEN_TIME__ = Date.now();" +
            "  window.pulseOpenChat(d.chatId, d.chatType, d);" +
            "} else {" +
            "  window.dispatchEvent(new CustomEvent('pulse:open-chat', { detail: d }));" +
            "}" +
            "})();";

        long[] delays = new long[]{100, 300, 600, 1200, 2400};
        for (long delay : delays) {
            runOnUiThread(() -> {
                try {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().postDelayed(() -> {
                            try {
                                getBridge().getWebView().evaluateJavascript(js, null);
                            } catch (Exception ignored) {}
                        }, delay);
                    }
                } catch (Exception ignored) {}
            });
        }
    }

    private void dispatchOpenCallToWebView(final String callerId, final String callType) {
        String jsonPayload;
        try {
            org.json.JSONObject obj = new org.json.JSONObject();
            obj.put("callerId", callerId != null ? callerId : "");
            obj.put("callType", callType != null ? callType : "video");
            obj.put("type", "call");
            jsonPayload = obj.toString();
        } catch (Exception e) {
            jsonPayload = "{\"callerId\":\"" + (callerId != null ? callerId : "") + "\",\"callType\":\"" + (callType != null ? callType : "video") + "\",\"type\":\"call\"}";
        }

        final String js = "(function() {" +
            "var d = " + jsonPayload + ";" +
            "window.dispatchEvent(new CustomEvent('pulse:open-call-from', { detail: d }));" +
            "})();";

        long[] delays = new long[]{150, 400, 800, 1500, 2500};
        for (long delay : delays) {
            runOnUiThread(() -> {
                try {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().postDelayed(() -> {
                            try {
                                getBridge().getWebView().evaluateJavascript(js, null);
                            } catch (Exception ignored) {}
                        }, delay);
                    }
                } catch (Exception ignored) {}
            });
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        isAppInForeground = true;
        try {
            getSharedPreferences("pulse_active_chat", android.content.Context.MODE_PRIVATE)
                .edit()
                .putBoolean("is_foreground", true)
                .apply();
        } catch (Exception ignored) {}

        if (getIntent() != null && (getIntent().hasExtra("chatId") || getIntent().getData() != null)) {
            handleIntent(getIntent());
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        isAppInForeground = false;
        try {
            getSharedPreferences("pulse_active_chat", android.content.Context.MODE_PRIVATE)
                .edit()
                .putBoolean("is_foreground", false)
                .apply();
        } catch (Exception ignored) {}
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        PulseWebChromeClient.handlePermissionsResult(this, requestCode, permissions, grantResults);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isAppInForeground = false;
        activeChatId = null;
    }
}
