import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, LogIn, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const AdminLogin = ({ onLogin }: { onLogin: () => void }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side email validation
    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      onLogin();
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background lg:bg-gradient-to-br lg:from-background lg:to-muted/30 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-in fade-in duration-1000" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-destructive/5 rounded-full blur-[120px] pointer-events-none animate-in fade-in duration-1000 delay-300" />

      <div className="w-full max-w-md bg-card/60 backdrop-blur-2xl border border-border/50 rounded-[2rem] shadow-2xl p-6 md:p-8 relative z-10 space-y-6 animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-700 ease-out fill-mode-both">
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="inline-flex items-center justify-center mb-1">
            <img src="/shield-logo.png" alt="Shield Logo" className="h-10 w-auto drop-shadow-md" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-['Montserrat'] font-black text-foreground tracking-tight text-center">
            Admin
          </h1>
          <p className="text-muted-foreground text-sm font-medium text-center">
            Emergency Dispatcher Access
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3">
            <Input
              type="email"
              placeholder="dispatch@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 lg:h-12 bg-background/50 border-border/50 text-base rounded-xl transition-all focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                title="Password must be at least 10 characters long"
                className="h-11 lg:h-12 bg-background/50 border-border/50 text-base pr-12 rounded-xl transition-all focus-visible:ring-1 focus-visible:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-11 lg:h-12 text-base font-bold rounded-xl shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_-5px_rgba(59,130,246,0.6)] hover:bg-primary/95 transition-all active:scale-[0.98]" 
            disabled={loading}
          >
            <LogIn className="h-5 w-5 mr-2.5" />
            {loading ? "Authenticating..." : "Sign In to Dispatch"}
          </Button>

          <div className="flex items-center justify-center pt-1">
            <a 
              href="/" 
              className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors font-medium hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to SOS Beacon
            </a>
          </div>
        </form>

        <div className="pt-3 border-t border-border/50">
          <p className="text-center text-xs lg:text-[13px] text-muted-foreground font-medium leading-relaxed">
            Only authorized dispatchers may access this system.<br className="hidden md:block"/>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;