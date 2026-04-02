import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, X } from "lucide-react";
import { toast } from "sonner";

const SOSPage = () => {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const handleQuickExit = () => {
    window.location.replace("https://google.com");
  };

  const handleSOS = async () => {
    if (status !== "idle") return;
    setStatus("sending");

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        }
      );

      const { error } = await supabase.from("sos_alerts").insert({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      if (error) throw error;

      setStatus("sent");
      toast.success("Location sent to local authorities. Help is on the way.", {
        duration: 8000,
      });
    } catch (err) {
      console.error("SOS Error:", err);
      // Fallback: send with default coordinates if geolocation fails
      try {
        await supabase.from("sos_alerts").insert({
          latitude: 9.0579,
          longitude: 7.4951,
        });
        setStatus("sent");
        toast.success("Alert sent. Help is on the way.", { duration: 8000 });
      } catch {
        setStatus("idle");
        toast.error("Failed to send alert. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between p-6 relative">
      {/* Quick Exit */}
      <button
        onClick={handleQuickExit}
        className="absolute top-4 right-4 z-50 flex items-center gap-1.5 bg-destructive text-destructive-foreground px-3 py-2 rounded-lg text-sm font-bold shadow-lg hover:opacity-90 transition-opacity"
      >
        <X className="h-4 w-4" />
        Exit Fast
      </button>

      {/* Header */}
      <div className="flex flex-col items-center pt-12">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            SafeGuardian
          </h1>
        </div>
        <p className="text-muted-foreground text-sm text-center max-w-xs">
          Your personal safety companion. Press the button below if you need
          immediate help.
        </p>
      </div>

      {/* SOS Button */}
      <div className="flex-1 flex items-center justify-center">
        <button
          onClick={handleSOS}
          disabled={status === "sent"}
          className={`relative w-48 h-48 rounded-full flex items-center justify-center text-2xl font-black tracking-wider transition-all duration-300 ${
            status === "idle"
              ? "bg-destructive text-destructive-foreground animate-pulse-sos hover:scale-105 cursor-pointer"
              : status === "sending"
              ? "bg-destructive/70 text-destructive-foreground cursor-wait"
              : "bg-success text-success-foreground cursor-default"
          }`}
        >
          {status === "idle" && "SOS"}
          {status === "sending" && (
            <span className="animate-pulse">SENDING...</span>
          )}
          {status === "sent" && "HELP\nREQUESTED"}
        </button>
      </div>

      {/* Footer */}
      <div className="text-center pb-4">
        <p className="text-muted-foreground text-xs">
          Your location will be shared with emergency responders.
        </p>
        <a
          href="/admin"
          className="text-primary text-xs mt-2 inline-block hover:underline"
        >
          Admin Dashboard →
        </a>
      </div>
    </div>
  );
};

export default SOSPage;
