/* A2 Key digital mock-test player. Needs window.TEST (unit data) and optional window.SITE_CONFIG. */
(function(){
const T = window.TEST;
const CFG = window.SITE_CONFIG || {};
const LS = 'kethub-' + T.id;
const store = { get(){ try{ return JSON.parse(localStorage.getItem(LS)||'null'); }catch(e){ return null; } },
  set(v){ try{ localStorage.setItem(LS, JSON.stringify(v)); }catch(e){} }, clear(){ try{ localStorage.removeItem(LS); }catch(e){} } };

// Build page list: each "page" = one navigable screen
const pages = [];
T.parts.forEach(p => {
  if (p.type === 'ocloze') pages.push({ part: p, nums: p.items.map(i => i.n) });
  else if (p.type === 'write6' || p.type === 'write7') pages.push({ part: p, nums: [p.n] });
  else p.items.forEach(it => pages.push({ part: p, item: it, nums: [it.n] }));
});
const allNums = pages.flatMap(pg => pg.nums);

let S = store.get() || { stage: 'start', name: '', answers: {}, flags: {}, page: 0, left: T.minutes * 60, fs: 17 };
let tick = null;
const save = () => store.set(S);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const words = s => (s || '').trim().split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
const answered = n => { const v = S.answers[n]; return v !== undefined && String(v).trim() !== ''; };
const app = document.getElementById('app');
document.documentElement.style.setProperty('--fs', S.fs + 'px');

function fmt(sec){ const m = Math.floor(sec / 60), s = sec % 60; return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }

function render(){
  if (S.stage === 'start') return renderStart();
  if (S.stage === 'results') return renderResults();
  renderTest();
}

/* ---------- start ---------- */
function renderStart(){
  const w = T.words || [];
  app.innerHTML = `<div class="screen"><div class="card">
    <a class="back" href="index.html">← All tests</a><div class="partlabel">${esc(T.unitName)} · ${esc(T.theme)}</div>
    <h1>A2 Key Reading &amp; Writing</h1>
    <p style="color:var(--muted);margin:4px 0 0">A2 Key 閱讀與寫作 電腦模擬測驗</p>
    <div class="meta">
      <div><small>Time</small><strong>60 minutes</strong></div>
      <div><small>Parts</small><strong>7 parts · 32 questions</strong></div>
      <div><small>Reading</small><strong>Parts 1–5 · 30 marks</strong></div>
      <div><small>Writing</small><strong>Parts 6–7</strong></div>
    </div>
    <p style="margin:0">How it works: read the text on the left, answer on the right. Use the numbers at the bottom to move between questions. Flag a question to come back to it. Your answers save automatically in this browser.</p>
    <div class="wordchips">${w.map(x => `<span>${x}</span>`).join('')}</div>
    <div class="field"><label for="cand">Your name 你的名字</label><input id="cand" autocomplete="name" value="${esc(S.name)}" placeholder="e.g. Henry Wang"><small id="nameErr" class="err" hidden>Please type your name first. 請先輸入名字。</small></div>
    <div class="row"><button class="primary" id="go">Start test</button></div>
  </div></div>`;
  document.getElementById('go').onclick = () => { const nm = document.getElementById('cand').value.trim(); if (!nm){ document.getElementById('nameErr').hidden = false; document.getElementById('cand').focus(); return; } S.name = nm; S.stage = 'test'; save(); startTimer(); render(); };
}

/* ---------- test ---------- */
function startTimer(){
  clearInterval(tick);
  tick = setInterval(() => {
    if (S.stage !== 'test') return clearInterval(tick);
    S.left = Math.max(0, S.left - 1);
    const el = document.getElementById('timer');
    if (el){ el.textContent = fmt(S.left); el.className = 'timer' + (S.left <= 300 ? ' crit' : S.left <= 600 ? ' warn' : ''); }
    if (S.left % 5 === 0) save();
    if (S.left === 0){ S.stage = 'results'; save(); submitResult(); render(); }
  }, 1000);
}

function leftPane(pg){
  const p = pg.part, it = pg.item;
  const head = `<div class="partlabel">${p.name}</div><div class="instr">${esc(p.instr)}<span class="zh">${esc(p.zh)}</span></div>`;
  if (p.type === 'notice'){
    const lines = it.text.split('\n');
    const isMsg = /Note|Email|Text message/.test(it.kind);
    return head + `<div class="notice ${isMsg ? 'msg' : ''}"><div class="kind">${esc(it.kind)}</div>${lines.map((l, i) => `<p class="${!isMsg && i === 0 ? 'head' : ''}">${esc(l)}</p>`).join('')}</div>`;
  }
  if (p.type === 'match') return head + `<div class="textbox"><h3>${esc(p.title)}</h3>${p.people.map(x => `<div class="person"><b>${x.k}&nbsp;&nbsp;${esc(x.name)}</b><p>${esc(x.text)}</p></div>`).join('')}</div>`;
  if (p.type === 'long') return head + `<div class="textbox"><h3>${esc(p.title)}</h3>${p.paras.map(x => `<p>${esc(x)}</p>`).join('')}</div>`;
  if (p.type === 'mcloze'){
    const txt = esc(p.text).replace(/\[(\d+)\]/g, (m, n) => {
      const v = S.answers[n]; const it2 = p.items.find(i => i.n == n);
      const shown = v ? it2.opts['ABC'.indexOf(v)] : '';
      return `<span class="gapmark ${n == it.n ? 'cur' : ''}"><button data-goto="${n}" aria-label="Go to question ${n}">(${n}) ${shown ? esc(shown) : '______'}</button></span>`;
    });
    return head + `<div class="textbox"><h3>${esc(p.title)}</h3><p class="cloze">${txt}</p></div>`;
  }
  if (p.type === 'ocloze'){
    const body = esc(p.text).replace(/\[(\d+)\]/g, (m, n) => `<span class="gn">${n}</span><input id="g${n}" data-n="${n}" aria-label="Question ${n}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(S.answers[n] || '')}">`).split('\n').map(l => l === '---' ? '<hr class="mailsep">' : /^From:/.test(l) ? `<div class="email-head">${l}</div>` : `<p class="cloze" style="margin:0 0 6px">${l}</p>`).join('');
    return head + `<div class="textbox">${body}</div>`;
  }
  if (p.type === 'write6') return `<div class="partlabel">${p.name} · Question ${p.n}</div><div class="instr">Writing<span class="zh">${esc(p.zh)}</span></div>
    <div class="task"><p style="margin:0 0 10px">${esc(p.instr)}</p><b>${esc(p.bulletLead)}</b><ul>${p.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul><p style="margin:12px 0 0"><b>Write ${p.min} words or more.</b></p></div>`;
  if (p.type === 'write7') return `<div class="partlabel">${p.name} · Question ${p.n}</div><div class="instr">${esc(p.instr)}<span class="zh">${esc(p.zh)}</span></div>
    <div class="pics">${T.pictures.map((s, i) => `<figure>${s.replace('<svg ', `<svg role="img" aria-label="Picture ${i + 1}" `)}<figcaption>Picture ${i + 1}</figcaption></figure>`).join('')}</div>
    <p style="margin-top:14px"><b>Write ${p.min} words or more.</b></p>`;
}

function optionList(n, opts){
  return `<div class="opts" role="radiogroup" aria-label="Question ${n}">${opts.map((o, i) => { const L = 'ABC'[i]; const sel = S.answers[n] === L;
    return `<label class="opt ${sel ? 'sel' : ''}"><input type="radio" id="q${n}${L}" name="q${n}" value="${L}" ${sel ? 'checked' : ''}><span class="l">${L}</span><span>${esc(o)}</span></label>`; }).join('')}</div>`;
}

function rightPane(pg){
  const p = pg.part, it = pg.item;
  const flag = n => `<button class="flagbtn" data-flag="${n}" aria-pressed="${!!S.flags[n]}">⚑ ${S.flags[n] ? 'Flagged for review' : 'Flag for review'}</button>`;
  if (p.type === 'notice') return `<div class="qtext"><span class="qnum">${it.n}</span><span>${esc(it.q || 'What does it say?')}</span></div>${optionList(it.n, it.opts)}${flag(it.n)}`;
  if (p.type === 'match') return `<div class="qtext"><span class="qnum">${it.n}</span><span>${esc(it.q)}</span></div>${optionList(it.n, p.people.map(x => x.name))}${flag(it.n)}`;
  if (p.type === 'long') return `<div class="qtext"><span class="qnum">${it.n}</span><span>${esc(it.q)}</span></div>${optionList(it.n, it.opts)}${flag(it.n)}`;
  if (p.type === 'mcloze') return `<div class="qtext"><span class="qnum">${it.n}</span><span>Choose the word for gap ${it.n}.</span></div>${optionList(it.n, it.opts)}${flag(it.n)}`;
  if (p.type === 'write6' || p.type === 'write7'){
    const v = S.answers[p.n] || ''; const c = words(v);
    return `<label for="w${p.n}" class="qtext"><span class="qnum">${p.n}</span><span>Write your answer here.</span></label>
      <textarea id="w${p.n}" data-n="${p.n}" spellcheck="false" placeholder="${p.type === 'write6' ? 'Hi Alex,' : 'Start your story here…'}">${esc(v)}</textarea>
      <div class="wc"><span>Minimum ${p.min} words</span><span>Words: <b id="wc" class="${c >= p.min ? 'ok' : ''}">${c}</b></span></div>${flag(p.n)}`;
  }
  return '';
}

function renderTest(){
  const pg = pages[S.page]; const p = pg.part; const single = p.type === 'ocloze';
  const groups = T.parts.map(pt => { const nums = pages.filter(x => x.part === pt).flatMap(x => x.nums);
    return `<div class="pgroup"><span class="pl">${pt.name.replace('Part ', 'P')}</span>${nums.map(n => `<button class="qb ${answered(n) ? 'done' : ''} ${pg.nums.includes(n) ? 'cur' : ''} ${S.flags[n] ? 'flag' : ''}" data-goto="${n}" aria-label="Question ${n}${answered(n) ? ', answered' : ''}${S.flags[n] ? ', flagged' : ''}">${n}</button>`).join('')}</div>`; }).join('');
  app.innerHTML = `
  <header class="top">
    <div class="brand"><b>A2 Key · Reading &amp; Writing</b><span>${esc(S.name)} · ${esc(T.unitName)}</span></div>
    <button class="tbtn" id="fsm" aria-label="Smaller text">A−</button><button class="tbtn" id="fsp" aria-label="Larger text">A+</button>
    <div class="timer" id="timer" aria-live="off" title="Time remaining">${fmt(S.left)}</div>
    <button class="primary" id="finish">Finish test</button>
  </header>
  <main class="stage ${single ? 'single' : ''}">
    <section class="pane left" id="lp"><div class="inner">${leftPane(pg)}${single ? `<div>${pg.nums.map(n => `<button class="flagbtn" data-flag="${n}" aria-pressed="${!!S.flags[n]}" style="margin-right:6px">⚑ ${n}</button>`).join('')}</div>` : ''}</div></section>
    ${single ? '' : `<section class="pane right" id="rp"><div class="inner">${rightPane(pg)}</div></section>`}
  </main>
  <nav class="nav" aria-label="Question navigation">
    <button class="arrow" id="prev" aria-label="Previous" ${S.page === 0 ? 'disabled' : ''}>←</button>
    <div class="navscroll">${groups}</div>
    <button class="arrow" id="next" aria-label="Next" ${S.page === pages.length - 1 ? 'disabled' : ''}>→</button>
  </nav>`;
  const cur = app.querySelector('.qb.cur'); if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
  const t = document.getElementById('timer'); t.className = 'timer' + (S.left <= 300 ? ' crit' : S.left <= 600 ? ' warn' : '');
  bind();
}

function go(i){ S.page = Math.max(0, Math.min(pages.length - 1, i)); save(); render(); }
function goNum(n){ go(pages.findIndex(pg => pg.nums.includes(+n))); }

function bind(){
  document.getElementById('prev').onclick = () => go(S.page - 1);
  document.getElementById('next').onclick = () => go(S.page + 1);
  app.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => goNum(b.dataset.goto));
  app.querySelectorAll('[data-flag]').forEach(b => b.onclick = () => { const n = b.dataset.flag; S.flags[n] = !S.flags[n]; save(); render(); });
  app.querySelectorAll('input[type=radio]').forEach(r => r.onchange = () => { S.answers[r.name.slice(1)] = r.value; save(); render(); });
  app.querySelectorAll('.cloze input').forEach(inp => {
    inp.oninput = () => { S.answers[inp.dataset.n] = inp.value; save(); const b = app.querySelector(`.qb[data-goto="${inp.dataset.n}"]`); if (b) b.classList.toggle('done', inp.value.trim() !== ''); };
  });
  app.querySelectorAll('textarea').forEach(ta => {
    ta.oninput = () => { S.answers[ta.dataset.n] = ta.value; save(); const c = words(ta.value), el = document.getElementById('wc'), min = pages[S.page].part.min; el.textContent = c; el.className = c >= min ? 'ok' : '';
      const b = app.querySelector(`.qb[data-goto="${ta.dataset.n}"]`); if (b) b.classList.toggle('done', ta.value.trim() !== ''); };
  });
  document.getElementById('fsm').onclick = () => setFs(-1);
  document.getElementById('fsp').onclick = () => setFs(1);
  document.getElementById('finish').onclick = confirmFinish;
}
function setFs(d){ S.fs = Math.max(14, Math.min(22, S.fs + d)); document.documentElement.style.setProperty('--fs', S.fs + 'px'); save(); }

function confirmFinish(){
  const un = allNums.filter(n => !answered(n)), fl = allNums.filter(n => S.flags[n]);
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="card" role="dialog" aria-modal="true" aria-labelledby="mt"><h2 id="mt" style="font-size:1.25rem">Finish the test?</h2>
    <p>${un.length ? `You have <b>${un.length}</b> unanswered question${un.length > 1 ? 's' : ''}: ${un.join(', ')}.` : 'You have answered every question.'}</p>
    ${fl.length ? `<p>Flagged for review: ${fl.join(', ')}.</p>` : ''}
    <p style="color:var(--muted);margin:0">You cannot change your answers after you finish.</p>
    <div class="row"><button class="primary" id="yes">Finish and see results</button><button class="tbtn" id="no">Keep working</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector('#no').onclick = () => m.remove();
  m.querySelector('#yes').onclick = () => { m.remove(); S.stage = 'results'; clearInterval(tick); save(); submitResult(); render(); };
  m.querySelector('#no').focus();
}

/* ---------- results ---------- */
function isRight(p, it){
  const v = (S.answers[it.n] || '').trim().toLowerCase();
  return Array.isArray(it.a) ? it.a.includes(v) : v === it.a.toLowerCase();
}
function shownAns(p, it, v){
  if (!v) return '—';
  if (p.type === 'match') return v + ' ' + (p.people.find(x => x.k === v) || {}).name;
  if (p.opts || it.opts) return v + ' ' + (it.opts ? it.opts['ABC'.indexOf(v)] : '');
  return v;
}
function renderResults(){
  const reading = T.parts.filter(p => p.items);
  let total = 0; const per = reading.map(p => { const c = p.items.filter(it => isRight(p, it)).length; total += c; return { p, c, n: p.items.length }; });
  const rows = reading.flatMap(p => p.items.map(it => { const ok = isRight(p, it); const v = S.answers[it.n];
    const correct = Array.isArray(it.a) ? it.a.join(' / ') : shownAns(p, it, it.a);
    return `<tr><td>${it.n}</td><td>${p.name.replace('Part ','P')}</td><td>${esc(shownAns(p, it, v))}</td><td>${esc(correct)}</td><td><span class="pill ${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'}</span></td></tr>`; })).join('');
  const w6 = T.parts[5], w7 = T.parts[6];
  const wsec = (p, checks) => { const v = S.answers[p.n] || ''; const c = words(v);
    return `<h3 style="margin-top:22px">${p.name} · ${c} words <span class="pill ${c >= p.min ? 'ok' : 'no'}">${c >= p.min ? 'length OK' : 'under ' + p.min}</span></h3>
    <div class="wbox">${v.trim() ? esc(v) : '<i>No answer</i>'}</div>
    <div class="check">${checks.map((t, i) => `<label><input type="checkbox" id="c${p.n}_${i}"> ${esc(t)}</label>`).join('')}</div>
    <details><summary>Model answer</summary><div class="wbox">${esc(p.model)}</div></details>`; };
  app.innerHTML = `<div class="screen"><div class="card">
    <div class="partlabel">Results · ${esc(S.name)}</div>
    <h1>Reading score</h1>
    <div class="score">${total} / ${per.reduce((a, x) => a + x.n, 0)}</div>
    <div id="sendStatus" class="send">${sendMsg()}</div>
    <p style="color:var(--muted);margin:0">Time used: ${fmt(T.minutes * 60 - S.left)}. Writing (Parts 6–7) is marked by your teacher.</p>
    <div class="bars">${per.map(x => `<div class="bar"><span>${x.p.name}</span><span class="t"><i style="width:${Math.round(100 * x.c / x.n)}%"></i></span><span>${x.c} / ${x.n}</span></div>`).join('')}</div>
    <h2 style="font-size:1.15rem;margin-top:10px">Check your answers</h2>
    <div class="tablewrap"><table class="rev"><thead><tr><th>Q</th><th>Part</th><th>Your answer</th><th>Correct</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <h2 style="font-size:1.15rem;margin-top:26px">Writing self-check</h2>
    ${wsec(w6, ['I told Alex where I am going.', 'I said who is going with me.', 'I said what I will take.', 'I started with a greeting and ended politely.'])}
    ${wsec(w7, ['I wrote about Picture 1.', 'I wrote about Picture 2.', 'I wrote about Picture 3.', 'I used past tense and First / Then / Finally.', 'I used at least three of this week’s words.'])}
    <div class="row"><button class="primary" id="again">Start again</button><a class="tbtn" href="index.html">All tests</a></div>
  </div></div>`;
  const rs = document.getElementById('resend'); if (rs) rs.onclick = () => { S.submitted = false; submitResult(); };
  document.getElementById('again').onclick = () => { store.clear(); S = { stage: 'start', name: S.name, answers: {}, flags: {}, page: 0, left: T.minutes * 60, fs: S.fs }; render(); };
}

/* ---------- send reading result to the teacher's Google Sheet ---------- */
function readingSummary(){
  const wrong = []; let right = 0, n = 0;
  T.parts.filter(p => p.items).forEach(p => p.items.forEach(it => { n++; if (isRight(p, it)) right++; else wrong.push(it.n); }));
  return { right, n, wrong };
}
function sendMsg(){
  const s = S.sendStatus;
  if (s === 'sent') return '✓ Your reading result was sent to your teacher. 成績已送出。';
  if (s === 'sending') return 'Sending your result… 傳送中…';
  if (s === 'failed') return 'Your result could not be sent. Check the internet, then <button class="tbtn" id="resend">Send again</button>';
  if (s === 'notset') return 'Practice mode: results are not being collected.';
  return '';
}
function updSend(){ const el = document.getElementById('sendStatus'); if (el){ el.innerHTML = sendMsg(); const rs = document.getElementById('resend'); if (rs) rs.onclick = () => { S.submitted = false; submitResult(); }; } }
function submitResult(){
  if (S.submitted) return;
  S.submitted = true;
  if (!CFG.sheetUrl){ S.sendStatus = 'notset'; save(); return; }
  const r = readingSummary();
  const payload = { studentName: S.name, unitName: T.unitName, correctPercentageforReading: (Math.round(1000 * r.right / r.n) / 10) + '%', mistakeQuestionNumber: r.wrong.length ? r.wrong.join(', ') : 'none', score: r.right + '/' + r.n };
  S.sendStatus = 'sending'; save(); updSend();
  fetch(CFG.sheetUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
    .then(() => { S.sendStatus = 'sent'; save(); updSend(); })
    .catch(() => { S.sendStatus = 'failed'; S.submitted = false; save(); updSend(); });
}

render();
if (S.stage === 'test') startTimer();
})();
