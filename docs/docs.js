// Small helpers shared by the docs pages: theme switch, copy buttons, screenshot lightbox.
(function () {
  const root = document.documentElement;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  };

  // theme: auto → light → dark
  const saved = store.get('sheeep-docs:theme');
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  const btn = document.querySelector('.theme-btn');
  const icon = () => (root.dataset.theme === 'dark' ? '☾' : root.dataset.theme === 'light' ? '☀' : '◐');
  if (btn) {
    btn.textContent = icon();
    btn.title = 'Theme: ' + (root.dataset.theme || 'auto');
    btn.addEventListener('click', () => {
      const next = !root.dataset.theme ? 'light' : root.dataset.theme === 'light' ? 'dark' : '';
      if (next) root.dataset.theme = next; else delete root.dataset.theme;
      store.set('sheeep-docs:theme', next);
      btn.textContent = icon();
      btn.title = 'Theme: ' + (next || 'auto');
    });
  }

  // copy text (works from file:// too)
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }
  window.sheeepCopy = copyText;

  document.querySelectorAll('pre[data-copy]').forEach((pre) => {
    const wrap = document.createElement('div');
    wrap.className = 'code';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    const b = document.createElement('button');
    b.className = 'copy-btn';
    b.type = 'button';
    b.textContent = 'Copy';
    b.addEventListener('click', async () => {
      const text = pre.dataset.copy || pre.innerText.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n').trim();
      b.textContent = (await copyText(text)) ? 'Copied' : 'Press Ctrl+C';
      setTimeout(() => (b.textContent = 'Copy'), 1600);
    });
    wrap.appendChild(b);
  });

  // click a screenshot to see it large
  const dlg = document.createElement('dialog');
  dlg.className = 'lightbox';
  dlg.innerHTML = '<img alt=""><p></p>';
  document.body.appendChild(dlg);
  dlg.addEventListener('click', () => dlg.close());
  document.addEventListener('click', (e) => {
    const img = e.target.closest('img[data-zoom], .frame img, .shot, .feature > img, .step-card img');
    if (!img) return;
    dlg.querySelector('img').src = img.currentSrc || img.src;
    dlg.querySelector('img').alt = img.alt;
    dlg.querySelector('p').textContent = img.alt;
    dlg.showModal();
  });
})();
