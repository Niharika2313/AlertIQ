import { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom red marker icon
const redIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCAzMiA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTYgNDhMMTYgMTZNMTYgMTZDMjIuNjI3NCAxNiAyOCAxMC42Mjc0IDI4IDRDMjggLTIuNjI3NCAyMi42Mjc0IC04IDE2IC04QzkuMzczIC04IDQgLTIuNjI3NCA0IDRDNCAxMC42Mjc0IDkuMzczIDE2IDE2IDE2WiIgZmlsbD0iI0RDMjYyNiIvPjxjaXJjbGUgY3g9IjE2IiBjeT0iNCIgcj0iNCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=",
  iconSize: [32, 48],
  iconAnchor: [16, 48],
  popupAnchor: [0, -48],
});

// Component to handle map auto-centering
function MapController({ locations }) {
  const map = useMap();

  useEffect(() => {
    if (locations && locations.length > 0) {
      const latLngs = locations.map((loc) => [loc.lat, loc.lng]);

      if (latLngs.length > 1) {
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        map.setView(latLngs[0], 16);
      }
    }
  }, [locations, map]);

  return null;
}

// Extract sessionId from URL
function getSessionIdFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/\/tracking\/([^/]+)/);
  return match ? match[1] : null;
}

export default function App() {
  const [sessionId] = useState(() => getSessionIdFromUrl());
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(() => !!sessionId);
  const [error, setError] = useState(
    sessionId ? null : "Invalid tracking link",
  );
  const eventSourceRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    console.log("🔍 Loading session:", sessionId);

    // Fetch initial session data
    fetch(`${API_URL}/sos/session/${sessionId}`)
      .then((res) => {
        console.log("📥 Response status:", res.status);
        if (!res.ok) throw new Error("Session not found");
        return res.json();
      })
      .then((data) => {
        console.log("✅ Session data:", data);
        setSession(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("❌ Error loading session:", err);
        setError(err.message);
        setLoading(false);
      });

    // Connect to SSE stream for live updates
    const eventSource = new EventSource(`${API_URL}/sos/stream/${sessionId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("📡 SSE event:", data);

      if (data.type === "init") {
        setSession(data.session);
      } else if (data.type === "update") {
        setSession((prev) => ({
          ...prev,
          locations: [...(prev?.locations || []), data.location],
        }));
      } else if (data.type === "ended") {
        setSession((prev) => ({ ...prev, ended: true }));
        alert("Tracking has ended. User is safe!");
        eventSource.close();
      }
    };

    eventSource.onerror = (err) => {
      console.error("❌ SSE error:", err);
      eventSource.close();
    };

    return () => {
      console.log("🧹 Cleaning up SSE connection");
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [sessionId, API_URL]);

  if (!sessionId || error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>
          <h2>❌ Error</h2>
          <p>{error || "Invalid tracking link"}</p>
          <p style={styles.helpText}>
            This tracking link may have expired or is invalid.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingBox}>
          <h2>Loading tracking information...</h2>
          <div style={styles.spinner}></div>
        </div>
      </div>
    );
  }

  const locations = session?.locations || [];
  const lastLocation =
    locations.length > 0 ? locations[locations.length - 1] : null;
  const defaultCenter = lastLocation
    ? [lastLocation.lat, lastLocation.lng]
    : [20.0, 77.0];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>🚨 Emergency Tracking</h1>
        <h2>{session?.userName}</h2>
        <p style={styles.status}>
          {session?.ended
            ? "✅ Safe - Tracking Ended"
            : "🔴 Live Tracking Active"}
        </p>
        <p style={styles.timestamp}>
          Started: {new Date(session?.createdAt).toLocaleString()}
        </p>
        {locations.length > 0 && (
          <p style={styles.updates}>{locations.length} location update(s)</p>
        )}
      </div>

      <div style={styles.mapContainer}>
        {locations.length === 0 ? (
          <div style={styles.noData}>
            <p>⏳ Waiting for location data...</p>
          </div>
        ) : (
          <MapContainer
            center={defaultCenter}
            zoom={16}
            style={{ height: "100%", width: "100%" }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapController locations={locations} />

            {/* Draw path */}
            {locations.length > 1 && (
              <Polyline
                positions={locations.map((loc) => [loc.lat, loc.lng])}
                color="#DC2626"
                weight={3}
                opacity={0.8}
              />
            )}

            {/* Show all location markers */}
            {locations.map((loc, index) => (
              <Marker
                key={index}
                position={[loc.lat, loc.lng]}
                icon={index === locations.length - 1 ? redIcon : undefined}
              >
                <Popup>
                  <strong>
                    {index === locations.length - 1
                      ? "Current Location"
                      : `Point ${index + 1}`}
                  </strong>
                  <br />
                  {new Date(loc.timestamp).toLocaleString()}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      <div style={styles.footer}>
        <p>
          ⚠️ If this is an emergency, please call local emergency services
          immediately
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: "100%",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: "Arial, sans-serif",
  },
  header: {
    backgroundColor: "#dc2626",
    color: "white",
    padding: "20px",
    textAlign: "center",
  },
  status: {
    fontSize: "18px",
    fontWeight: "bold",
    margin: "10px 0",
  },
  timestamp: {
    fontSize: "14px",
    opacity: 0.9,
  },
  updates: {
    fontSize: "14px",
    opacity: 0.9,
  },
  mapContainer: {
    flex: 1,
    width: "100%",
    position: "relative",
  },
  noData: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    fontSize: "18px",
    color: "#6b7280",
  },
  footer: {
    backgroundColor: "#1f2937",
    color: "white",
    padding: "15px",
    textAlign: "center",
  },
  loadingBox: {
    margin: "auto",
    textAlign: "center",
    padding: "40px",
  },
  spinner: {
    border: "4px solid #f3f3f3",
    borderTop: "4px solid #dc2626",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    animation: "spin 1s linear infinite",
    margin: "20px auto",
  },
  errorBox: {
    margin: "auto",
    textAlign: "center",
    padding: "40px",
    maxWidth: "500px",
  },
  helpText: {
    marginTop: "20px",
    color: "#6b7280",
  },
};
