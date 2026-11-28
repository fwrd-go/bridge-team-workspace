# Firebase workspace

The Firebase project is `bridge-team-workspace`. This is the secure workspace page at `secure.html`; the existing public dashboard at `index.html` remains unchanged.

## Planned behavior

- Google sign-in for invited members
- Organization-specific membership for Bridge Kids, Our Place, and KIZAZI
- In-dashboard organization chat backed by Cloud Firestore
- Files buttons open each organization's Google Drive folder
- Gmail opens the Google Workspace inbox link

## Current Firebase setup

- Project and Web app created
- Cloud Firestore Standard database created in production mode at `nam5`
- Project remains on the no-cost Spark plan
- Email/Password and Google sign-in are enabled; the Google support email is `fwrd.go@gmail.com`
- Firestore is in production mode and the member-only rules are published

## Finish setup

1. Confirm `fwrd-go.github.io` is listed in Authentication → Settings → Authorized domains.
2. In the BKOP dashboard, open Admin Settings and paste the web app config from Firebase Project settings → Your apps. It is public client config, not a password or service-account key. It is stored in that browser and the secure chat page reuses it.
3. Publish the current `firestore.rules` from this repository in Firestore → Rules. The older deployed rules allow organization membership and board chat; the added workspace and shared-committee paths enable the dashboard data.
4. The initial admin memberships are seeded for `fwrd.go@gmail.com` in all three organizations. The Firebase project owner account and workspace admin account are separate.
5. Sign in with the invited account. Organization access is checked against its email membership document.
6. Share each Drive folder with the Google accounts that need file access. Firebase membership and Drive folder permissions are separate controls.

## Files and billing

Files use Google Drive, so this workspace does not use Firebase Storage. Firebase's Storage product requires the pay-as-you-go Blaze plan to provision a bucket; this setup avoids that. Do not switch the Firebase project to Blaze for this design.

The Drive folders are owned by `fwrd.go@gmail.com`:
- Bridge Kids International: https://drive.google.com/drive/folders/1XgoqXSXD4ZtKCtTaJESj0trnd8oxEjnV
- Our Place @ Ben Washer Park: https://drive.google.com/drive/folders/1CNHoAp9Up0iH-Nm1voSaW__MYOfHJyNC
- KIZAZI: https://drive.google.com/drive/folders/1140jGNxZ3zM4FqQCYdkgXIi5iTnq07xy

Folder links respect Google Drive permissions. A user who is signed into the dashboard still needs permission to the matching Drive folder to open its files.

This is a static GitHub Pages app. The page URL itself is public; Firebase sign-in and Firestore rules protect chat and membership data.
