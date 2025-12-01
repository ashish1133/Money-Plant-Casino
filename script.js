// Integrated client script with backend API usage
let balance = 10000, currentBet = null, currentGame = null, previousFocus = null, transactions = [];
let currentUser = null, isAuthenticated = false, achievements = [], gameHistory = [], dailyBonusClaimed = false;
let slotsState = { spinning: false }, rouletteState = { spinning: false, selectedBet: null }, blackjackState = { gameState: null };

document.addEventListener('DOMContentLoaded', () => { setupEventListeners(); initNavToggle(); initRevealObserver(); initTiltEffects(); initFinanceButtons(); initAuthSystem(); initModalTriggers(); initHeroMetrics(); initLiveTicker(); initSpotlightCountdown(); initHeatmapBars(); initCatalogControls(); bootstrapFromServer(); });

async function bootstrapFromServer(){ showLoader(); try { if(apiClient.isAuthenticated()){ await loadUserDataFromServer(); await refreshBalance(); await initDailyBonusUI(); await loadTransactions(); } else { updateBalance(); initDailyBonusUI(); } } catch(e){ console.warn('Bootstrap fallback', e.message); updateBalance(); } finally { hideLoader(); }}
// Load catalog shortly after bootstrap
setTimeout(()=>{ renderCatalog(); }, 600);

// Catalog UI state
const catalogState = {
	loaded: false,
	data: null,
	query: '',
	category: 'all',
	risk: 'all',
	favoritesOnly: false,
	favs: new Set()
};

function loadFavorites(){
	try{ const raw=localStorage.getItem('catalog:favs'); if(raw){ catalogState.favs=new Set(JSON.parse(raw)); } }catch(_){}
}
function saveFavorites(){ try{ localStorage.setItem('catalog:favs', JSON.stringify(Array.from(catalogState.favs))); }catch(_){} }

function initCatalogControls(){
	loadFavorites();
	const search=document.getElementById('catalogSearch');
	const favTog=document.getElementById('favoritesToggle');
	const chips=document.querySelectorAll('.chip-group[aria-label="Categories"] .chip');
	const riskChips=document.querySelectorAll('.chip-group[aria-label="Risk"] .chip');
	const sort=document.getElementById('catalogSort');
	const openCatBtn=document.getElementById('openCategoryPage');
	if(search){ search.addEventListener('input',()=>{ catalogState.query=search.value.trim().toLowerCase(); renderCatalog(); }); }
	if(favTog){ favTog.addEventListener('click',()=>{ const cur=favTog.getAttribute('aria-pressed')==='true'; const next=!cur; favTog.setAttribute('aria-pressed', String(next)); favTog.classList.toggle('active', next); catalogState.favoritesOnly=next; renderCatalog(); }); }
	chips.forEach(ch=>{ ch.addEventListener('click',()=>{ document.querySelectorAll('.chip-group .chip').forEach(x=>x.classList.remove('active')); ch.classList.add('active'); document.querySelectorAll('.chip-group .chip').forEach(x=>x.setAttribute('aria-selected','false')); ch.setAttribute('aria-selected','true'); catalogState.category=ch.dataset.cat||'all'; renderCatalog(); }); });
	riskChips.forEach(ch=>{ ch.addEventListener('click',()=>{ riskChips.forEach(x=>{ x.classList.remove('active'); x.setAttribute('aria-selected','false'); }); ch.classList.add('active'); ch.setAttribute('aria-selected','true'); catalogState.risk=ch.dataset.risk||'all'; renderCatalog(); }); });
	if(sort){ sort.addEventListener('change',()=>{ renderCatalog(); }); }
	if(openCatBtn){ openCatBtn.addEventListener('click',()=>{ const cat=(catalogState.category||'all'); if(cat==='all'){ location.href='/categories/featured/'; } else { location.href=`/categories/${encodeURIComponent(cat)}/`; } }); }
}

function setupEventListeners(){ document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault(); const t=document.querySelector(a.getAttribute('href')); if(t) t.scrollIntoView({behavior:'smooth'});})); window.addEventListener('scroll', updateActiveNav); }
function initNavToggle(){ const toggle=document.getElementById('navToggle'); const navLinks=document.getElementById('primaryNav'); const overlay=document.getElementById('navOverlay'); if(!toggle||!navLinks||!overlay) return; document.body.classList.add('mobile-nav-ready'); const closeMenu=()=>{ navLinks.classList.remove('open'); toggle.classList.remove('active'); toggle.setAttribute('aria-expanded','false'); overlay.classList.remove('visible'); overlay.setAttribute('aria-hidden','true'); document.body.classList.remove('nav-menu-open'); }; const openMenu=()=>{ navLinks.classList.add('open'); toggle.classList.add('active'); toggle.setAttribute('aria-expanded','true'); overlay.classList.add('visible'); overlay.setAttribute('aria-hidden','false'); document.body.classList.add('nav-menu-open'); }; closeMenu(); toggle.addEventListener('click',()=>{ const isOpen=navLinks.classList.contains('open'); if(isOpen) closeMenu(); else openMenu(); }); overlay.addEventListener('click',closeMenu); navLinks.querySelectorAll('a, button').forEach(link=>{ link.addEventListener('click',()=>{ if(window.innerWidth<=1024) closeMenu(); }); }); window.addEventListener('resize',()=>{ if(window.innerWidth>1024) closeMenu(); }); }
function scrollToGames(){ const gamesSection=document.getElementById('games'); if(gamesSection) gamesSection.scrollIntoView({ behavior:'smooth', block:'start' }); }
function initFinanceButtons(){ const dep=document.getElementById('depositBtn'); const wit=document.getElementById('withdrawBtn'); if(dep) dep.addEventListener('click',()=>openFinance('deposit')); if(wit) wit.addEventListener('click',()=>openFinance('withdraw')); }
function initModalTriggers(){ document.querySelectorAll('[data-modal]').forEach(btn=>btn.addEventListener('click',()=>openGenericModal(btn.dataset.modal))); document.querySelectorAll('.close[data-close]').forEach(c=>c.addEventListener('click',()=>closeGenericModal(c.dataset.close))); }
function openGenericModal(id){ const m=document.getElementById(id); if(!m) return; m.style.display='block'; m.classList.add('fade-in'); const c=m.querySelector('.modal-content'); if(c) c.classList.add('scale-in'); document.body.style.overflow='hidden'; m.setAttribute('aria-hidden','false'); previousFocus=document.activeElement; trapFocus(m); focusFirstInput(m); if(id==='achievementsModal') renderAchievements(); if(id==='leaderboardModal') renderLeaderboard('profit'); if(id==='statsModal') renderStats(); if(id==='registrationModal') renderRegistrationDetails(); }
function closeGenericModal(id){ const m=document.getElementById(id); if(!m) return; m.style.display='none'; document.body.style.overflow='auto'; m.setAttribute('aria-hidden','true'); releaseFocus(); }
function updateActiveNav(){ const sections=document.querySelectorAll('section[id]'); const navLinks=document.querySelectorAll('.nav-link'); let current=''; sections.forEach(s=>{ if(window.pageYOffset>=s.offsetTop-200) current=s.id; }); navLinks.forEach(l=>{ l.classList.remove('active'); if(l.getAttribute('href')===`#${current}`) l.classList.add('active'); }); const nav=document.querySelector('.navbar'); if(nav){ if(window.scrollY>50) nav.classList.add('nav-shrink'); else nav.classList.remove('nav-shrink'); }}
function updateBalance(){ const el=document.getElementById('balance'); if(el) el.textContent=`$${balance.toLocaleString()}`; }
async function refreshBalance(){ if(!apiClient.isAuthenticated()) return updateBalance(); try { const d=await apiClient.getBalance(); balance=d.balance; updateBalance(); } catch(e){ console.error('Balance fetch failed', e); }}

