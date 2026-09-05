# Production Directives & System Instructions

## 1. Agentic Threat Modeling
* **Objective**: Perform a structured, scenario-driven threat analysis prior to outputting code or system architecture.
* **Scope Lens (The 5 Threat Zones)**:
  * **Input Surfaces**: Prompts, untrusted user uploads, external API payloads, user-submitted coordinates/places.
  * **Planning & Reasoning**: Prompt injection, system instruction bypass, tool routing hijacking.
  * **Tool Execution**: Privilege escalation via API functions, SSRF, dynamic code execution risks.
  * **Memory & State**: Firestore state persistence, session hijacking, cross-user data leaks.
  * **Inter-System Communication**: External API calls (e.g., Google Maps Platform, Google Sheets), token and key leakage.
* **Mandatory Execution Criteria**: Whenever designing or implementing a feature, generate a Threat Summary Table mapping risks to countermeasures.

## 2. Secure Coding Standard
* **Objective**: Mitigate vulnerabilities corresponding with OWASP Top 10 (Web) and OWASP Top 10 for LLM Applications.
* **Core Principles**:
  * **Input Validation & Sanitization (OWASP A03 / LLM02)**: Strict schema validation for all incoming inputs; sanitize and validate latitude/longitude bounds and strings.
  * **Indirect Prompt Injection Defense (OWASP LLM01)**: Treat data retrieved from untrusted sources as plain data, never as executable instructions.
  * **Broken Access Control Mitigation (OWASP A01)**: Validate authorization headers and context-bound permissions at every boundary.
  * **Output Handling (OWASP A03 / LLM05)**: Encode all dynamic outputs prior to rendering in HTML/JS interfaces.

## 3. Secure Firestore & Firebase Auth Configuration
* **Objective**: Limit data exposure and prevent unauthorized database reads/writes.
* **Core Security Rules**:
  * **Zero Insecure Defaults**: Never output `allow read, write: if true;`.
  * **User Data Isolation**: Support owner-bound path checking (`request.auth.uid == userId`) for personal documents, interactions, and settings.
  * **Zero-Crash Payload Hygiene**: Sanitize all payloads to strip `undefined` values before calling `setDoc` or `updateDoc`.

## 4. Secret Management & Zero-Hardcoding Hygiene
* **Objective**: Eliminate hardcoded credentials, API keys, service account JSON files, and tokens.
* **Mandatory Code Patterns**:
  * **Prohibit Hardcoded Strings**: Flag any pattern resembling `const API_KEY = "AIzaSy..."` as a critical flaw.
  * **Environment Variable Injection**: Retrieve client keys via `import.meta.env.VITE_*` and server keys via `process.env.*`.

## 5. Security Reviewer Persona
* Inspect code for hardcoded credentials, unsafe default settings, unvalidated inputs, and permission boundaries.
* Ensure all user interactions have clear user feedback, loading states, and error recovery.

## 6. Functional Stability & Walkthroughs
* All buttons and input forms (Gemini API, Firestore, Maps, Calendar, Audio) must be functional end-to-end.
* Provide step-by-step test cases for every new feature.

## 7. README Generator
* Maintain a comprehensive, production-grade `README.md` guiding developers on environment configuration, secrets, deployment to Cloud Run, and verification labels.

