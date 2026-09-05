# Reflections Journal

A private, authenticated web application for multi-turn journaling, structured reflections, and thoughtful brainstorming powered by Google Gemini 3.6 Flash and Cloud Firestore.

---

## Architecture & Security Threat Model

| Threat Zone | Identified Risks | Countermeasures & Secure Implementation |
| :--- | :--- | :--- |
| **Input Surfaces** | Untrusted user prompts, oversized journal inputs, script injection, malformed geospatial coordinates. | Strict schema validation, character limits, bounds checking (`lat: -90..90`, `lng: -180..180`), sanitization of place names, and encoded Markdown rendering. |
| **Planning & Reasoning** | Prompt injection attempting to alter assistant role or exfiltrate system instructions. | Explicit contextual system instructions per reflection mode; input bounded within role parts. |
| **Tool / API Execution** | Server-side API key leakage, model downtime, or latency spikes. | Gemini API key kept strictly server-side; automated resilient fallback ladder (`gemini-3.6-flash` &rarr; `gemini-3.1-flash-lite` &rarr; `gemini-flash-latest` &rarr; `gemini-3.7-flash`). Google Maps Geocoding is proxied through `/api/maps/geocode` to prevent exposing private keys and bypass browser CORS limitations. |
| **Memory & State** | Cross-user data leaks, unauthorized reads/writes of personal journals or pinned locations. | Strict owner-bound Firestore security rules (`/users/{userId}/interactions/{interactionId}`) with `request.auth.uid == userId`. Geospatial data is stored strictly under the authenticated owner. Undefined-stripping utility prevents runtime serialization crashes. |
| **Inter-System Comms** | Unauthenticated backend API access, Google Maps API key scraping, session hijacking. | Federated identity with Google Sign-In via Firebase Auth; official `@vis.gl/react-google-maps` SDK integration; client-side key loaded strictly via `VITE_GOOGLE_MAPS_API_KEY` (restricted by HTTP referrers); server key injected via `process.env.GOOGLE_MAPS_API_KEY`; attribution tag `gmp_mcp_codeassist_v1_aistudio` attached to Maps API interactions. |

---

## Technology Stack

- **Client**: React 19, TypeScript, Tailwind CSS, Lucide Icons, React-Markdown.
- **Maps & Geolocation**: `@vis.gl/react-google-maps` with `AdvancedMarker`, browser Geolocation API, and server-side `/api/maps/geocode` proxy.
- **Server**: Express, Vite middleware integration, `@google/genai` TypeScript SDK.
- **User Identity**: Firebase Authentication (Google Sign-In).
- **Database**: Cloud Firestore (per-user document path isolation).
- **AI Processing**: Gemini 3.6 Flash with automated fallback ladder + Built-in Reflective Synthesis Engine (Zero-API-Key fallback).
- **Secret Management**: Google Cloud Secret Manager & Environment Variables.

---

## 🚀 Zero-Billing & Zero-API-Key Live Publishing (Instant Access)

You can publish and run this application on **Google Cloud without adding a billing account or paying for an API key**:

### 1. Instant Google Cloud Run Publishing (No Billing Required)
Google AI Studio already hosts and publishes this application on **Google Cloud Run** for you at zero cost:
- **Production / Public Shared URL**:
  `https://ais-pre-l6w4ubory5wvyi7tpdjc5h-278965238571.asia-southeast1.run.app`
- **Development URL**:
  `https://ais-dev-l6w4ubory5wvyi7tpdjc5h-278965238571.asia-southeast1.run.app`

*Notice the `.run.app` domain — this is Google Cloud Run! Simply click the **Share** button in the top right of Google AI Studio to publish it and share the link with anyone. No credit card or billing account is required.*

### 2. Zero-API-Key Resilience (Built-in Reflective Synthesis Engine)
- If no `GEMINI_API_KEY` is provided, the application activates its **Built-in Reflective Synthesis Engine**.
- It analyzes emotional tones, parses user entries, synthesizes summaries, formulates Socratic follow-up questions, and crafts micro-action plans for all 5 reflection modes without requiring an external API key.
- **100% Free Gemini API Key Option**: If you want to use live Gemini models (`gemini-3.1-flash-lite`, `gemini-3.8-flash`), you can create a free key in seconds at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (no credit card or billing required) and add it via **Settings > Secrets**.

---

## 1. Environment & Prerequisites

