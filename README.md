# SyncStream UI

A modern, synchronized video player interface built with React, Vite, and Vidstack. Designed for seamless group watching experiences with low-latency sync.

## Features & Advantages

### Core Experience
- **Synchronized Playback**: Tightly coupled with the server for near-zero latency video sync across clients.
- **Glassmorphic UI**: Premium, modern design with translucent panels and dynamic backgrounds.
- **Voice Chat**: Built-in microphone controls with visual feedback for active speakers.
- **Admin Controls**: Manage playback, load URLs, and toggle permissions.
- **Responsive**: Fully optimized for desktop and mobile viewing with adaptive layouts.

### New Enhancements
- **Client-Side Routing**: Powered by `react-router-dom` for seamless navigation between the Login, Session, and Info pages.
- **Secure Authentication Flow**: 
    - Dedicated **Login Page** (`/`) for identity verification.
    - Protected **Session Page** (`/session`) that automatically redirects unauthenticated users.
    - **Reload Protection**: Warns users before reloading the page to prevent accidental session loss.
- **Enhanced Chat Experience**:
    - **Message Grouping**: Consecutive messages from the same sender are visually grouped for a cleaner chat history.
    - **Advanced Image Lightbox**: 
        - **Full Screen Portal**: Images open in a high-z-index overlay covering the entire app.
        - **Zoom & Pan**: Use the toolbar to zoom in, then drag/pan to inspect details.
        - **Download**: Save shared images directly with a single click.

## Tech Stack
- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Routing**: React Router Dom
- **Video Player**: Vidstack
- **Styling**: CSS Modules (Glassmorphism), Lucide React (Icons)
- **State/Network**: Custom WebSocket context for real-time sync

## Setup & Usage

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configuration**
   - Create a `.env` file in the root directory.
   - Add your Google Client ID:
     ```env
     VITE_GOOGLE_CLIENT_ID=your-google-client-id
     ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```
   Access at `http://localhost:5173`

4. **Using the App**
   - **Login**: Navigate to `/`, click "Identify Yourself", and sign in with Google.
   - **Session**: You will be redirected to the player.
   - **Chat**: Type messages or paste images directly into the input field.
     - **Click** an image to open the Lightbox.
     - **Zoom/Pan** using the toolbar or mouse drag.
   - **Admin**: If you are an admin, use the top bar to load videos (`.m3u8`, `.mp4`) or control playback.

5. **Build for Production**
   ```bash
   npm run build
   ```

## Key Components
- `pages/Login.tsx`: Entry point for authentication.
- `pages/Session.tsx`: Main application view (formerly `Home`).
- `components/Chat.tsx`: Real-time chat with grouping and lightbox features.
- `components/VideoPlayer.tsx`: Core player logic handling sync packets, Intro loop, and media events.
- `WebSocketContext`: Manages the persistent socket connection and messaging.