function openGame(gameName){ currentGame=gameName; const m=document.getElementById(`${gameName}Modal`); if(!m) return; m.style.display='block'; m.classList.add('fade-in'); const c=m.querySelector('.modal-content'); if(c) c.classList.add('scale-in'); document.body.style.overflow='hidden'; m.setAttribute('aria-hidden','false'); previousFocus=document.activeElement; trapFocus(m); if(gameName==='blackjack') resetBlackjackLocal(); }
function closeGame(gameName){ const m=document.getElementById(`${gameName}Modal`); if(!m) return; m.style.display='none'; document.body.style.overflow='auto'; currentGame=null; m.setAttribute('aria-hidden','true'); releaseFocus(); m.querySelectorAll('.win-message').forEach(msg=>{ msg.textContent=''; msg.className='win-message'; }); }
function openFinance(action){ const m=document.getElementById('financeModal'); if(!m) return; m.style.display='block'; m.classList.add('fade-in'); const c=m.querySelector('.modal-content'); if(c) c.classList.add('scale-in'); document.body.style.overflow='hidden'; m.setAttribute('aria-hidden','false'); previousFocus=document.activeElement; trapFocus(m); switchFinanceTab(action); updateTransactionList(); }
function closeFinance(){ const m=document.getElementById('financeModal'); if(!m) return; m.style.display='none'; document.body.style.overflow='auto'; m.setAttribute('aria-hidden','true'); releaseFocus(); const msg=document.getElementById('financeMessage'); if(msg){ msg.textContent=''; msg.className='win-message'; } }
function switchFinanceTab(action){ const dep=document.getElementById('depositForm'); const wit=document.getElementById('withdrawForm'); const tabDep=document.getElementById('tab-deposit'); const tabWit=document.getElementById('tab-withdraw'); if(!dep||!wit||!tabDep||!tabWit) return; const msg=document.getElementById('financeMessage'); if(msg){ msg.textContent=''; msg.className='win-message'; } if(action==='deposit'){ dep.classList.remove('hidden'); wit.classList.add('hidden'); tabDep.classList.add('active'); tabWit.classList.remove('active'); } else { wit.classList.remove('hidden'); dep.classList.add('hidden'); tabWit.classList.add('active'); tabDep.classList.remove('active'); }}
// Focus helper: focus and select first visible input inside modal
function focusFirstInput(modal){ try{ if(!modal) return; const selector='input,select,textarea,button'; const inputs=Array.from(modal.querySelectorAll(selector)).filter(el=>el.offsetParent!==null && !el.disabled); if(inputs.length){ const first=inputs[0]; first.focus(); if(typeof first.select==='function') first.select(); } }catch(e){console.warn('focusFirstInput failed',e);} }

// Improve finance tab switching to focus the active input
const _origSwitchFinanceTab = switchFinanceTab;
function switchFinanceTab(action){
	const dep=document.getElementById('depositForm');
	const wit=document.getElementById('withdrawForm');
	const tabDep=document.getElementById('tab-deposit');
	const tabWit=document.getElementById('tab-withdraw');
	if(!dep||!wit||!tabDep||!tabWit) return;
	const msg=document.getElementById('financeMessage');
	if(msg){ msg.textContent=''; msg.className='win-message'; }
	if(action==='deposit'){
		dep.classList.remove('hidden');
		wit.classList.add('hidden');
		tabDep.classList.add('active');
		tabWit.classList.remove('active');
		focusFirstInput(dep);
	} else {
		wit.classList.remove('hidden');
		dep.classList.add('hidden');
		tabWit.classList.add('active');
		tabDep.classList.remove('active');
		focusFirstInput(wit);
	}
}
async function handleDeposit(e){ e.preventDefault(); const amtInput=document.getElementById('depositAmount'); const msg=document.getElementById('financeMessage'); const raw=parseInt(amtInput.value); if(isNaN(raw)||raw<10){ msg.textContent='Minimum deposit is $10.'; msg.className='win-message lose'; return;} if(!apiClient.isAuthenticated()){ msg.textContent='Login required'; msg.className='win-message lose'; return;} showLoader(); try { const r=await apiClient.deposit(raw); balance=r.balance; updateBalance(); msg.textContent=`Deposited $${raw.toLocaleString()}.`; msg.className='win-message win'; if(raw>=1000) createConfetti(); await loadTransactions(); } catch(err){ msg.textContent=err.message||'Deposit failed'; msg.className='win-message lose'; } finally { hideLoader(); }}
async function handleWithdraw(e){ e.preventDefault(); const amtInput=document.getElementById('withdrawAmount'); const msg=document.getElementById('financeMessage'); const raw=parseInt(amtInput.value); if(isNaN(raw)||raw<10){ msg.textContent='Minimum withdrawal is $10.'; msg.className='win-message lose'; return;} if(!apiClient.isAuthenticated()){ msg.textContent='Login required'; msg.className='win-message lose'; return;} showLoader(); try { const r=await apiClient.withdraw(raw); balance=r.balance; updateBalance(); msg.textContent=`Withdrew $${raw.toLocaleString()}.`; msg.className='win-message win'; await loadTransactions(); } catch(err){ msg.textContent=err.message||'Withdrawal failed'; msg.className='win-message lose'; } finally { hideLoader(); }}
async function loadTransactions(){ if(!apiClient.isAuthenticated()) return; try { const d=await apiClient.getTransactions(15,0); transactions=d.transactions.map(t=>({type:t.type, amount:Math.abs(t.amount), time:t.created_at||Date.now()})); updateTransactionList(); } catch(e){ console.error('Transactions failed', e); }}
function updateTransactionList(){ const list=document.getElementById('transactionList'); if(!list) return; list.innerHTML=''; transactions.slice(0,15).forEach(tx=>{ const li=document.createElement('li'); li.className=tx.type; const date=new Date(tx.time); const stamp=date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); li.innerHTML=`<span>${tx.type==='deposit'?'➕':tx.type==='withdraw'?'➖':'★'} $${tx.amount.toLocaleString()}</span><span>${stamp}</span>`; list.appendChild(li); }); }
window.addEventListener('click',e=>{ if(e.target.classList&&e.target.classList.contains('modal')){ e.target.style.display='none'; document.body.style.overflow='auto'; currentGame=null; e.target.setAttribute('aria-hidden','true'); releaseFocus(); if(e.target.id==='financeModal'){ const msg=document.getElementById('financeMessage'); if(msg){ msg.textContent=''; msg.className='win-message'; } } } });
window.addEventListener('keydown',e=>{ if(e.key==='Escape'&&currentGame) closeGame(currentGame); else if(e.key==='Escape'){ const fm=document.getElementById('financeModal'); if(fm&&fm.style.display==='block') closeFinance(); }});
function trapFocus(modal){ const selectors='button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'; const f=Array.from(modal.querySelectorAll(selectors)).filter(el=>!el.disabled&&el.offsetParent!==null); if(f.length){ f[0].focus(); modal.addEventListener('keydown',handleTrap); modal.__focusables=f; }}
function handleTrap(e){ if(e.key!=='Tab') return; const f=e.currentTarget.__focusables||[]; const first=f[0]; const last=f[f.length-1]; if(e.shiftKey&&document.activeElement===first){ e.preventDefault(); last.focus(); } else if(!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first.focus(); }}
function releaseFocus(){ const open=document.querySelector('.modal[aria-hidden="false"]'); if(open) open.removeEventListener('keydown',handleTrap); if(previousFocus) previousFocus.focus(); previousFocus=null; }

