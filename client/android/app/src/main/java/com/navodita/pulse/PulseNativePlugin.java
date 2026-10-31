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

