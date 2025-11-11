/* script.js
   Full front-end logic integrating with your backend.
   Ensure API variable points to your backend (update if required).
*/
const API = "https://paymomentbackend.onrender.com/api";

// Auth guard
const token = localStorage.getItem('token');
if(!token){
  // if opened on dashboard page, redirect to auth
  if(!location.pathname.includes('auth.html')) location.href = 'auth.html';
}

// --- UI refs
const usernameEl = document.getElementById('username');
const profilePic = document.getElementById('profilePic');
const notifCountEl = document.getElementById('notifCount');
const balanceDisplay = document.getElementById('balanceDisplay');
const toggleBalanceBtn = document.getElementById('toggleBalance');
const addMoneyBtn = document.getElementById('addMoney');
const historyLink = document.getElementById('historyLink');
const recentTx = document.getElementById('recentTx');
const todaySalesEl = document.getElementById('todaySales');
const miniText = document.getElementById('miniText');

// Modal refs
const modalDeposit = document.getElementById('modalDeposit');
const depositAmt = document.getElementById('depositAmt');
const depositProceed = document.getElementById('depositProceed');

const modalService = document.getElementById('modalService');
const svcTitle = document.getElementById('svcTitle');
const svcBody = document.getElementById('svcBody');
const svcSubmit = document.getElementById('svcSubmit');

const modalHistory = document.getElementById('modalHistory');
const historyList = document.getElementById('historyList');

// Buttons
const logoutBtn = document.getElementById('logout');

let showBalance = true;
let txCache = [];

// Init
async function init(){
  // set user name
  usernameEl.textContent = localStorage.getItem('name') || localStorage.getItem('email') || 'User';
  miniText.textContent = localStorage.getItem('email') || '';

  // event listeners
  toggleBalanceBtn.addEventListener('click', toggleBalanceDisplay);
  addMoneyBtn.addEventListener('click', () => openModal(modalDeposit));
  depositProceed.addEventListener('click', proceedDeposit);
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeAllModals));
  document.querySelectorAll('.svc').forEach(b => b.addEventListener('click', svcClickHandler));
  document.querySelectorAll('.quick-btn').forEach(b => b.addEventListener('click', quickHandler));
  document.querySelectorAll('.icon').forEach(el => el.addEventListener('click', e => {
    // small demo behaviours
    if(el.id === 'helpBtn') alert('Help center');
    if(el.id === 'qrBtn') alert('QR scan (demo)');
    if(el.id === 'notifBtn') openNotificationsModal();
  }));
  logoutBtn && logoutBtn.addEventListener('click', () => { localStorage.clear(); location.href = 'auth.html'; });
  historyLink && historyLink.addEventListener('click', (e) => { e.preventDefault(); openHistoryModal(); });

  // polling updates
  await refreshAll();
  setInterval(refreshAll, 12000);
}

// --- Refresh functions
async function refreshAll(){
  await fetchBalance();
  await fetchTransactions();
  updateTodaySales();
  updateNotifBadge();
}

// --- Balance
async function fetchBalance(){
  try{
    const res = await fetch(`${API}/user/balance`, { headers: { Authorization: 'Bearer ' + token } });
    const body = await res.json();
    if(body && body.success){
      const amt = Number(body.balance || 0).toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 });
      balanceDisplay.textContent = showBalance ? `₦${amt}` : '₦•••••';
    }
  }catch(err){
    console.error('balance error', err);
  }
}
function toggleBalanceDisplay(){ showBalance = !showBalance; fetchBalance(); }

// --- Deposit (Paystack flow: initialize on server, redirect user)
async function proceedDeposit(){
  const amount = Number(depositAmt.value);
  if(!amount || amount <= 0) return alert('Enter a valid amount');
  try{
    const res = await fetch(`${API}/paystack/initialize`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ amount, email: localStorage.getItem('email') || '' })
    });
    const data = await res.json();
    if(data && data.data && data.data.authorization_url){
      // redirect to paystack checkout (server returned url)
      window.location.href = data.data.authorization_url;
    } else {
      alert('Could not initialize payment. See console.');
      console.error(data);
    }
  }catch(err){
    console.error(err);
    alert('Network error');
  }
}