async function spinSlots(){ if(slotsState.spinning) return; const bet=parseInt(document.getElementById('slotBet').value); const wm=document.getElementById('slotWinMessage'); if(!apiClient.isAuthenticated()){ wm.textContent='Login required'; wm.className='win-message lose'; return;} slotsState.spinning=true; const btn=document.getElementById('spinBtn'); btn.disabled=true; wm.textContent=''; wm.className='win-message'; showLoader(); try { const res=await apiClient.playSlots(bet); ['reel1','reel2','reel3'].forEach((id,i)=>{ const el=document.getElementById(id); if(el) el.textContent=res.reels[i]; }); balance=res.balance; updateBalance(); updateFairness(res.seed,res.hash); if(res.winAmount>0){ wm.textContent=`You won $${res.winAmount.toLocaleString()}!`; wm.className='win-message win'; if(res.outcome==='jackpot') createConfetti(); } else { wm.textContent='Better luck next time!'; wm.className='win-message lose'; } updateXPFromProgression(res.progression,res.xpGained); achievements=res.achievements||achievements; } catch(err){ wm.textContent=err.message||'Spin failed'; wm.className='win-message lose'; } finally { hideLoader(); slotsState.spinning=false; btn.disabled=false; }}
function placeBet(color){ if(rouletteState.spinning) return; rouletteState.selectedBet=color; document.querySelectorAll('.bet-btn').forEach(b=>b.classList.remove('active')); event.target.classList.add('active'); }
async function spinRoulette(){ if(rouletteState.spinning) return; const wm=document.getElementById('rouletteWinMessage'); if(!rouletteState.selectedBet){ wm.textContent='Select a bet!'; wm.className='win-message lose'; return;} if(!apiClient.isAuthenticated()){ wm.textContent='Login required'; wm.className='win-message lose'; return;} const bet=parseInt(document.getElementById('rouletteBet').value); rouletteState.spinning=true; const wheel=document.getElementById('rouletteWheel'); wheel.classList.add('spinning'); wm.textContent=''; wm.className='win-message'; showLoader(); try { const res=await apiClient.playRoulette(bet,rouletteState.selectedBet); wheel.classList.remove('spinning'); balance=res.balance; updateBalance(); updateFairness(res.seed,res.hash); if(res.winAmount>0){ wm.textContent=`You won $${res.winAmount.toLocaleString()}! Result: ${res.result}`; wm.className='win-message win'; if(res.result==='green') createConfetti(); } else { wm.textContent=`Result: ${res.result.toUpperCase()} - Better luck next time!`; wm.className='win-message lose'; } updateXPFromProgression(res.progression,res.xpGained); achievements=res.achievements||achievements; } catch(err){ wheel.classList.remove('spinning'); wm.textContent=err.message||'Spin failed'; wm.className='win-message lose'; } finally { hideLoader(); rouletteState.spinning=false; rouletteState.selectedBet=null; document.querySelectorAll('.bet-btn').forEach(b=>b.classList.remove('active')); }}

function resetBlackjackLocal(){ blackjackState.gameState=null; ['playerCards','dealerCards'].forEach(id=>document.getElementById(id).innerHTML=''); document.getElementById('playerScore').textContent=''; document.getElementById('dealerScore').textContent=''; const wm=document.getElementById('blackjackWinMessage'); wm.textContent=''; wm.className='win-message'; document.getElementById('dealBtn').disabled=false; document.getElementById('hitBtn').disabled=true; document.getElementById('standBtn').disabled=true; }
async function dealCards(){ const bet=parseInt(document.getElementById('blackjackBet').value); const wm=document.getElementById('blackjackWinMessage'); if(!apiClient.isAuthenticated()){ wm.textContent='Login required'; wm.className='win-message lose'; return;} showLoader(); try { const res=await apiClient.dealBlackjack(bet); balance=res.balance; updateBalance(); blackjackState.gameState=res.gameState; currentBet=bet; renderBlackjackHands(true); updateFairness(res.gameState.seed,res.gameState.hash); document.getElementById('dealBtn').disabled=true; document.getElementById('hitBtn').disabled=false; document.getElementById('standBtn').disabled=false; updateXPFromProgression(res.progression,res.xpGained); } catch(err){ wm.textContent=err.message||'Deal failed'; wm.className='win-message lose'; } finally { hideLoader(); }}
async function hit(){ const wm=document.getElementById('blackjackWinMessage'); if(!blackjackState.gameState) return; showLoader(); try { const res=await apiClient.hitBlackjack(blackjackState.gameState); blackjackState.gameState=res.gameState; renderBlackjackHands(false); if(res.outcome==='bust'){ wm.textContent='Bust! You lose.'; wm.className='win-message lose'; document.getElementById('hitBtn').disabled=true; document.getElementById('standBtn').disabled=true; document.getElementById('dealBtn').disabled=false; } } catch(err){ wm.textContent=err.message||'Hit failed'; wm.className='win-message lose'; } finally { hideLoader(); }}
async function stand(){ const wm=document.getElementById('blackjackWinMessage'); if(!blackjackState.gameState) return; showLoader(); try { const res=await apiClient.standBlackjack(blackjackState.gameState); blackjackState.gameState=res.gameState; renderBlackjackHands(false,true); balance=res.balance; updateBalance(); if(res.outcome==='win'){ wm.textContent=`You won $${res.winAmount.toLocaleString()}!`; wm.className='win-message win'; createConfetti(); } else if(res.outcome==='push'){ wm.textContent='Push! Bet returned.'; wm.className='win-message'; } else { wm.textContent='Dealer wins!'; wm.className='win-message lose'; } updateFairness(res.gameState.seed,res.gameState.hash); updateXPFromProgression(res.progression,res.xpGained); achievements=res.achievements||achievements; } catch(err){ wm.textContent=err.message||'Stand failed'; wm.className='win-message lose'; } finally { hideLoader(); document.getElementById('hitBtn').disabled=true; document.getElementById('standBtn').disabled=true; document.getElementById('dealBtn').disabled=false; }}
function renderBlackjackHands(hideDealer,revealDealer=false){ const gs=blackjackState.gameState; if(!gs) return; const pc=document.getElementById('playerCards'); const dc=document.getElementById('dealerCards'); pc.innerHTML=''; dc.innerHTML=''; gs.playerHand.forEach(c=>displayServerCard(pc,c)); gs.dealerHand.forEach((c,i)=>displayServerCard(dc,c,hideDealer&&i===0&&!revealDealer)); document.getElementById('playerScore').textContent=`Score: ${gs.playerScore}`; document.getElementById('dealerScore').textContent=`Score: ${gs.dealerScore}`; }
function displayServerCard(container,card,hidden=false){ const el=document.createElement('div'); el.className='card'; if(hidden){ el.textContent='🂠'; el.style.background='#333'; } else { const isRed=card.suit==='♥'||card.suit==='♦'; el.className+=' '+(isRed?'red':'black'); el.textContent=`${card.rank}${card.suit}`; } container.appendChild(el); }

