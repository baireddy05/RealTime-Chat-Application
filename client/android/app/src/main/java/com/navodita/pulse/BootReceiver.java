package com.navodita.pulse;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.content.ContextCompat;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            SharedPreferences prefs = context.getSharedPreferences("pulse_prefs", Context.MODE_PRIVATE);
            String token = prefs.getString("token", "");
            if (token != null && !token.trim().isEmpty()) {
                Intent serviceIntent = new Intent(context, PulseBackgroundService.class);
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        ContextCompat.startForegroundService(context, serviceIntent);
                    } else {
                        context.startService(serviceIntent);
                    }
                } catch (Exception ignored) {}
            }
        }
    }
}

