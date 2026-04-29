# Frontend Standard Operating Procedures

## Goal
Establish a deterministic and scalable React/Vite frontend for the InvoiceGen application.

## Layout & Navigation Layer
- **Shell:** `App.jsx` handles global state and routing.
- **Routing:** React Router DOM handles screen transitions.
- **Side Panel:** Persistent left-side navigation bar with Lucide React icons linking to specific routes (`/`, `/create`, `/reports`).

## State & Styling
- **Styling:** Vanilla CSS (`index.css`) utilizing modern aesthetics (dark modes, glassmorphism, dynamic animations, CSS variables for colors).
- **Responsiveness:** Flexbox and Media Queries to ensure layout adapts to mobile devices (e.g., side panel collapsing to bottom bar or hamburger menu).

## Edge Cases
- **Unauthenticated Access:** Users attempting to access protected routes (`/create`, `/reports`) without a valid session must be redirected to `/login`.
- **API Failure:** Show clear error toasts or messages on the UI when database reads/writes fail.