function initAuthSystem(){
	const loginBtn=document.getElementById('loginBtn');
	const signupBtn=document.getElementById('signupBtn');
	const logoutBtn=document.getElementById('logoutBtn');
	// If buttons are links (href), let navigation happen; otherwise use modal
	if(loginBtn && !loginBtn.getAttribute('href')) loginBtn.addEventListener('click',openAuth);
	if(signupBtn && !signupBtn.getAttribute('href')) signupBtn.addEventListener('click',()=>{ openAuth(); switchAuthTab('signup'); });
	if(logoutBtn) logoutBtn.addEventListener('click',handleLogout);
	try {
		const params=new URLSearchParams(window.location.search);
		if(window.location.hash==='#signup'||params.get('signup')==='1'){
			openAuth();
			switchAuthTab('signup');
		}
	} catch(_){}
}
async function loadUserDataFromServer(){ try { const profile=await apiClient.getProfile(); currentUser=profile.user; achievements=profile.achievements||[]; isAuthenticated=true; balance=currentUser.balance||balance; updateUserUI(); updateXPBar(); } catch(e){ console.error('Profile load failed', e); }}
function saveUserData(){}
async function handleLogin(e){ e.preventDefault(); const em=document.getElementById('loginEmail').value; const p=document.getElementById('loginPassword').value; const msg=document.getElementById('authMessage'); msg.textContent=''; msg.className='win-message'; showLoader(); try { await apiClient.login(em,p); await loadUserDataFromServer(); await refreshBalance(); isAuthenticated=true; const name=(currentUser&&currentUser.username)||em; showNotification('Login Successful',`Welcome back, ${name}!`,'success'); closeAuth(); initDailyBonusUI(); } catch(err){ msg.textContent=err.message||'Login failed'; msg.className='win-message lose'; } finally { hideLoader(); }}
async function handleSignup(e){
	e.preventDefault();
	const name=document.getElementById('signupName').value.trim();
	const phone=document.getElementById('signupPhone').value.trim();
	const age=parseInt(document.getElementById('signupAge').value,10);
	const gender=document.getElementById('signupGender').value;
	const email=document.getElementById('signupEmail').value.trim();
	const password=document.getElementById('signupPassword').value;
	const confirm=document.getElementById('signupConfirmPassword').value;
	const msg=document.getElementById('authMessage');
	msg.textContent='';
	msg.className='win-message';
	if(password!==confirm){ msg.textContent='Passwords do not match'; msg.className='win-message lose'; return; }
	if(!Number.isFinite(age)||age<18){ msg.textContent='You must be 18 or older'; msg.className='win-message lose'; return; }
	showLoader();
	try {
		const profile={ name, phone, age, gender, email, password };
		await apiClient.register(profile);
		await loadUserDataFromServer();
		await refreshBalance();
		isAuthenticated=true;
		showNotification('Account Created',`Welcome to Lucky Casino, ${name}!`,'success');
		closeAuth();
		initDailyBonusUI();
	} catch(err){
		msg.textContent=err.message||'Signup failed';
		msg.className='win-message lose';
	} finally { hideLoader(); }
}
async function handleLogout(){ showLoader(); try { await apiClient.logout(); } catch(_){} currentUser=null; isAuthenticated=false; balance=10000; transactions=[]; gameHistory=[]; achievements=[]; updateUserUI(); updateBalance(); showNotification('Logged Out','See you soon!','info'); initDailyBonusUI(); hideLoader(); }
function updateUserUI(){ const loginBtn=document.getElementById('loginBtn'); const userProfile=document.getElementById('userProfile'); const userName=document.getElementById('userName'); const userLevel=document.getElementById('userLevel'); if(isAuthenticated&&currentUser){ if(loginBtn) loginBtn.style.display='none'; if(userProfile) userProfile.style.display='flex'; if(userName) userName.textContent=currentUser.username; if(userLevel) userLevel.textContent=`Level ${currentUser.level||1}`; } else { if(loginBtn) loginBtn.style.display='block'; if(userProfile) userProfile.style.display='none'; }}
function openAuth(){ const m=document.getElementById('authModal'); if(!m) return; m.style.display='block'; m.classList.add('fade-in'); document.body.style.overflow='hidden'; m.setAttribute('aria-hidden','false'); previousFocus=document.activeElement; switchAuthTab('login'); }
function closeAuth(){ const m=document.getElementById('authModal'); if(!m) return; m.style.display='none'; document.body.style.overflow='auto'; m.setAttribute('aria-hidden','true'); releaseFocus(); const msg=document.getElementById('authMessage'); if(msg){ msg.textContent=''; msg.className='win-message'; }}
function switchAuthTab(tab){ const loginForm=document.getElementById('loginForm'); const signupForm=document.getElementById('signupForm'); const tabLogin=document.getElementById('tab-login'); const tabSignup=document.getElementById('tab-signup'); const msg=document.getElementById('authMessage'); if(msg){ msg.textContent=''; msg.className='win-message'; } if(tab==='login'){ loginForm.classList.remove('hidden'); signupForm.classList.add('hidden'); tabLogin.classList.add('active'); tabSignup.classList.remove('active'); } else { signupForm.classList.remove('hidden'); loginForm.classList.add('hidden'); tabSignup.classList.add('active'); tabLogin.classList.remove('active'); }}

// Enhance auth tab switching with focus management
const _origSwitchAuthTab = switchAuthTab;
function switchAuthTab(tab){
	const loginForm=document.getElementById('loginForm');
	const signupForm=document.getElementById('signupForm');
	const tabLogin=document.getElementById('tab-login');
	const tabSignup=document.getElementById('tab-signup');
	const msg=document.getElementById('authMessage');
	if(msg){ msg.textContent=''; msg.className='win-message'; }
	if(tab==='login'){
		loginForm.classList.remove('hidden');
		signupForm.classList.add('hidden');
		tabLogin.classList.add('active');
		tabSignup.classList.remove('active');
		focusFirstInput(loginForm);
	} else {
		signupForm.classList.remove('hidden');
		loginForm.classList.add('hidden');
		tabSignup.classList.add('active');
		tabLogin.classList.remove('active');
		focusFirstInput(signupForm);
	}
}
function showNotification(title,message,type='info'){ const container=document.getElementById('notificationContainer'); if(!container) return; const n=document.createElement('div'); n.className=`notification ${type}`; n.innerHTML=`<div class='notification-title'>${title}</div><div class='notification-message'>${message}</div>`; container.appendChild(n); n.addEventListener('click',()=>{ n.classList.add('removing'); setTimeout(()=>n.remove(),300); }); setTimeout(()=>{ n.classList.add('removing'); setTimeout(()=>n.remove(),300); },5000); }
function unlockAchievement(id,title,description){ showNotification(`🏆 ${title}`,description,'success'); createConfetti(); }
function checkDailyBonus(){}
async function initDailyBonusUI(){ const btn=document.getElementById('claimDailyBonusBtn'); if(!btn) return; btn.disabled=true; if(!apiClient.isAuthenticated()||!currentUser){ btn.textContent='Login for Bonus'; return;} try { const profile=await apiClient.getProfile(); const streak=profile.streak||{current_streak:0}; const lastClaim=profile.user.last_bonus_claim||0; const now=Date.now(); const oneDayMs=86400000; if(now-lastClaim>=oneDayMs){ const bonusBase=500+Math.min(streak.current_streak*50,500); btn.textContent=`Claim $${bonusBase}`; btn.disabled=false; btn.onclick= async ()=>{ btn.disabled=true; showLoader(); try { const res=await apiClient.claimDailyBonus(); balance=res.balance; updateBalance(); showNotification('Bonus Claimed',`You received $${res.amount}`,'success'); createConfetti(); } catch(err){ showNotification('Bonus Error',err.message||'Failed','error'); } finally { hideLoader(); initDailyBonusUI(); } }; } else { const remaining=oneDayMs-(now-lastClaim); const hrs=Math.floor(remaining/3600000); const mins=Math.floor((remaining%3600000)/60000); btn.textContent=`Next in ${hrs}h ${mins}m`; } } catch(e){ btn.textContent='Bonus unavailable'; }}
async function renderAchievements(){ const grid=document.getElementById('achievementsGrid'); if(!grid) return; grid.innerHTML=''; if(!apiClient.isAuthenticated()){ grid.innerHTML='<p style="text-align:center;color:var(--text-gray)">Login to view achievements.</p>'; return;} try { const data=await apiClient.getAchievements(); const list=data.achievements||[]; if(!list.length){ grid.innerHTML='<p style="text-align:center;color:var(--text-gray)">No achievements yet.</p>'; return;} list.forEach(a=>{ const d=new Date(a.unlocked_at||Date.now()); const el=document.createElement('div'); el.className='achievement-card unlocked'; el.innerHTML=`<div class='achievement-icon'>🏆</div><div class='achievement-title'>${a.title}</div><div class='achievement-desc'>${a.description}</div><div class='achievement-date'>${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>`; grid.appendChild(el); }); } catch(e){ grid.innerHTML='<p style="text-align:center;color:var(--text-gray)">Failed to load achievements.</p>'; }}

