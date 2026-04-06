import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import SOSPage from "./pages/SOSPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#1a1a1a', color: '#ff3333', textAlign: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
    <h1>UNABLE TO ACCESS SITE FEATURES, PAY DEVELOPER FIRST.</h1>
  </div>
);

export default App;
