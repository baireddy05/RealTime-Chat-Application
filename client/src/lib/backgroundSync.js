import { Capacitor, registerPlugin } from "@capacitor/core";
import { getApiBaseUrl } from "./apiConfig";

export const PulseBackground = Capacitor.isNativePlatform()
  ? registerPlugin("PulseBackground")
  : null;

export async function syncNativeBackgroundService(userId) {
  // Pure native FCM high-priority data messages deliver notifications 100% reliably.
  // We explicitly disable the persistent foreground service so "Connected in background" notification is removed.
  if (Capacitor.isNativePlatform() && PulseBackground) {
    try {
      await PulseBackground.stopSync();
    } catch {}
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

export async function setActiveNativeChat(chatId) {
  if (!Capacitor.isNativePlatform() || !PulseBackground) return;
  try {
    await PulseBackground.setActiveChat({ chatId: chatId ? String(chatId) : "" });
  } catch (e) {
    console.warn("[Pulse Background Sync] setActiveChat error:", e);
  }
}

export async function getPendingNativeChat() {
  if (!Capacitor.isNativePlatform() || !PulseBackground) return null;
  try {
    const res = await PulseBackground.getPendingChat();
    if (res && res.chatId) {
      return res;
    }
  } catch (e) {
    console.warn("[Pulse Background Sync] getPendingChat error:", e);
  }
  return null;
}

export async function clearPendingNativeChat() {
  if (!Capacitor.isNativePlatform() || !PulseBackground) return;
  try {
    await PulseBackground.clearPendingChat();
  } catch {}
}