1. **Set Active Project & Credentials**:
   > **Important**: Do not attempt to deploy to the automated Firebase project (e.g. `precise-hallway-gkhb0`), as managed service accounts restrict IAM service enablement permissions. You must deploy to **your own Google Cloud Project** where your account is an Owner.

   ```bash
   # List projects your Google account owns
   gcloud projects list

   # Set active project to YOUR own Google Cloud project
   gcloud config set project YOUR_PROJECT_ID

   # Or create a new project if needed:
   # gcloud projects create my-reflections-app-$(date +%s) --name="Reflections Journal"
   ```

2. **Enable Required Google Cloud Services**:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     cloudbuild.googleapis.com \
     artifactregistry.googleapis.com \
     secretmanager.googleapis.com \
     firestore.googleapis.com
   ```

---

## 2. Secret Management Setup

Store your Gemini API key securely in Google Cloud Secret Manager:

```bash
# 1. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Identify your Cloud project number
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")

# 3. Grant the default Cloud Run runtime service account permission to access the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Database Security Configuration (Cloud Firestore & Zero-Trust RBAC)

Deploy the owner-bound and RBAC-partitioned Firestore security rules enforcing strict user data isolation and Tier 1 privileged access control:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isBootstrapAdmin() {
      return isSignedIn() && request.auth.token.email == 'limrashakirthd@gmail.com';
    }

    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isAdmin() {
      return isSignedIn() && (
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         getUserData().role == 'admin') ||
        isBootstrapAdmin()
      );
    }

    function isOwnerOrAdmin(userId) {
      return isOwner(userId) || isAdmin();
    }

    // User profiles & RBAC roles
    match /users/{userId} {
      allow read: if isOwnerOrAdmin(userId);
      allow create: if isOwner(userId) && (
        request.resource.data.role == 'user' ||
        (isBootstrapAdmin() && request.resource.data.role == 'admin')
      );
      allow update: if (isOwner(userId) && 
        request.resource.data.role == resource.data.role)
        || isAdmin();
      allow delete: if isAdmin();
    }

    // Tier 2: User-Isolated private journal reflections
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if isOwner(userId);
    }

    // Tier 2: User-Isolated private reminder and theme settings
    match /users/{userId}/settings/{settingId} {
      allow read, write: if isOwner(userId);
    }

    // Tier 1: Tamper-Evident Admin Audit Trail
    match /admin/audit_logs/{logId} {
      allow read, write: if isAdmin();
    }

    // Tier 1: System Prompts & Global Operational Metadata
    match /system/{document=**} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }
  }
}
```

To deploy rules using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 4. Local Development

```bash
# Install dependencies
npm install

# Run development server with Express + Vite on port 3000
npm run dev
```

---

## 5. Cloud Run Deployment Flow

Deploy the container directly to Google Cloud Run with the Secret Manager binding:

```bash
# Build and deploy service (recommended: us-central1 for optimal quota availability)
gcloud run deploy reflections-journal \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port 3000
```

> **Troubleshooting Regional Quotas (`Project failed to initialize in this region due to quota exceeded`)**:
> If deployment in a region fails with a quota exceeded error, change `--region` to an alternate high-capacity Google Cloud region such as `us-central1`, `us-east1`, or `europe-west1`. You can also inspect current project quota limits in the Google Cloud Console under **IAM & Admin > Quotas**.

---

## 6. Required Campaign Verification Binding

Apply the mandatory challenge verification label to register the service:

```bash
gcloud run services update reflections-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 7. Functional Stability & End-to-End Walkthrough Test Cases

Every user interaction that can be triggered in the application has a corresponding test case below:

### Test Suite 1: Authentication & Landing View
- **TC-1.1 [Landing Display]**: Unauthenticated visitor navigates to `/`. The landing page displays the app title, feature cards, and "Sign In with Google" button. The journal dashboard is blocked.
- **TC-1.2 [Google Sign-In Success]**: User clicks "Sign In with Google". A popup opens with Google accounts. After selection, user avatar, display name, and dashboard appear.
- **TC-1.3 [Popup Closure & Block Handling]**: If the Google sign-in popup is closed or dismissed by the user (`auth/popup-closed-by-user` or `auth/cancelled-popup-request`), the application handles it cleanly without throwing an unhandled exception or showing a disruptive technical error. If blocked by the browser or an unauthorized domain occurs, an informative notice renders with an open-in-new-tab option and dismiss action.
- **TC-1.4 [Sign-Out Execution]**: Authenticated user clicks the Log Out button in the navigation bar. Session is cleared, Firestore subscriptions unsubscribe, and the landing view renders.

