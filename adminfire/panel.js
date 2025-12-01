import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

function fmt(n){
  if(n == null) return '-';
  return typeof n === 'number' ? n.toLocaleString() : String(n);
}
function fmtTime(t){
  if(!t) return '-';
  if (t.seconds) return new Date(t.seconds*1000).toLocaleString();
  return new Date(t).toLocaleString();
}

async function ensureAdminClaim(user){
  try {
    // Force refresh to get latest custom claims
    await user.getIdToken(true);
    const token = await user.getIdTokenResult();
    return !!(token && token.claims && token.claims.admin);
  } catch {
    return false;
  }
}

async function loadUsers(db){
  const tbody = document.querySelector('#users-table tbody');
  const snap = await getDocs(collection(db,'users'));
  const users = [];
  snap.forEach(d=>users.push({ id:d.id, ...d.data() }));
  document.getElementById('users-count').textContent = `(${users.length})`;
  tbody.innerHTML = users.map(u=>`<tr>
    <td>${u.uid||u.id}</td>
    <td>${u.email||'-'}</td>
    <td>${u.name||u.displayName||'-'}</td>
    <td>${fmt(u.balance)}</td>
    <td>${fmt(u.totalDeposited)}</td>
    <td>${fmt(u.totalWon)}</td>
    <td>${fmt(u.totalLost)}</td>
  </tr>`).join('');
}

function liveTable(db){
  const txBody = document.querySelector('#tx-table tbody');
  const playsBody = document.querySelector('#plays-table tbody');
  const txQ = query(collection(db,'transactions'), orderBy('createdAt','desc'), limit(50));
  const gpQ = query(collection(db,'gamePlays'), orderBy('createdAt','desc'), limit(50));
  onSnapshot(txQ, snap => {
    const rows = [];
    snap.forEach(d=>{
      const t=d.data();
      rows.push(`<tr><td>${t.userId}</td><td>${t.type}</td><td>${fmt(t.amount)}</td><td>${fmt(t.balanceAfter)}</td><td>${fmtTime(t.createdAt)}</td></tr>`)
    });
    txBody.innerHTML = rows.join('');
  });
  onSnapshot(gpQ, snap => {
    const rows = [];
    snap.forEach(d=>{
      const g=d.data();
      rows.push(`<tr><td>${g.userId}</td><td>${g.gameName}</td><td>${fmt(g.betAmount)}</td><td>${fmt(g.winAmount)}</td><td>${fmt(g.profit)}</td><td>${g.outcome}</td><td>${fmtTime(g.createdAt)}</td></tr>`)
    });
    playsBody.innerHTML = rows.join('');
  });
}

(function init(){
  const auth = getAuth();
  const db = getFirestore();
  const status = document.getElementById('adminStatus');
  onAuthStateChanged(auth, async (user)=>{
    if(!user){
      status.textContent = 'Please sign in first (userlogin), then come back.';
      return;
    }
    const isAdmin = await ensureAdminClaim(user);
    if(!isAdmin){
      status.textContent = 'Access denied. Admin claim not present.';
      return;
    }
    status.textContent = 'Admin verified. Loading data...';
    await loadUsers(db);
    liveTable(db);
    status.textContent = 'Admin verified. Live data connected.';
  });
})();
