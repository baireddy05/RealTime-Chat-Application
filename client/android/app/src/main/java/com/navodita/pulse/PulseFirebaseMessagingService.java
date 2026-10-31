package com.navodita.pulse;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.Map;

public class PulseFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "PulseFCMService";
    public static final String CHANNEL_MESSAGE_ID = "pulse_v5_messages";
    public static final String CHANNEL_CALL_ID = "pulse_calls_v2";
    private static final String PREF_STACKS = "pulse_msg_stacks";

    private static final java.util.Map<String, Long> processedMessageCache =
        java.util.Collections.synchronizedMap(new java.util.LinkedHashMap<String, Long>(50, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(java.util.Map.Entry<String, Long> eldest) {
                return size() > 50;
            }
        });

    public static void ensureNotificationChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                // High importance message channels with sound, vibration, lights
                String[] messageChannels = new String[]{CHANNEL_MESSAGE_ID, "pulse_v4_messages", "pulse_messages_v2", "pulse_messages", "default"};
                Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();

                for (String chId : messageChannels) {
                    NotificationChannel ch = nm.getNotificationChannel(chId);
                    if (ch == null) {
                        ch = new NotificationChannel(chId, "Pulse Messages", NotificationManager.IMPORTANCE_HIGH);
                        ch.setDescription("Incoming chat messages and alerts");
                        ch.enableLights(true);
                        ch.setLightColor(0xFF00E5FF);
                        ch.enableVibration(true);
                        ch.setVibrationPattern(new long[]{0, 250, 250, 250});
                        ch.setShowBadge(true);
                        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                        ch.setSound(defaultSoundUri, audioAttributes);
                        ch.setBypassDnd(true);
                        nm.createNotificationChannel(ch);
                    }
                }

                // Call channel with maximum importance
                NotificationChannel callChannel = nm.getNotificationChannel(CHANNEL_CALL_ID);
                if (callChannel == null) {
                    callChannel = new NotificationChannel(
                        CHANNEL_CALL_ID,
                        "Pulse Calls",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    callChannel.setDescription("Incoming voice and video calls");
                    callChannel.enableLights(true);
                    callChannel.setLightColor(0xFF00E5FF);
                    callChannel.enableVibration(true);
                    callChannel.setShowBadge(true);
                    callChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

                    Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                    AudioAttributes callAudioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build();
                    callChannel.setSound(ringtoneUri, callAudioAttributes);
                    nm.createNotificationChannel(callChannel);
                }
            }
        }
    }

    public static void clearStackForChat(Context ctx, String chatId) {
        if (chatId == null || chatId.isEmpty()) return;
        try {
            int notifId = Math.abs(chatId.hashCode());
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel("chat_" + chatId, notifId);
                nm.cancel(notifId);
            }
            SharedPreferences stackPrefs = ctx.getSharedPreferences(PREF_STACKS, Context.MODE_PRIVATE);
            stackPrefs.edit().remove(chatId).apply();
            Log.d(TAG, "Cleared notification stack for chat: " + chatId);
        } catch (Exception e) {
            Log.w(TAG, "clearStackForChat error: " + e.getMessage());
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.i(TAG, "New FCM token received: " + token);
        SharedPreferences prefs = getSharedPreferences("pulse_prefs", Context.MODE_PRIVATE);
        prefs.edit().putString("fcm_token", token).apply();
        PushNotificationsPlugin.onNewToken(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.i(TAG, "FCM message received from: " + remoteMessage.getFrom());

        Map<String, String> data = remoteMessage.getData();

        // De-duplicate: ignore duplicate deliveries of the same message within 15 seconds
        String messageId = remoteMessage.getMessageId();
        if (data != null && data.containsKey("messageId")) {
            messageId = data.get("messageId");
        }
        if (messageId != null && !messageId.isEmpty()) {
            Long lastProcessed = processedMessageCache.get(messageId);
            long now = System.currentTimeMillis();
            if (lastProcessed != null && (now - lastProcessed) < 15000) {
                Log.i(TAG, "Duplicate FCM message ignored: " + messageId);
                return;
            }
            processedMessageCache.put(messageId, now);
        }

        // Always forward to Capacitor plugin safely (never crash onMessageReceived)
        try {
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        } catch (Throwable t) {
            Log.w(TAG, "Capacitor push forward skipped: " + t.getMessage());
        }

        String type = data != null ? data.get("type") : "message";

        if ("call".equals(type)) {
            handleCallNotification(data);
            return;
        }

        // Suppress tray notification if the app is currently open in the foreground
        // and the user is actively viewing this exact chat!
        String chatId = (data != null && data.containsKey("chatId")) ? data.get("chatId") : null;
        if (MainActivity.isAppInForeground && chatId != null && MainActivity.activeChatId != null
                && chatId.trim().equalsIgnoreCase(MainActivity.activeChatId.trim())) {
            Log.i(TAG, "User currently in active chat " + chatId + " in foreground — skipping system notification");
            return;
        }

        handleMessageNotification(remoteMessage, data);
    }

    private void handleMessageNotification(RemoteMessage remoteMessage, Map<String, String> data) {
        try {
            ensureNotificationChannel(this);

            String title = data != null ? data.get("title") : null;
            String body = data != null ? data.get("body") : null;

            if (title == null && remoteMessage.getNotification() != null) {
                title = remoteMessage.getNotification().getTitle();
            }
            if (body == null && remoteMessage.getNotification() != null) {
                body = remoteMessage.getNotification().getBody();
            }

            if (title == null || title.trim().isEmpty()) title = "Pulse Chat";
            if (body == null || body.trim().isEmpty()) body = "New message";

            String chatId = (data != null && data.containsKey("chatId")) ? data.get("chatId") : "default";
            String chatType = (data != null && data.containsKey("chatType")) ? data.get("chatType") : "user";
            String senderName = (data != null && data.containsKey("senderName")) ? data.get("senderName") : title;

            // WhatsApp-style message stacking via SharedPreferences
            SharedPreferences stackPrefs = getSharedPreferences(PREF_STACKS, Context.MODE_PRIVATE);
            String rawJson = stackPrefs.getString(chatId, "[]");
            JSONArray arr;
            try {
                arr = new JSONArray(rawJson);
            } catch (JSONException e) {
                arr = new JSONArray();
            }

            // Append new message line
            arr.put(body);

            // Keep max 10 lines
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

            // WhatsApp style: displays stacked lines inside the notification
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

            String notifTitle = count > 1 ? (senderName + " (" + count + " messages)") : senderName;
            inboxStyle.setBigContentTitle(notifTitle);
            if (count > 1) {
                inboxStyle.setSummaryText(count + " messages");
            }

            // Clicking notification launches MainActivity with chat details
            Intent launchIntent = new Intent(this, MainActivity.class);
            launchIntent.setAction(Intent.ACTION_VIEW);
            launchIntent.setData(Uri.parse("pulse://chat/" + chatType + "/" + chatId));
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            launchIntent.putExtra("chatId", chatId);
            launchIntent.putExtra("chatType", chatType);
            launchIntent.putExtra("senderName", senderName);
            launchIntent.putExtra("title", notifTitle);
            launchIntent.putExtra("type", "message");

            int notifId = Math.abs(chatId.hashCode());

            PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                notifId,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_MESSAGE_ID)
                .setContentTitle(notifTitle)
                .setContentText(body)
                .setStyle(inboxStyle)
                .setSmallIcon(R.drawable.ic_stat_pulse)
                .setColor(0xFF00E5FF)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE);

            Bitmap largeIcon = getNotificationLargeIcon();
            if (largeIcon != null) {
                builder.setLargeIcon(largeIcon);
            }

            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify("chat_" + chatId, notifId, builder.build());
                Log.i(TAG, "Displayed stacked notification for chat: " + chatId + " (count: " + count + ")");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error displaying message notification: " + e.getMessage(), e);
        }
    }

    private void handleCallNotification(Map<String, String> data) {
        try {
            ensureNotificationChannel(this);

            String callerName = data != null ? data.get("callerName") : "Someone";
            String callerId = data != null ? data.get("callerId") : "";
            String callType = data != null ? data.get("callType") : "video";
            String label = "audio".equals(callType) ? "Voice" : "Video";

            Intent callIntent = new Intent(this, MainActivity.class);
            callIntent.setAction(Intent.ACTION_VIEW);
            callIntent.setData(Uri.parse("pulse://call/" + callerId));
            callIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            callIntent.putExtra("callerId", callerId);
            callIntent.putExtra("callerName", callerName);
            callIntent.putExtra("callType", callType);
            callIntent.putExtra("type", "call");

            int notifId = Math.abs(("call_" + callerId).hashCode());

            PendingIntent pi = PendingIntent.getActivity(
                this,
                notifId,
                callIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_CALL_ID)
                .setContentTitle("Incoming " + label + " Call")
                .setContentText(callerName + " is calling you")
                .setSmallIcon(R.drawable.ic_stat_pulse)
                .setColor(0xFF00E5FF)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setDefaults(NotificationCompat.DEFAULT_ALL);

            Bitmap largeIcon = getNotificationLargeIcon();
            if (largeIcon != null) {
                builder.setLargeIcon(largeIcon);
            }

            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(notifId, builder.build());
                Log.i(TAG, "Displayed incoming call notification from: " + callerName);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error displaying call notification: " + e.getMessage(), e);
        }
    }

    private Bitmap getNotificationLargeIcon() {
        try {
            Bitmap bmp = BitmapFactory.decodeResource(getResources(), R.drawable.ic_notification_large);
            if (bmp != null) {
                return bmp;
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed to decode ic_notification_large: " + t.getMessage());
        }

        try {
            Drawable drawable = ContextCompat.getDrawable(this, R.mipmap.ic_launcher);
            if (drawable == null) {
                drawable = getPackageManager().getApplicationIcon(getPackageName());
            }
            if (drawable instanceof BitmapDrawable) {
                return ((BitmapDrawable) drawable).getBitmap();
            }
            if (drawable != null) {
                int width = drawable.getIntrinsicWidth() > 0 ? drawable.getIntrinsicWidth() : 192;
                int height = drawable.getIntrinsicHeight() > 0 ? drawable.getIntrinsicHeight() : 192;
                Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(bitmap);
                drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
                drawable.draw(canvas);
                return bitmap;
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed to load notification large icon: " + t.getMessage());
        }
        return null;
    }
}

