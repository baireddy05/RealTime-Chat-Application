package com.navodita.pulse;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.PermissionRequest;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class PulseWebChromeClient extends BridgeWebChromeClient {
    private final Activity activity;
    private static volatile PermissionRequest pendingPermissionRequest = null;

    public PulseWebChromeClient(Bridge bridge) {
        super(bridge);
        this.activity = bridge.getActivity();
    }

    public static void handlePermissionsResult(Activity act, int requestCode, String[] permissions, int[] grantResults) {
        if (pendingPermissionRequest == null) return;
        act.runOnUiThread(() -> {
            try {
                if (pendingPermissionRequest != null) {
                    boolean allGranted = true;
                    if (grantResults != null && grantResults.length > 0) {
                        for (int res : grantResults) {
                            if (res != PackageManager.PERMISSION_GRANTED) {
                                allGranted = false;
                                break;
                            }
                        }
                    }
                    if (allGranted) {
                        pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                    } else {
                        pendingPermissionRequest.deny();
                    }
                    pendingPermissionRequest = null;
                }
            } catch (Exception ignored) {
                pendingPermissionRequest = null;
            }
        });
    }

    @Override
    public void onGeolocationPermissionsShowPrompt(final String origin, final android.webkit.GeolocationPermissions.Callback callback) {
        if (callback == null) return;
        activity.runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    boolean hasFine = activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                    boolean hasCoarse = activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                    if (hasFine || hasCoarse) {
                        callback.invoke(origin, true, false);
                    } else {
                        activity.requestPermissions(new String[]{
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        }, 103);
                        callback.invoke(origin, true, false);
                    }
                } else {
                    callback.invoke(origin, true, false);
                }
            } catch (Exception e) {
                callback.invoke(origin, true, false);
            }
        });
    }

    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        if (request == null) return;
        activity.runOnUiThread(() -> {
            try {
                String[] resources = request.getResources();
                if (resources == null || resources.length == 0) {
                    request.grant(new String[0]);
                    return;
                }
                List<String> resList = Arrays.asList(resources);
                boolean needCamera = resList.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE);
                boolean needAudio = resList.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE);

                boolean hasCamera = true;
                boolean hasAudio = true;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (needCamera) {
                        hasCamera = activity.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
                    }
                    if (needAudio) {
                        hasAudio = activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
                    }
                }

                if ((!needCamera || hasCamera) && (!needAudio || hasAudio)) {
                    request.grant(resources);
                } else {
                    List<String> toRequest = new ArrayList<>();
                    if (needCamera && !hasCamera) toRequest.add(Manifest.permission.CAMERA);
                    if (needAudio && !hasAudio) toRequest.add(Manifest.permission.RECORD_AUDIO);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !toRequest.isEmpty()) {
                        pendingPermissionRequest = request;
                        activity.requestPermissions(toRequest.toArray(new String[0]), 102);
                    } else {
                        request.grant(resources);
                    }
                }
            } catch (Exception e) {
                try {
                    request.grant(request.getResources());
                } catch (Exception ignored) {}
            }
        });
    }
}
