# SyncStream UI

A modern, synchronized video player interface built with React, Vite, and Vidstack. Designed for seamless group watching experiences with low-latency sync.

## Features
- **Synchronized Playback**: Tightly coupled with the server for near-zero latency video sync across clients.
- **Glassmorphic UI**: Premium, modern design with translucent panels and dynamic backgrounds.
- **Voice Chat**: Built-in microphone controls with visual feedback for active speakers.
- **Admin Controls**: Manage playback, load URLs, and toggle permissions.
- **Responsive**: Fully optimized for desktop and mobile viewing with adaptive layouts.

## Tech Stack
- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Video Player**: Vidstack
- **Styling**: CSS Modules (Glassmorphism), Lucide React (Icons)
- **State/Network**: Custom WebSocket context for real-time sync

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   ```
   Access at `http://localhost:5173`

3. **Build for Production**
   ```bash
   npm run build
   ```

## Key Components
- `VideoPlayer.tsx`: Core player logic handling sync packets, Intro loop, and media events.
- `WebSocketContext`: Manages the persistent socket connection and messaging.
- `App.css` / `index.css`: Global styles and responsive design rules.