async function renderRegistrationDetails(){
	const container = document.getElementById('registrationBody');
	const status = document.getElementById('registrationStatus');
	if(!container) return;
	if(status) { status.textContent = 'Loading…'; status.className = 'full'; }
	try{
		if(!apiClient.isAuthenticated()){
			if(status) status.textContent = 'Please login to view your registration.';
			return;
		}
		if(typeof window.getRegistrationDoc !== 'function'){
			if(status) status.textContent = 'Registration details unavailable.';
			return;
		}
		const data = await window.getRegistrationDoc();
		if(!data){
			if(status) status.textContent = 'No registration document found.';
			return;
		}
		const fmt = (ts)=>{
			try{ if(ts && typeof ts.toDate === 'function') return ts.toDate().toLocaleString(); }catch(_){}
			return ts || '—';
		};
		container.innerHTML = `
			<div><label class="note">UID</label><div class="stat-value" style="word-break:break-all">${data.uid||data.id||'—'}</div></div>
			<div><label class="note">Email</label><div class="stat-value">${data.email||'—'}</div></div>
			<div><label class="note">Name</label><div class="stat-value">${data.name||'—'}</div></div>
			<div><label class="note">Phone</label><div class="stat-value">${data.phone||'—'}</div></div>
			<div><label class="note">Age</label><div class="stat-value">${Number.isFinite(data.age)?data.age:'—'}</div></div>
			<div><label class="note">Gender</label><div class="stat-value">${data.gender||'—'}</div></div>
			<div><label class="note">Provider</label><div class="stat-value">${data.provider||'—'}</div></div>
			<div><label class="note">Created</label><div class="stat-value">${fmt(data.createdAt)}</div></div>
			<div><label class="note">Updated</label><div class="stat-value">${fmt(data.updatedAt)}</div></div>
			<div class="full note">These details are stored in Firestore collection <code>registure_users</code>.</div>
		`;
	} catch(e){
		if(status) status.textContent = 'Failed to load registration details.';
	}
}
async function renderLeaderboard(type){ const list=document.getElementById('leaderboardList'); if(!list) return; list.innerHTML='Loading...'; try { const isGame=['slots','roulette','blackjack'].includes(type); const data=await apiClient.getLeaderboard(isGame?'profit':type,isGame?type:null,10); const lb=data.leaderboard||[]; list.innerHTML=''; lb.forEach((row,idx)=>{ const li=document.createElement('li'); const scoreVal=row.net_profit!==undefined?('$'+row.net_profit.toLocaleString()):row.level!==undefined?('Lvl '+row.level):('$'+(row.profit||0).toLocaleString()); li.innerHTML=`<span class='leaderboard-rank'>#${idx+1}</span><span class='leaderboard-name'>${row.username||'Player'}</span><span class='leaderboard-score'>${scoreVal}</span>`; list.appendChild(li); }); } catch(e){ list.innerHTML='<li>Failed to load leaderboard</li>'; } document.querySelectorAll('.leaderboard-tab').forEach(tab=>{ tab.classList.remove('active'); if(tab.dataset.lbType===type) tab.classList.add('active'); tab.onclick=()=>renderLeaderboard(tab.dataset.lbType); }); }
async function renderStats(){ const grid=document.getElementById('statsGrid'); if(!grid) return; grid.innerHTML=''; if(!apiClient.isAuthenticated()){ grid.innerHTML='<p style="text-align:center;color:var(--text-gray)">Login to view stats.</p>'; return;} try { const data=await apiClient.getStats(); const s=data.stats||{}; const breakdown=data.gameBreakdown||[]; const core=[{label:'Total Games',value:s.total_games||0},{label:'Wins',value:s.total_wins||0},{label:'Win Rate',value:(s.winRate||0)+'%'},{label:'Net Profit',value:'$'+(s.net_profit||0).toLocaleString()},{label:'Biggest Win',value:'$'+(s.biggest_win||0).toLocaleString()},{label:'Avg Bet',value:'$'+(Math.round(s.avg_bet)||0).toLocaleString()}]; core.forEach(d=>{ const card=document.createElement('div'); card.className='stat-card'; card.innerHTML=`<div class='stat-label'>${d.label}</div><div class='stat-value'>${d.value}</div>`; grid.appendChild(card); }); breakdown.forEach(gb=>{ const card=document.createElement('div'); card.className='stat-card'; card.innerHTML=`<div class='stat-label'>${gb.game} plays</div><div class='stat-value'>${gb.plays} (Wins: ${gb.wins})</div>`; grid.appendChild(card); }); updateXPBar(); } catch(e){ grid.innerHTML='<p style="text-align:center;color:var(--text-gray)">Failed to load stats.</p>'; }}
function updateXPBar(){ if(!currentUser) return; const xpFill=document.getElementById('xpFill'); const xpValue=document.getElementById('xpValue'); if(!xpFill||!xpValue) return; const xp=currentUser.xp||0; const level=currentUser.level||1; const base=(level-1)*1000; const progress=xp-base; const pct=Math.min(100,(progress/1000)*100); xpFill.style.width=pct+'%'; xpValue.textContent=`${progress} / 1000`; }
function updateXPFromProgression(progression,gained){ if(!progression||!currentUser) return; currentUser.level=progression.level; currentUser.xp=progression.xp; updateUserUI(); updateXPBar(); if(gained) showNotification('XP Gained',`+${gained} XP`,'info'); }
function updateFairness(seed,hash){ const seedEl=document.getElementById('fairnessSeed'); const verifyBtn=document.getElementById('verifyFairnessBtn'); if(seedEl) seedEl.textContent=seed||'—'; if(verifyBtn){ if(seed&&hash){ verifyBtn.disabled=false; verifyBtn.onclick= async ()=>{ try { const res=await apiClient.verifyGame(seed,hash); showNotification('Fairness Check',res.valid?'Valid seed/hash':'Invalid!',res.valid?'success':'error'); } catch(e){ showNotification('Fairness Error',e.message||'Verification failed','error'); } }; } else verifyBtn.disabled=true; }}
function showLoader(){ const l=document.getElementById('globalLoader'); if(l){ l.classList.remove('hidden'); l.setAttribute('aria-hidden','false'); }}
function hideLoader(){ const l=document.getElementById('globalLoader'); if(l){ l.classList.add('hidden'); l.setAttribute('aria-hidden','true'); }}
function initRevealObserver(){ const o=new IntersectionObserver(entries=>{ entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('visible'); o.unobserve(en.target); } }); },{threshold:0.15}); document.querySelectorAll('.reveal').forEach(el=>o.observe(el)); }
function initTiltEffects(){ document.querySelectorAll('.tilt-hover').forEach(el=>{ el.addEventListener('mousemove',e=>{ const r=el.getBoundingClientRect(); const x=e.clientX-r.left; const y=e.clientY-r.top; const rotX=((y/r.height)-0.5)*-10; const rotY=((x/r.width)-0.5)*10; el.style.transform=`perspective(800px) translateY(-8px) rotateX(${rotX}deg) rotateY(${rotY}deg)`; }); el.addEventListener('mouseleave',()=>{ el.style.transform=''; }); }); }
const style=document.createElement('style'); style.textContent='@keyframes confettiFall { to { transform: translateY(100vh) rotate(360deg); opacity: 0; } }'; document.head.appendChild(style);
function createConfetti(){ const colors=['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#FFA07A']; for(let i=0;i<50;i++){ setTimeout(()=>{ const c=document.createElement('div'); c.style.position='fixed'; c.style.width='10px'; c.style.height='10px'; c.style.backgroundColor=colors[Math.floor(Math.random()*colors.length)]; c.style.left=Math.random()*100+'%'; c.style.top='-10px'; c.style.borderRadius='50%'; c.style.pointerEvents='none'; c.style.zIndex='9999'; c.style.animation=`confettiFall ${2+Math.random()*2}s linear forwards`; document.body.appendChild(c); setTimeout(()=>c.remove(),4000); },i*20); }}
window.spinSlots=spinSlots; window.placeBet=placeBet; window.spinRoulette=spinRoulette; window.dealCards=dealCards; window.hit=hit; window.stand=stand; window.handleLogin=handleLogin; window.handleSignup=handleSignup; window.handleLogout=handleLogout; window.handleDeposit=handleDeposit; window.handleWithdraw=handleWithdraw; window.openGame=openGame; window.closeGame=closeGame; window.openFinance=openFinance; window.closeFinance=closeFinance; window.switchFinanceTab=switchFinanceTab; window.renderLeaderboard=renderLeaderboard; window.scrollToGames=scrollToGames;
window.playCrashPrompt=playCrashPrompt; window.playDicePrompt=playDicePrompt; window.playPlinkoPrompt=playPlinkoPrompt;

