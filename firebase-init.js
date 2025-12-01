// Client-side Firebase Analytics (optional). Safe to include on public pages.
// Uses your existing Firebase config.
// Note: This does NOT affect server-side auth or database; it only enables Analytics on the client.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, GoogleAuthProvider, OAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBf5mkzvmzWu0-sdwbuLnwxnNXNFLqO8N4",
  authDomain: "moneyplant-1e7bb.firebaseapp.com",
  projectId: "moneyplant-1e7bb",
  storageBucket: "moneyplant-1e7bb.firebasestorage.app",
  messagingSenderId: "404133843124",
  appId: "1:404133843124:web:57a8f97bf12a7b311587e1",
  measurementId: "G-LN66B7DCPB"
};

try {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Resolve collection to store registration records
  let REGISTER_COLLECTION = 'registure_users';
  try {
    if (typeof window !== 'undefined' && window.REGISTER_COLLECTION) {
      REGISTER_COLLECTION = String(window.REGISTER_COLLECTION);
    } else {
      const meta = document.querySelector('meta[name="register-collection"]');
      if (meta && meta.content) REGISTER_COLLECTION = meta.content.trim();
    }
  } catch(_) {}
  async function ensureUserDoc(user, extra={}){
    if(!user) return;
    const userDoc = doc(db, 'users', user.uid);
    const base = {
      uid: user.uid,
      email: user.email || '',
      name: user.displayName || '',
      phone: user.phoneNumber || '',
      age: null,
      gender: '',
      balance: 0,
      totalDeposited: 0,
      totalWon: 0,
      totalLost: 0,
      isAdmin: false,
      updatedAt: serverTimestamp()
    };
    await setDoc(userDoc, { createdAt: serverTimestamp(), ...base, ...extra }, { merge: true });
  }
  async function recordRegistration(user, data={}){
    try {
      if (!user) return;
      const regDoc = doc(db, REGISTER_COLLECTION, user.uid);
      const payload = {
        uid: user.uid,
        email: user.email || data.email || '',
        name: (user.displayName || data.name || ''),
        phone: data.phone || user.phoneNumber || '',
        age: Number.isFinite(data.age) ? data.age : null,
        gender: data.gender || '',
        provider: (user.providerData && user.providerData[0] && user.providerData[0].providerId) || 'password',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(regDoc, payload, { merge: true });
    } catch (e) {
      console.warn('Registration record failed:', e?.message || e);
    }
  }
  // Expose helpers for the app to use
  window.firebaseAuth = auth;
  window.firebaseLogin = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };
  window.firebaseSignup = async (email, password) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await ensureUserDoc(cred.user);
    await recordRegistration(cred.user, { email });
    return cred.user;
  };
  window.firebaseSignupWithProfile = async (profile) => {
    const { email, password, name, phone, age, gender } = profile;
    if (!email || !password) throw new Error('Email and password required');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    try { if (name) await updateProfile(user, { displayName: name }); } catch (_) {}
    await ensureUserDoc(user, {
      email,
      name: name || '',
      phone: phone || '',
      age: Number.isFinite(age) ? age : null,
      gender: gender || ''
    });
    await recordRegistration(user, { email, name, phone, age, gender });
    return user;
  };
  window.firebaseSignInWithProvider = async (providerName) => {
    let provider;
    if(providerName === 'google'){
      provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
    } else if(providerName === 'apple'){
      provider = new OAuthProvider('apple.com');
    } else {
      throw new Error('Unsupported provider');
    }
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;
    await ensureUserDoc(user);
    return user;
  };
  window.firebaseLogout = async () => { await signOut(auth); };
  window.getFirebaseIdToken = async () => {
    const u = auth.currentUser;
    if (!u) return null;
    return await u.getIdToken(/* forceRefresh */ true);
  };

  const supported = await isSupported();
  if (supported) {
    getAnalytics(app);
    console.log('Firebase Analytics initialized');
  } else {
    console.warn('Firebase Analytics not supported in this environment');
  }
  // Signal readiness to any listeners
  try { window.dispatchEvent(new Event('firebase-ready')); } catch(_) {}
} catch (e) {
  console.warn('Firebase client init failed:', e.message);
}