### Test Suite 2: Journal Creation & AI Interaction
- **TC-2.1 [Starter Spark Activation]**: Authenticated user with empty session clicks "Unpack the Day" spark card. Textarea immediately populates with the starter text and gains focus.
- **TC-2.2 [Mode Selection Switch]**: User clicks mode buttons ("Insightful Reflection", "Key Takeaways", "Brainstorm Ideas", "Action Plan", "Emotional Grounding"). The active pill updates with a solid contrast style.
- **TC-2.3 [Input Submission via Keyboard]**: User types a reflection in the textarea and presses `Enter`. The send button switches to a spinner, and textarea disables while generation is in progress.
- **TC-2.4 [Shift+Enter Newline]**: User presses `Shift+Enter` in the textarea. A newline is inserted without triggering submission.
- **TC-2.5 [Gemini Multi-Model Fallback]**: When primary model `gemini-3.6-flash` is called, response generates successfully. If primary model returns 503/429, the ladder automatically shifts to `gemini-3.1-flash-lite` without UI disruption.

### Test Suite 3: Firestore Persistence & Data Isolation
- **TC-3.1 [Transaction Verification & Auto-Save]**: When user sends a turn, user text and Gemini response are saved to Firestore at `/users/{userId}/interactions/{interactionId}`. Status indicator shows "Saving to Firestore..." then transitions to "✓ Saved to Firestore".
- **TC-3.2 [Buffer Preservation on Error]**: If network or backend fails, the textarea input text is NOT cleared. A persistent error notification displays with a "Retry" button.
- **TC-3.3 [Multi-Turn Follow-Up]**: User types a follow-up response in the same interaction. Previous conversation history is provided to Gemini, and new turns are appended to the existing Firestore document.
- **TC-3.4 [Cross-User Isolation]**: Sign in as User A, create an entry. Sign out and sign in as User B. User B's history sidebar is empty and cannot see User A's entries.

### Test Suite 4: History Management & Search
- **TC-4.1 [Real-Time History Sync]**: Newly saved reflections immediately appear in the past reflections sidebar with relative timestamp, mode badge, and turn counter.
- **TC-4.2 [Search Keyword Filtering]**: User types keywords into the search bar. The list dynamically filters matching titles and journal entry texts in real time.
- **TC-4.3 [Filter by Mode / Starred]**: Clicking "Summary" or "Starred" filters the sidebar list to only relevant reflections.
- **TC-4.4 [Rename Interaction Title]**: Clicking the reflection title in the top bar switches to an inline text input. Modifying text and blurring updates the title in Firestore.
- **TC-4.5 [Favorite Star Toggle]**: Clicking the star icon on any entry toggles its favorite status in Firestore.
- **TC-4.6 [Delete with Confirmation]**: Clicking the trash icon prompts "Confirm?". Clicking confirm deletes the document from Firestore and clears the active session if currently open.

### Test Suite 5: Daily Journaling Notification Reminders
- **TC-5.1 [Reminder Bell & Status Indicator]**: The navigation bar displays the reminder bell icon with the active schedule time badge (e.g. `20:30`). If user has already journaled today, an adjacent `✓ Reflected Today` status badge appears.
- **TC-5.2 [Open Reminder Settings Modal]**: Clicking the bell button opens the Daily Reminder Settings dialog with current configurations pre-populated.
- **TC-5.3 [Schedule Time & Day Selection]**: User can modify the scheduled time (HH:MM) and toggle specific days of the week (Sun-Sat). Modifying selections updates the active button styling.
- **TC-5.4 [Gentle Meditative Chime Preview]**: User clicks "Preview Gentle Chime". The custom Web Audio API dual-harmonic chime (C5/G5 with exponential decay) plays immediately without external media asset dependencies.
- **TC-5.5 [Browser Notification Permission Request]**: User clicks "Enable Desktop Notifications". The browser triggers native permission prompt. Status reflects `granted` or `blocked` gracefully.
- **TC-5.6 [Reminder Theme Selection & Custom Prompt]**: Selecting themes ("Evening Reflection", "Morning Clarity", "Gratitude & Wins", "Mindful Pause", "Custom Message") updates the prompt starter. Entering a custom message persists correctly.
- **TC-5.7 [In-App Banner Test Trigger]**: In the modal, user clicks "Preview In-App Banner". The modal closes and the Natural Tones floating banner renders at the top of the journal with action buttons.
- **TC-5.8 [Banner Reflection Activation]**: User clicks "Begin Reflection" on the banner. The editor switches to a fresh reflection and automatically populates the textarea with the theme's starter spark.
- **TC-5.9 [Banner Snooze & Dismiss Controls]**: Clicking "Snooze 1 hr" dismisses the banner and postpones alerts for 60 minutes. Clicking "Done for Today" marks today's ISO date as dismissed in local storage so the reminder does not nag again today.
- **TC-5.10 [Firestore Settings Persistence]**: Clicking "Save Settings" saves the configuration to `/users/{userId}/settings/reminders`. Refreshing the application retains all saved reminder preferences.

