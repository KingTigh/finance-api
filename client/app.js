const API = window.location.origin.includes('localhost') ? 'http://localhost:4000' : 'https://your-render-app.onrender.com';
let token = localStorage.token||'';
const auth = ()=> ({'Authorization':`Bearer ${token}`,'Content-Type':'application/json'});
document.getElementById('theme-toggle').onclick = ()=>{
  const d = document.body.classList.toggle('dark');
  localStorage.theme = d?'dark':'light';
  document.body.setAttribute('data-theme', localStorage.theme);
};
if(localStorage.theme==='dark') document.body.setAttribute('data-theme','dark');

/* ---------- Firebase ---------- */
const firebaseConfig = {"apiKey":"AIzaSyD6Q5xxxxxxxxxxxxxxxx","authDomain":"finance-xxxx.firebaseapp.com","projectId":"finance-xxxx"};
firebase.initializeApp(firebaseConfig);
const provider = new firebase.auth.GoogleAuthProvider();
document.getElementById('login').onclick = ()=>{
  firebase.auth().signInWithPopup(provider).then(async res=>{
    const idToken = await res.user.getIdToken();
    const r = await fetch(`${API}/auth/firebase`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})});
    const {token:jwt} = await r.json();
    token = jwt; localStorage.token = token;
    document.getElementById('login').hidden = true;
    document.getElementById('logout').hidden = false;
    load();
  });
};
document.getElementById('logout').onclick = ()=>{
  token=''; localStorage.clear(); location.reload();
};
if(token){ document.getElementById('login').hidden = true; document.getElementById('logout').hidden = false; }

/* ---------- CRUD ---------- */
async function load(){
  const txs = await fetch(`${API}/api/transactions`,{headers:auth()}).then(r=>r.json());
  render(txs);
}
document.getElementById('form').onsubmit = async (e)=>{
  e.preventDefault();
  const doc = {
    desc: document.getElementById('desc').value,
    amount: parseFloat(document.getElementById('amt').value),
    type: document.getElementById('type').value,
    category: document.getElementById('cat').value,
    date: document.getElementById('date').value
  };
  await fetch(`${API}/api/transactions`,{method:'POST',headers:auth(),body:JSON.stringify(doc)});
  e.target.reset(); document.getElementById('date').valueAsDate = new Date();
  load();
};
async function del(id){
  await fetch(`${API}/api/transactions/${id}`,{method:'DELETE',headers:auth()});
  load();
}
/* ---------- Render ---------- */
function render(txs){
  let inc=0, exp=0;
  const tbody = document.querySelector('tbody');
  tbody.innerHTML = '';
  txs.forEach(tx=>{
    if(tx.type==='income') inc+=tx.amount; else exp+=tx.amount;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${tx.date}</td><td>${tx.desc}</td><td>${tx.category}</td><td class="amount ${tx.type}">${tx.amount}</td><td><button onclick="del('${tx._id}')">Del</button></td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('inc').textContent = `$${inc.toFixed(2)}`;
  document.getElementById('exp').textContent = `$${exp.toFixed(2)}`;
  document.getElementById('bal').textContent = `$${(inc-exp).toFixed(2)}`;
  /* chart */
  const cat = {};
  txs.filter(t=>t.type==='expense').forEach(t=> cat[t.category]=(cat[t.category]||0)+t.amount);
  const ctx = document.getElementById('chart').getContext('2d');
  if(window._chart) window._chart.destroy();
  window._chart = new Chart(ctx,{type:'doughnut',data:{labels:Object.keys(cat),datasets:[{data:Object.values(cat)}]}});
}
document.getElementById('csv').onclick = ()=>{
  const rows = [['Date','Desc','Cat','Type','Amount']];
  fetch(`${API}/api/transactions`,{headers:auth()}).then(r=>r.json()).then(txs=>{
    txs.forEach(t=>rows.push([t.date,t.desc,t.category,t.type,t.amount]));
    const blob = new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'finance.csv'});
    a.click();
  });
};
/* ---------- SW ---------- */
navigator.serviceWorker.register('sw.js');
load();
