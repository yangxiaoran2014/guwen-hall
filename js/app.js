/* ============================================================
   古文古诗学习馆 —— 交互层（书页版）
   ============================================================ */
(function () {
  'use strict';

  const D = window.DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------------- 工具 ---------------- */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const stripPunct = (s) => String(s).replace(/[\s，。！？；：、"“”‘’（）《》〈〉·—…,.!?;:'"()\[\]{}<>\/\\|]/g, '');

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 1900);
  }

  /* 音效 */
  let actx = null;
  function beep(kind) {
    if (!S.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.connect(g); g.connect(actx.destination);
      const now = actx.currentTime;
      if (kind === 'ok') { o.type = 'sine'; o.frequency.setValueAtTime(660, now); o.frequency.exponentialRampToValueAtTime(990, now + .12); }
      else if (kind === 'no') { o.type = 'triangle'; o.frequency.setValueAtTime(320, now); o.frequency.exponentialRampToValueAtTime(180, now + .18); }
      else { o.type = 'sine'; o.frequency.setValueAtTime(520, now); }
      g.gain.setValueAtTime(.0001, now);
      g.gain.exponentialRampToValueAtTime(.07, now + .012);
      g.gain.exponentialRampToValueAtTime(.0001, now + .26);
      o.start(now); o.stop(now + .3);
    } catch (e) { /* 忽略 */ }
  }

  /* 朗读 */
  function speak(text, rate) {
    if (!('speechSynthesis' in window)) { toast('当前浏览器不支持语音朗读'); return; }
    window.speechSynthesis.cancel();
    const clean = String(text).replace(/[「」“”《》（）()]/g, '');
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'zh-CN';
    u.rate = rate || .82;
    u.pitch = 1.02;
    const vs = window.speechSynthesis.getVoices().filter((v) => /zh/i.test(v.lang));
    if (vs.length) u.voice = vs[0];
    window.speechSynthesis.speak(u);
    toast('朗读中…');
  }

  /* ---------------- 本地存储 ---------------- */
  const KEY = 'guwen-hall-v1';
  const blankState = () => ({
    version: 1,
    module: {},
    card: {},
    qa: {},
    wrong: [],
    stats: { correct: 0, wrong: 0, days: {}, streak: 0, lastDay: '' },
    settings: { sound: true, theme: 'light' },
    visited: [],
    last: null
  });
  let S = blankState();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.version === 1) S = Object.assign(blankState(), p, {
          stats: Object.assign(blankState().stats, p.stats || {}),
          settings: Object.assign(blankState().settings, p.settings || {})
        });
      }
    } catch (e) { /* 忽略 */ }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 忽略 */ }
  }

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  function markStudy() {
    const t = todayKey();
    if (S.stats.lastDay === t) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    S.stats.streak = S.stats.lastDay === yk ? (S.stats.streak || 0) + 1 : 1;
    S.stats.lastDay = t;
    save();
  }

  function markModule(id, kind) {
    const m = S.module[id] || (S.module[id] = { viewed: 0, correct: 0, wrong: 0 });
    if (kind === 'view') m.viewed = 1;
    if (kind === 'correct') m.correct = (m.correct || 0) + 1;
    if (kind === 'wrong') m.wrong = (m.wrong || 0) + 1;
    S.module[id] = m;
    save();
    markStudy();
  }

  function moduleScore(id) {
    const m = S.module[id];
    if (!m) return 0;
    const correct = m.correct || 0;
    const wrong = (m.wrong || 0) + (m.total || 0);
    const answered = correct + wrong;
    const base = m.viewed ? 25 : 0;
    if (!answered) return base;
    return Math.min(100, base + Math.round(75 * (correct / answered)));
  }

  /* ---------------- 目录 / 路由 ---------------- */
  const TOC = () => [
    { label: '', items: [{ href: '#/home', label: '功课' }] },
    {
      label: '学习路径', items: [
        { href: '#/path', label: '五步概览' },
        ...D.modules.map((m) => ({ href: '#/module/' + m.id, label: m.title, no: m.num }))
      ]
    },
    {
      label: '练习', items: [
        { href: '#/slash', label: '断句练习' },
        { href: '#/qa', label: '自测问答' },
        { href: '#/quiz', label: '随机练习' }
      ]
    },
    {
      label: '诗文', items: [
        { href: '#/poems', label: '诵读' },
        { href: '#/recite', label: '背诵' }
      ]
    },
    { label: '复习', items: [{ href: '#/cards', label: '词义卡' }] },
    { label: '', items: [{ href: '#/progress', label: '记录' }] }
  ];

  const PATH = [
    { no: '一', name: '读', desc: '先解决停顿，把句子读顺。', ids: ['jiezou'] },
    { no: '二', name: '解', desc: '让每个字都有确定的意思。', ids: ['shici', 'xuci'] },
    { no: '三', name: '断', desc: '给长句断句，标出停顿处。', ids: ['duanju'] },
    { no: '四', name: '译', desc: '把文言句译成现代汉语。', ids: ['fanyi'] },
    { no: '五', name: '答', desc: '从原文找依据，写出答案。', ids: ['neirong', 'ganwu'] }
  ];

  let currentRoute = '';

  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    const seg = raw.split('/').filter(Boolean);
    if (!seg.length) return { view: 'home' };
    if (seg[0] === 'module') return { view: 'module', id: seg[1] };
    return { view: seg[0] };
  }

  function routeKey(r) {
    return r.view === 'module' ? 'module/' + r.id : r.view;
  }

  function renderTOC() {
    $('#nav').innerHTML = TOC().map((g) => `
      <div class="toc-group">
        ${g.label ? `<div class="toc-label">${esc(g.label)}</div>` : ''}
        ${g.items.map((it) => `
          <a class="toc-item" href="${it.href}" data-route="${it.href.slice(2)}">
            ${it.no ? `<span class="toc-no">${esc(it.no)}</span>` : ''}<span>${esc(it.label)}</span>
          </a>`).join('')}
      </div>`).join('');
  }

  function setNav(r) {
    const key = routeKey(r);
    $$('.toc-item').forEach((a) => {
      a.classList.toggle('active', a.dataset.route === key);
    });
  }

  /* ---------------- 通用：滚动揭示 ---------------- */
  let io = null;
  function observeReveal(root) {
    if (io) io.disconnect();
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        setTimeout(() => el.classList.add('in'), Number(el.dataset.delay || 0));
        io.unobserve(el);
      });
    }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });

    $$('.step, .poem-line', root).forEach((el, i) => {
      el.dataset.delay = String(Math.min(i * 80, 600));
      io.observe(el);
    });

    clearTimeout(observeReveal._t);
    observeReveal._t = setTimeout(() => {
      $$('.step, .poem-line', root).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('in');
      });
    }, 1200);
  }

  /* ---------------- 片段 ---------------- */
  function pageHead(title, sub) {
    return `<div class="page-head"><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;
  }

  function section(title, body, note) {
    return `<section class="sec">
      <h2>${esc(title)}</h2>
      ${note ? `<p class="sec-note">${esc(note)}</p>` : ''}
      ${body}
    </section>`;
  }

  function progressRow(label, pct, extra) {
    return `<div class="meta-row"><span>${esc(label)}</span><span>${pct}%${extra ? ' · ' + esc(extra) : ''}</span></div>`;
  }

  /* ---------------- 视图：功课 ---------------- */
  function viewHome() {
    const totalAns = Object.values(S.module).reduce((a, m) => a + (m.correct || 0) + (m.wrong || 0) + (m.total || 0), 0);
    const dayIdx = Math.floor(Date.now() / 86400000) % D.poems.length;
    const daily = D.poems[dayIdx];
    const doneModules = D.modules.filter((m) => moduleScore(m.id) >= 100).length;
    const last = (S.last && S.last.hash && S.last.lang !== 'x')
      ? S.last
      : { hash: '#/path', label: '学习路径' };

    return `
    <div class="view">
      ${pageHead('今日功课', '接着上次的地方继续，或者从今日一诗读起。')}

      <div class="list" style="margin-bottom:26px">
        <a class="list-row" href="${esc(last.hash)}">
          <span class="li-no">续</span>
          <span class="li-main">
            <span class="li-title">${esc(last.label)}</span>
            <span class="li-desc">上次停在这里</span>
          </span>
          <span class="li-meta">继续 →</span>
        </a>
      </div>

      <div class="kpi-row">
        <div class="kpi"><b>${S.stats.streak || 0}</b><span>连续天数</span></div>
        <div class="kpi"><b>${totalAns}</b><span>累计作答</span></div>
        <div class="kpi"><b>${S.stats.correct || 0}</b><span>答对</span></div>
        <div class="kpi"><b>${doneModules}/7</b><span>考点完成</span></div>
      </div>

      ${section('今日一诗', `
        <div class="poem-sheet">
          <div class="poem-title">
            <h2>${esc(daily.title)}</h2>
            <div>〔${esc(daily.dynasty)}〕${esc(daily.author)}</div>
          </div>
          <div class="poem-body">${daily.lines.map((l) => `<span class="poem-line">${esc(l)}</span>`).join('')}</div>
          <div class="poem-tools">
            <button class="btn sm" data-act="speak" data-text="${esc(daily.lines.join(''))}">朗读</button>
            <a class="btn sm" href="#/poems">全部诗文</a>
          </div>
        </div>`, '每天一首，先读顺，再看注释与译文。')}

      ${section('从这里开始', `
        <div class="tool-cards">
          <a class="tool-card" href="#/slash">
            <b>断句练习</b>
            <span>长句 ${(D.longDrills || []).length} 道、短句 ${D.slashDrills.length} 道。点字间空隙标停顿。</span>
          </a>
          <a class="tool-card" href="#/qa">
            <b>自测问答</b>
            <span>${(D.qa || []).length} 道简答题。先自己写，再对照要点自评。</span>
          </a>
          <a class="tool-card" href="#/cards">
            <b>词义卡</b>
            <span>${D.cards.length} 张实词虚词卡，按遗忘曲线安排复习。</span>
          </a>
        </div>`)}
    </div>`;
  }

  /* ---------------- 视图：学习路径 ---------------- */
  function viewPath() {
    return `
    <div class="view">
      ${pageHead('学习路径', '七个考点排成五步：读、解、断、译、答。点开任一考点看讲解与练习。')}

      <div class="path-grid">
        ${PATH.map((p) => `
          <div class="path-step">
            <div class="path-no">${p.no}</div>
            <div class="path-name">${p.name}</div>
            <div class="path-desc">${esc(p.desc)}</div>
            <div class="path-mods">
              ${p.ids.map((id) => {
                const m = D.modules.find((x) => x.id === id);
                if (!m) return '';
                return `<a href="#/module/${m.id}"><span>${esc(m.title)}</span><span class="path-pct">${moduleScore(m.id)}%</span></a>`;
              }).join('')}
            </div>
          </div>`).join('')}
      </div>

      <div class="rule"></div>

      ${section('其余练习', `
        <div class="tool-cards">
          <a class="tool-card" href="#/slash"><b>断句练习</b><span>点字间空隙标停顿，检查多断与漏断。</span></a>
          <a class="tool-card" href="#/qa"><b>自测问答</b><span>写答案，对照要点，自评三档。</span></a>
          <a class="tool-card" href="#/quiz"><b>随机练习</b><span>从全部练习里随机抽十道。</span></a>
        </div>`)}
    </div>`;
  }

  /* ---------------- 视图：考点详情 ---------------- */
  function viewModule(id) {
    const m = D.modules.find((x) => x.id === id) || D.modules[0];
    const idx = D.modules.indexOf(m);
    const prev = D.modules[idx - 1], next = D.modules[idx + 1];
    markModule(m.id, 'view');
    S.visited = Array.from(new Set([...(S.visited || []), m.id]));
    save();

    const asks = [];
    if (m.asks.common.length) asks.push(['常见设问', m.asks.common]);
    if (m.asks.neo.length) asks.push(['新型设问', m.asks.neo]);

    const know = m.knowledge;
    let knowHTML = '';
    if (know.type === 'list' || know.type === 'blocks') {
      knowHTML = `<div class="acc">${know.items.map((it, i) => `
        <div class="acc-item ${(know.type === 'blocks' ? i < 2 : i === 0) ? 'open' : ''}">
          <div class="acc-head">${esc(it.k)}</div>
          <div class="acc-body"><p>${esc(it.v)}</p></div>
        </div>`).join('')}</div>`;
    } else if (know.type === 'table') {
      knowHTML = `<div class="tbl-wrap"><table class="t">
        <thead><tr>${know.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${know.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    }

    const formulaHTML = m.formula.map((p, i) => `
      <span class="fpart" data-i="${i}">${esc(p)}</span>
      ${i < m.formula.length - 1 ? '<span class="fop">＋</span>' : ''}`).join('');

    return `
    <div class="view">
      <div class="crumb"><a href="#/path">学习路径</a><span>/</span><span>${esc(m.title)}</span></div>
      ${pageHead(m.title, m.intro)}

      ${m.stem || m.quote ? section('教材母题', `
        ${m.stem ? `<div class="stem">${esc(m.stem)}</div>` : ''}
        ${m.quote ? `<div class="quote">
          <div class="q-text">${m.quoteMarked || esc(m.quote)}</div>
          <div class="q-src">${esc(m.source)}</div>
        </div>` : `<p class="note" style="margin-top:12px">出处：${esc(m.source)}</p>`}
      `) : ''}

      ${section('答题思路', `
        <div class="steps">
          ${m.steps.map((s, i) => `
            <div class="step">
              <div class="step-no">${i + 1}</div>
              <h4 class="step-h"><small>${esc(s.h)}</small>${esc(s.t)}</h4>
              <p class="step-p">${esc(s.d)}</p>
            </div>`).join('')}
        </div>
        <div class="answer">
          <h4>参考答案</h4>
          <p>${esc(m.answer)}</p>
        </div>`)}

      ${section('答题公式与口诀', `
        <div class="formula" id="formula">${formulaHTML}</div>
        <p class="note">${esc(m.formulaText)}</p>
        <div class="mnemo" id="mnemo" title="点击翻面">
          <div class="mnemo-inner">
            <div class="mnemo-face">
              <div>
                <div class="mnemo-code">${esc(m.mnemonic.code)}</div>
                <p class="note" style="margin:8px 0 0">点击翻看拆解 ${esc(m.mnemonic.note)}</p>
              </div>
            </div>
            <div class="mnemo-face mnemo-back">
              <div>
                <div class="mnemo-exp">${m.mnemonic.expand.map((e) => `<span>${esc(e)}</span>`).join('')}</div>
                <p class="note" style="margin:10px 0 0">${esc(m.formulaText)}</p>
              </div>
            </div>
          </div>
        </div>`)}

      ${asks.length ? section('常见设问', asks.map(([k, arr]) => `
        <div style="margin-bottom:14px">
          <span class="tag">${esc(k)}</span>
          <ol style="margin:8px 0 0;padding-left:22px;font-size:13.5px;line-height:1.9">
            ${arr.map((a) => `<li>${esc(a)}</li>`).join('')}
          </ol>
        </div>`).join('')) : ''}

      ${section('必备知识', knowHTML, know.title)}

      ${m.exam ? section(m.exam.title, `<div class="tbl-wrap"><table class="t">
          <thead><tr>${m.exam.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${m.exam.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>`) : ''}

      ${section('练习', `<div id="practice">
        ${m.practice.map((p, i) => questionHTML(p, 'p' + i, i + 1)).join('')}
      </div>`, '做错的题会收进「记录」里的错题本。')}

      <div class="row" style="justify-content:space-between;margin-top:22px">
        ${prev ? `<a class="btn sm" href="#/module/${prev.id}">← ${esc(prev.title)}</a>` : '<span></span>'}
        ${next ? `<a class="btn sm" href="#/module/${next.id}">${esc(next.title)} →</a>` : '<span></span>'}
      </div>
    </div>`;
  }

  /* ---------------- 题目渲染 ---------------- */
  function questionHTML(item, key, no) {
    const id = item._id || key;
    if (item.type === 'choice') {
      return `<div class="q" data-q="${esc(id)}" data-type="choice">
        <div class="q-no">第 ${no} 题</div>
        <div class="q-text">${esc(item.q)}</div>
        <div class="opts">
          ${item.opts.map((o, i) => `<div class="opt" data-i="${i}">
            <span class="opt-key">${'ABCD'[i] || i + 1}</span><span>${esc(o)}</span></div>`).join('')}
        </div>
        <div class="fb"></div>
      </div>`;
    }
    if (item.type === 'blank') {
      return `<div class="q" data-q="${esc(id)}" data-type="blank">
        <div class="q-no">第 ${no} 题</div>
        <div class="q-text">${esc(item.q)}</div>
        <div class="row" style="margin-bottom:12px">
          ${item.words.map((w, i) => `<label class="row" style="gap:6px;font-size:13.5px">
            <span style="color:var(--zhu)">${esc(w)}</span>
            <input class="blank-input" data-i="${i}" placeholder="释义">
          </label>`).join('')}
          <button class="btn sm primary" data-act="check-blank">对答案</button>
        </div>
        <div class="fb"></div>
      </div>`;
    }
    return `<div class="q" data-q="${esc(id)}" data-type="slash">
      <div class="q-no">第 ${no} 题 · ${esc(item.mode || '断句')}</div>
      <div class="q-text">${esc(item.q)}</div>
      ${slashStageHTML(item, Array.from(item.plain).length > 26)}
      <div class="toolbar" style="margin:14px 0 0">
        <button class="btn sm primary" data-act="check-slash">检查断句</button>
        <button class="btn sm" data-act="clear-slash">清空</button>
        <button class="btn sm ghost" data-act="hint-slash">提示</button>
      </div>
      <div class="fb"></div>
    </div>`;
  }

  const PUNCT = /[，。！？；：、）」』”’,.!?;:]/;
  function slashStageHTML(item, long) {
    const chars = Array.from(item.plain);
    let html = '<div class="stage' + (long ? ' long' : '') + '">';
    chars.forEach((c, i) => {
      if (i > 0 && !PUNCT.test(c)) {
        html += `<span class="gap${long ? ' long-gap' : ''}" data-g="${i}"><span class="s">／</span></span>`;
      }
      html += `<span class="ch">${esc(c)}</span>`;
    });
    html += '</div>';
    return html;
  }

  function gapsFromMarked(marked, plain) {
    const P = Array.from(plain);
    const gaps = [];
    let pi = 0;
    for (const c of Array.from(marked)) {
      if (c === '/') {
        let g = pi;
        while (g < P.length && PUNCT.test(P[g])) g++;
        if (g > 0 && g < P.length) gaps.push(g);
        continue;
      }
      if (P[pi] === c) { pi++; continue; }
      let k = pi;
      while (k < P.length && PUNCT.test(P[k]) && P[k] !== c) k++;
      if (k < P.length && P[k] === c) { pi = k + 1; }
    }
    return Array.from(new Set(gaps));
  }

  function bindQuestion(card) {
    const type = card.dataset.type;
    const fb = $('.fb', card);
    const qid = card.dataset.q;

    if (type === 'choice') {
      const q = findQuestion(qid);
      $$('.opt', card).forEach((opt) => {
        opt.addEventListener('click', () => {
          if (card.dataset.done) return;
          const i = Number(opt.dataset.i);
          const ok = i === q.ans;
          $$('.opt', card).forEach((o) => o.classList.add('locked'));
          if (ok) {
            opt.classList.add('right');
            fb.className = 'fb show ok';
            fb.textContent = '答对了。' + (q.exp ? ' ' + q.exp : '');
            beep('ok');
          } else {
            opt.classList.add('wrong');
            $$('.opt', card)[q.ans].classList.add('right');
            fb.className = 'fb show no';
            fb.textContent = '不对。正确答案是 ' + ('ABCD'[q.ans]) + '。' + (q.exp || '');
            beep('no');
          }
          card.dataset.done = '1';
          card.dataset.correct = ok ? '1' : '0';
          recordAnswer(q, ok, card.dataset.module || '');
        });
      });
    }

    if (type === 'blank') {
      const q = findQuestion(qid);
      $('[data-act="check-blank"]', card).addEventListener('click', () => {
        if (card.dataset.done) return;
        const inputs = $$('.blank-input', card);
        let allOk = true;
        inputs.forEach((inp, i) => {
          const ok = answerMatches(inp.value, q.ans[i]);
          inp.style.borderColor = ok ? 'var(--green)' : 'var(--zhu)';
          inp.style.background = ok ? 'color-mix(in srgb, var(--green) 7%, var(--paper-2))' : 'color-mix(in srgb, var(--zhu) 6%, var(--paper-2))';
          if (!ok) allOk = false;
        });
        fb.className = 'fb show ' + (allOk ? 'ok' : 'no');
        fb.innerHTML = (allOk ? '全对。' : '参考释义：' + q.ans.map((a) => '「' + esc(a) + '」').join('、')) +
          (q.exp ? '<br>' + esc(q.exp) : '');
        card.dataset.done = '1';
        card.dataset.correct = allOk ? '1' : '0';
        recordAnswer(q, allOk, card.dataset.module || '');
        beep(allOk ? 'ok' : 'no');
      });
      $$('.blank-input', card).forEach((inp) => {
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('[data-act="check-blank"]', card).click(); });
      });
    }

    if (type === 'slash') {
      const q = findQuestion(qid);
      const ans = gapsFromMarked(q.marked, q.plain);
      const stage = $('.stage', card);
      const chosen = new Set();
      $$('.gap', stage).forEach((g) => {
        g.addEventListener('click', (e) => {
          e.stopPropagation();
          if (card.dataset.done) return;
          const i = Number(g.dataset.g);
          if (chosen.has(i)) { chosen.delete(i); g.classList.remove('on'); }
          else { chosen.add(i); g.classList.add('on'); beep('tick'); }
        });
      });
      $('[data-act="check-slash"]', card).addEventListener('click', () => {
        if (card.dataset.done) return;
        let ok = true, extra = 0, missing = 0;
        $$('.gap', stage).forEach((g) => {
          const i = Number(g.dataset.g);
          const isAns = ans.includes(i);
          if (chosen.has(i) && isAns) g.classList.add('ok');
          else if (chosen.has(i) && !isAns) { g.classList.add('bad'); ok = false; extra++; }
          else if (!chosen.has(i) && isAns) { g.classList.add('miss'); ok = false; missing++; }
        });
        if (ok) {
          fb.className = 'fb show ok';
          fb.textContent = '断句正确。' + (q.limit ? `共 ${q.limit} 处。` : '') + (q.hint ? ' ' + q.hint : '');
          beep('ok');
        } else {
          fb.className = 'fb show no';
          fb.textContent = `多断 ${extra} 处，漏断 ${missing} 处。红色斜线是多断的地方，金色闪烁处是漏掉的停顿。` + (q.hint ? '提示：' + q.hint : '');
          beep('no');
        }
        card.dataset.done = '1';
        card.dataset.correct = ok ? '1' : '0';
        recordAnswer(q, ok, card.dataset.module || '');
      });
      $('[data-act="clear-slash"]', card).addEventListener('click', () => {
        if (card.dataset.done) return;
        chosen.clear();
        $$('.gap', stage).forEach((g) => g.classList.remove('on'));
      });
      $('[data-act="hint-slash"]', card).addEventListener('click', () => {
        if (q.hint) { fb.className = 'fb show'; fb.textContent = '提示：' + q.hint; }
      });
    }
  }

  function answerMatches(input, ans) {
    const a = stripPunct(ans);
    const b = stripPunct(input);
    if (!b) return false;
    if (a === b) return true;
    const toks = String(ans).split(/[，,；;、／\/]/).map(stripPunct).filter(Boolean);
    return toks.some((t) => t === b);
  }

  const questionRegistry = new Map();
  function registerQuestion(item) {
    questionRegistry.set(item._id, item);
    return item._id;
  }
  function findQuestion(id) { return questionRegistry.get(id) || {}; }

  function recordAnswer(q, ok, moduleId) {
    if (ok) S.stats.correct = (S.stats.correct || 0) + 1;
    else {
      S.stats.wrong = (S.stats.wrong || 0) + 1;
      S.wrong.unshift({
        q: q.q || (q.plain ? q.plain : ''),
        a: q.type === 'choice' ? q.opts[q.ans] : (q.type === 'blank' ? q.ans.join('；') : q.marked),
        exp: q.exp || q.hint || '',
        from: moduleId || '',
        ts: Date.now()
      });
      S.wrong = S.wrong.slice(0, 60);
    }
    if (moduleId) markModule(moduleId, ok ? 'correct' : 'wrong');
    save();
  }

  function bindPractice(moduleId) {
    const m = D.modules.find((x) => x.id === moduleId);
    if (!m) return;
    $$('#practice .q').forEach((card, i) => {
      const item = m.practice[i];
      if (!item) return;
      item._id = moduleId + '-' + i;
      registerQuestion(item);
      card.dataset.q = item._id;
      card.dataset.module = moduleId;
      bindQuestion(card);
    });
  }

  /* ---------------- 视图：断句练习 ---------------- */
  let drillMode = 'long';
  let drillOrder = [];
  let drillIdx = 0;

  function drillPool() {
    return drillMode === 'long' ? (D.longDrills || []) : D.slashDrills;
  }
  function resetDrillOrder() {
    drillOrder = drillPool().map((_, i) => i);
    drillIdx = 0;
  }

  function viewSlash() {
    if (!drillOrder.length) resetDrillOrder();
    const nLong = (D.longDrills || []).length;
    const nShort = D.slashDrills.length;
    return `
    <div class="view">
      ${pageHead('断句练习', '在字与字之间点一下标出停顿，断完点「检查断句」。红色是多断，金色闪烁是漏断。')}

      <div class="toolbar">
        <button class="btn sm ${drillMode === 'long' ? 'primary' : 'ghost'}" data-act="mode-long">长句 · 限断（${nLong}）</button>
        <button class="btn sm ${drillMode === 'short' ? 'primary' : 'ghost'}" data-act="mode-short">短句（${nShort}）</button>
      </div>

      <div class="row" style="justify-content:space-between;margin-bottom:10px">
        <div class="muted" id="drill-count"></div>
        <div class="row">
          <button class="btn sm" data-act="shuffle">打乱</button>
          <button class="btn sm" data-act="next-drill">下一题 →</button>
        </div>
      </div>

      <div id="drill-box"></div>

      <div class="row" style="margin-top:14px">
        <button class="btn sm" data-act="speak-drill">按节奏朗读</button>
        <span class="muted">${drillMode === 'long'
        ? '先读通句意，再找「曰、也、矣、哉、乎、者」这类标志词。'
        : '短句多考单层结构，看主谓、转折、对称即可。'}</span>
      </div>
    </div>`;
  }

  function renderDrill() {
    const box = $('#drill-box');
    if (!box) return;
    const pool = drillPool();
    if (!pool.length) return;
    const raw = pool[drillOrder[drillIdx % drillOrder.length]];
    const isLong = drillMode === 'long';
    const item = Object.assign({}, raw, {
      _id: 'drill-' + drillIdx + '-' + drillMode,
      type: 'slash',
      mode: isLong ? '断句' : (raw.mode || '断句')
    });
    registerQuestion(item);
    box.innerHTML = `<div class="q" data-q="${item._id}" data-type="slash" data-module="" style="border-top:0;padding:14px 0 0">
      <div class="q-no">${isLong ? '长句断句' : esc(item.mode)}</div>
      ${isLong ? `<div class="drill-meta">
        <span class="tag">${esc(raw.source || '')}</span>
        <span>限断 <b>${raw.limit}</b> 处 · 共 ${Array.from(raw.plain).length} 字</span>
      </div>` : ''}
      ${slashStageHTML(item, isLong)}
      <div class="toolbar" style="margin:14px 0 0">
        <button class="btn sm primary" data-act="check-slash">检查断句</button>
        <button class="btn sm" data-act="clear-slash">清空</button>
        <button class="btn sm ghost" data-act="hint-slash">提示</button>
        ${isLong && raw.trans ? '<button class="btn sm ghost" data-act="show-trans-drill">看译文</button>' : ''}
      </div>
      ${isLong && raw.trans ? `<div class="drill-trans" id="drill-trans" hidden>${esc(raw.trans)}</div>` : ''}
      <div class="fb"></div>
    </div>`;
    const card = $('.q', box);
    bindQuestion(card);
    $('#drill-count').textContent = `第 ${(drillIdx % drillOrder.length) + 1} / ${drillOrder.length} 题 · ${isLong ? '长句' : '短句'}`;
    markStudy();
  }

  /* ---------------- 视图：自测问答 ---------------- */
  let qaFilter = 'all';

  function qaRec(id) {
    return (S.qa && S.qa[id]) || null;
  }

  function viewQA() {
    const list = D.qa || [];
    const doneN = list.filter((q) => qaRec(q.id)).length;
    const goodN = list.filter((q) => qaRec(q.id) && qaRec(q.id).grade >= 2).length;
    const shown = list.filter((q) => {
      if (qaFilter === 'todo') return !qaRec(q.id);
      if (qaFilter === 'done') return !!qaRec(q.id);
      if (qaFilter === 'hard') return qaRec(q.id) && qaRec(q.id).grade < 2;
      return true;
    });

    return `
    <div class="view">
      ${pageHead('自测问答', '先自己写答案，再对照参考答案要点，最后评一档：完全答对、答到一半、没答上。')}

      <div class="kpi-row">
        <div class="kpi"><b>${list.length}</b><span>题目</span></div>
        <div class="kpi"><b>${doneN}</b><span>已自测</span></div>
        <div class="kpi"><b>${goodN}</b><span>已掌握</span></div>
      </div>

      <div class="toolbar">
        ${[['all', '全部'], ['todo', '未做'], ['done', '做过'], ['hard', '待巩固']].map(([k, t]) => `
          <button class="btn sm ${qaFilter === k ? 'primary' : 'ghost'}" data-act="qa-filter" data-f="${k}">${t}</button>`).join('')}
        <button class="btn sm" data-act="qa-random" style="margin-left:auto">随机抽一题</button>
      </div>

      <div class="qa-list" id="qa-list">
        ${shown.length ? shown.map((q) => qaCard(q, list.indexOf(q) + 1)).join('') : '<p class="muted" style="padding:16px 0">这个分类下暂时没有题目。</p>'}
      </div>
    </div>`;
  }

  function qaCard(q, no) {
    const r = qaRec(q.id);
    const badge = !r ? '<span class="badge">未自测</span>'
      : r.grade >= 2 ? '<span class="badge ok">已掌握</span>'
        : r.grade === 1 ? '<span class="badge mid">部分掌握</span>'
          : '<span class="badge no">待巩固</span>';
    return `
    <div class="qa-item" id="qa-${q.id}" data-qa="${q.id}">
      <div class="qa-top">
        <span class="tag">${esc(q.tag)}</span>
        <span class="qa-no">Q${no}</span>
        <span style="margin-left:auto">${badge}</span>
      </div>
      <div class="qa-q">${esc(q.q)}</div>
      <textarea class="qa-input" rows="3" placeholder="先写下你的答案，再对照要点。">${esc(r && r.text ? r.text : '')}</textarea>
      <div class="row" style="margin-top:10px">
        <button class="btn sm primary" data-act="qa-reveal" data-id="${q.id}">对照参考答案</button>
        <button class="btn sm ghost" data-act="qa-clear" data-id="${q.id}">清空作答</button>
      </div>
      <div class="qa-ref" id="ref-${q.id}" ${r && r.shown ? '' : 'hidden'}>
        <div class="ref-title">参考答案（要点）</div>
        <ol>${q.ref.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
        <div class="grade-row">
          <span class="muted">自评</span>
          <button class="btn sm ${r && r.grade === 2 ? 'primary' : ''}" data-act="qa-grade" data-id="${q.id}" data-g="2">完全答对</button>
          <button class="btn sm ${r && r.grade === 1 ? 'primary' : ''}" data-act="qa-grade" data-id="${q.id}" data-g="1">答到一半</button>
          <button class="btn sm ${r && r.grade === 0 ? 'primary' : ''}" data-act="qa-grade" data-id="${q.id}" data-g="0">没答上</button>
        </div>
      </div>
    </div>`;
  }

  function qaReveal(id) {
    const card = document.getElementById('qa-' + id);
    if (!card) return;
    const box = document.getElementById('ref-' + id);
    box.hidden = false;
    const txt = $('.qa-input', card).value.trim();
    const rec = (S.qa && S.qa[id]) || {};
    rec.shown = true;
    rec.text = txt;
    rec.ts = Date.now();
    if (rec.grade === undefined) rec.grade = -1;
    S.qa = S.qa || {};
    S.qa[id] = rec;
    save();
    markStudy();
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function qaGrade(id, g) {
    const card = document.getElementById('qa-' + id);
    S.qa = S.qa || {};
    const rec = S.qa[id] || {};
    rec.grade = g;
    rec.text = card ? $('.qa-input', card).value.trim() : rec.text;
    rec.shown = true;
    rec.ts = Date.now();
    S.qa[id] = rec;
    if (g >= 2) S.stats.correct = (S.stats.correct || 0) + 1;
    if (g === 0) S.stats.wrong = (S.stats.wrong || 0) + 1;
    save();
    markStudy();
    if (card) {
      const last = card.querySelector('.qa-top').lastElementChild;
      last.innerHTML = g >= 2 ? '<span class="badge ok">已掌握</span>' : g === 1 ? '<span class="badge mid">部分掌握</span>' : '<span class="badge no">待巩固</span>';
      $$('[data-act="qa-grade"]', card).forEach((b) => {
        b.classList.toggle('primary', Number(b.dataset.g) === g);
      });
    }
    beep(g >= 2 ? 'ok' : 'no');
    toast(g >= 2 ? '记下了' : g === 1 ? '再补一补要点' : '先看一遍参考答案，再自测一次');
  }

  /* ---------------- 视图：词义卡 ---------------- */
  const CARD_INTERVAL = [0, 1, 3, 7, 15, 30];
  let deck = [];
  let deckPos = 0;

  function buildDeck() {
    const now = Date.now();
    const due = [], rest = [];
    D.cards.forEach((c) => {
      const st = S.card[c.w];
      const isDue = !st || !st.due || st.due <= now;
      (isDue ? due : rest).push(c);
    });
    deck = due.concat(rest);
    deckPos = 0;
  }

  function viewCards() {
    if (!deck.length) buildDeck();
    const learned = Object.keys(S.card).length;
    return `
    <div class="view">
      ${pageHead('词义卡', '正面是词，背面是释义。记住点「记住了」，忘记点「没记住」，系统按遗忘曲线安排复习。')}
      <div class="flash-wrap">
        <div class="deck-info">
          <span>本轮 ${deck.length} 张</span><span>已学 ${learned} / ${D.cards.length}</span><span id="card-pos">1 / ${deck.length}</span>
        </div>
        <div class="flash" id="flash">
          <div class="flash-inner">
            <div class="face" id="flash-front"></div>
            <div class="face back" id="flash-back"></div>
          </div>
        </div>
        <p class="muted" style="margin:0">点击卡片翻面，键盘 ← → 切换。</p>
        <div class="toolbar" style="justify-content:center;margin:0">
          <button class="btn" data-act="card-unknown">没记住</button>
          <button class="btn ghost" data-act="flip">翻面</button>
          <button class="btn primary" data-act="card-known">记住了</button>
        </div>
        <div class="row">
          <button class="btn sm ghost" data-act="card-prev">← 上一张</button>
          <button class="btn sm ghost" data-act="card-next">下一张 →</button>
        </div>
      </div>
      <div class="rule"></div>
      <p class="muted">复习间隔：记住后 1、3、7、15、30 天再出现。没记住的立刻回到本轮末尾。</p>
    </div>`;
  }

  function renderCard() {
    if (!deck.length) return;
    const c = deck[deckPos % deck.length];
    const st = S.card[c.w];
    const box = st ? st.box || 0 : 0;
    $('#flash-front').innerHTML = `<div>
      <div class="big">${esc(c.w)}</div>
      <div class="ex">${esc(c.ex)}</div>
      <div class="src">${esc(c.src)} · 点击翻面</div>
    </div>`;
    $('#flash-back').innerHTML = `<div>
      <div class="def">${esc(c.d)}</div>
      <div class="ex">${esc(c.ex)}</div>
      <div class="src">${esc(c.src)} · 熟练 ${'●'.repeat(box)}${'○'.repeat(Math.max(0, 5 - box))}</div>
    </div>`;
    $('#flash').classList.remove('flipped');
    const pos = $('#card-pos');
    if (pos) pos.textContent = `${(deckPos % deck.length) + 1} / ${deck.length}`;
  }

  function cardAnswer(known) {
    if (!deck.length) return;
    const c = deck[deckPos % deck.length];
    const st = S.card[c.w] || { box: 0, right: 0, wrong: 0, due: 0 };
    if (known) {
      st.box = Math.min(5, (st.box || 0) + 1);
      st.right = (st.right || 0) + 1;
      st.due = Date.now() + CARD_INTERVAL[st.box] * 86400000;
      beep('ok');
      S.stats.correct = (S.stats.correct || 0) + 1;
    } else {
      st.box = 0;
      st.wrong = (st.wrong || 0) + 1;
      st.due = Date.now();
      beep('no');
      S.stats.wrong = (S.stats.wrong || 0) + 1;
    }
    S.card[c.w] = st;
    save();
    markStudy();
    deckPos++;
    if (deckPos >= deck.length) {
      buildDeck();
      toast('本轮过完，已按遗忘曲线重新排序');
    }
    const f = $('#flash');
    f.style.transition = 'opacity .2s';
    f.style.opacity = '0';
    setTimeout(() => { renderCard(); f.style.opacity = '1'; }, 200);
  }

  /* ---------------- 视图：随机练习 ---------------- */
  let quizState = null;

  function allQuestions() {
    const list = [];
    D.modules.forEach((m) => {
      m.practice.forEach((p, i) => {
        const item = Object.assign({}, p, { _id: 'quiz-' + m.id + '-' + i, type: p.type || 'choice' });
        list.push({ item, moduleId: m.id, title: m.title });
      });
    });
    return list;
  }

  function viewQuiz() {
    if (!quizState) startQuiz();
    return `
    <div class="view">
      ${pageHead('随机练习', '从七个考点的练习里随机抽十道，做完看正确率。')}
      <div class="row" style="justify-content:space-between;margin-bottom:14px">
        <div class="muted" id="quiz-count"></div>
        <button class="btn sm" data-act="quiz-restart">重新抽题</button>
      </div>
      <div class="bar" style="margin-bottom:20px"><i id="quiz-prog"></i></div>
      <div id="quiz-box"></div>
    </div>`;
  }

  function startQuiz() {
    const pool = allQuestions();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    quizState = { items: pool.slice(0, Math.min(10, pool.length)), idx: 0, score: 0, done: 0 };
  }

  function renderQuiz() {
    const box = $('#quiz-box');
    if (!box || !quizState) return;
    const total = quizState.items.length;
    if (quizState.idx >= total) {
      const pct = Math.round((quizState.score / total) * 100);
      const label = pct >= 90 ? '基本全对' : pct >= 70 ? '大体掌握' : pct >= 50 ? '还需巩固' : '回到考点再读一遍';
      box.innerHTML = `<div class="center" style="padding:20px 0">
        <div style="font-family:var(--kai);font-size:22px;letter-spacing:2px">${label}</div>
        <div style="font-size:34px;margin:12px 0 4px">${quizState.score} / ${total}</div>
        <p class="muted">正确率 ${pct}%</p>
        <div class="row" style="justify-content:center;margin-top:16px">
          <button class="btn primary" data-act="quiz-restart">再来一轮</button>
          <a class="btn" href="#/progress">看错题本</a>
        </div>
      </div>`;
      $('#quiz-count').textContent = `已答 ${total} / ${total}`;
      $('#quiz-prog').style.width = '100%';
      return;
    }
    const cur = quizState.items[quizState.idx];
    const item = cur.item;
    registerQuestion(item);
    box.innerHTML = `
      <div class="row" style="margin-bottom:8px">
        <span class="tag">${esc(cur.title)}</span>
        <span class="muted">第 ${quizState.idx + 1} / ${total} 题 · 答对 ${quizState.score}</span>
      </div>
      ${questionHTML(item, 'q' + quizState.idx, quizState.idx + 1)}`;
    const card = $('.q', box);
    card.dataset.module = cur.moduleId;
    card.style.borderTop = '0';
    card.style.paddingTop = '0';
    bindQuestion(card);
    $('#quiz-count').textContent = `已答 ${quizState.idx} / ${total}`;
    $('#quiz-prog').style.width = Math.round((quizState.idx / total) * 100) + '%';

    const watcher = setInterval(() => {
      if (!document.body.contains(card)) { clearInterval(watcher); return; }
      if (card.dataset.done && !$('#next-q')) {
        clearInterval(watcher);
        if (card.dataset.correct === '1') quizState.score++;
        quizState.done++;
        const btn = document.createElement('button');
        btn.id = 'next-q';
        btn.className = 'btn primary';
        btn.style.marginTop = '12px';
        btn.textContent = quizState.idx + 1 >= total ? '看成绩 →' : '下一题 →';
        btn.addEventListener('click', () => { quizState.idx++; renderQuiz(); });
        card.appendChild(btn);
      }
    }, 120);
  }

  /* ---------------- 视图：诵读 ---------------- */
  let poemId = D.poems[0].id;
  let poemVert = false;

  function viewPoems() {
    const p = D.poems.find((x) => x.id === poemId) || D.poems[0];
    return `
    <div class="view">
      ${pageHead('诵读', '点「朗读」跟读，可切换竖排。注释与译文在下方。')}
      <div class="poem-grid">
        ${D.poems.map((x) => `
          <div class="poem-item ${x.id === p.id ? 'on' : ''}" data-poem="${x.id}">
            ${esc(x.title)}<small>〔${esc(x.dynasty)}〕${esc(x.author)}</small>
          </div>`).join('')}
      </div>
      <div class="poem-sheet">
        <div class="poem-title">
          <h2>${esc(p.title)}</h2>
          <div>〔${esc(p.dynasty)}〕${esc(p.author)}</div>
        </div>
        <div class="poem-body ${poemVert ? 'vert' : ''}" id="poem-body">
          ${p.lines.map((l) => `<span class="poem-line">${esc(l)}</span>`).join('')}
        </div>
        <div class="poem-tools">
          <button class="btn sm" data-act="speak-poem">朗读全文</button>
          <button class="btn sm" data-act="speak-slow">慢速</button>
          <button class="btn sm" data-act="toggle-vert">${poemVert ? '横排' : '竖排'}</button>
          <button class="btn sm" data-act="show-trans">译文</button>
        </div>
        ${p.notes && p.notes.length ? `<div class="notes">
          ${p.notes.map(([w, d]) => `<div class="note-item"><b>${esc(w)}</b>${esc(d)}</div>`).join('')}
        </div>` : ''}
        ${p.trans ? `<div class="trans" id="trans" style="display:none"><b>白话译文　</b>${esc(p.trans)}</div>` : ''}
      </div>
    </div>`;
  }

  /* ---------------- 视图：背诵 ---------------- */
  let reciteId = D.reciteIds[0];
  let reciteMode = 0;
  let reciteHideRatio = 0.35;
  let revealMap = new Set();

  function viewRecite() {
    const p = D.poems.find((x) => x.id === reciteId) || D.poems[0];
    return `
    <div class="view">
      ${pageHead('背诵', '挖空模式点空格揭示。默写模式写完自动逐字比对。')}
      <div class="poem-grid">
        ${D.reciteIds.map((id) => {
          const x = D.poems.find((y) => y.id === id);
          return `<div class="poem-item ${x.id === p.id ? 'on' : ''}" data-recite="${x.id}">
            ${esc(x.title)}<small>${esc(x.author)} · ${x.lines.length} 句</small></div>`;
        }).join('')}
      </div>
      <div class="toolbar" style="justify-content:space-between">
        <div class="row">
          <button class="btn sm ${reciteMode === 0 ? 'primary' : 'ghost'}" data-act="mode-cloze">挖空背诵</button>
          <button class="btn sm ${reciteMode === 1 ? 'primary' : 'ghost'}" data-act="mode-write">默写比对</button>
        </div>
        ${reciteMode === 0 ? `<div class="row">
          <button class="btn sm ghost" data-act="ratio-20">少量</button>
          <button class="btn sm ghost" data-act="ratio-35">适中</button>
          <button class="btn sm ghost" data-act="ratio-55">大量</button>
          <button class="btn sm ghost" data-act="reveal-all">全部揭示</button>
        </div>` : `<button class="btn sm ghost" data-act="speak-poem2">听一遍</button>`}
      </div>
      <div id="recite-stage">${reciteMode === 0 ? clozeHTML(p) : writeHTML()}</div>
      ${reciteMode === 1 ? transcriptHTML(p) : ''}
    </div>`;
  }

  function clozeHTML(p) {
    revealMap = revealMap || new Set();
    return `<div class="recite-text" id="cloze">
      ${p.lines.map((line) => `<div class="line">${
      Array.from(line).map((ch, i) => {
        const key = hash(line) + '_' + i;
        const isPunct = /[，。！？；：、「」“”（）]/.test(ch);
        const r = pseudoRand(hash(line) + i);
        const shouldHide = !isPunct && r < reciteHideRatio;
        if (!shouldHide || revealMap.has(key)) return `<span>${esc(ch)}</span>`;
        return `<span class="blank" data-key="${key}">${esc(ch)}</span>`;
      }).join('')
    }</div>`).join('')}
    </div>`;
  }

  function pseudoRand(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 1000) / 1000;
  }

  function writeHTML() {
    return `<textarea class="recite-input" id="write-input" placeholder="在这里默写全文，标点可省略。写完后点下面的按钮比对。"></textarea>
      <div class="row" style="margin-top:12px">
        <button class="btn primary" data-act="compare">逐字比对</button>
        <button class="btn ghost" data-act="show-answer">看原文</button>
      </div>`;
  }

  function transcriptHTML(p) {
    return `<div class="trans" id="answer-text" style="display:none;margin-top:14px">
      <b>原文　</b>${p.lines.map(esc).join('')}
    </div>`;
  }

  function lcsDiff(target, input) {
    const a = Array.from(stripPunct(target));
    const b = Array.from(stripPunct(input));
    const n = a.length, m = b.length;
    if (!m) return a.map((c) => ({ c, t: 'skip' }));
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { out.push({ c: a[i], t: 'ok' }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ c: a[i], t: 'bad' }); i++; }
      else { out.push({ c: b[j], t: 'extra' }); j++; }
    }
    while (i < n) { out.push({ c: a[i++], t: 'bad' }); }
    while (j < m) { out.push({ c: b[j++], t: 'extra' }); }
    return out;
  }

  /* ---------------- 视图：记录 ---------------- */
  function viewProgress() {
    const totalCards = D.cards.length;
    const learned = Object.keys(S.card).length;
    const mastered = Object.values(S.card).filter((c) => (c.box || 0) >= 3).length;
    const totalQ = Object.values(S.module).reduce((a, m) => a + (m.correct || 0) + (m.wrong || 0) + (m.total || 0), 0);
    const qaAll = D.qa || [];
    const qaTotal = qaAll.length;
    const qaDone = qaAll.filter((q) => S.qa && S.qa[q.id]).length;
    const qaGood = qaAll.filter((q) => S.qa && S.qa[q.id] && S.qa[q.id].grade >= 2).length;

    return `
    <div class="view">
      ${pageHead('记录', '数据保存在本机浏览器，换设备不会同步。')}

      <div class="kpi-row">
        <div class="kpi"><b>${S.stats.streak || 0}</b><span>连续天数</span></div>
        <div class="kpi"><b>${totalQ}</b><span>累计作答</span></div>
        <div class="kpi"><b>${S.stats.correct || 0}</b><span>答对</span></div>
        <div class="kpi"><b>${S.stats.wrong || 0}</b><span>答错</span></div>
      </div>

      ${section('考点进度', `
        <div class="list">
          ${D.modules.map((m) => `
            <div class="list-row" style="cursor:default">
              <span class="li-no">${esc(m.num)}</span>
              <span class="li-main">
                <span class="li-title">${esc(m.title)}</span>
                <div class="bar" style="margin-top:7px"><i data-w="${moduleScore(m.id)}"></i></div>
              </span>
              <span class="li-meta">${moduleScore(m.id)}%</span>
            </div>`).join('')}
        </div>`)}

      ${section('复习', `
        <div class="list">
          <a class="list-row" href="#/cards">
            <span class="li-main"><span class="li-title">词义卡</span>
              <span class="li-desc">已学 ${learned} / ${totalCards} 张，熟练 ${mastered} 张</span></span>
            <span class="li-meta">${Math.round((mastered / Math.max(1, totalCards)) * 100)}%</span>
          </a>
          <a class="list-row" href="#/qa">
            <span class="li-main"><span class="li-title">自测问答</span>
              <span class="li-desc">已自测 ${qaDone} / ${qaTotal} 题，掌握 ${qaGood} 题</span></span>
            <span class="li-meta">${Math.round((qaGood / Math.max(1, qaTotal)) * 100)}%</span>
          </a>
          <a class="list-row" href="#/slash">
            <span class="li-main"><span class="li-title">断句练习</span>
              <span class="li-desc">长句 ${(D.longDrills || []).length} 道，短句 ${D.slashDrills.length} 道</span></span>
            <span class="li-meta">去练习 →</span>
          </a>
        </div>`)}

      ${section('错题本', S.wrong.length ? `<div class="row" style="justify-content:flex-end;margin-bottom:8px">
          <button class="btn sm ghost" data-act="clear-wrong">清空</button>
        </div>
        ${S.wrong.slice(0, 20).map((w) => `
          <div style="padding:10px 0;border-bottom:1px solid var(--line)">
            <div style="font-size:14px">${esc(w.q)}</div>
            <div class="muted" style="margin-top:3px">${esc(w.a)}${w.exp ? ' · ' + esc(w.exp) : ''}</div>
          </div>`).join('')}`
      : '<p class="muted">还没有错题。做错的题会自动收在这里。</p>', `最近 ${S.wrong.length} 条`)}

      <div class="row" style="justify-content:center;margin-top:24px">
        <button class="btn ghost" data-act="export">导出学习数据</button>
        <button class="btn ghost" data-act="reset">重置进度</button>
      </div>
    </div>`;
  }

  /* ---------------- 渲染 ---------------- */
  const app = $('#main');

  function render() {
    const r = parseRoute();
    const key = JSON.stringify(r);
    const changed = key !== currentRoute;
    currentRoute = key;

    if (window.speechSynthesis) window.speechSynthesis.cancel();

    let html = '';
    switch (r.view) {
      case 'home': html = viewHome(); break;
      case 'path': html = viewPath(); break;
      case 'module': html = viewModule(r.id); break;
      case 'slash': html = viewSlash(); break;
      case 'qa': html = viewQA(); break;
      case 'cards': html = viewCards(); break;
      case 'quiz': html = viewQuiz(); break;
      case 'poems': html = viewPoems(); break;
      case 'recite': html = viewRecite(); break;
      case 'progress': html = viewProgress(); break;
      default: html = viewHome();
    }
    app.innerHTML = html;
    setNav(r);
    if (changed) window.scrollTo({ top: 0, behavior: 'auto' });

    // 记住上一次的位置，供首页「续」使用
    if (r.view !== 'home') {
      const labelMap = {
        path: '学习路径', slash: '断句练习', qa: '自测问答', cards: '词义卡',
        quiz: '随机练习', poems: '诵读', recite: '背诵', progress: '记录'
      };
      let label = labelMap[r.view];
      if (r.view === 'module') {
        const m = D.modules.find((x) => x.id === r.id);
        label = m ? m.title : '考点';
      }
      if (label) {
        S.last = { hash: location.hash, label };
        save();
      }
    }

    observeReveal(app);

    app.querySelectorAll('.list-row .bar i, .bar > i[data-w]').forEach((i) => {
      const w = i.dataset.w || 0;
      requestAnimationFrame(() => setTimeout(() => { i.style.width = w + '%'; }, 80));
    });

    if (r.view === 'module') {
      bindPractice(r.id);
      const f = $('#formula');
      if (f) {
        const parts = $$('.fpart', f);
        setTimeout(() => parts.forEach((p, i) => setTimeout(() => p.classList.add('lit'), i * 160)), 200);
      }
      const mn = $('#mnemo');
      if (mn) mn.addEventListener('click', () => { mn.classList.toggle('flipped'); beep('tick'); });
      $$('.acc-head').forEach((h) => h.addEventListener('click', () => h.parentElement.classList.toggle('open')));
    }

    if (r.view === 'slash') { renderDrill(); }
    if (r.view === 'cards') {
      if (!deck.length) buildDeck();
      renderCard();
      const fl = $('#flash');
      if (fl) fl.addEventListener('click', () => { fl.classList.toggle('flipped'); beep('tick'); });
    }
    if (r.view === 'quiz') { renderQuiz(); }
    if (r.view === 'recite') { bindRecite(); }
  }

  /* 背诵交互 */
  function bindRecite() {
    const p = D.poems.find((x) => x.id === reciteId) || D.poems[0];
    $$('#recite-stage .blank').forEach((b) => {
      b.addEventListener('click', () => {
        b.classList.add('revealed');
        revealMap.add(b.dataset.key);
        beep('tick');
      });
    });
    const cmp = $('[data-act="compare"]');
    if (cmp) {
      cmp.addEventListener('click', () => {
        const val = $('#write-input').value;
        if (!stripPunct(val).length) { toast('先写点内容再比对'); return; }
        const target = p.lines.join('');
        const diff = lcsDiff(target, val);
        const total = Array.from(stripPunct(target)).length;
        const okCount = diff.filter((d) => d.t === 'ok').length;
        const pct = Math.round((okCount / Math.max(1, total)) * 100);
        let out = `<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--rule)">
          <div class="muted" style="margin-bottom:8px">逐字比对 · 正确率 ${pct}%</div>`;
        out += '<div class="diff">' + diff.map((d) => {
          if (d.t === 'ok') return `<span class="ok">${esc(d.c)}</span>`;
          if (d.t === 'bad') return `<span class="bad">${esc(d.c)}</span>`;
          return `<span class="skip">${esc(d.c)}</span>`;
        }).join('') + '</div>';
        out += '<p class="muted" style="margin-top:8px">绿色为正确，红色为写错或漏写，删除线为多写。</p></div>';
        const old = $('#diff-box');
        if (old) old.remove();
        const box = document.createElement('div');
        box.id = 'diff-box';
        box.innerHTML = out;
        $('#recite-stage').after(box);
        if (pct >= 90) { beep('ok'); toast('正确率不错'); } else beep('no');
      });
    }
  }

  /* 全局点击代理 */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;

    if (act === 'speak' || act === 'speak-drill' || act === 'speak-poem' || act === 'speak-poem2') {
      let text = t.dataset.text;
      if (act === 'speak-drill') {
        const node = $('#drill-box .q');
        const item = node ? questionRegistry.get(node.dataset.q) : null;
        text = item ? item.marked.replace(/\//g, '，') : '';
      }
      if (act === 'speak-poem' || act === 'speak-poem2') {
        const p = D.poems.find((x) => x.id === poemId) || D.poems[0];
        const p2 = D.poems.find((x) => x.id === reciteId) || D.poems[0];
        text = act === 'speak-poem' ? p.lines.join('') : p2.lines.join('');
      }
      speak(text, .85);
      return;
    }
    if (act === 'speak-slow') {
      const p = D.poems.find((x) => x.id === poemId) || D.poems[0];
      speak(p.lines.join(''), .62);
      return;
    }

    if (act === 'toggle-vert') { poemVert = !poemVert; render(); return; }
    if (act === 'show-trans') {
      const tr = $('#trans');
      if (tr) {
        tr.style.display = tr.style.display === 'none' ? 'block' : 'none';
        tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return;
    }

    if (act === 'mode-long') { drillMode = 'long'; resetDrillOrder(); render(); return; }
    if (act === 'mode-short') { drillMode = 'short'; resetDrillOrder(); render(); return; }
    if (act === 'show-trans-drill') {
      const p = $('#drill-trans');
      if (p) p.hidden = !p.hidden;
      return;
    }
    if (act === 'next-drill') { drillIdx = (drillIdx + 1) % drillOrder.length; renderDrill(); return; }
    if (act === 'shuffle') {
      for (let i = drillOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [drillOrder[i], drillOrder[j]] = [drillOrder[j], drillOrder[i]];
      }
      drillIdx = 0; renderDrill(); toast('题库已打乱'); return;
    }

    if (act === 'flip') { $('#flash').classList.toggle('flipped'); beep('tick'); return; }
    if (act === 'card-known') { cardAnswer(true); return; }
    if (act === 'card-unknown') { cardAnswer(false); return; }
    if (act === 'card-next') { deckPos = (deckPos + 1) % Math.max(1, deck.length); renderCard(); return; }
    if (act === 'card-prev') { deckPos = (deckPos - 1 + deck.length) % Math.max(1, deck.length); renderCard(); return; }

    if (act === 'quiz-restart') { startQuiz(); render(); return; }

    if (act === 'qa-reveal') { qaReveal(t.dataset.id); return; }
    if (act === 'qa-grade') { qaGrade(t.dataset.id, Number(t.dataset.g)); return; }
    if (act === 'qa-clear') {
      const id = t.dataset.id;
      const card = document.getElementById('qa-' + id);
      if (card) $('.qa-input', card).value = '';
      if (S.qa && S.qa[id]) { delete S.qa[id]; save(); }
      render();
      toast('已清空');
      return;
    }
    if (act === 'qa-filter') { qaFilter = t.dataset.f; render(); return; }
    if (act === 'qa-random') {
      const list = (D.qa || []).filter((q) => !qaRec(q.id) || qaRec(q.id).grade < 2);
      const pool = list.length ? list : (D.qa || []);
      if (!pool.length) return;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      qaFilter = 'all';
      render();
      const el = document.getElementById('qa-' + pick.id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '2px solid var(--zhu)';
        setTimeout(() => { el.style.outline = ''; }, 1600);
        $('.qa-input', el).focus();
      }
      return;
    }

    if (act === 'mode-cloze') { reciteMode = 0; revealMap = new Set(); render(); return; }
    if (act === 'mode-write') { reciteMode = 1; render(); return; }
    if (act === 'ratio-20') { reciteHideRatio = 0.2; render(); return; }
    if (act === 'ratio-35') { reciteHideRatio = 0.35; render(); return; }
    if (act === 'ratio-55') { reciteHideRatio = 0.55; render(); return; }
    if (act === 'reveal-all') { $$('#recite-stage .blank').forEach((b) => b.classList.add('revealed')); beep('tick'); return; }
    if (act === 'show-answer') {
      const a = $('#answer-text');
      if (a) a.style.display = a.style.display === 'none' ? 'block' : 'none';
      return;
    }

    if (act === 'clear-wrong') {
      if (confirm('确定清空错题本？')) { S.wrong = []; save(); render(); }
      return;
    }
    if (act === 'reset') {
      if (confirm('将清空所有学习进度（考点、词卡、错题），确定？')) {
        const theme = S.settings.theme, sound = S.settings.sound;
        S = blankState();
        S.settings = { theme, sound };
        save(); render(); toast('已重置');
      }
      return;
    }
    if (act === 'export') {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '古文古诗学习数据.json';
      a.click();
      toast('已导出');
      return;
    }
  });

  /* 诗文/背诵选择器 */
  document.addEventListener('click', (e) => {
    const pc = e.target.closest('[data-poem]');
    if (pc) { poemId = pc.dataset.poem; render(); return; }
    const rc = e.target.closest('[data-recite]');
    if (rc) { reciteId = rc.dataset.recite; revealMap = new Set(); render(); return; }
  });

  /* 键盘 */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      closeMenu();
      return;
    }
    if (!$('#flash')) return;
    if (e.key === 'ArrowRight') { $('#flash').classList.contains('flipped') ? cardAnswer(true) : $('#flash').classList.toggle('flipped'); }
    if (e.key === 'ArrowLeft') { $('#flash').classList.toggle('flipped'); }
    if (e.key === ' ') { e.preventDefault(); $('#flash').classList.toggle('flipped'); }
  });

  /* 主题 / 音效 */
  function applySettings() {
    document.documentElement.dataset.theme = S.settings.theme || 'light';
    const dark = S.settings.theme === 'dark';
    $('#btnTheme').textContent = dark ? '日' : '夜';
    $('#btnTheme').setAttribute('aria-label', dark ? '切换到日间模式' : '切换到夜间模式');
    $('#btnSound').classList.toggle('off', !S.settings.sound);
    $('#btnSound').textContent = S.settings.sound ? '音' : '静';
    const mt = document.getElementById('metaTheme');
    if (mt) mt.setAttribute('content', dark ? '#14130f' : '#f3eee2');
  }

  /* 手机目录 */
  function closeMenu() {
    const side = $('#side'), btn = $('#btnMenu'), shell = $('.shell');
    if (!side || !side.classList.contains('open')) return;
    side.classList.remove('open');
    if (shell) shell.classList.remove('menu-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function boot() {
    load();
    applySettings();
    renderTOC();

    const btnMenu = $('#btnMenu');
    if (btnMenu) {
      btnMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = $('#side').classList.toggle('open');
        $('.shell').classList.toggle('menu-open', open);
        btnMenu.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      $('#nav').addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
      const scrim = $('#scrim');
      if (scrim) scrim.addEventListener('click', closeMenu);
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.side') && !e.target.closest('#btnMenu')) closeMenu();
      });
    }

    $('#btnTheme').addEventListener('click', () => {
      S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark';
      save(); applySettings(); beep('tick');
    });
    $('#btnSound').addEventListener('click', () => {
      S.settings.sound = !S.settings.sound;
      save(); applySettings();
      if (S.settings.sound) beep('tick');
    });

    window.addEventListener('hashchange', () => { closeMenu(); render(); });
    if (!location.hash) location.hash = '#/home';
    render();
    markStudy();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
