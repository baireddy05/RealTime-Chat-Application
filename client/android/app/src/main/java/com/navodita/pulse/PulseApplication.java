package com.navodita.pulse;

import android.app.Application;
import android.util.Log;

public class PulseApplication extends Application {
    private static final String TAG = "PulseApp";

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "PulseApplication onCreate - ensuring notification channels");
        try {
            PulseFirebaseMessagingService.ensureNotificationChannel(this);
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize notification channels in Application: " + e.getMessage());
        }
    }
}
