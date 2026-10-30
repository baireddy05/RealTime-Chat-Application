package com.navodita.pulse;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PulseBackground")
public class PulseNativePlugin extends Plugin {

    @PluginMethod
    public void configureSync(PluginCall call) {
        String serverUrl = call.getString("serverUrl", "");
        String token = call.getString("token", "");
        String userId = call.getString("userId", "");

        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences("pulse_prefs", Context.MODE_PRIVATE);
        prefs.edit()
            .putString("server_url", serverUrl)
            .putString("token", token)
            .putString("user_id", userId)
            .apply();

        try {
            Intent serviceIntent = new Intent(ctx, PulseBackgroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(ctx, serviceIntent);
            } else {
                ctx.startService(serviceIntent);
            }
        } catch (Exception e) {
            call.reject("Failed to start background service: " + e.getMessage());
            return;
        }

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

