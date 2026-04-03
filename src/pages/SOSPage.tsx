import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Settings } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface UserProfile {
  name: string;
  age: string;
  medicalInfo: string;
  emergencyContact: string;
}

const defaultProfile: UserProfile = {
  name: "",
  age: "",
  medicalInfo: "",
  emergencyContact: "",
};

const SOSPage = () => {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isInstantMode, setIsInstantMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("safeguardian_profile");
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing existing profile data", e);
      }
    } else {
      setIsInstantMode(false); // Animate smoothly on auto-load
      setTimeout(() => setIsSetupOpen(true), 150); // Prompt them to set it up initially after a tiny delay
    }
  }, []);

  const saveProfile = async () => {
    localStorage.setItem("safeguardian_profile", JSON.stringify(profile));
    setIsSetupOpen(false);
    
    const lastSosTime = localStorage.getItem("last_sos_time");
    const lastSosId = localStorage.getItem("last_sos_id");
    
    // If an SOS was sent within the last 5 minutes, update the active alert with new details
    if (lastSosTime && lastSosId && Date.now() - parseInt(lastSosTime) < 5 * 60 * 1000) {
      try {
        const { error } = await supabase.rpc("update_alert_profile", {
          p_alert_id: lastSosId,
          p_new_name: profile.name || "Unknown",
          p_new_age: profile.age ? parseInt(profile.age) : null,
          p_new_details: profile.medicalInfo || "No details provided",
          p_new_contact: profile.emergencyContact || "None provided"
        });
        
        if (error) throw error;
        toast.success("Profile saved and active SOS alert updated!");
      } catch (err) {
        console.error("Failed to update active alert:", err);
        toast.success("Profile saved locally, but failed to update active alert.");
      }
    } else {
      toast.success("Identity profile saved!");
    }
  };

  const handleSOS = async () => {
    if (status !== "idle") return;

    // Basic rate limiting via localStorage (5 minutes cooldown)
    const lastSosTime = localStorage.getItem("last_sos_time");
    if (lastSosTime && Date.now() - parseInt(lastSosTime) < 5 * 60 * 1000) {
      toast.error("You recently sent an SOS. Please wait before sending another, or call emergency services directly.");
      return;
    }

    setStatus("sending");

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser."));
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 20000,
          });
        }
      );

      const newId = crypto.randomUUID();

      const { error } = await supabase.from("sos_alerts").insert({
        id: newId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        victim_name: profile.name || "Unknown",
        victim_age: profile.age ? parseInt(profile.age) : null,
        victim_details: profile.medicalInfo || "No details provided",
        emergency_contact: profile.emergencyContact || "None provided",
      });

      if (error) throw error;

      localStorage.setItem("last_sos_time", Date.now().toString());
      localStorage.setItem("last_sos_id", newId);
      setStatus("sent");
      toast.success("Location sent to local authorities. Help is on the way.", {
        duration: 8000,
      });
      
      // Automatically reset status after 8 seconds
      setTimeout(() => setStatus("idle"), 8000);
    } catch (err: unknown) {
      console.error("SOS Error:", err);
      setStatus("idle");
      const errorObj = err as { code?: number | string };
      const errorMessage = errorObj.code === 1 
        ? "Location access denied. Please enable location permissions." 
        : "Failed to get location or send alert. Please call emergency services directly.";
      toast.error(errorMessage, { duration: 10000 });
    }
  };

  const getAmbientColor = () => {
    if (status === "sending") return "bg-amber-500/15";
    if (status === "sent") return "bg-emerald-500/15";
    return "bg-destructive/15";
  };

  return (
    <div className="min-h-[100dvh] lg:h-screen w-full bg-black flex flex-col items-center justify-center overflow-hidden relative">
      {/* Dynamic Ambient Background Elements */}
      <div className={`absolute top-[-15%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[140px] pointer-events-none transition-colors duration-1000 ${getAmbientColor()}`} />
      <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full h-full lg:h-[85vh] lg:max-h-[900px] lg:max-w-6xl lg:bg-card/30 lg:backdrop-blur-2xl lg:border border-border/40 lg:rounded-[3.5rem] lg:shadow-2xl relative flex flex-col justify-evenly lg:flex-row items-center lg:justify-between px-4 pb-6 pt-24 sm:px-6 sm:pb-8 sm:pt-28 lg:p-14 overflow-hidden mx-auto transition-all duration-300">
        
        {/* Top Navbar / Buttons */}
        <div className="absolute top-0 left-0 w-full z-50 px-4 py-3 sm:px-6 bg-background/20 backdrop-blur-xl border-b border-border/20 lg:bg-transparent lg:backdrop-blur-none lg:border-none lg:top-4 lg:right-6 lg:w-auto lg:left-auto lg:px-0 lg:py-0">
          <div className="w-full mx-auto flex items-center justify-between lg:justify-end gap-3 lg:gap-4">
            
            {/* Mobile Navbar Left Content */}
            <div className="flex items-center gap-3 lg:hidden">
              <img src="/shield-logo.png" alt="Shield Logo" className="h-8 w-auto drop-shadow-md" />
              <span className="font-['Montserrat'] font-black text-[22px] tracking-tight text-foreground">Guardian</span>
            </div>

            <div className="flex items-center gap-3 lg:gap-4 ml-auto lg:ml-0">
              {/* Desktop Edit Profile Button */}
              <button onClick={() => { setIsInstantMode(true); setIsSetupOpen(true); }} className="hidden lg:flex items-center gap-1.5 bg-background/50 border border-border/50 text-foreground px-4 py-2.5 rounded-full text-sm font-bold shadow-sm hover:bg-background/80 hover:shadow-md active:scale-[0.98] transition-none backdrop-blur-md">
                <Settings className="h-4 w-4 text-primary" />
                <span>Edit Profile</span>
              </button>

              <button
                onClick={async (e) => {
                  e.preventDefault();
                  await supabase.auth.signOut();
                  window.location.href = "/admin";
                }}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-sm font-bold shadow-[0_4px_20px_-5px_rgba(59,130,246,0.4)] hover:shadow-[0_4px_25px_-5px_rgba(59,130,246,0.6)] active:scale-[0.98] transition-all"
              >
                <Shield className="h-4 w-4" />
                Admin
              </button>
            </div>
          </div>
        </div>
        
        {/* Controls - Controlled Setup Dialog */}
        <Dialog open={isSetupOpen} onOpenChange={(open) => {
          if (!open) setIsInstantMode(false); // Reset on close so next auto-load animates gracefully
          setIsSetupOpen(open);
        }}>
          <DialogContent className={`w-[95vw] max-w-[400px] p-5 sm:p-6 rounded-3xl border-border/50 bg-card/95 backdrop-blur-2xl shadow-2xl overflow-y-auto max-h-[90vh] ${isInstantMode ? "duration-0 data-[state=open]:animate-none data-[state=closed]:animate-none" : ""}`}>
            <DialogHeader className="space-y-1.5">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <img src="/shield-logo.png" alt="Shield Logo" className="h-6 w-auto drop-shadow-md" />
              </div>
              <DialogTitle className="text-xl font-black">Emergency Profile</DialogTitle>
              <p className="text-[13px] text-muted-foreground leading-tight font-medium">
                This information will be securely dispatched to authorities alongside your physical GPS location the moment you click the SOS button.
              </p>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                <Input
                  id="name"
                  className="h-10 border-border/50 bg-background/50 rounded-lg text-sm"
                  placeholder="e.g. John Doe"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="age" className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Age</Label>
                <Input
                  id="age"
                  type="number"
                  className="h-10 border-border/50 bg-background/50 rounded-lg text-sm"
                  placeholder="e.g. 35"
                  value={profile.age}
                  onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact" className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Emergency Contact</Label>
                <Input
                  id="contact"
                  className="h-10 border-border/50 bg-background/50 rounded-lg text-sm"
                  placeholder="e.g. Jane Doe (+123456789)"
                  value={profile.emergencyContact}
                  onChange={(e) => setProfile({ ...profile, emergencyContact: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="medical" className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Medical Details</Label>
                <Textarea
                  id="medical"
                  className="min-h-[60px] resize-none border-border/50 bg-background/50 rounded-lg text-sm"
                  placeholder="e.g. Asthma, allergies..."
                  value={profile.medicalInfo}
                  onChange={(e) => setProfile({ ...profile, medicalInfo: e.target.value })}
                />
              </div>
              <button
                onClick={saveProfile}
                className="w-full bg-primary text-primary-foreground h-11 rounded-xl text-sm font-extrabold mt-2 shadow-[0_4px_20px_-5px_rgba(59,130,246,0.4)] hover:shadow-[0_4px_25px_-5px_rgba(59,130,246,0.6)] hover:bg-primary/95 active:scale-[0.98] transition-all"
              >
                Save & Secure Identity
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Left Column (Info / Branding) */}
        <div className="flex flex-col items-center lg:items-start lg:w-[50%] z-10 space-y-4 lg:space-y-6 pt-4 lg:pt-0 lg:pr-8">
          
          {/* Desktop Logo & Title */}
          <div className="hidden lg:flex items-center gap-4 mb-2">
            <img src="/shield-logo.png" alt="Shield Logo" className="h-12 lg:h-[4rem] w-auto drop-shadow-md" />
            <h1 className="text-[4rem] lg:text-[5rem] font-['Montserrat'] font-black tracking-tighter bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent leading-[1.1]">
              Guardian
            </h1>
          </div>

          {/* Mobile Only Header (Replaces Logo & Title in main area) */}
          <h1 className="lg:hidden text-[2.25rem] font-['Montserrat'] font-black tracking-tighter bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent leading-[1.1] text-center mb-1">
            Emergency Beacon
          </h1>

          <p className="text-muted-foreground text-[13px] lg:text-[17px] text-center lg:text-left max-w-[280px] lg:max-w-md leading-snug lg:leading-relaxed font-medium">
            Your personal safety companion. Press the beacon instantly to alert authorities with your precise location.
          </p>

          {/* Mobile Only Edit Profile button (under paragraph, above SOS button) */}
          <button onClick={() => { setIsInstantMode(true); setIsSetupOpen(true); }} className="lg:hidden flex items-center justify-center gap-2.5 bg-white/[0.03] border border-white/10 text-muted-foreground hover:text-foreground px-6 py-2.5 rounded-full text-[13.5px] font-medium hover:bg-white/[0.08] active:scale-[0.98] transition-none mt-7">
            <Settings className="h-4 w-4 text-primary/80" />
            <span>Edit Profile</span>
          </button>

          <div className="hidden lg:flex flex-col gap-4 mt-6 lg:mt-10 w-full max-w-sm">
            <div className="flex items-center gap-4 bg-background/40 backdrop-blur-md p-4 rounded-2xl border border-border/50 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:bg-background/60 transition-all">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <div className="h-3.5 w-3.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-foreground">GPS Target Lock</p>
                <p className="text-[13px] text-muted-foreground font-medium mt-0.5">High-accuracy telemetry active</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-background/40 backdrop-blur-md p-4 rounded-2xl border border-border/50 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:bg-background/60 transition-all">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-foreground">Encrypted Channel</p>
                <p className="text-[13px] text-muted-foreground font-medium mt-0.5">Direct 256-bit link to dispatch</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (SOS Button) */}
        <div className="flex flex-col items-center lg:items-end justify-center w-full lg:mb-0 lg:mt-0 lg:w-[50%] relative z-10 py-6 lg:py-0 mt-8">
          <div className="relative flex items-center justify-center w-[240px] h-[240px] lg:w-[500px] lg:h-[500px] lg:translate-x-8">
            {status === "idle" && (
              <>
                <div className="absolute inset-2 lg:inset-4 rounded-full border-[1.5px] border-destructive/20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] origin-center" />
                <div className="absolute inset-8 lg:inset-14 rounded-full border-[1.5px] border-destructive/15 animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite] origin-center" />
                <div className="absolute inset-14 lg:inset-24 rounded-full border-[1.5px] border-destructive/10 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] origin-center" />
                <div className="absolute inset-20 lg:inset-32 rounded-full border-[1.5px] border-destructive/5 animate-[ping_3.5s_cubic-bezier(0,0,0.2,1)_infinite] origin-center" />
              </>
            )}

            <button
              onClick={handleSOS}
              disabled={status === "sent"}
              className={`relative z-20 w-44 h-44 lg:w-80 lg:h-80 rounded-full flex flex-col items-center justify-center text-white font-black tracking-widest transition-all duration-500 overflow-hidden ${
                status === "idle"
                  ? "bg-[radial-gradient(circle_at_30%_30%,_#ef4444,_#7f1d1d)] hover:scale-105 active:scale-95 shadow-[0_20px_50px_-10px_rgba(220,38,38,0.7),inset_0_-15px_30px_rgba(0,0,0,0.4),inset_0_15px_30px_rgba(255,255,255,0.3)] border border-red-400/30 cursor-pointer"
                  : status === "sending"
                  ? "bg-[radial-gradient(circle_at_30%_30%,_#f59e0b,_#78350f)] cursor-wait scale-95 opacity-95 shadow-[0_20px_50px_-10px_rgba(245,158,11,0.6),inset_0_-15px_30px_rgba(0,0,0,0.4),inset_0_15px_30px_rgba(255,255,255,0.2)] border border-amber-300/30"
                  : "bg-[radial-gradient(circle_at_30%_30%,_#10b981,_#064e3b)] cursor-default scale-100 shadow-[0_20px_50px_-10px_rgba(16,185,129,0.5),inset_0_-15px_30px_rgba(0,0,0,0.4),inset_0_15px_30px_rgba(255,255,255,0.2)] border border-emerald-300/30"
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent opacity-50 rounded-[inherit] pointer-events-none" />

              {status === "idle" && <span className="text-[3rem] lg:text-[6rem] drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] z-10 leading-none">SOS</span>}
              {status === "sending" && (
                <span className="text-lg lg:text-3xl animate-pulse drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] z-10 font-bold uppercase tracking-widest">Sending</span>
              )}
              {status === "sent" && (
                <span className="text-lg lg:text-[2rem] text-center leading-[1.1] drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] z-10 px-4 font-bold">HELP<br/>DISPATCHED</span>
              )}
            </button>
          </div>
        </div>
        
        {/* Mobile Footer Note */}
        <div className="lg:hidden text-center w-full z-10 px-4">
          <div className="bg-background/60 backdrop-blur-md px-4 py-3 rounded-2xl border border-border/50 shadow-sm">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Location Active</span>
            </div>
            <p className="text-muted-foreground text-[11px] font-medium leading-snug">
              Securely sharing your coordinates with responders.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SOSPage;
