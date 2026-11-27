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
- Google sign-in provider still needs its required public-facing support email selected and saved
- Firestore's production default-deny rules are active; deploy `firestore.rules` after Google sign-in setup

## Finish setup

1. Select the support email for Google sign-in in Firebase Authentication. It is shown to users on sign-in screens.
2. In Authentication settings, add `fwrd-go.github.io` as an authorized domain.
3. Publish `firebase-config.js` using the Web app config from Firebase Console. Firebase client config is public; access control is enforced by the rules.
4. Deploy the included `firestore.rules` in Firebase Console or with `firebase deploy --only firestore:rules`.
5. Add the owner's Google email as an initial admin membership document for each organization in Firestore:
   - `orgs/bridge-kids/members/OWNER_EMAIL`
   - `orgs/our-place/members/OWNER_EMAIL`
   - `orgs/kizazi/members/OWNER_EMAIL`
   Use fields `email` (lowercase) and `role: "admin"`. This first admin must be seeded in the console because no admin exists yet.
6. Share each Drive folder with the Google accounts that should have access. Firebase invitations and Drive folder permissions are separate controls.

## Files and billing

Files use Google Drive, so this workspace does not use Firebase Storage. Firebase's Storage product requires the pay-as-you-go Blaze plan to provision a bucket; this setup avoids that. Do not switch the Firebase project to Blaze for this design.

The Drive folders are owned by `fwrd.go@gmail.com`:
- Bridge Kids International: https://drive.google.com/drive/folders/1XgoqXSXD4ZtKCtTaJESj0trnd8oxEjnV
- Our Place @ Ben Washer Park: https://drive.google.com/drive/folders/1CNHoAp9Up0iH-Nm1voSaW__MYOfHJyNC
- KIZAZI: https://drive.google.com/drive/folders/1140jGNxZ3zM4FqQCYdkgXIi5iTnq07xy

Folder links respect Google Drive permissions. A user who is signed into the dashboard still needs permission to the matching Drive folder to open its files.

This is a static GitHub Pages app. The page URL itself is public; Firebase sign-in and Firestore rules protect chat and membership data.
