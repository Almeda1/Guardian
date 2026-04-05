# 🛡️ Guardian - Personal Emergency SMS Beacon

Guardian is a client-side web application designed for personal safety, discreet alerts, and rapid emergency response. It allows users to instantly generate an SOS SMS alert prepopulated with their exact GPS coordinates and medical profile, routing the distress signal directly to an emergency contact via their device's native messaging app without the need for a central dispatcher.

## ✨ Key Features

### SOS Beacon
- **One-Tap Emergency Alert:** Instantly captures high-accuracy GPS coordinates via the Geolocation API.
- **Native SMS Integration:** Automatically constructs an OS-level SMS deep link (`sms:`) containing the user's live location formatted as a Google Maps URL along with their profile details.
- **Identity Storage:** Securely stores the user's emergency profile (Name, Age, Medical/Incident Details, Emergency Contact) locally in the browser to attach it to the distress signal.
- **Privacy First:** A strictly client-side application. No central database, no dispatcher monitoring dashboard, no external APIs other than Google Maps formatting, and no persistent track recording.

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS, shadcn/ui components, Lucide Icons
- **Package Manager:** Bun / npm

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+) or Bun

### 1. Clone & Install
```bash
git clone <repo-url>
cd beacon-bridge-aid
bun install
```

### 2. Run the Development Server
```bash
bun run dev
```
Navigate to `http://localhost:8080` to access the SOS Beacon.

## 🔐 Security & Privacy Notes
- The GPS Beacon utilizes the HTML5 Geolocation API and requires explicit hardware permission from the user upon activation.
- Emergency profiles and contact listings are securely isolated in the browser's `localStorage`. No data whatsoever is transmitted to any third-party backend servers or cloud databases.