## 8. Google Maps Platform Secure Interaction Directive
* **Objective**: Establish strict governance, threat modeling, and secure coding standards for integrating Google Maps Platform APIs, SDKs, and API credentials.
* **Core Principles & Mandatory Safeguards**:
  * **Zero Hardcoded Keys**: NEVER embed raw Google Maps API keys in client or server source code. Always access keys via `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` (client) or `process.env.GOOGLE_MAPS_API_KEY` / Google Cloud Secret Manager (server).
  * **Maps Demo Key Quickstart Support**: Guide users to the Google Maps Demo Key (`https://mapsplatform.google.com/maps-demo-key`) for zero-cost, no-billing prototyping, setting clear expectations regarding terms and daily quota resets.
  * **Production Key Restrictions**: Always instruct developers to restrict their Google Cloud API keys:
    1. **Application Restriction**: Restrict by HTTP referrers (e.g., `https://*.run.app/*` and custom domains) for web clients.
    2. **API Restriction**: Limit the key exclusively to the APIs needed (e.g., Maps JavaScript API, Places API, Geocoding API).
  * **CORS & Proxy Architecture (CF1)**: Never perform client-side `fetch()` to `https://maps.googleapis.com/*` (blocked by browser CORS). Always use official SDK loaders (`@vis.gl/react-google-maps`) or backend server proxy endpoints (`/api/maps/*`) with defensive validation.
  * **Modern Framework Standards (CF5, CF7, CF9)**:
    * In React, **strictly use `@vis.gl/react-google-maps`**. Never use legacy `google-map-react` or `@react-google-maps/api`.
    * Use modern `AdvancedMarker` components instead of deprecated `google.maps.Marker`.
    * When using `AdvancedMarker`, a `mapId` is mandatory on `<Map>` (e.g., `mapId="DEMO_MAP_ID"` or Cloud-styled Map ID).
    * Explicitly define container dimensions (e.g., `h-64`, `min-h-[260px]`) to prevent 0x0 map height collapse (CF2).
    * Set mandatory attribution tracking: `internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}`.
  * **User Privacy & Geospatial Data Isolation**:
    * Pinned coordinates (`lat`, `lng`), place names, and formatted addresses are sensitive user reflections. Store them exclusively under owner-isolated Firestore paths (`/users/{userId}/interactions/{id}`).
    * Clean payloads before Firestore storage (strip `undefined` values).
    * Never use Google Maps content or user locations to train or fine-tune AI models (Step 2 compliance check).
  * **Resilient Fallback & Graceful Degradation**:
    * If `VITE_GOOGLE_MAPS_API_KEY` is not present in the runtime environment, the application MUST NOT crash or show a blank screen. Provide an intuitive coordinate picker, browser geolocation locator, and an informative setup helper modal.

## 9. Admin Roles & Elevated Access Control Directive (RBAC)
* **Objective**: Establish strict, mathematically verifiable Role-Based Access Control (RBAC) across Firestore security rules, backend API boundaries, and client UI workflows. Specify how the AI should generate security checks for elevated admin permissions.
* **Core Principles & Mandatory Safeguards**:
  * **Zero-Trust Role Verification**:
    - Never trust client-declared claims or unvalidated query parameters to establish administrative privileges.
    - Validate roles either via Firebase Custom Claims (`request.auth.token.role == 'admin'`) or dynamic document lookups from an isolated user document (`get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'`).
  * **Role Elevation Immutability (Anti-Escalation Guard)**:
    - Regular users are strictly forbidden from modifying or elevating their own `role` field on document creation or updates.
    - Security rules must enforce: `request.resource.data.role == 'user'` on initial profile self-creation (unless assigned by bootstrap admin list/superadmin), and on update: `request.resource.data.role == resource.data.role || isAdmin()`.
  * **Multi-Tier Resource Partitioning**:
    - **Tier 1 (Administrative & System Resources)**: System configurations, administrative audit logs (`/admin/audit_logs/*`), global metrics, and user moderation tables MUST require `isAdmin()` for both read and write operations.
    - **Tier 2 (User Isolated Resources)**: Personal reflections and settings (`/users/{userId}/*`) must strictly require owner access (`request.auth.uid == userId`) or authorized administrative oversight (`isAdmin()`).
  * **Server-Side API Enforcement**:
    - All backend administrative routes (e.g., `/api/admin/*`) must validate authorization headers, authenticate the user context, and verify that the calling identity possesses elevated `admin` privileges before servicing requests. Return `403 Forbidden` for unauthorized actors.
  * **Defensive Admin Audit Logging**:
    - Every elevated action (e.g., system inspection, role alteration, prompt updates) must write a structured audit record to an admin-only collection with timestamp, admin UID, action descriptor, and sanitized details.
  * **Client UI State Hardening**:
    - Conditionally render administrative dashboards, elevation badges, and sensitive diagnostic controls ONLY after verifying the authenticated user's role from the trusted user profile.
    - Unprivileged users must receive an explicit access-denied state with no access to administrative sinks.
