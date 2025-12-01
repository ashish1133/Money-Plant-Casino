function getAdminToken(){
  try { return localStorage.getItem('ADMIN_TOKEN'); } catch(_) { return null; }
}

async function fetchJSON(url){
  const token = getAdminToken();
  const headers = {};
  if(token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(url,{ headers });
  if(!res.ok) throw new Error(`Request failed ${res.status}`);
  return res.json();
}

function formatTime(ts){
  if(!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleString();
}

function renderOverview(data){
  const container = document.getElementById('overview-stats');
  const entries = [
    ['Users', data.users],
    ['Total Balance', data.totalBalance.toFixed(2)],
    ['Transactions', data.transactions],
    ['Games Played', data.gamesPlayed],
    ['Aggregate Profit', data.aggregateProfit.toFixed(2)]
  ];
  container.innerHTML = entries.map(([label,val])=>`<div class="stat"><div class="label">${label}</div><div class="value">${val}</div></div>`).join('');
}

function renderUsers(users){
  document.getElementById('users-count').textContent = `(${users.length})`;
  const tbody = document.querySelector('#users-table tbody');
  tbody.innerHTML = users.map(u => {
    return `<tr>
      <td data-label="ID">${u.id}</td>
      <td data-label="Username">${u.username}</td>
      <td data-label="Email">${u.email}</td>
      <td data-label="Level">${u.level}</td>
      <td data-label="XP">${u.xp}</td>
      <td data-label="Balance">${(u.balance || 0).toFixed(2)}</td>
      <td data-label="Created">${formatTime(u.created_at)}</td>
    </tr>`;
  }).join('');
}

function renderTransactions(list){
  const tbody = document.querySelector('#tx-table tbody');
  tbody.innerHTML = list.map(t => `<tr>
    <td data-label="ID">${t.id}</td>
    <td data-label="User">${t.username}</td>
    <td data-label="Type">${t.type}</td>
    <td data-label="Amount">${t.amount.toFixed(2)}</td>
    <td data-label="Balance After">${t.balance_after.toFixed(2)}</td>
    <td data-label="Time">${formatTime(t.created_at)}</td>
  </tr>`).join('');
}

function renderGameResults(list){
  const tbody = document.querySelector('#games-table tbody');
  tbody.innerHTML = list.map(g => `<tr>
    <td data-label="ID">${g.id}</td>
    <td data-label="User">${g.username}</td>
    <td data-label="Game">${g.game}</td>
    <td data-label="Bet">${g.bet_amount.toFixed(2)}</td>
    <td data-label="Win">${g.win_amount.toFixed(2)}</td>
    <td data-label="Profit">${g.profit.toFixed(2)}</td>
    <td data-label="Outcome">${g.outcome}</td>
    <td data-label="Time">${formatTime(g.created_at)}</td>
  </tr>`).join('');
}

async function loadAll(){
  try {
    const [overview, usersData, txData, gameData] = await Promise.all([
      fetchJSON('/api/admin/overview'),
      fetchJSON('/api/admin/users?limit=100'),
      fetchJSON('/api/admin/transactions?limit=50'),
      fetchJSON('/api/admin/game-results?limit=50')
    ]);
    renderOverview(overview);
    renderUsers(usersData.users);
    renderTransactions(txData.transactions);
    renderGameResults(gameData.results);
  } catch (e){
    console.error(e);
    alert('Failed to load admin data: '+ e.message);
  }
}

loadAll();
setInterval(loadAll, 30000); // refresh every 30s
