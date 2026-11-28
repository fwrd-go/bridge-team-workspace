const CONFIG_KEY = 'bkop-firebase-config-v1';
const STATE_KEY = 'bkop-interactive-demo-v1';
const FIREBASE_VERSION = '13.4.0';
const ORGS = [
  { key: 'bki', id: 'bridge-kids' },
  { key: 'ourplace', id: 'our-place' },
  { key: 'kizazi', id: 'kizazi' }
];
const COMMITTEES = ['Committee 1', 'Committee 2', 'Committee 3', 'Committee 4', 'Committee 5', 'Committee 6'];

let sdk;
let app;
let auth;
let db;
let user = null;
let memberships = [];
let authUnsubscribe = null;
let listeners = [];
let lastSignatures = new Map();
let configuredProject = '';

function emitStatus(state, message) {
  window.BKOPFirebase.status = {
    state: state,
    configured: !!auth,
    user: user ? { uid: user.uid, email: user.email || '', orgKeys: memberships.map(item => item.key) } : null,
    message: message
  };
  window.dispatchEvent(new CustomEvent('bkop-firebase-status', { detail: window.BKOPFirebase.status }));
}

function emitMemberships() {
  window.dispatchEvent(new CustomEvent('bkop-firebase-memberships', {
    detail: { orgKeys: user ? memberships.map(item => item.key) : null }
  }));
}

function signature(value) { return JSON.stringify(value); }

function readLocalState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
  catch { return {}; }
}

function orgState(source, orgKey) {
  return {
    notices: (source.notices || []).filter(item => item.org === orgKey),
    tasks: (source.tasks || []).filter(item => item.org === orgKey),
    events: (source.events || []).filter(item => item.org === orgKey),
    files: (source.files || []).filter(item => item.org === orgKey)
  };
}

function committeeState(source, room) {
  return {
    messages: (source.messages || []).filter(item => item.org === 'shared' && item.room === room),
    tasks: (source.tasks || []).filter(item => item.org === 'shared' && item.room === room)
  };
}

function dateValue(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value || new Date().toISOString();
}

function explain(error) {
  const code = String(error && error.code || '');
  if (code.includes('unauthorized-domain')) {
    return 'Add fwrd-go.github.io to Firebase Authentication → Settings → Authorized domains, then try again.';
  }
  if (code.includes('permission-denied') || code.includes('insufficient-permission')) {
    return 'Firebase sign-in worked, but the current Firestore rules do not yet allow dashboard data. Publish the updated firestore.rules file; access still checks each organization membership by email.';
  }
  if (code.includes('failed-precondition') || code.includes('not-found')) {
    return 'Firestore could not open the workspace path. Check that the Firestore database exists and publish the updated firestore.rules file.';
  }
  if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/user-not-found')) {
    return 'That Firebase account could not sign in. Check the email/password or use Google sign-in with an invited account.';
  }
  return 'Firebase error' + (code ? ' (' + code + ')' : '') + ': ' + ((error && error.message) || 'try again');
}

async function loadSdk() {
  if (sdk) return sdk;
  const root = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION;
  const loaded = await Promise.all([
    import(root + '/firebase-app.js'),
    import(root + '/firebase-auth.js'),
    import(root + '/firebase-firestore.js')
  ]);
  sdk = Object.assign({}, loaded[0], loaded[1], loaded[2]);
  return sdk;
}

function stopAllListeners() {
  listeners.forEach(stop => { try { stop(); } catch (error) {} });
  listeners = [];
  lastSignatures = new Map();
}

async function loadMemberships() {
  if (!user || !user.email) return [];
  const email = user.email.toLowerCase();
  const found = await Promise.all(ORGS.map(async org => {
    const result = await sdk.getDoc(sdk.doc(db, 'orgs', org.id, 'members', email));
    return result.exists() ? Object.assign({}, org, result.data()) : null;
  }));
  return found.filter(Boolean);
}

async function writeState(ref, key, state) {
  const serialized = signature(state);
  if (new Blob([serialized]).size > 800 * 1024) {
    emitStatus('error', 'A workspace record is too large for the single-document demo sync. Keep files in Drive and split larger records before production.');
    return;
  }
  if (serialized === lastSignatures.get(key)) return;
  lastSignatures.set(key, serialized);
  try {
    await sdk.setDoc(ref, {
      state: state,
      schemaVersion: 1,
      updatedAt: sdk.serverTimestamp(),
      updatedBy: user.uid
    });
  } catch (error) {
    lastSignatures.delete(key);
    emitStatus('error', explain(error));
  }
}

