# Firebase workspace preview setup

This is a separate authenticated preview. The existing public dashboard at `index.html` remains unchanged.

## What this build does

- Google sign-in for invited members
- Organization-specific membership for Bridge Kids, Our Place, and KIZAZI
- In-dashboard organization chat backed by Cloud Firestore
- Organization file uploads and downloads backed by Cloud Storage
- Admin role can add a member by Google email
- Gmail opens the existing Google Workspace inbox link

## One-time Firebase setup

1. Create a Firebase project and register a Web app.
2. In Authentication, enable Google as a sign-in provider. Add the GitHub Pages domain under authorized domains.
3. Create a Cloud Firestore database and a Cloud Storage bucket.
4. Copy `firebase-config.example.js` to `firebase-config.js`, then paste the Firebase Web app config into it.
5. Deploy `firestore.rules` and `storage.rules` to the Firebase project. The included `firebase.json` supports `firebase deploy --only firestore:rules,storage`.
6. In Firestore, seed the first administrator membership document manually:
   `orgs/bridge-kids/members/OWNER_GOOGLE_EMAIL`
   with fields `email` (lowercase) and `role: "admin"`. Repeat for each organization the owner administers. This first seed must be done in Firebase Console because no admin exists yet.
7. Open `secure.html`, sign in as that Google account, and use Invite someone to add the other members.

## Before sharing

Cloud Storage for Firebase currently requires a billing-linked Blaze project. Set usage alerts in Google Cloud Billing before inviting people. The rules limit each upload to 25 MB and require organization membership, but alerts are not a hard spending stop.

Do not commit a real service account key. Firebase Web app config is client-side by design; data protection comes from the deployed Auth checks and security rules. Keep the rules default-deny.

This is a static GitHub Pages app. Chat and file data are protected by Firebase rules. The page URL itself is public, so the Firebase sign-in gate—not GitHub Pages—protects the workspace data.
