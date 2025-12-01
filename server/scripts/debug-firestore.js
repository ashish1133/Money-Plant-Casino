#!/usr/bin/env node
/*
 * Utility to verify Firebase Admin credentials and Firestore access.
 * Usage: node scripts/debug-firestore.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { getFirestore, isFirebaseEnabled } = require('../config/firebase');

async function main() {
  try {
    const db = getFirestore();
    if (!isFirebaseEnabled() || !db) {
      console.error('[FAIL] Firebase Admin is not configured.');
      console.log('Set one of the following before running:');
      console.log('  - FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json');
      console.log('  - or FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY');
      process.exitCode = 1;
      return;
    }

    const projectId = db._settings?.projectId || process.env.FIREBASE_PROJECT_ID || 'unknown';
    console.log('[INFO] Connected to project:', projectId);

    const testId = `debug-${Date.now()}`;
    const docRef = db.collection('registure_users').doc(testId);
    await docRef.set({
      uid: testId,
      createdAt: Date.now(),
      diagnostics: 'temporary debug write'
    });
    console.log('[PASS] Write succeeded to collection registure_users.');

    const snap = await docRef.get();
    if (!snap.exists) {
      console.error('[FAIL] Write verification failed: document not found.');
      process.exitCode = 1;
    } else {
      console.log('[PASS] Read back doc:', snap.data());
      await docRef.delete();
      console.log('[INFO] Cleaned up debug document.');
    }
  } catch (err) {
    console.error('[ERROR]', err.message);
    process.exitCode = 1;
  }
}

main();