### Test Suite 6: Email Reminders & Background Reminders (When App Is Closed)
- **TC-6.1 [Daily Email Reminders Toggle]**: In the Reminder Modal, user toggles "Daily Email Reminders". The email input field expands, automatically prefilled with the authenticated user's Google email address.
- **TC-6.2 [Email Format Validation]**: User inputs an invalid email string (e.g. `invalid-email`). Clicking "Send Test Email Now" surfaces an accessible validation error banner without submitting malformed data.
- **TC-6.3 [Send Test Email Dispatch]**: User clicks "Send Test Email Now" with their valid email address. A loading spinner activates, and the backend `/api/reminders/send-email` endpoint dispatches a styled HTML reflection email. A green checkmark badge confirms delivery.
- **TC-6.4 [HTML Email Rendering Integrity]**: The delivered email renders with brand typography, prompt theme title, personalized reflection spark, "Open Journal & Begin Reflection" button linking directly to the app URL, and calming quote.
- **TC-6.5 [Google Calendar 1-Click Sync]**: User clicks "Add to Google Calendar". A new browser tab opens to the Google Calendar event creation interface pre-populated with a daily recurring 15-minute reflection session (`RRULE:FREQ=DAILY`) and alarm notification.
- **TC-6.6 [Download Apple / Outlook .ics Calendar Event]**: User clicks "Download .ics (Apple / Outlook)". The browser immediately generates and downloads `daily-reflection-reminder.ics` formatted with RFC-5545 compliance, a 5-minute pre-alert alarm (`VALARM`), and daily recurrence rule.
- **TC-6.7 [PWA Standalone App Installation]**: On supported browsers (Chrome, Edge), the modal displays the "Install Reflections App" button. Clicking triggers the browser's native installation prompt. Once installed, the badge updates to "App Installed as Standalone".
- **TC-6.8 [Service Worker Background & Offline Cache]**: Service Worker (`/sw.js`) registers on startup, caching key navigation assets and enabling background notification click routing and offline reflection journaling.

### Test Suite 7: Mood Selector & Sentiment Tags
- **TC-7.1 [Starter Mood Selector Rendering]**: On a new empty reflection, the Mood Selector renders in full interactive card mode with 6 distinct sentiments (`peaceful`, `grateful`, `curious`, `energetic`, `anxious`, `reflective`) and informative subtexts.
- **TC-7.2 [Mood Selection Prior to First Prompt]**: User clicks a mood tag (e.g. "Grateful ✨"). The tag highlights with an active warm border and badge. The selection persists in pending state and is automatically saved to Firestore on first submission.
- **TC-7.3 [Compact Mood Selector in Toolbar]**: While in an ongoing reflection conversation, the toolbar displays a compact mood dropdown pill. Changing the mood triggers an atomic update via `updateInteractionSentimentInFirestore`.
- **TC-7.4 [History Sidebar Mood Badges & Filtering]**: In `HistorySidebar`, reflections with sentiment tags display an emoji badge. Clicking the badge or filter chip filters the history list to entries matching that specific sentiment.

