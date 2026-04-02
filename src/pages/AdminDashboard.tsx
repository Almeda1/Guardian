import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Bell, Shield, Clock, CheckCircle, AlertTriangle, LogOut } from "lucide-react";
import AdminLogin from "./AdminLogin";
import type { Session } from "@supabase/supabase-js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const yellowIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type AlertStatus = "unresolved" | "dispatched" | "resolved";

interface Alert {
  id: string;
  latitude: number;
  longitude: number;
  status: AlertStatus;
  victim_name: string;
  victim_age: number;
  victim_details: string;
  emergency_contact: string;
  created_at: string;
  updated_at: string;
}

const statusConfig = {
  unresolved: { color: "bg-destructive", icon: AlertTriangle, label: "Unresolved" },
  dispatched: { color: "bg-warning", icon: Clock, label: "Dispatched" },
  resolved: { color: "bg-success", icon: CheckCircle, label: "Resolved" },
};

const getIcon = (status: AlertStatus) => {
  if (status === "unresolved") return redIcon;
  if (status === "dispatched") return yellowIcon;
  return greenIcon;
};

const beepAudio = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      gain2.gain.value = 0.3;
      osc2.start();
      osc2.stop(ctx.currentTime + 0.15);
    }, 200);
  } catch {}
};

const AdminDashboard = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    // Fetch existing alerts
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from("sos_alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) {
        setAlerts(data as Alert[]);
        isInitialLoad.current = false;
      }
    };
    fetchAlerts();

    // Real-time subscription
    const channel = supabase
      .channel("sos-alerts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sos_alerts" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newAlert = payload.new as Alert;
            setAlerts((prev) => [newAlert, ...prev]);
            if (!isInitialLoad.current) {
              beepAudio();
            }
            // Pan map to new alert
            if (mapRef.current) {
              mapRef.current.flyTo([newAlert.latitude, newAlert.longitude], 14);
            }
          } else if (payload.eventType === "UPDATE") {
            setAlerts((prev) =>
              prev.map((a) =>
                a.id === payload.new.id ? (payload.new as Alert) : a
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (id: string, status: AlertStatus) => {
    await supabase.from("sos_alerts").update({ status }).eq("id", id);
  };

  const selected = alerts.find((a) => a.id === selectedAlert);
  const mapCenter: [number, number] = alerts.length > 0
    ? [alerts[0].latitude, alerts[0].longitude]
    : [9.0579, 7.4951]; // Default: Abuja, Nigeria

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 lg:w-96 border-r border-border flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">SafeGuardian</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Emergency Dispatch Center
          </p>
          <div className="flex gap-2 mt-3">
            <Badge variant="destructive" className="text-xs">
              {alerts.filter((a) => a.status === "unresolved").length} Active
            </Badge>
            <Badge variant="secondary" className="text-xs bg-warning/20 text-warning">
              {alerts.filter((a) => a.status === "dispatched").length} Dispatched
            </Badge>
            <Badge variant="secondary" className="text-xs bg-success/20 text-success">
              {alerts.filter((a) => a.status === "resolved").length} Resolved
            </Badge>
          </div>
        </div>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto">
          {alerts.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No alerts yet. Waiting for incoming distress signals...
            </div>
          )}
          {alerts.map((alert) => {
            const config = statusConfig[alert.status];
            const StatusIcon = config.icon;
            const isActive = alert.status === "unresolved";
            return (
              <button
                key={alert.id}
                onClick={() => {
                  setSelectedAlert(alert.id);
                  mapRef.current?.flyTo([alert.latitude, alert.longitude], 14);
                }}
                className={`w-full text-left p-4 border-b border-border transition-colors hover:bg-accent/50 ${
                  selectedAlert === alert.id ? "bg-accent" : ""
                } ${isActive ? "border-l-4 border-l-destructive" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${config.color} ${isActive ? "animate-pulse" : ""}`} />
                    <span className="font-semibold text-sm text-foreground">
                      {alert.victim_name}
                    </span>
                  </div>
                  <StatusIcon className={`h-4 w-4 ${
                    alert.status === "unresolved" ? "text-destructive" :
                    alert.status === "dispatched" ? "text-warning" : "text-success"
                  }`} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Age {alert.victim_age} · {alert.victim_details}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  📍 {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(alert.created_at).toLocaleString()}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar with details */}
        {selected && (
          <div className="p-4 border-b border-border bg-card flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {selected.victim_name}, {selected.victim_age}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selected.victim_details}
              </p>
              <p className="text-sm text-muted-foreground">
                📞 Emergency Contact: {selected.emergency_contact}
              </p>
            </div>
            <Select
              value={selected.status}
              onValueChange={(val) => updateStatus(selected.id, val as AlertStatus)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unresolved">🔴 Unresolved</SelectItem>
                <SelectItem value="dispatched">🟡 Authorities Dispatched</SelectItem>
                <SelectItem value="resolved">🟢 Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={mapCenter}
            zoom={6}
            className="h-full w-full"
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {alerts.map((alert) => (
              <Marker
                key={alert.id}
                position={[alert.latitude, alert.longitude]}
                icon={getIcon(alert.status)}
                eventHandlers={{
                  click: () => setSelectedAlert(alert.id),
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>{alert.victim_name}</strong>
                    <br />
                    Status: {statusConfig[alert.status].label}
                    <br />
                    {new Date(alert.created_at).toLocaleString()}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