// Modal-based play handlers
async function playCrashFromModal(){
	const bet=parseInt(document.getElementById('crashBet').value,10);
	const auto=parseFloat(document.getElementById('crashAuto').value);
	const resEl=document.getElementById('crashResult');
	if(!apiClient.isAuthenticated()){ resEl.textContent='Login required'; resEl.className='win-message lose'; return; }
	if(!Number.isFinite(bet)||bet<10||!Number.isFinite(auto)||auto<1.01){ resEl.textContent='Enter valid bet and auto cashout'; resEl.className='win-message lose'; return; }
	resEl.textContent=''; resEl.className='win-message'; showLoader();
	try{ const res=await apiClient.playCrash(bet,auto); balance=res.balance; updateBalance(); updateFairness(res.seed,res.hash); if(res.cashedOut){ resEl.textContent=`Cashed at x${res.bust} — Won $${res.winAmount}`; resEl.className='win-message win'; createConfetti(); } else { resEl.textContent=`Busted at x${res.bust}`; resEl.className='win-message lose'; } updateXPFromProgression(res.progression,res.xpGained); } catch(e){ resEl.textContent=e.message||'Play failed'; resEl.className='win-message lose'; } finally{ hideLoader(); }
}

async function playDiceFromModal(){
	const bet=parseInt(document.getElementById('diceBet').value,10);
	const target=parseInt(document.getElementById('diceTarget').value,10);
	const resEl=document.getElementById('diceResult');
	if(!apiClient.isAuthenticated()){ resEl.textContent='Login required'; resEl.className='win-message lose'; return; }
	if(!Number.isFinite(bet)||bet<10||!Number.isFinite(target)||target<2||target>98){ resEl.textContent='Enter valid bet and target (2-98)'; resEl.className='win-message lose'; return; }
	resEl.textContent=''; resEl.className='win-message'; showLoader();
	try{ const res=await apiClient.playDice(bet,target); balance=res.balance; updateBalance(); updateFairness(res.seed,res.hash); if(res.winAmount>0){ resEl.textContent=`Roll ${res.roll} < ${res.target} — Won $${res.winAmount}`; resEl.className='win-message win'; createConfetti(); } else { resEl.textContent=`Roll ${res.roll} ≥ ${res.target}`; resEl.className='win-message lose'; } updateXPFromProgression(res.progression,res.xpGained); } catch(e){ resEl.textContent=e.message||'Play failed'; resEl.className='win-message lose'; } finally{ hideLoader(); }
}

async function playPlinkoFromModal(){
	const bet=parseInt(document.getElementById('plinkoBet').value,10);
	let rows=parseInt(document.getElementById('plinkoRows').value,10); if(!Number.isFinite(rows)) rows=8; rows=Math.min(16,Math.max(6,rows));
	const resEl=document.getElementById('plinkoResult');
	if(!apiClient.isAuthenticated()){ resEl.textContent='Login required'; resEl.className='win-message lose'; return; }
	if(!Number.isFinite(bet)||bet<10){ resEl.textContent='Enter valid bet (min $10)'; resEl.className='win-message lose'; return; }
	resEl.textContent=''; resEl.className='win-message'; showLoader();
	try{ const res=await apiClient.playPlinko(bet,rows); balance=res.balance; updateBalance(); updateFairness(res.seed,res.hash); const path=(res.path||[]).join(''); if(res.winAmount>0){ resEl.textContent=`Path ${path} ⇒ x${res.multiplier} — Won $${res.winAmount}`; resEl.className='win-message win'; createConfetti(); } else { resEl.textContent=`Path ${path} ⇒ x${res.multiplier}`; resEl.className='win-message lose'; } updateXPFromProgression(res.progression,res.xpGained); } catch(e){ resEl.textContent=e.message||'Play failed'; resEl.className='win-message lose'; } finally{ hideLoader(); }
}

async function playLimboFromModal(){
	const bet=parseInt(document.getElementById('limboBet').value,10);
	const target=parseFloat(document.getElementById('limboTarget').value);
	const resEl=document.getElementById('limboResult');
	if(!apiClient.isAuthenticated()){ resEl.textContent='Login required'; resEl.className='win-message lose'; return; }
	if(!Number.isFinite(bet)||bet<10||!Number.isFinite(target)||target<1.01){ resEl.textContent='Enter valid bet and target (≥1.01x)'; resEl.className='win-message lose'; return; }
	resEl.textContent=''; resEl.className='win-message'; showLoader();
	try{ const res=await apiClient.playLimbo(bet,target); balance=res.balance; updateBalance(); updateFairness(res.seed,res.hash); if(res.winAmount>0){ resEl.textContent=`Won $${res.winAmount} at x${res.target}`; resEl.className='win-message win'; createConfetti(); } else { resEl.textContent=`Missed target x${res.target}`; resEl.className='win-message lose'; } updateXPFromProgression(res.progression,res.xpGained); } catch(e){ resEl.textContent=e.message||'Play failed'; resEl.className='win-message lose'; } finally{ hideLoader(); }
}

async function playMinesFromModal(){
	const bet=parseInt(document.getElementById('minesBet').value,10);
	const bombs=parseInt(document.getElementById('minesBombs').value,10);
	const picks=parseInt(document.getElementById('minesPicks').value,10);
	const resEl=document.getElementById('minesResult');
	if(!apiClient.isAuthenticated()){ resEl.textContent='Login required'; resEl.className='win-message lose'; return; }
	if(!Number.isFinite(bet)||bet<10||!Number.isFinite(bombs)||bombs<1||bombs>24||!Number.isFinite(picks)||picks<1||picks>24){ resEl.textContent='Enter valid values'; resEl.className='win-message lose'; return; }
	resEl.textContent=''; resEl.className='win-message'; showLoader();
	try{ const res=await apiClient.playMines(bet,bombs,picks); balance=res.balance; updateBalance(); updateFairness(res.seed,res.hash); if(res.winAmount>0){ resEl.textContent=`Won $${res.winAmount} (x${res.multiplier}) with ${res.picks} picks`; resEl.className='win-message win'; createConfetti(); } else { resEl.textContent=`Boom! ${res.bombs} bombs on board — try fewer picks`; resEl.className='win-message lose'; } updateXPFromProgression(res.progression,res.xpGained); } catch(e){ resEl.textContent=e.message||'Play failed'; resEl.className='win-message lose'; } finally{ hideLoader(); }
}

// Expose for inline handlers
window.playCrashFromModal=playCrashFromModal; window.playDiceFromModal=playDiceFromModal; window.playPlinkoFromModal=playPlinkoFromModal; window.playLimboFromModal=playLimboFromModal; window.playMinesFromModal=playMinesFromModal;

function initHeroMetrics(){ const counters=document.querySelectorAll('[data-counter-target]'); if(!counters.length) return; counters.forEach(el=>{ const target=parseFloat(el.dataset.counterTarget); if(isNaN(target)) return; const format=el.dataset.counterFormat||'number'; const prefix=el.dataset.counterPrefix||''; const suffix=el.dataset.counterSuffix||''; const decimals=el.dataset.counterDecimals?parseInt(el.dataset.counterDecimals,10):null; animateCounter(el,target,format,prefix,suffix,decimals); setInterval(()=>{ const variance=target*0.012; const oscillation=target+((Math.random()*2-1)*variance); animateCounter(el,Math.max(0,oscillation),format,prefix,suffix,decimals); },9000+Math.random()*4000); }); }

function animateCounter(el,target,format,prefix,suffix,decimals){ const duration=1200; const startValue=parseFloat(el.dataset.counterValue)||0; const start=performance.now(); const step=now=>{ const progress=Math.min((now-start)/duration,1); const value=startValue+(target-startValue)*progress; el.dataset.counterValue=value; el.textContent=formatCounterValue(value,format,prefix,suffix,decimals); if(progress<1) requestAnimationFrame(step); }; requestAnimationFrame(step); }

function formatCounterValue(value,format,prefix,suffix,decimals){ if(format==='currency'){ return `${prefix}${Math.round(value).toLocaleString()}${suffix||''}`; } if(format==='percent'){ const places=Number.isInteger(decimals)?decimals:1; return `${prefix}${value.toFixed(places)}${suffix||'%'}`; } if(format==='compact'){ const formatter=new Intl.NumberFormat('en', { notation:'compact', maximumFractionDigits:Number.isInteger(decimals)?decimals:1 }); return `${prefix}${formatter.format(value)}${suffix||''}`; } const places=Number.isInteger(decimals)?decimals:0; const formatted=Number(value).toFixed(places).replace(/\B(?=(\d{3})+(?!\d))/g, ','); return `${prefix}${formatted}${suffix||''}`; }