// --- Transactions
async function fetchTransactions(){
  try{
    const res = await fetch(`${API}/user/transactions`, { headers: { Authorization: 'Bearer ' + token } });
    const data = await res.json();
    if(data && data.success){
      txCache = data.transactions || [];
      renderRecent(txCache.slice(0,5));
    } else {
      console.warn('transactions response', data);
    }
  }catch(err){
    console.error('tx error', err);
  }
}
function renderRecent(list){
  recentTx.innerHTML = '';
  if(!list || list.length === 0){
    recentTx.innerHTML = '<li class="tx-item"><div class="tx-title muted">No recent transactions</div></li>';
    return;
  }
  for(const tx of list){
    const li = document.createElement('li');
    li.className = 'tx-item';
    const left = document.createElement('div'); left.className = 'tx-left';
    const icon = document.createElement('div'); icon.className = 'tx-icon';
    icon.textContent = tx.type === 'deposit' ? '⬇️' : (String(tx.type).toLowerCase().includes('electric') ? '💡' : (String(tx.type).toLowerCase().includes('data') ? '📡' : '💳'));
    const meta = document.createElement('div'); meta.className = 'tx-meta';
    const title = document.createElement('div'); title.className = 'tx-title';
    title.textContent = tx.description || tx.type;
    const time = document.createElement('div'); time.className = 'tx-time muted';
    time.textContent = new Date(tx.created_at || tx.createdAt || Date.now()).toLocaleString();
    meta.appendChild(title); meta.appendChild(time);
    left.appendChild(icon); left.appendChild(meta);

    const amount = document.createElement('div');
    const amtSign = (tx.type === 'deposit' || Number(tx.amount) > 0) ? '+' : '-';
    amount.className = 'tx-amount ' + ((tx.type === 'deposit' || Number(tx.amount) > 0) ? 'credit' : 'debit');
    amount.textContent = amtSign + ' ₦' + Number(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 });

    li.appendChild(left); li.appendChild(amount);
    recentTx.appendChild(li);
  }
}