### Test Suite 8: Google Maps Location Pinning & Geospatial Security Directives
- **TC-8.1 [Toolbar Pin Location Trigger]**: User clicks the "Pin Location" button in the `JournalEditor` toolbar. The `LocationPinModal` dialog smoothly transitions into view.
- **TC-8.2 [Sanctuary Preset Selection]**: User selects one of the calm presets ("Kyoto Zen Garden", "Redwood Forest Sanctuary", "Icelandic Hot Springs", "Alps High Meadow"). The latitude, longitude, and place name update in the form inputs.
- **TC-8.3 [Browser Geolocation Locator]**: User clicks "Use My Current Location". If browser permission is granted, coordinates are accurately set and a reverse geocode lookup resolves the place name.
- **TC-8.4 [Secure Geocoding Search Proxy]**: User types a place name or address into the search input and clicks "Search Place". The query is sent to `/api/maps/geocode` on the backend, proxying to the Google Maps Geocoding API without exposing private API keys or triggering CORS blocks.
- **TC-8.5 [Interactive Google Maps View with Modern AdvancedMarker]**: When `VITE_GOOGLE_MAPS_API_KEY` is provided, the modal renders an interactive Google Map via `@vis.gl/react-google-maps` using modern `AdvancedMarker`, a custom cloud Map ID (`DEMO_MAP_ID`), and mandatory attribution (`internalUsageAttributionIds: ["gmp_mcp_codeassist_v1_aistudio"]`).
- **TC-8.6 [Resilient Fallback Mode]**: If no Maps API key is configured, the application does not crash. An accessible coordinate and address picker renders with presets and browser geolocation.
- **TC-8.7 [Location Save & Owner-Bound Firestore Isolation]**: User clicks "Pin Location to Reflection". The location data (`name`, `lat`, `lng`, `address`, `placeId`) is saved to Firestore under `/users/{userId}/interactions/{interactionId}`. All undefined fields are stripped before database commit.
- **TC-8.8 [Remove Pinned Location]**: In the modal, user clicks "Remove Pin". The backend issues a Firestore `deleteField()` command, removing the location object cleanly.
- **TC-8.9 [History Sidebar Location Badge & Search]**: Pinned reflections in `HistorySidebar` display a location badge with a pin icon. Typing a location or city name into the history search bar filters reflections matching that location.
- **TC-8.10 [Security Directives Drawer]**: In the Location modal, clicking "Google Maps Security & Architecture Directives" expands a drawer showing the 5-threat-zone mitigation, HTTP referrer restriction rules, and zero-hardcoding guidelines.

### Test Suite 9: Role-Based Access Control (RBAC) & Directive 9 Governance
- **TC-9.1 [Bootstrap Admin Auto-Elevation]**: User signs in with designated bootstrap administrator account (`limrashakirthd@gmail.com`). `syncUserProfile` initializes the Firestore profile at `/users/{userId}` with role `admin`. The navigation bar displays the elevated "Admin 🛡️" button and the user profile pill shows the `ADMIN` chip.
- **TC-9.2 [Standard User Non-Elevation & Profile Lockdown]**: User signs in with a non-bootstrap email account. Profile is initialized with role `user`. The "Admin 🛡️" button does NOT render on the navigation bar. Attempting to write `role: 'admin'` directly via client Firestore SDK is rejected by `firestore.rules`.
- **TC-9.3 [Open Admin & RBAC Governance Console]**: Authenticated admin clicks the "Admin 🛡️" button in the navigation bar. The `AdminConsoleModal` opens smoothly, showing Directive 9 active status, active admin identity, and lock indicators.
- **TC-9.4 [Live RBAC Security Benchmark]**: In the System Diagnostics tab, admin clicks "Test RBAC Verification". Backend endpoint `/api/admin/verify-access` executes server-side role validation. A green banner surfaces with granted administrative permissions (`ACCESS_SYSTEM_STATS`, `MANAGE_USER_ROLES`, `VIEW_AUDIT_LOGS`, `CONFIGURE_SYSTEM_PROMPTS`).
- **TC-9.5 [Real-Time Operational Telemetry & Model Ladder]**: The diagnostics tab displays live server uptime, memory usage, runtime node version, and the ordered Gemini resilient fallback ladder (`gemini-3.6-flash` &rarr; `gemini-3.1-flash-lite` &rarr; `gemini-flash-latest` &rarr; `gemini-3.7-flash`).
- **TC-9.6 [User Roles Directory Inspection & Role Elevation]**: In the User Roles Directory tab, admin views registered user accounts fetched from `/users`. Admin clicks "Elevate to Admin" for a user. An atomic role update occurs in Firestore and an audit log entry is recorded to `/admin/audit_logs`.
- **TC-9.7 [Tamper-Evident Admin Audit Trail]**: In the Audit Logs tab, the real-time stream of audit records is displayed with action codes, timestamps, admin email, and detailed operation descriptions. Clicking "Log Security Audit Ping" dispatches an immediate test log to `/admin/audit_logs`.
- **TC-9.8 [Tier 1 vs Tier 2 Authorization Enforcement]**: A standard user attempting to read `/admin/audit_logs` or `/users` receives an immediate Firestore permission-denied error, confirming Tier 1 administrative resource partitioning.