function initLiveTicker(){ const track=document.getElementById('liveTickerTrack'); if(!track) return; const highlights=["🎰 <strong>Slots</strong> Nova hit $18,400 on a 50x combo","🃏 <strong>Blackjack</strong> Celestine pulled a perfect 21","🎲 <strong>Roulette</strong> Table 07 paid 10x on green","💰 <strong>Wallet</strong> VIP deposit processed in 2.3s","🏆 <strong>Leaderboard</strong> AstraNova up $128,400 today","⚡ <strong>Daily Bonus</strong> 6,420 players claimed streaks"]; const markup=highlights.map(item=>`<span class="ticker-item">${item}</span>`).join(''); track.innerHTML=markup+markup; }

function initSpotlightCountdown(){ const countdown=document.querySelector('[data-countdown]'); if(!countdown) return; let targetAttr=countdown.dataset.countdownTarget; let targetDate=targetAttr?new Date(targetAttr):null; if(!targetDate||Number.isNaN(targetDate.getTime())){ targetDate=getFutureDate(36); } const parts={ days:countdown.querySelector('[data-countdown-part="days"]'), hours:countdown.querySelector('[data-countdown-part="hours"]'), minutes:countdown.querySelector('[data-countdown-part="minutes"]'), seconds:countdown.querySelector('[data-countdown-part="seconds"]') }; const format=val=>String(val).padStart(2,'0'); const tick=()=>{ const now=new Date(); let diff=targetDate-now; if(diff<=0){ targetDate=getFutureDate(36); diff=targetDate-now; } const totalSeconds=Math.floor(diff/1000); const days=Math.floor(totalSeconds/86400); const hours=Math.floor((totalSeconds%86400)/3600); const minutes=Math.floor((totalSeconds%3600)/60); const seconds=totalSeconds%60; if(parts.days) parts.days.textContent=format(days); if(parts.hours) parts.hours.textContent=format(hours); if(parts.minutes) parts.minutes.textContent=format(minutes); if(parts.seconds) parts.seconds.textContent=format(seconds); }; tick(); setInterval(tick,1000); }

function getFutureDate(hoursAhead){ const now=new Date(); return new Date(now.getTime()+hoursAhead*60*60*1000); }

function initHeatmapBars(){ const bars=document.querySelectorAll('.heatmap-bar'); if(!bars.length) return; bars.forEach((bar,idx)=>{ const value=Math.max(0,Math.min(100,parseInt(bar.dataset.heatValue,10)||0)); const fill=bar.querySelector('.heatmap-fill'); const label=bar.querySelector('.heatmap-value'); if(label) label.textContent=`${value}%`; requestAnimationFrame(()=>{ setTimeout(()=>{ if(fill) fill.style.width=value+'%'; }, idx*120); }); }); }

async function playCrashPrompt(){
	if(!apiClient.isAuthenticated()) return showNotification('Login required','Please login to play','error');
	const betRaw = parseInt(prompt('Enter bet amount (min $10):')||'0',10);
	if(!Number.isFinite(betRaw)||betRaw<10) return;
	const auto = parseFloat(prompt('Auto cashout multiplier (e.g., 2.0):')||'0');
	if(!Number.isFinite(auto)||auto<1.01) return;
	showLoader();
	try {
		const res = await apiClient.playCrash(betRaw, auto);
		balance = res.balance; updateBalance(); updateFairness(res.seed,res.hash);
		const msg = res.cashedOut ? `Cashed at x${res.bust} — Won $${res.winAmount}` : `Busted at x${res.bust} — Better luck next time`;
		showNotification('Crash Result', msg, res.cashedOut?'success':'error');
		updateXPFromProgression(res.progression,res.xpGained);
	} catch(e){ showNotification('Crash Failed', e.message||'Error', 'error'); } finally { hideLoader(); }
}

async function playDicePrompt(){
	if(!apiClient.isAuthenticated()) return showNotification('Login required','Please login to play','error');
	const betRaw = parseInt(prompt('Enter bet amount (min $10):')||'0',10);
	if(!Number.isFinite(betRaw)||betRaw<10) return;
	const target = parseInt(prompt('Pick target roll-under (2-98):')||'0',10);
	if(!Number.isFinite(target)||target<2||target>98) return;
	showLoader();
	try {
		const res = await apiClient.playDice(betRaw, target);
		balance = res.balance; updateBalance(); updateFairness(res.seed,res.hash);
		const msg = res.winAmount>0 ? `Roll ${res.roll} < ${res.target} — Won $${res.winAmount}` : `Roll ${res.roll} ≥ ${res.target} — You lost`;
		showNotification('Dice Result', msg, res.winAmount>0?'success':'error');
		updateXPFromProgression(res.progression,res.xpGained);
	} catch(e){ showNotification('Dice Failed', e.message||'Error', 'error'); } finally { hideLoader(); }
}

async function playPlinkoPrompt(){
	if(!apiClient.isAuthenticated()) return showNotification('Login required','Please login to play','error');
	const betRaw = parseInt(prompt('Enter bet amount (min $10):')||'0',10);
	if(!Number.isFinite(betRaw)||betRaw<10) return;
	const rows = parseInt(prompt('Rows (6-16, default 8):')||'8',10);
	showLoader();
	try {
		const res = await apiClient.playPlinko(betRaw, rows);
		balance = res.balance; updateBalance(); updateFairness(res.seed,res.hash);
		const msg = res.winAmount>0 ? `Path ${res.path.join('')} ⇒ x${res.multiplier} — Won $${res.winAmount}` : `Path ${res.path.join('')} ⇒ x${res.multiplier} — You lost`;
		showNotification('Plinko Result', msg, res.winAmount>0?'success':'error');
		updateXPFromProgression(res.progression,res.xpGained);
	} catch(e){ showNotification('Plinko Failed', e.message||'Error', 'error'); } finally { hideLoader(); }
}

