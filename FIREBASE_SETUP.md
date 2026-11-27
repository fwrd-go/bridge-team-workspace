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
- Google sign-in is not enabled yet; Firebase requires a support email that users will see on the sign-in screen
- Firestore's production default-deny rules are active; deploy `firestore.rules` after Google sign-in setup

## Finish setup

1. Select the support email for Google sign-in in Firebase Authentication. Firebase currently offers `trippeerstephanie@gmail.com`; it will be shown to users on sign-in screens. Do not save it until approved.
2. In Authentication settings, add `fwrd-go.github.io` as an authorized domain.
3. Publish `firebase-config.js` using the Web app config from Firebase Console. Firebase client config is public; access control is enforced by the rules.
4. Deploy the included `firestore.rules` in Firebase Console or with `firebase deploy --only firestore:rules`.
5. The initial admin memberships are already seeded for `fwrd.go@gmail.com` in all three organizations. The Firebase project owner account and workspace admin account are separate.
6. Share each Drive folder with the Google accounts that should have access. Firebase invitations and Drive folder permissions are separate controls.

## Files and billing

Files use Google Drive, so this workspace does not use Firebase Storage. Firebase's Storage product requires the pay-as-you-go Blaze plan to provision a bucket; this setup avoids that. Do not switch the Firebase project to Blaze for this design.

The Drive folders are owned by `fwrd.go@gmail.com`:
- Bridge Kids International: https://drive.google.com/drive/folders/1XgoqXSXD4ZtKCtTaJESj0trnd8oxEjnV
- Our Place @ Ben Washer Park: https://drive.google.com/drive/folders/1CNHoAp9Up0iH-Nm1voSaW__MYOfHJyNC
- KIZAZI: https://drive.google.com/drive/folders/1140jGNxZ3zM4FqQCYdkgXIi5iTnq07xy

Folder links respect Google Drive permissions. A user who is signed into the dashboard still needs permission to the matching Drive folder to open its files.

This is a static GitHub Pages app. The page URL itself is public; Firebase sign-in and Firestore rules protect chat and membership data.
