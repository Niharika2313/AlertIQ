import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Alert, Vibration } from "react-native";
import { auth } from "../config/firebase";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const LOCATION_TASK_NAME = "sos-location-tracking";
const UPDATE_INTERVAL = 5000; // Send update every 5 seconds when being tracked

let trackingInterval: NodeJS.Timeout | number | null = null;
let isTracking = false;
let sessionId: string | null = null;

// Define background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("❌ Location tracking error:", error);
    return;
  }
  if (data && sessionId) {
    const { locations } = data;
    const location = locations[0];
    console.log("📍 Background location update:", location.coords);
    await sendLocationUpdate(
      location.coords.latitude,
      location.coords.longitude,
    );
  }
});

// Send location update to server
async function sendLocationUpdate(lat: number, lng: number) {
  if (!sessionId) {
    console.log("⚠️ No session ID, skipping location update");
    return;
  }

  try {
    console.log(`📤 Sending location update: ${lat}, ${lng}`);
    const response = await fetch(`${API_URL}/sos/update-location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        location: { lat, lng },
        timestamp: new Date().toISOString(),
      }),
    });

    const data = await response.json();
    console.log("✅ Location update response:", data);
  } catch (err) {
    console.error("💥 Location update error:", err);
  }
}

// Start live location tracking
async function startLiveTracking(newSessionId: string) {
  if (isTracking) {
    console.log("⚠️ Already tracking, skipping");
    return;
  }

  sessionId = newSessionId;
  console.log("🚀 Starting live tracking for session:", sessionId);

  try {
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Location permission is required for SOS tracking.",
      );
      return;
    }

    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();

    console.log("✅ Foreground permission:", foregroundStatus);
    console.log("✅ Background permission:", backgroundStatus);

    // Start foreground tracking
    trackingInterval = setInterval(async () => {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        console.log("📍 Foreground location:", location.coords);
        await sendLocationUpdate(
          location.coords.latitude,
          location.coords.longitude,
        );
      } catch (err) {
        console.error("💥 Tracking interval error:", err);
      }
    }, UPDATE_INTERVAL);

    // Start background tracking if permission granted
    if (backgroundStatus === "granted") {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: UPDATE_INTERVAL,
        distanceInterval: 10, // Update every 10 meters
        foregroundService: {
          notificationTitle: "SOS Active",
          notificationBody: "Live location tracking is active",
          notificationColor: "#FF0000",
        },
      });
      console.log("✅ Background tracking started");
    }

    isTracking = true;
    console.log("✅ Live tracking started successfully");
  } catch (err) {
    console.error("💥 Failed to start tracking:", err);
    Alert.alert("Tracking Error", "Could not start live location tracking.");
  }
}

// Stop live location tracking
export async function stopLiveTracking() {
  if (!isTracking || !sessionId) {
    console.log("⚠️ Not tracking, nothing to stop");
    return;
  }

  console.log("🛑 Stopping live tracking for session:", sessionId);

  try {
    if (trackingInterval) {
      clearInterval(trackingInterval);
      trackingInterval = null;
      console.log("✅ Foreground tracking stopped");
    }

    const hasTask = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (hasTask) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log("✅ Background tracking stopped");
    }

    // Notify server that tracking has stopped
    console.log("📤 Sending end session request");
    const response = await fetch(`${API_URL}/sos/end-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });

    const data = await response.json();
    console.log("✅ End session response:", data);

    isTracking = false;
    sessionId = null;
    Alert.alert("✅ Tracking Stopped", "You are now safe.");
  } catch (err) {
    console.error("💥 Stop tracking error:", err);
    Alert.alert("Error", "Could not stop tracking properly.");
  }
}

// Check if currently tracking
export function isLiveTracking(): boolean {
  return isTracking;
}

// Get current session ID
export function getCurrentSessionId(): string | null {
  return sessionId;
}

// Trigger SOS
export async function triggerSOS() {
  const user = auth.currentUser;
  if (!user) {
    Alert.alert("Error", "You must be logged in to trigger SOS.");
    return;
  }

  console.log("🚨 Triggering SOS for user:", user.uid);

  try {
    // Get current location
    console.log("📍 Getting current location...");
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    console.log("✅ Location obtained:", location.coords);

    // Send SOS request
    console.log("📤 Sending SOS request to:", `${API_URL}/sos/trigger`);
    const res = await fetch(`${API_URL}/sos/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: user.uid,
        location: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        },
      }),
    });

    console.log("📥 Response status:", res.status);
    const data = await res.json();
    console.log("📥 Response data:", data);

    if (data?.success && data?.sessionId) {
      console.log("✅ SOS sent successfully, session ID:", data.sessionId);

      // Vibrate to confirm
      Vibration.vibrate([300, 300, 300]);

      // Start live tracking with session ID
      await startLiveTracking(data.sessionId);

      Alert.alert(
        "✅ SOS Sent",
        `Emergency contacts notified with tracking link. Live location tracking started.\n\nSession ID: ${data.sessionId}`,
        [
          {
            text: "I'm Safe Now",
            onPress: stopLiveTracking,
            style: "cancel",
          },
        ],
      );
    } else {
      console.error("❌ SOS failed:", data);
      Alert.alert(
        "❌ SOS Failed",
        data?.error || "Message could not be delivered.",
      );
    }
  } catch (err: any) {
    console.error("💥 SOS Error:", err);
    Alert.alert("❌ SOS Error", err?.message || "Network or server error.");
  }
}