async function renderCatalog(){
	const container = document.getElementById('catalogContainer');
	if(!container) return;
	try {
		if(!catalogState.loaded){
			showCatalogSkeleton();
			const data = await apiClient.getGamesCatalog();
			catalogState.data = data;
			catalogState.loaded = true;
		}
		const data = catalogState.data || { categories: [] };
		const cats = data.categories||[];

		// Flatten with category info
		const allGames = cats.flatMap(cat => (cat.games||[]).map(g => ({...g, category: cat.key})));
		// Dedup by key (show first occurrence)
		const map = new Map(); allGames.forEach(g=>{ if(!map.has(g.key)) map.set(g.key, g); });
		let list = Array.from(map.values());
		// Compute derived risk
		list.forEach(g=>{ const e=Number(g.edge); if(Number.isFinite(e)){ g._rtp = Math.max(0, 100 - e*100); g._risk = e<=0.01?'low':e<=0.02?'medium':'high'; } else { g._rtp = null; g._risk='medium'; } });

		// Apply category filter
		if(catalogState.category && catalogState.category!=='all'){
			list = list.filter(g => g.category === catalogState.category);
		}
		// Apply risk filter
		if(catalogState.risk && catalogState.risk!=='all'){
			list = list.filter(g => g._risk === catalogState.risk);
		}
		// Apply favorites filter
		if(catalogState.favoritesOnly){ list = list.filter(g => catalogState.favs.has(g.key)); }
		// Apply search
		if(catalogState.query){ const q=catalogState.query; list = list.filter(g => (g.name||'').toLowerCase().includes(q) || (g.type||'').includes(q)); }

		// Sorting
		const sort=document.getElementById('catalogSort');
		const mode=sort?sort.value:'name-asc';
		list.sort((a,b)=>{
			if(mode==='edge-asc') return (a.edge??99) - (b.edge??99);
			if(mode==='edge-desc') return (b.edge??-1) - (a.edge??-1);
			return (a.name||'').localeCompare(b.name||'');
		});

		const icon = (key)=>({
			slots:'🎰', roulette:'🎲', blackjack:'🃏', crash:'✈️', dice:'🎯', plinko:'🔻', limbo:'💫', mines:'💣'
		})[key] || '🎮';

		// Group by category for display
		const byCat = list.reduce((acc,g)=>{ (acc[g.category] ||= []).push(g); return acc; },{});
		const order = ['featured','table','arcade','live'];

		container.innerHTML = order.filter(k=>byCat[k]?.length).map(catKey => {
			const cat = cats.find(c=>c.key===catKey);
			const title = cat?.title || catKey;
			const games = byCat[catKey];
			return `
			<div class="catalog-category">
				<h3>${title}</h3>
				<div class="catalog-games">
					${games.map(g => `
						<div class="catalog-game ${g.comingSoon?'soon':''}" title="${g.name}">
							<button class="favorite-btn ${catalogState.favs.has(g.key)?'active':''}" data-fav="${g.key}" aria-label="Toggle favorite">★</button>
							<div class="catalog-icon">${icon(g.key)}</div>
							<div class="catalog-name"><a href="/games/${encodeURIComponent(g.key)}/" style="text-decoration:none;color:inherit">${g.name}</a></div>
							${g.edge!=null?`<div class="catalog-meta">edge ~ ${(g.edge*100).toFixed(1)}% · ${g._risk}</div>`:''}
							${g.comingSoon?'<div class="catalog-tag">Soon</div>':`<div class="catalog-actions"><button class="btn btn-small" data-gamekey="${g.key}">Play</button><button class="btn btn-small btn-outline" data-details="${g.key}">Details</button></div>`}
						</div>
					`).join('')}
				</div>
			</div>`;
		}).join('') || `<div class="empty-state">No games match your filters.</div>`;

		// Bind play buttons
		container.querySelectorAll('button[data-gamekey]').forEach(btn => {
			btn.addEventListener('click', () => {
				const key = btn.getAttribute('data-gamekey');
				if(key==='slots') openGame('slots');
				else if(key==='roulette') openGame('roulette');
				else if(key==='blackjack') openGame('blackjack');
				else if(key==='crash') openGenericModal('crashModal');
				else if(key==='dice') openGenericModal('diceModal');
				else if(key==='plinko') openGenericModal('plinkoModal');
				else if(key==='limbo') openGenericModal('limboModal');
				else if(key==='mines') openGenericModal('minesModal');
				else showNotification('Coming Soon', 'This game will be added shortly', 'info');
			});
		});
		// Bind favorites toggles
		container.querySelectorAll('button[data-fav]').forEach(btn=>{
			btn.addEventListener('click',()=>{
				const key=btn.getAttribute('data-fav');
				if(catalogState.favs.has(key)) catalogState.favs.delete(key); else catalogState.favs.add(key);
				saveFavorites();
				try{ playClickTone(); }catch(_){ }
				const added=catalogState.favs.has(key);
				showNotification(added?'Favorited':'Removed Favorite', added?'Added to your favorites':'Removed from favorites', added?'success':'info');
				renderCatalog();
			});
		});
		// Bind details buttons
		container.querySelectorAll('button[data-details]').forEach(btn=>{
			btn.addEventListener('click',()=>{
				const key=btn.getAttribute('data-details');
				openGameDetails(key);
			});
		});
	} catch(e){
		container.innerHTML = '<p>Catalog unavailable.</p>';
	}
}

function showCatalogSkeleton(){
	const container=document.getElementById('catalogContainer');
	if(!container) return;
	const n=8; const cards=Array.from({length:n},()=>'<div class="sk-card skeleton"></div>').join('');
	container.innerHTML = `<div class="catalog-skeleton">${cards}</div>`;
}

function openGameDetails(key){
	const modal=document.getElementById('gameDetailsModal');
	if(!modal) return;
	const data=catalogState.data||{categories:[]};
	const g = (data.categories.flatMap(c=>c.games||[])).find(x=>x.key===key);
	const title=g?.name||key;
	const edge=Number(g?.edge); const rtp=Number.isFinite(edge)?(100-edge*100).toFixed(2)+'%':'—';
	const risk=Number.isFinite(edge)?(edge<=0.01?'Low':edge<=0.02?'Medium':'High'):'—';
	document.getElementById('gdTitle').textContent=title;
	document.getElementById('gdEdge').textContent=Number.isFinite(edge)?(edge*100).toFixed(2)+'%':'—';
	document.getElementById('gdRTP').textContent=rtp;
	document.getElementById('gdRisk').textContent=risk;
	const details=getGameDetailsContent(key, edge);
	document.getElementById('gdDesc').textContent=details.desc;
	const ul=document.getElementById('gdExamples');
	ul.innerHTML='';
	details.examples.forEach(ex=>{ const li=document.createElement('li'); li.textContent=ex; ul.appendChild(li); });
	const play=document.getElementById('gdPlay');
	play.onclick=()=>{ closeGenericModal('gameDetailsModal'); setTimeout(()=>{
		if(key==='slots') openGame('slots'); else if(key==='roulette') openGame('roulette'); else if(key==='blackjack') openGame('blackjack');
		else if(key==='crash') openGenericModal('crashModal'); else if(key==='dice') openGenericModal('diceModal'); else if(key==='plinko') openGenericModal('plinkoModal'); else if(key==='limbo') openGenericModal('limboModal'); else if(key==='mines') openGenericModal('minesModal');
	}, 120); };
	openGenericModal('gameDetailsModal');
	try{ playClickTone(); }catch(_){ }
	try{ history.replaceState(null,'',`#game=${encodeURIComponent(key)}`); }catch(_){ }
}

function getGameDetailsContent(key, edge){
	const e = Number.isFinite(edge)?(edge*100).toFixed(1)+'%':'—';
	const map={
		slots:{ desc:`Spin for lines and symbols with stacked multipliers. House edge ~ ${e}.`, examples:["Three 7s: 10x","Two cherries: 2x","Mixed: no win"]},
		roulette:{ desc:`Bet red/black/green or numbers. Edge ~ ${e}.`, examples:["Red win: 2x","Black win: 2x","Green hit: 10x"]},
		blackjack:{ desc:`Beat dealer to 21 without busting. Edge ~ ${e}.`, examples:["21 vs 18: 2x","Push 20 vs 20: 1x","Bust: 0x"]},
		crash:{ desc:`Profit grows until it busts—cash out in time. Edge ~ ${e}.`, examples:["Bust at 1.42x","Auto cashout 2.0x wins","Late cashout loses"]},
		dice:{ desc:`Roll-under with custom target; lower targets pay more. Edge ~ ${e}.`, examples:["Target 10: ~11x","Target 50: ~2x","Roll≥target: lose"]},
		plinko:{ desc:`Drop path left/right; edges reward extremes. Edge ~ ${e}.`, examples:["Center bin: ~1x","Edge bin: 3x","Miss: <1x"]},
		limbo:{ desc:`Pick a multiplier and hope the roll meets it. Edge ~ ${e}.`, examples:["Target 1.5x: frequent","Target 5x: rarer","Miss: 0x"]},
		mines:{ desc:`Pick safe tiles; one-shot probability-based payout. Edge ~ ${e}.`, examples:["3 picks, 3 bombs: high risk","3/3 safe picks: x~multiplier","Hit bomb: 0x"]}
	};
	return map[key] || { desc:`Game information and RTP overview. Edge ~ ${e}.`, examples:["Example win","Example loss","Odds vary"] };
}

// Theme toggle removed

// Subtle audio cue
let _audioCtx=null;
function playClickTone(){
	try{
		if(!_audioCtx) _audioCtx=new (window.AudioContext||window.webkitAudioContext)();
		const ctx=_audioCtx; const o=ctx.createOscillator(); const g=ctx.createGain();
		o.type='sine'; o.frequency.value=660; g.gain.value=0.0001; o.connect(g); g.connect(ctx.destination);
		const now=ctx.currentTime; g.gain.exponentialRampToValueAtTime(0.02, now+0.005); g.gain.exponentialRampToValueAtTime(0.0001, now+0.08);
		o.start(now); o.stop(now+0.09);
	}catch(_){}
}

// Deep-link to details via hash
try{ const m=location.hash.match(/#game=([^&]+)/); if(m){ setTimeout(()=>openGameDetails(decodeURIComponent(m[1])), 300); } }catch(_){ }

