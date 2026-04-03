import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
// Replaced Leaflet with MapLibre GL JS
import MapGL, { Marker, Popup, MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Bell, Shield, Clock, CheckCircle, AlertTriangle, LogOut, Menu, X, ArrowLeft } from "lucide-react";
import AdminLogin from "./AdminLogin";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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

const getMarkerColor = (status: AlertStatus) => {
  if (status === "unresolved") return "#ef4444"; // red-500
  if (status === "dispatched") return "#eab308"; // yellow-500
  return "#10b981"; // emerald-500
};

let audioCtx: AudioContext | null = null;
const beepAudio = () => {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
    setTimeout(() => {
      if (!audioCtx) return;
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.frequency.value = 1100;
      gain2.gain.value = 0.3;
      osc2.start();
      osc2.stop(audioCtx.currentTime + 0.15);
    }, 200);
  } catch (e) {
    console.warn("Audio play failed:", e);
  }
};

const addressCache = new Map<string, string>();
const fetchQueue: Array<() => Promise<void>> = [];
let isFetching = false;

const processQueue = async () => {
  if (isFetching) return;
  isFetching = true;
  while (fetchQueue.length > 0) {
    const fetchFn = fetchQueue.shift();
    if (fetchFn) {
      await fetchFn();
      await new Promise((r) => setTimeout(r, 1500)); // Respect OSM Nominatim rate limit (safer at 1.5s)
    }
  }
  isFetching = false;
};

