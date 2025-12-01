const fs = require('fs');
const path = require('path');
let admin = null;

try {
  admin = require('firebase-admin');
} catch (_) {
  // firebase-admin not installed yet; handled below
}

let firestore = null;
let initialized = false;

function initFirebase() {
  if (!admin) return;
  if (initialized) return;

  const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  try {
    if (svcPath && fs.existsSync(path.resolve(svcPath))) {
      const serviceAccount = require(path.resolve(svcPath));
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }
    } else if (projectId && clientEmail && privateKey) {
      // Replace escaped newlines if provided as env
      privateKey = privateKey.replace(/\\n/g, '\n');
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey
          })
        });
      }
    } else {
      // Not configured
      return;
    }

    firestore = admin.firestore();
    initialized = true;
  } catch (e) {
    // Fail open: leave firestore as null
    console.warn('Firebase initialization failed:', e.message);
  }
}

function isFirebaseEnabled() {
  return !!firestore;
}

function getFirestore() {
  if (!initialized) initFirebase();
  return firestore;
}

module.exports = {
  getFirestore,
  isFirebaseEnabled
};
