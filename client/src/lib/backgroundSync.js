import { Capacitor, registerPlugin } from "@capacitor/core";
import { getApiBaseUrl } from "./apiConfig";

export const PulseBackground = Capacitor.isNativePlatform()
  ? registerPlugin("PulseBackground")
  : null;

export async function syncNativeBackgroundService(userId) {
  if (!Capacitor.isNativePlatform() || !PulseBackground) return;
  try {
    const token = localStorage.getItem("pulse-token") || "";
    const serverUrl = getApiBaseUrl();
    await PulseBackground.configureSync({
      serverUrl,
      token,
      userId: userId ? String(userId) : "",
    });
    console.log("[Pulse Background Sync] Native background service configured and running.");
  } catch (e) {
    console.warn("[Pulse Background Sync] configureSync error:", e);
  }
}

export async function stopNativeBackgroundService() {
  if (!Capacitor.isNativePlatform() || !PulseBackground) return;
  try {
    await PulseBackground.stopSync();
  } catch (e) {
    console.warn("[Pulse Background Sync] stopSync error:", e);
  }
}

export async function requestIgnoreBatteryOptimization() {
  if (!Capacitor.isNativePlatform() || !PulseBackground) return;
  try {
    await PulseBackground.requestBatteryOptimization();
  } catch (e) {
    console.warn("[Pulse Background Sync] requestBatteryOptimization error:", e);
  }
}

export async function openAutostartSettings() {
  if (!Capacitor.isNativePlatform() || !PulseBackground) return;
  try {
    await PulseBackground.openAutostartSettings();
  } catch (e) {
    console.warn("[Pulse Background Sync] openAutostartSettings error:", e);
  }
}

