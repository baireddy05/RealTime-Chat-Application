package com.navodita.pulse;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PulseBackground")
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
        if (chatId != null && !chatId.trim().isEmpty()) {
            MainActivity.activeChatId = chatId.trim();
            PulseFirebaseMessagingService.clearStackForChat(getContext(), MainActivity.activeChatId);
        } else {
            MainActivity.activeChatId = null;
        }
        call.resolve();
    }

    @PluginMethod
    public void getPendingChat(PluginCall call) {
        JSObject ret = new JSObject();
        if (MainActivity.pendingChatId != null) {
            ret.put("chatId", MainActivity.pendingChatId);
            ret.put("chatType", MainActivity.pendingChatType != null ? MainActivity.pendingChatType : "user");
            ret.put("senderName", MainActivity.pendingSenderName != null ? MainActivity.pendingSenderName : "");
            MainActivity.pendingChatId = null;
            MainActivity.pendingChatType = null;
            MainActivity.pendingSenderName = null;
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void clearPendingChat(PluginCall call) {
        MainActivity.pendingChatId = null;
        MainActivity.pendingChatType = null;
        MainActivity.pendingSenderName = null;
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
}