// --- Transaction history modal
function openHistoryModal(){
  // populate historyList
  historyList.innerHTML = '';
  if(!txCache || txCache.length === 0) historyList.innerHTML = '<div class="muted">No transactions</div>';
  else {
    txCache.forEach(tx => {
      const row = document.createElement('div'); row.style.padding = '10px 0'; row.style.borderBottom = '1px solid #f1f5f9';
      row.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700">${tx.description || tx.type}</div>
          <div class="muted small">${new Date(tx.created_at || tx.createdAt || Date.now()).toLocaleString()}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:800;color:${(tx.type==='deposit' || Number(tx.amount)>0) ? '#00a944' : '#ff3b30'}">
            ${(tx.type==='deposit' || Number(tx.amount)>0) ? '+' : '-'} ₦${Number(tx.amount||0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}
          </div>
          <div class="muted small">${tx.status || 'Successful'}</div>
        </div>
      </div>`;
      historyList.appendChild(row);
    });
  }
  openModal(modalHistory);
}

// --- Notifications (try /api/notifications else fallback)
async function updateNotifBadge(){
  try{
    const res = await fetch(`${API}/notifications`, { headers: { Authorization: 'Bearer ' + token }});
    if(res.ok){
      const data = await res.json();
      if(data && Number(data.unreadCount) > 0){
        notifCountEl.style.display = 'inline-block';
        notifCountEl.textContent = data.unreadCount;
        return;
      }
    }
  }catch(e){
    // ignore and fallback
  }
  // fallback: count txs in last 24h
  const now = Date.now();
  const recent = (txCache || []).filter(tx => now - new Date(tx.created_at || tx.createdAt || now).getTime() < (24*3600*1000));
  if(recent.length) { notifCountEl.style.display='inline-block'; notifCountEl.textContent = recent.length; }
  else notifCountEl.style.display = 'none';
}
function openNotificationsModal(){ alert('Open notifications - implement /api/notifications for full experience'); }

// --- Today sales (simple derivation)
function updateTodaySales(){
  try{
    const now = Date.now();
    const today = (txCache || []).filter(tx => now - new Date(tx.created_at || tx.createdAt || now).getTime() < (24*3600*1000));
    const sum = today.reduce((s,t) => s + Number(t.amount || 0), 0);
    todaySalesEl.textContent = '₦' + sum.toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 });
  }catch(e){ todaySalesEl.textContent = '₦0.00'; }
}

// --- Quick actions (To OPay, To Bank, Withdraw)
function quickHandler(e){
  const action = e.currentTarget.dataset.action;
  if(action === 'to-opay'){
    const recipient = prompt('Recipient email or phone:');
    const amount = Number(prompt('Amount (₦):'));
    if(!recipient || !amount) return alert('Complete fields');
    callServicePay({ type:'Transfer', description:'To OPay: '+recipient, amount, recipient });
  } else if(action === 'to-bank'){
    const bank = prompt('Bank account (format: BankName - AccountNumber):');
    const amount = Number(prompt('Amount (₦):'));
    if(!bank || !amount) return alert('Complete fields');
    callServicePay({ type:'Bank', description: bank, amount });
  } else if(action === 'withdraw'){
    const amount = Number(prompt('Amount to withdraw (₦):'));
    if(!amount) return alert('Enter amount');
    callServicePay({ type:'Withdraw', description:'Withdraw to cash', amount });
  }
}

// --- Service modal builder
function svcClickHandler(e){
  const service = e.currentTarget.dataset.service;
  openServiceModal(service);
}
function openServiceModal(service){
  svcTitle.textContent = service;
  svcBody.innerHTML = '';
  // build service-specific form
  if(service === 'Airtime'){
    svcBody.innerHTML = `
      <label>Network</label>
      <select id="input_network"><option value="">Select</option><option>MTN</option><option>GLO</option><option>AIRTEL</option><option>9MOBILE</option></select>
      <label>Phone number</label>
      <input id="input_phone" placeholder="080..." />
      <label>Amount</label>
      <input id="input_amount" type="number" placeholder="Amount (₦)" />
    `;
  } else if(service === 'Data'){
    svcBody.innerHTML = `
      <label>Network</label>
      <select id="input_network"><option value="">Select</option><option>MTN</option><option>GLO</option><option>AIRTEL</option><option>9MOBILE</option></select>
      <label>Plan Type</label>
      <select id="input_plansel"><option value="">Select</option><option value="Daily">Daily</option><option value="Weekly">Weekly</option><option value="Monthly">Monthly</option></select>
      <label>Plan</label>
      <select id="input_plan"><option value="">Choose plan</option></select>
      <label>Phone number</label>
      <input id="input_phone" placeholder="080..." />
      <label>Amount</label>
      <input id="input_amount" type="number" placeholder="Amount (₦)" />
    `;
    // plan data
    const plans = {
      MTN: { Daily:[{n:'100MB - ₦50',v:50},{n:'500MB - ₦200',v:200}], Weekly:[{n:'1GB - ₦500',v:500},{n:'2GB - ₦900',v:900}], Monthly:[{n:'5GB - ₦2500',v:2500},{n:'10GB - ₦4500',v:4500}]},
      GLO: { Daily:[{n:'100MB - ₦40',v:40},{n:'500MB - ₦180',v:180}], Weekly:[{n:'1GB - ₦450',v:450},{n:'2GB - ₦850',v:850}], Monthly:[{n:'5GB - ₦2400',v:2400},{n:'10GB - ₦4300',v:4300}]},
      AIRTEL: { Daily:[{n:'100MB - ₦45',v:45},{n:'500MB - ₦190',v:190}], Weekly:[{n:'1GB - ₦480',v:480},{n:'2GB - ₦870',v:870}], Monthly:[{n:'5GB - ₦2450',v:2450},{n:'10GB - ₦4400',v:4400}]},
      '9MOBILE': { Daily:[{n:'100MB - ₦50',v:50},{n:'500MB - ₦200',v:200}], Weekly:[{n:'1GB - ₦500',v:500},{n:'2GB - ₦900',v:900}], Monthly:[{n:'5GB - ₦2500',v:2500},{n:'10GB - ₦4500',v:4500}]}
    };
    // attach change handlers after modal opens (use small timeout)
    setTimeout(()=>{
      const net = document.getElementById('input_network');
      const type = document.getElementById('input_plansel');
      const planSelect = document.getElementById('input_plan');
      const amountInput = document.getElementById('input_amount');
      function updatePlans(){
        planSelect.innerHTML = '<option value="">Choose plan</option>';
        const n = net.value, t = type.value;
        if(!n || !t || !plans[n]) return;
        plans[n][t].forEach(p => {
          const o = document.createElement('option'); o.value = p.v; o.text = p.n; planSelect.add(o);
        });
      }
      net.addEventListener('change', updatePlans);
      type.addEventListener('change', updatePlans);
      planSelect.addEventListener('change', ()=> amountInput.value = planSelect.value || '');
    }, 30);
  } else if(service === 'Electricity'){
    svcBody.innerHTML = `
      <label>Provider (DISCO)</label>
      <select id="input_disco"><option value="">Select</option><option>Aba Power</option><option>EEDC</option><option>Ikeja Electric</option><option>Abuja Disco</option></select>
      <label>Meter Type</label>
      <select id="input_meter_type"><option value="">Select</option><option>Prepaid</option><option>Postpaid</option></select>
      <label>Meter Number</label>
      <input id="input_meter" placeholder="e.g. 1234567890" />
      <label>Amount</label>
      <input id="input_amount" type="number" placeholder="Amount (₦)" />
    `;
  } else if(service === 'TV'){
    svcBody.innerHTML = `
      <label>Provider</label>
      <select id="input_tv"><option value="">Select</option><option>DSTV</option><option>GOTV</option><option>Startimes</option></select>
      <label>Smartcard/IUC</label>
      <input id="input_smart" placeholder="Smartcard number" />
      <label>Package Amount</label>
      <input id="input_amount" type="number" placeholder="Amount (₦)" />
    `;
  } else if(service === 'Flight'){
    svcBody.innerHTML = `
      <label>Passenger Full Name</label>
      <input id="input_name" placeholder="Full name" />
      <label>Route</label>
      <input id="input_route" placeholder="From - To" />
      <label>Amount</label>
      <input id="input_amount" type="number" placeholder="Amount (₦)" />
    `;
  }
  // Transfer/Bank/Withdraw handled by quick actions
  openModal(modalService);
  // set submit handler
  svcSubmit.onclick = async function(){
    // build payload depending on svcTitle
    const s = svcTitle.textContent;
    let payload = null;
    if(s === 'Airtime'){
      const net = document.getElementById('input_network').value;
      const phone = document.getElementById('input_phone').value.trim();
      const amount = Number(document.getElementById('input_amount').value);
      if(!net || !phone || !amount) return alert('Complete all fields');
      payload = { type: 'Airtime', description: `${net} Airtime | ${phone}`, amount, phone, network: net };
    } else if(s === 'Data'){
      const net = document.getElementById('input_network').value;
      const planType = document.getElementById('input_plansel').value;
      const planVal = Number(document.getElementById('input_plan').value);
      const phone = document.getElementById('input_phone').value.trim();
      if(!net || !planType || !planVal || !phone) return alert('Complete all fields');
      payload = { type: 'Data', description: `${net} ${planType}`, amount: planVal, phone, network: net, planType };
    } else if(s === 'Electricity'){
      const disco = document.getElementById('input_disco').value;
      const mtype = document.getElementById('input_meter_type').value;
      const meter = document.getElementById('input_meter').value.trim();
      const amount = Number(document.getElementById('input_amount').value);
      if(!disco || !mtype || !meter || !amount) return alert('Complete all fields');
      payload = { type: 'Electricity', description: `${disco} ${mtype}`, amount, meterNumber: meter, disco: disco, meterType: mtype };
    } else if(s === 'TV'){
      const prov = document.getElementById('input_tv').value;
      const smart = document.getElementById('input_smart').value.trim();
      const amount = Number(document.getElementById('input_amount').value);
      if(!prov || !smart || !amount) return alert('Complete all fields');
      payload = { type: 'TV', description: prov, amount, smartCard: smart, provider: prov };
    } else if(s === 'Flight'){
      const name = document.getElementById('input_name').value.trim();
      const route = document.getElementById('input_route').value.trim();
      const amount = Number(document.getElementById('input_amount').value);
      if(!name || !route || !amount) return alert('Complete all fields');
      payload = { type: 'Flight', description: `${route} | ${name}`, amount, passenger: name, route };
    } else {
      return alert('Unknown service');
    }

    await callServicePay(payload);
    closeAllModals();
  };
}

// --- call service/pay endpoint
async function callServicePay(payload){
  try{
    const res = await fetch(`${API}/services/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(data && data.success){
      alert(data.message || 'Payment successful');
      await fetchTransactions();
      await fetchBalance();
    } else {
      alert(data.message || data.error || 'Payment failed');
    }
  }catch(err){
    console.error('service pay err', err);
    alert('Network or server error');
  }
}

// --- Helpers: open/close modal
function openModal(el){
  if(!el) return;
  el.setAttribute('aria-hidden','false');
}
function closeModal(el){
  if(!el) return;
  el.setAttribute('aria-hidden','true');
}
function closeAllModals(){ document.querySelectorAll('.modal').forEach(m=>m.setAttribute('aria-hidden','true')); }

// --- Notifications modal placeholder
function openNotificationsModal(){ alert('Notifications placeholder — implement /api/notifications to show list'); }

// start app if dashboard loaded
if(typeof init === 'function') init();










