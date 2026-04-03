# 🛡️ Guardian - Emergency Beacon & Dispatch System

Guardian is a full-stack web application designed for personal safety, rapid emergency response, and localized dispatch tracking. It allows users to broadcast an immediate SOS alert with their exact GPS coordinates and medical profile, which automatically appears on a real-time dashboard for authorized emergency dispatchers.

## ✨ Key Features

### For Users (SOS Beacon)
- **One-Tap Emergency Alert:** Instantly broadcasts high-accuracy GPS coordinates to authorities.
- **Identity Storage:** Securely stores the user's emergency profile (Name, Age, Medical Details, Emergency Contact) locally and attaches it to the distress signal.
- **Dynamic Updates:** Users can update their medical details on an active distress call immediately after sending.
- **Rate Limiting:** Built-in safeguards (5-minute cooldown) to prevent accidental spamming of emergency services.

### For Dispatchers (Admin Dashboard)
- **Secure Authentication:** Protected dispatch center utilizing Supabase Auth ensuring only verified operators can view distress locations.
- **Real-Time Live Map:** Live monitoring of distress signals across an interactive Leaflet map interface using Supabase Realtime subscriptions.
- **Automatic Reverse Geocoding:** Intelligently translates raw latitude/longitude payload into human-readable street addresses and landmarks using the OpenStreetMap Nominatim API (with local coordinate clustering to heavily conserve rate limits).
- **Alert Lifecycle Management:** Dispatchers can categorize and filter alerts as *Active (Unresolved)*, *Dispatched*, and *Resolved*.
- **Visual & Audio Cues:** Critical incoming alerts trigger immediate audio beeps and visual ping animations on the map.

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS, shadcn/ui components, Lucide Icons
- **Mapping:** React-Leaflet, Leaflet.js, OpenStreetMap (TileLayer & Nominatim API)
- **Backend & Database:** Supabase (PostgreSQL, Realtime Subscriptions, Authentication, Row-Level Security)
- **Package Manager:** Bun / npm

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+) or Bun
- A Supabase project

### 1. Clone & Install
```bash
git clone <repo-url>
cd beacon-bridge-aid
bun install
```

### 2. Environment Variables
Ensure you have a `.env` or `.env.local` file configured in the root directory with your Supabase credentials:
```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Database Setup (Supabase)
Apply the database migrations found in the `supabase/migrations/` directory to your Supabase instance. This step automatically provisions:
1. The `sos_alerts` table and `alert_status` enums.
2. Row-Level Security (RLS) policies defining anonymous insert access vs. authenticated read/update bounds.
3. PostgreSQL RPC functions for profile syncing (`update_alert_profile`).
4. Realtime enablement for live websockets.

### 4. Run the Development Server
```bash
bun run dev
```
Navigate to `http://localhost:8080` to access the SOS Beacon.
Append `/admin` to access the Dispatch Dashboard.

## 🔐 Security & Privacy Notes
- The GPS Beacon uses HTML5 Geolocation and requires explicit hardware permission from the user upon activation. 
- The SOS `id` generation utilizes `crypto.randomUUID()` client-side insertions, effectively bypassing `INSERT ... RETURNING *` Postgres read-policy locks for anonymous users.
- RLS firmly isolates distress locations: only authenticated Admins have `SELECT` table privileges.
