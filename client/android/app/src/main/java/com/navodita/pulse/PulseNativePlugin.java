package com.navodita.pulse;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "PulseBackground",
    permissions = {
        @Permission(
            alias = "camera",
            strings = { Manifest.permission.CAMERA }
        ),
        @Permission(
            alias = "audio",
            strings = { Manifest.permission.RECORD_AUDIO }
        )
    }
)
public class PulseNativePlugin extends Plugin {

    @PluginMethod
    public void configureSync(PluginCall call) {
        Context ctx = getContext();
        try {
            Intent serviceIntent = new Intent(ctx, PulseBackgroundService.class);
            ctx.stopService(serviceIntent);
            android.app.NotificationManager nm = (android.app.NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(9999);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    nm.deleteNotificationChannel(PulseBackgroundService.CHANNEL_SERVICE_ID);
                }
            }
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void stopSync(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences("pulse_prefs", Context.MODE_PRIVATE);
        prefs.edit().clear().apply();

        try {
            Intent serviceIntent = new Intent(ctx, PulseBackgroundService.class);
            ctx.stopService(serviceIntent);
        } catch (Exception ignored) {}

        call.resolve();
    }

    @PluginMethod
    public void clearNotificationStack(PluginCall call) {
        String chatId = call.getString("chatId", "");
        if (chatId != null && !chatId.isEmpty()) {
            PulseFirebaseMessagingService.clearStackForChat(getContext(), chatId);
        }
        call.resolve();
    }

    @PluginMethod
    public void setActiveChat(PluginCall call) {
        String chatId = call.getString("chatId", null);
        SharedPreferences sp = getContext().getSharedPreferences("pulse_active_chat", Context.MODE_PRIVATE);
        if (chatId != null && !chatId.trim().isEmpty()) {
            MainActivity.activeChatId = chatId.trim();
            sp.edit().putString("active_chat_id", chatId.trim()).apply();
            PulseFirebaseMessagingService.clearStackForChat(getContext(), MainActivity.activeChatId);
        } else {
            MainActivity.activeChatId = null;
            sp.edit().remove("active_chat_id").apply();
        }
        call.resolve();
    }

    @PluginMethod
    public void getPendingChat(PluginCall call) {
        JSObject ret = new JSObject();
        SharedPreferences sp = getContext().getSharedPreferences("pulse_active_chat", Context.MODE_PRIVATE);
        String pId = MainActivity.pendingChatId != null ? MainActivity.pendingChatId : sp.getString("pending_chat_id", null);
        String pType = MainActivity.pendingChatType != null ? MainActivity.pendingChatType : sp.getString("pending_chat_type", "user");
        String pName = MainActivity.pendingSenderName != null ? MainActivity.pendingSenderName : sp.getString("pending_sender_name", "");

        if (pId != null && !pId.isEmpty()) {
            ret.put("chatId", pId);
            ret.put("chatType", pType != null ? pType : "user");
            ret.put("senderName", pName != null ? pName : "");
            MainActivity.pendingChatId = null;
            MainActivity.pendingChatType = null;
            MainActivity.pendingSenderName = null;
            sp.edit().remove("pending_chat_id").remove("pending_chat_type").remove("pending_sender_name").apply();
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void clearPendingChat(PluginCall call) {
        MainActivity.pendingChatId = null;
        MainActivity.pendingChatType = null;
        MainActivity.pendingSenderName = null;
        try {
            getContext().getSharedPreferences("pulse_active_chat", Context.MODE_PRIVATE)
                .edit().remove("pending_chat_id").remove("pending_chat_type").remove("pending_sender_name").apply();
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void requestBatteryOptimization(PluginCall call) {
        Context ctx = getContext();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(ctx.getPackageName())) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + ctx.getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(intent);
                }
            }
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + ctx.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
            } catch (Exception ignored) {}
        }
        call.resolve();
    }

    @PluginMethod
    public void requestCallPermissions(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED ||
            getPermissionState("audio") != PermissionState.GRANTED) {
            requestPermissionForAliases(new String[]{"camera", "audio"}, call, "callPermissionsCallback");
        } else {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            ret.put("camera", true);
            ret.put("audio", true);
            call.resolve(ret);
        }
    }

    @PermissionCallback
    private void callPermissionsCallback(PluginCall call) {
        JSObject ret = new JSObject();
        boolean camera = getPermissionState("camera") == PermissionState.GRANTED;
        boolean audio = getPermissionState("audio") == PermissionState.GRANTED;
        ret.put("camera", camera);
        ret.put("audio", audio);
        ret.put("granted", camera && audio);
        call.resolve(ret);
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String data = call.getString("data");
        String filename = call.getString("filename", "downloaded_file");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (data == null || data.isEmpty()) {
            call.reject("No data provided");
            return;
        }

        try {
            byte[] fileBytes;
            if (data.contains(";base64,")) {
                String base64Part = data.split(";base64,")[1];
                fileBytes = android.util.Base64.decode(base64Part, android.util.Base64.DEFAULT);
            } else {
                fileBytes = android.util.Base64.decode(data, android.util.Base64.DEFAULT);
            }

            Context ctx = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                android.content.ContentValues values = new android.content.ContentValues();
                values.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, filename);
                values.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS);

                android.content.ContentResolver resolver = ctx.getContentResolver();
                Uri uri = resolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    try (java.io.OutputStream os = resolver.openOutputStream(uri)) {
                        if (os != null) {
                            os.write(fileBytes);
                            os.flush();
                        }
                    }
                }
            } else {
                java.io.File downloadDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
                if (!downloadDir.exists()) downloadDir.mkdirs();
                java.io.File destFile = new java.io.File(downloadDir, filename);
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(destFile)) {
                    fos.write(fileBytes);
                    fos.flush();
                }
                android.media.MediaScannerConnection.scanFile(ctx, new String[]{destFile.getAbsolutePath()}, null, null);
            }

            getActivity().runOnUiThread(() -> {
                android.widget.Toast.makeText(ctx, "Saved " + filename + " to Downloads", android.widget.Toast.LENGTH_SHORT).show();
            });

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("filename", filename);
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.e("PulseNativePlugin", "Error saving file: " + e.getMessage(), e);
            call.reject("Failed to save file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        Context ctx = getContext();
        boolean opened = false;
        // Try Xiaomi / MIUI / HyperOS autostart activity
        try {
            Intent intent = new Intent();
            intent.setClassName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            opened = true;
        } catch (Exception ignored) {}

        if (!opened) {
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + ctx.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
            } catch (Exception ignored) {}
        }
        call.resolve();
    }

    @PluginMethod
    public void startSpeechRecognition(PluginCall call) {
        try {
            Intent intent = new Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, "Speak now...");
            startActivityForResult(call, intent, "speechRecognitionResult");
        } catch (Exception e) {
            call.reject("Speech recognition failed to start: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void speechRecognitionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        try {
            if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                java.util.ArrayList<String> matches = result.getData().getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS);
                if (matches != null && !matches.isEmpty()) {
                    JSObject ret = new JSObject();
                    ret.put("transcript", matches.get(0));
                    call.resolve(ret);
                    return;
                }
            }
            call.reject("No speech detected or cancelled");
        } catch (Exception e) {
            call.reject("Error parsing speech result: " + e.getMessage());
        }
    }
}