function startOrgListeners(org, localState) {
  const stateRef = sdk.doc(db, 'orgs', org.id, 'workspace', 'main');
  const stateKey = 'org:' + org.key;
  const stateStop = sdk.onSnapshot(stateRef, async snapshot => {
    if (!snapshot.exists()) {
      const initial = orgState(readLocalState(), org.key);
      await writeState(stateRef, stateKey, initial);
      return;
    }
    const remote = snapshot.data() && snapshot.data().state;
    if (!remote) return;
    const sig = signature(remote);
    if (sig === lastSignatures.get(stateKey)) return;
    lastSignatures.set(stateKey, sig);
    window.dispatchEvent(new CustomEvent('bkop-org-state', {
      detail: { orgKey: org.key, state: remote }
    }));
    emitStatus('connected', 'Connected to Firebase. Organization records sync live while you are signed in.');
  }, error => emitStatus('error', explain(error)));
  listeners.push(stateStop);

  const messagesQuery = sdk.query(
    sdk.collection(db, 'orgs', org.id, 'rooms', 'general', 'messages'),
    sdk.orderBy('createdAt', 'asc'),
    sdk.limit(100)
  );
  const messagesStop = sdk.onSnapshot(messagesQuery, snapshot => {
    const items = snapshot.docs.map(messageDoc => {
      const message = messageDoc.data();
      return {
        id: messageDoc.id,
        org: org.key,
        room: 'Board',
        by: message.displayName || message.email || 'Member',
        body: message.text || '',
        created: dateValue(message.createdAt)
      };
    });
    window.dispatchEvent(new CustomEvent('bkop-board-messages', {
      detail: { orgKey: org.key, messages: items }
    }));
  }, error => emitStatus('error', explain(error)));
  listeners.push(messagesStop);
}

function startCommitteeListener(room) {
  const number = room.replace('Committee ', '');
  const stateRef = sdk.doc(db, 'shared', 'workspace', 'committees', number);
  const stateKey = 'committee:' + number;
  const stop = sdk.onSnapshot(stateRef, async snapshot => {
    if (!snapshot.exists()) {
      const initial = committeeState(readLocalState(), room);
      await writeState(stateRef, stateKey, initial);
      return;
    }
    const remote = snapshot.data() && snapshot.data().state;
    if (!remote) return;
    const sig = signature(remote);
    if (sig === lastSignatures.get(stateKey)) return;
    lastSignatures.set(stateKey, sig);
    window.dispatchEvent(new CustomEvent('bkop-shared-committee', {
      detail: { room: room, messages: remote.messages || [], tasks: remote.tasks || [] }
    }));
  }, error => emitStatus('error', explain(error)));
  listeners.push(stop);
}

async function startWorkspaceSync() {
  stopAllListeners();
  memberships = await loadMemberships();
  emitMemberships();
  if (!memberships.length) {
    emitStatus('error', 'Signed in as ' + (user.email || 'Firebase account') + ', but no BKOP organization membership was found. Ask an administrator to add this email in the secure workspace.');
    return;
  }
  memberships.forEach(org => startOrgListeners(org, readLocalState()));
  COMMITTEES.forEach(startCommitteeListener);
  emitStatus('connecting', 'Signed in. Loading your organization and shared committee spaces…');
}

async function connect(config) {
  if (!config || !config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error('Firebase config needs apiKey, authDomain, projectId, and appId.');
  }
  emitStatus('connecting', 'Loading Firebase and preparing the sign-in connection…');
  try {
    const f = await loadSdk();
    if (app && configuredProject !== config.projectId) {
      throw new Error('This page is connected to a different Firebase project. Reload the page before switching projects.');
    }
    if (!app) {
      app = f.getApps().find(item => item.name === '[DEFAULT]') || f.initializeApp(config);
      configuredProject = config.projectId;
      auth = f.getAuth(app);
      db = f.getFirestore(app);
      authUnsubscribe = f.onAuthStateChanged(auth, async nextUser => {
        user = nextUser;
        stopAllListeners();
        memberships = [];
        emitMemberships();
        if (!user) {
          emitStatus('signed-out', 'Firebase is configured. Sign in to start live workspace sync.');
          return;
        }
        emitStatus('connecting', 'Signed in. Checking approved organization access…');
        try { await startWorkspaceSync(); }
        catch (error) { emitStatus('error', explain(error)); }
      }, error => emitStatus('error', explain(error)));
      await f.getRedirectResult(auth).catch(error => emitStatus('error', explain(error)));
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    emitStatus(user ? 'connecting' : 'signed-out', user ? 'Firebase is ready; opening your shared workspaces…' : 'Firebase is configured. Sign in to start live workspace sync.');
  } catch (error) {
    emitStatus('error', explain(error));
    throw error;
  }
}

async function save(state) {
  if (!auth || !db || !user || !memberships.length || !state) return;
  const writes = memberships.map(org => writeState(
    sdk.doc(db, 'orgs', org.id, 'workspace', 'main'),
    'org:' + org.key,
    orgState(state, org.key)
  ));
  COMMITTEES.forEach(room => {
    const number = room.replace('Committee ', '');
    writes.push(writeState(
      sdk.doc(db, 'shared', 'workspace', 'committees', number),
      'committee:' + number,
      committeeState(state, room)
    ));
  });
  await Promise.all(writes);
}

async function sendMessage(message) {
  if (!auth || !db || !user || !message || message.room !== 'Board') return;
  const org = memberships.find(item => item.key === message.org);
  if (!org) return;
  try {
    await sdk.setDoc(sdk.doc(db, 'orgs', org.id, 'rooms', 'general', 'messages', message.id), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email,
      text: message.body,
      createdAt: sdk.serverTimestamp()
    });
  } catch (error) {
    emitStatus('error', explain(error));
    throw error;
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

window.BKOPFirebase = { status: null, connect, save, sendMessage, signInEmail, signInGoogle, signOut };
emitStatus('local', 'Local demo only · add your Firebase web app config to connect.');

try {
  const savedConfig = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
  if (savedConfig) connect(savedConfig).catch(() => {});
} catch {
  emitStatus('error', 'The saved Firebase config is invalid. Re-enter the config in Admin Settings.');
}
