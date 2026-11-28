const CONFIG_KEY = 'bkop-firebase-config-v1';
const STATE_KEY = 'bkop-interactive-demo-v1';
const FIREBASE_VERSION = '13.4.0';
const CLOUD_KEYS = ['notices', 'messages', 'tasks', 'files', 'events', 'aliases', 'inbox', 'members', 'socialDraft', 'socialMedia', 'checklist', 'committees'];

let sdk;
let app;
let auth;
let db;
let user = null;
let cloudRef = null;
let authUnsubscribe = null;
let cloudUnsubscribe = null;
let lastCloudSignature = '';
let configuredProject = '';

function emitStatus(state, message) {
  window.BKOPFirebase.status = {
    state,
    configured: !!auth,
    user: user ? { uid: user.uid, email: user.email || '' } : null,
    message
  };
  window.dispatchEvent(new CustomEvent('bkop-firebase-status', { detail: window.BKOPFirebase.status }));
}

function getCloudState(source) {
  const state = {};
  CLOUD_KEYS.forEach(key => { state[key] = source?.[key]; });
  return state;
}

function readLocalState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
  catch { return {}; }
}

function signature(value) { return JSON.stringify(value); }

function explain(error) {
  const code = String(error?.code || '');
  if (code.includes('unauthorized-domain')) {
    return 'Add fwrd-go.github.io to Firebase Authentication → Settings → Authorized domains, then try again.';
  }
  if (code.includes('permission-denied') || code.includes('insufficient-permission')) {
    return 'Sign-in worked, but Firestore denied access. Publish firestore.rules and approve this Firebase UID under workspaces/bkop/members with status = active.';
  }
  if (code.includes('failed-precondition') || code.includes('not-found')) {
    return 'Firestore is not ready for this project yet. Create the Firestore database, then publish firestore.rules.';
  }
  if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/user-not-found')) {
    return 'That Firebase account could not sign in. Check the email/password or use Google sign-in.';
  }
  return `Firebase error${code ? ` (${code})` : ''}: ${error?.message || 'try again'}`;
}

async function loadSdk() {
  if (sdk) return sdk;
  const root = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const [appSdk, authSdk, firestoreSdk] = await Promise.all([
    import(`${root}/firebase-app.js`),
    import(`${root}/firebase-auth.js`),
    import(`${root}/firebase-firestore.js`)
  ]);
  sdk = { ...appSdk, ...authSdk, ...firestoreSdk };
  return sdk;
}

async function connect(config) {
  if (!config?.apiKey || !config?.authDomain || !config?.projectId || !config?.appId) {
    throw new Error('Firebase config needs apiKey, authDomain, projectId, and appId.');
  }
  emitStatus('connecting', 'Loading Firebase and preparing the sign-in connection…');
  try {
    const f = await loadSdk();
    if (app && configuredProject !== config.projectId) {
      throw new Error('This page is connected to a different Firebase project. Reload the page before switching projects.');
    }
    if (!app) {
      const existing = f.getApps().find(item => item.name === 'bkop-workspace');
      app = existing || f.initializeApp(config, 'bkop-workspace');
      configuredProject = config.projectId;
      auth = f.getAuth(app);
      db = f.getFirestore(app);
      cloudRef = f.doc(db, 'workspaces', 'bkop', 'data', 'current');
      authUnsubscribe = f.onAuthStateChanged(auth, nextUser => {
        user = nextUser;
        lastCloudSignature = '';
        if (cloudUnsubscribe) { cloudUnsubscribe(); cloudUnsubscribe = null; }
        if (!user) {
          emitStatus('signed-out', 'Firebase is configured. Sign in to start live workspace sync.');
          return;
        }
        emitStatus('connecting', 'Signed in. Connecting to the BKOP Firestore workspace…');
        cloudUnsubscribe = f.onSnapshot(cloudRef, async snapshot => {
          if (!snapshot.exists()) {
            const state = getCloudState(readLocalState());
            const sig = signature(state);
            try {
              await f.setDoc(cloudRef, { state, schemaVersion: 1, updatedAt: f.serverTimestamp(), updatedBy: user.uid });
              lastCloudSignature = sig;
              emitStatus('connected', 'Connected to Firebase. This device’s current demo records seeded the shared workspace.');
            } catch (error) {
              emitStatus('error', explain(error));
            }
            return;
          }
          const remote = snapshot.data()?.state;
          if (!remote) {
            emitStatus('error', 'The Firestore workspace document exists but has no state field.');
            return;
          }
          const sig = signature(remote);
          emitStatus('connected', 'Connected to Firebase. Workspace records sync live while you are signed in.');
          if (sig !== lastCloudSignature) {
            lastCloudSignature = sig;
            window.dispatchEvent(new CustomEvent('bkop-cloud-state', { detail: { state: remote } }));
          }
        }, error => emitStatus('error', explain(error)));
      }, error => emitStatus('error', explain(error)));
      await f.getRedirectResult(auth).catch(error => emitStatus('error', explain(error)));
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    emitStatus(user ? 'connecting' : 'signed-out', user ? 'Firebase is ready; opening the shared workspace…' : 'Firebase is configured. Sign in to start live workspace sync.');
  } catch (error) {
    emitStatus('error', explain(error));
    throw error;
  }
}

async function save(state) {
  if (!auth || !db || !user || !cloudRef || !state) return;
  const cloudState = getCloudState(state);
  const sig = signature(cloudState);
  if (sig === lastCloudSignature) return;
  if (new Blob([sig]).size > 800 * 1024) {
    emitStatus('error', 'This workspace has outgrown the single-document demo sync limit. Keep files in Drive and split the data into collections before production.');
    return;
  }
  lastCloudSignature = sig;
  try {
    await sdk.setDoc(cloudRef, { state: cloudState, schemaVersion: 1, updatedAt: sdk.serverTimestamp(), updatedBy: user.uid });
    emitStatus('connected', 'Connected to Firebase. Workspace records sync live while you are signed in.');
  } catch (error) {
    lastCloudSignature = '';
    emitStatus('error', explain(error));
  }
}

async function signInEmail(email, password) {
  if (!auth) throw new Error('Save the Firebase web app config first.');
  await sdk.signInWithEmailAndPassword(auth, email, password);
}

async function signInGoogle() {
  if (!auth) throw new Error('Save the Firebase web app config first.');
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await sdk.signInWithRedirect(auth, provider);
}

async function signOut() {
  if (auth) await sdk.signOut(auth);
}

window.BKOPFirebase = { status: null, connect, save, signInEmail, signInGoogle, signOut };
emitStatus('local', 'Local demo only · add your Firebase web app config to connect.');

try {
  const savedConfig = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
  if (savedConfig) connect(savedConfig).catch(() => {});
} catch {
  emitStatus('error', 'The saved Firebase config is invalid. Re-enter the config in Admin Settings.');
}