const fetchAddressQueue = (lat: number, lon: number): Promise<string> => {
  return new Promise((resolve) => {
    // Reduce precision to cluster nearby points (~11m resolution) to massively save on rate limiting
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (addressCache.has(key)) {
      resolve(addressCache.get(key)!);
      return;
    }

    fetchQueue.push(async () => {
      if (addressCache.has(key)) {
        resolve(addressCache.get(key)!);
        return;
      }
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&email=dispatch@guardian.app`,
          {
            headers: {
              "Accept-Language": "en-US,en;q=0.9",
            }
          }
        );
        
        if (res.status === 429) {
          console.warn("Nominatim Rate Limited (429)");
          addressCache.set(key, "Location details unavailable (Rate Limited)");
          resolve("Location details unavailable (Rate Limited)");
          return;
        }
        
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        
        const data = await res.json();

        
        const addrParts: string[] = [];
        
        if (data.name) {
          addrParts.push(data.name);
        }

        if (data.address) {
          // Layer specific facility/campus identifiers
          const poiKeys = ["building", "amenity", "university", "college", "school", "hospital", "clinic", "shop", "office", "leisure", "tourism", "mall"];
          for (const k of poiKeys) {
            if (data.address[k] && !addrParts.includes(data.address[k])) {
              addrParts.push(data.address[k]);
            }
          }

          // Layer standard street/city components
          const road = data.address.road;
          if (road && !addrParts.includes(road)) addrParts.push(road);

          const neighborhood = data.address.suburb || data.address.neighbourhood;
          if (neighborhood && !addrParts.includes(neighborhood)) addrParts.push(neighborhood);

          const city = data.address.city || data.address.town || data.address.village;
          if (city && !addrParts.includes(city)) addrParts.push(city);

          const state = data.address.state;
          if (state && !addrParts.includes(state)) addrParts.push(state);
        }

        const addr = addrParts.length > 0 ? addrParts.join(", ") : data.display_name || "Unknown Location";
          
        addressCache.set(key, addr);
        resolve(addr);
      } catch (e) {
        resolve("Location details unavailable");
      }
    });

    processQueue();
  });
};

const LocationDisplay = ({ lat, lon }: { lat: number; lon: number }) => {
  const [address, setAddress] = useState<string>("Loading address...");

  useEffect(() => {
    let mounted = true;
    fetchAddressQueue(lat, lon).then((addr) => {
      if (mounted) setAddress(addr);
    });
    return () => {
      mounted = false;
    };
  }, [lat, lon]);

  return <span>{address}</span>;
};

const AdminDashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMenuClosing, setIsMenuClosing] = useState(false);

  const handleCloseMobileMenu = () => {
    setIsMenuClosing(true);
    setTimeout(() => {
      setIsMobileMenuOpen(false);
      setIsMenuClosing(false);
    }, 300);
  };
  
  // Safeguard to prevent Leaflet from crashing during React SSR/Strict Mode
  const [isMounted, setIsMounted] = useState(false);
  const mapRef = useRef<MapRef | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (window.location.hash.includes("access_token") || window.location.hash.includes("type=signup")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

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
            if (mapRef.current && newAlert.latitude != null && newAlert.longitude != null) {
              mapRef.current.flyTo({ center: [newAlert.longitude, newAlert.latitude], zoom: 14, duration: 1500 });
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
  }, [session]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (!session) {
    return <AdminLogin onLogin={() => {}} />;
  }

  const updateStatus = async (id: string, status: AlertStatus) => {
    // Optimistic UI Update for immediate feedback
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );

    try {
      const { error } = await supabase.from("sos_alerts").update({ status }).eq("id", id);
      if (error) {
        console.error("Failed to update status:", error);
        toast.error("Failed to update alert status.");
      } else {
        toast.success(`Alert marked as ${statusConfig[status].label}`);
      }
    } catch (err) {
      console.error("Failed to update status unexpectedly:", err);
      toast.error("Unexpected error updating alert status.");
    }
  };

  const selected = alerts.find((a) => a.id === selectedAlert);
  const mapCenter: [number, number] = alerts.length > 0 && alerts[0].latitude != null && alerts[0].longitude != null
    ? [alerts[0].latitude, alerts[0].longitude]
    : [9.0579, 7.4951]; // Default: Abuja, Nigeria

  return (
    <div className="h-[100dvh] min-h-[100dvh] flex flex-col lg:flex-row bg-background overflow-hidden relative">
      {/* Mobile Drawer Overlay */}
      {(isMobileMenuOpen || isMenuClosing) && (
        <div className={`lg:hidden fixed inset-0 z-[100] bg-black/60 flex duration-300 ease-in-out fill-mode-both ${isMenuClosing ? 'animate-out fade-out' : 'animate-in fade-in'}`}>
          <div className={`w-[80vw] max-w-sm h-full bg-background border-r border-border/50 shadow-2xl flex flex-col duration-300 ease-in-out fill-mode-both ${isMenuClosing ? 'animate-out slide-out-to-left' : 'animate-in slide-in-from-left'}`}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img src="/shield-logo.png" alt="Shield Logo" className="h-7 w-auto drop-shadow-md" />
                <h1 className="text-[22px] font-['Montserrat'] font-black tracking-tight text-foreground">Guardian</h1>
              </div>
              <button onClick={handleCloseMobileMenu} className="p-2 -mr-2 text-muted-foreground hover:text-foreground">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-muted-foreground px-1 uppercase tracking-wider">Status Overview</h2>
              <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-destructive flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" /> Active</span>
                  <span className="font-bold text-lg">{alerts.filter((a) => a.status === "unresolved").length}</span>
                </div>
                <div className="w-full h-px bg-border/50" />
                <div className="flex justify-between items-center">
                  <span className="font-medium text-warning flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-warning" /> Dispatched</span>
                  <span className="font-bold text-lg">{alerts.filter((a) => a.status === "dispatched").length}</span>
                </div>
                <div className="w-full h-px bg-border/50" />
                <div className="flex justify-between items-center">
                  <span className="font-medium text-success flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-success" /> Resolved</span>
                  <span className="font-bold text-lg">{alerts.filter((a) => a.status === "resolved").length}</span>
                </div>
              </div>
            </div>
            <div className="mt-auto p-6">
              <button
                onClick={() => supabase.auth.signOut()}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/20 rounded-xl transition-all font-bold shadow-sm"
              >
                <LogOut className="h-5 w-5" />
                Sign Out / Exit
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={handleCloseMobileMenu} />
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-96 border-r border-border flex-col shrink-0 z-20 bg-background h-full shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <img src="/shield-logo.png" alt="Shield Logo" className="h-8 w-auto drop-shadow-md" />
              <h1 className="text-[26px] font-['Montserrat'] font-black tracking-tight text-foreground">Guardian</h1>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-muted-foreground hover:text-foreground bg-muted/50 p-2 rounded-full transition-all"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Emergency Dispatch Center
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="destructive" className="py-1 px-2.5 text-[11px] uppercase tracking-wider font-bold">
              {alerts.filter((a) => a.status === "unresolved").length} Active
            </Badge>
            <Badge variant="secondary" className="py-1 px-2.5 text-[11px] bg-warning/20 text-warning uppercase tracking-wider font-bold">
              {alerts.filter((a) => a.status === "dispatched").length} Dispatched
            </Badge>
            <Badge variant="secondary" className="py-1 px-2.5 text-[11px] bg-success/20 text-success uppercase tracking-wider font-bold">
              {alerts.filter((a) => a.status === "resolved").length} Resolved
            </Badge>
          </div>
        </div>

        {/* Desktop Alert List */}
        <div className="flex-1 overflow-y-auto">
          {alerts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
              <div className="bg-muted/30 p-4 rounded-full mb-3">
                <Bell className="h-8 w-8 opacity-40" />
              </div>
              <p className="text-sm font-medium">No alerts yet.</p>
              <p className="text-xs opacity-70 mt-1">Waiting for incoming distress signals...</p>
            </div>
          )}
          {alerts.map((alert) => {
            const config = statusConfig[alert.status] || statusConfig["unresolved"];
            const StatusIcon = config.icon;
            const isActive = alert.status === "unresolved";
            return (
              <button
                key={alert.id}
                onClick={() => {
                  setSelectedAlert(alert.id);
                  if (alert.latitude != null && alert.longitude != null) {
                    mapRef.current?.flyTo({ center: [alert.longitude, alert.latitude], zoom: 14, duration: 1500 });
                  }
                }}
                className={`w-full text-left p-5 border-b border-border/60 transition-all hover:bg-muted/40 ${
                  selectedAlert === alert.id ? "bg-muted/60" : ""
                } relative`}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-destructive" />}
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${config.color} ${isActive ? "animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]" : ""}`} />
                    <span className="font-bold text-[15px] text-foreground tracking-tight">
                      {alert.victim_name || "Unknown Victim"}
                    </span>
                  </div>
                  <div className={`p-1.5 rounded-md ${
                    alert.status === "unresolved" ? "bg-destructive/10 text-destructive" :
                    alert.status === "dispatched" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                  }`}>
                    <StatusIcon className="h-4 w-4" />
                  </div>
                </div>
                <div className="pl-5 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40" /> Age {alert.victim_age || "N/A"} · {alert.victim_details || "No details"}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground flex items-start gap-1.5 leading-snug">
                    <span>📍</span>
                    <span>
                      {alert.latitude?.toFixed(4) || "Unknown"}, {alert.longitude?.toFixed(4) || "Unknown"}
                      {alert.latitude != null && alert.longitude != null && (
                        <>
                          {" • "}
                          <LocationDisplay lat={alert.latitude} lon={alert.longitude} />
                        </>
                      )}
                    </span>
                  </p>
                  <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mt-1">
                    {alert.created_at ? new Date(alert.created_at).toLocaleString() : "Unknown"}
                  </p>
                </div>
                
                {selectedAlert === alert.id && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-border/40 pl-5">
                    <button
                      onClick={(e) => { e.stopPropagation(); updateStatus(alert.id, "unresolved"); }}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all ${
                        alert.status === "unresolved" ? "bg-destructive text-destructive-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); updateStatus(alert.id, "dispatched"); }}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all ${
                        alert.status === "dispatched" ? "bg-warning text-warning-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      }`}
                    >
                      Dispatched
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); updateStatus(alert.id, "resolved"); }}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all ${
                        alert.status === "resolved" ? "bg-success text-success-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      }`}
                    >
                      Resolved
                    </button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Area (Map Background on Mobile) */}
      <div className="flex-1 relative flex flex-col h-full w-full">
        {/* Mobile Header Buttons (Floating over map) */}
        {!selectedAlert && (
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden absolute top-4 left-4 z-[60] bg-background/90 backdrop-blur-md p-3.5 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-border/50 text-foreground hover:bg-background transition-all active:scale-95"
          >
            <Menu className="h-6 w-6" />
          </button>
        )}

        {/* Detail View Menu Bar (Mobile & Desktop) */}
        {selected && (
          <div className="relative z-[60] shrink-0 pointer-events-none p-3 lg:p-0">
            <div className="bg-background/95 backdrop-blur-xl lg:bg-card border border-border/50 lg:border-b lg:border-x-0 lg:border-t-0 p-4 lg:p-5 rounded-2xl lg:rounded-none shadow-lg lg:shadow-none pointer-events-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <button 
                  onClick={() => setSelectedAlert(null)}
                  className="lg:hidden p-2 -ml-2 bg-muted/50 rounded-full hover:bg-muted transition-colors text-foreground"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                    {selected.victim_name || "Unknown Victim"} 
                    <span className="text-sm font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                      Age {selected.victim_age || "N/A"}
                    </span>
                  </h2>
                  <p className="text-sm text-foreground/80 font-medium mt-1">
                    {selected.victim_details || "No additional medical/situation details provided."}
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground mt-1.5 flex items-start gap-1">
                    <span className="mt-0.5">📍</span>
                    <span className="leading-relaxed">
                      {selected.latitude?.toFixed(4)}, {selected.longitude?.toFixed(4)}
                      {selected.latitude != null && selected.longitude != null && (
                        <>
                          <span className="mx-1">•</span>
                          <LocationDisplay lat={selected.latitude} lon={selected.longitude} />
                        </>
                      )}
                    </span>
                  </p>
                  <p className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md inline-block mt-2">
                    📞 Emergency Contact: {selected.emergency_contact || "Not provided"}
                  </p>
                </div>
              </div>
              <div className="pt-2 lg:pt-0 border-t border-border/50 lg:border-none flex lg:block justify-end">
                <Select
                  value={selected.status || "unresolved"}
                  onValueChange={(val) => updateStatus(selected.id, val as AlertStatus)}
                >
                  <SelectTrigger className="w-full lg:w-48 h-11 bg-background shadow-sm border-border/60 font-medium">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unresolved" className="font-medium text-destructive">🔴 Active / Unresolved</SelectItem>
                    <SelectItem value="dispatched" className="font-medium text-warning">🟡 Authorities Dispatched</SelectItem>
                    <SelectItem value="resolved" className="font-medium text-success">🟢 Fully Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Map */}
        <div className="flex-1 relative w-full h-full min-h-0 z-0 p-0 m-0">
          {isMounted && (
            <MapGL
              initialViewState={{
                longitude: mapCenter[1],
                latitude: mapCenter[0],
                zoom: 6
              }}
              mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
              style={{ width: "100%", height: "100%" }}
              ref={mapRef}
            >
              {alerts.filter((a) => a.latitude != null && a.longitude != null).map((alert) => (
                <Marker
                  key={alert.id}
                  longitude={alert.longitude}
                  latitude={alert.latitude}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setSelectedAlert(alert.id);
                    mapRef.current?.flyTo({ center: [alert.longitude, alert.latitude], zoom: 15, duration: 1500 });
                  }}
                >
                  <div className="relative flex items-center justify-center -translate-y-2 cursor-pointer transition-transform hover:scale-110">
                    {alert.status === "unresolved" && (
                      <div className="absolute inset-0 rounded-full bg-destructive/40 animate-ping opacity-80" style={{ width: "16px", height: "16px", left: "50%", bottom: 0, transform: "translate(-50%, -5px)" }} />
                    )}
                    <svg viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}>
                      <path
                        fill={getMarkerColor(alert.status)}
                        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                      />
                    </svg>
                  </div>
                </Marker>
              ))}

              {selected && selected.latitude != null && selected.longitude != null && (
                <Popup
                  longitude={selected.longitude}
                  latitude={selected.latitude}
                  anchor="bottom"
                  offset={35}
                  closeButton={false}
                  closeOnClick={false}
                  maxWidth="300px"
                  className="rounded-xl shadow-xl z-50"
                >
                  <div className="text-sm p-1">
                    <strong className="text-base font-bold text-black">{selected.victim_name || "Unknown"}</strong>
                    <div className="h-px bg-slate-200 my-2 w-full" />
                    <span className="font-medium text-slate-500">Status:</span>{" "}
                    <strong className={
                      selected.status === 'unresolved' ? 'text-destructive' : 
                      selected.status === 'resolved' ? 'text-success' : 'text-warning'
                    }>
                      {statusConfig[selected.status]?.label || "Unresolved"}
                    </strong>
                    <br />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      {selected.created_at ? new Date(selected.created_at).toLocaleString() : "Unknown"}
                    </span>
                  </div>
                </Popup>
              )}

            </MapGL>
          )}
        </div>

        {/* Mobile Bottom List Sheet (Visible when NO alert is selected) */}
        {!selectedAlert && (
          <div className="lg:hidden absolute bottom-0 left-0 right-0 z-[50] bg-background/95 backdrop-blur-xl rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] flex flex-col border-t border-border/40 max-h-[60vh] min-h-[40vh] transition-transform duration-500 ease-out">
            <div className="p-4 flex justify-center shrink-0 w-full">
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
            </div>
            <div className="px-6 pb-2 shrink-0 flex items-center justify-between">
              <h2 className="font-extrabold text-xl tracking-tight text-foreground">Distress Requests</h2>
              <Badge variant="destructive" className="animate-pulse">{alerts.filter(a => a.status === 'unresolved').length} Active</Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 pb-6 mt-2">
              {alerts.length === 0 && (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <CheckCircle className="h-10 w-10 opacity-30 mb-2" />
                  <p className="text-sm font-medium">All clear. No active requests.</p>
                </div>
              )}
              {alerts.map((alert) => {
                const config = statusConfig[alert.status] || statusConfig["unresolved"];
                const StatusIcon = config.icon;
                const isActive = alert.status === "unresolved";

                return (
                  <div
                    key={alert.id}
                    onClick={() => {
                      setSelectedAlert(alert.id);
                      if (alert.latitude != null && alert.longitude != null) {
                        mapRef.current?.flyTo({ center: [alert.longitude, alert.latitude], zoom: 15, duration: 1200 });
                      }
                    }}
                    className="bg-card w-full text-left p-4 mb-3 rounded-2xl border border-border/50 shadow-sm active:scale-[0.98] transition-all relative overflow-hidden"
                  >
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-destructive" />}
                    
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-2 mb-1 pl-1">
                        <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${config.color} ${isActive ? "animate-pulse" : ""}`} />
                        <span className="font-bold text-[15px] text-foreground tracking-tight">
                          {alert.victim_name || "Unknown Victim"}
                        </span>
                      </div>
                      <div className={`p-1.5 rounded-md shrink-0 ${
                        alert.status === "unresolved" ? "bg-destructive/10 text-destructive" :
                        alert.status === "dispatched" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                      }`}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                    </div>
                    
                    <div className="pl-4">
                      <p className="text-xs font-medium text-muted-foreground mb-1 line-clamp-1">
                        {alert.victim_details || "No details"}
                      </p>
                      <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                        {alert.created_at ? new Date(alert.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;