# Skull King Score Tracker - Implementation Plan

## Goal Description
Build a premium, mobile-friendly web application to track Skull King (and potentially other) card games. The app will feature a public dashboard for statistics, an admin-gated interface for inputting scores, and a robust system for managing custom card assets.

**Key Features:**
*   **Visuals**: High-end, "wow" factor design using Vanilla CSS (Dark mode, glassmorphism, vibrant accents, animations).
*   **Admin Access**: Simple shared-password mechanism to enter "Admin Mode" for score entry and card management.
*   **Scoring**: Automatic calculation of Skull King scores based on bids and tricks.
*   **Stats**: Historical data tracking (Wins, Top Scores, "Skull King" titles).
*   **Custom Cards**: Ability to upload custom card images or generate them via AI (placeholder/API integration) for personalized gameplay elements.
*   **Tech Stack**: Next.js (App Router), Supabase (Postgres + Storage), Vanilla CSS.
*   **Deployment**: Dockerized for self-hosting.

## User Review Required
> [!IMPORTANT]
> **Custom Cards Logic**: How do "Personalized Cards" affect gameplay?
> *   *Visual Only*: Replaces specific standard cards (e.g., "Uncle Bob" replaces the "Skull King" card image).
> *   *Functional*: Adds new card types with special rules?
> *   *Assumption for MVP*: I will implement a system where you can upload/generate an image and "map" it to an existing card type (e.g., "This custom card counts as a Mermaid") OR just treat it as a visual collectible. **Let's start with Visual Overrides/New Cards that act as standard types.**

> [!TIP]
> **AI Generation**: For the "AI Draw" feature, do you want to hook up an actual API key (OpenAI/Midjourney) within the app, or just have an interface where we (the devs) can generate assets during build time? I will assume you want an *Admin Interface* to upload items, and maybe a "Generate" button if we have an API key.

## Proposed Changes

### Architecture
- **Framework**: Next.js 15 (App Router).
- **Styling**: Vanilla CSS with a global `design-system.css`.
- **Database**: Supabase (Postgres) for data, Supabase Storage for card images.
- **Infrastructure**: Dockerfile for containerized deployment.

### Schema Design (Proposed)
- **`players`**: `id`, `name`, `avatar_url`
- **`games`**: `id`, `created_at`, `status`, `type`
- **`game_players`**: Link players to games.
- **`rounds`**: `game_id`, `round_number`.
- **`scores`**: `game_player_id`, `round_id`, `bid`, `tricks`, `bonus_points` (integer).
- **`cards`**: (New) `id`, `name`, `type` (Pirate, Escape, etc.), `image_url` (Supabase Storage path), `is_custom` (boolean), `owner_id` (optional, for specific players).

### Component Structure

#### [NEW] /app
- `layout.tsx`: Global layout, fonts, metadata.
- `page.tsx`: Landing page (Leaderboard + "Start Game").
- `login/page.tsx`: Admin password entry.
- `admin/cards/page.tsx`: **(New)** Interface to manage/upload/generate custom cards.
- `game/[id]/page.tsx`: The main game view.

#### [NEW] /components
- `ui/`: Standard premium components.
- `game/`: `ScoreTable`, `ScoreInput`.
- `admin/`: `CardUploader` (Drag & drop + Preview), `AssetGenerator` (Mock UI for AI generation options).

#### [NEW] /lib
- `scoring.ts`: Scoring logic.
- `supabase.ts`: Client initialization.
- `docker-entrypoint.sh`: Startup script.

#### [NEW] Project Root
- `Dockerfile`: Multi-stage build for Next.js standalone output.
- `docker-compose.yml`: (Optional) To orchestrate main app.

## Verification Plan

### Automated Tests
- Unit tests for `scoring.ts`.

### Manual Verification
1.  **Deployment**: Build Docker image -> Run container -> Access localhost:3000.
2.  **Custom Cards**: Admin -> Upload a picture -> Assign as "Skull King" -> Verify it shows up in game/dashboard.
3.  **Gameplay**: Run a full 10-round game simulation with scores.
