// Site interactions: nav, reveal-on-scroll, counters, lightbox, table of contents, card tilt.
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // nav background on scroll + mobile menu
  const nav = document.querySelector('.nav');
  const onScroll = () => nav && nav.classList.toggle('scrolled', window.scrollY > 20);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  const mb = document.querySelector('.menu-btn');
  if (mb) mb.addEventListener('click', () => document.querySelector('.nav ul').classList.toggle('open'));
  document.querySelectorAll('.nav ul a').forEach(a => a.addEventListener('click', () => document.querySelector('.nav ul').classList.remove('open')));

  // reveal
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  document.querySelectorAll('.rv').forEach(el => reduce ? el.classList.add('in') : io.observe(el));

  // count-up numbers
  const fmt = (n, d) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    const el = e.target, end = parseFloat(el.dataset.count), dec = (el.dataset.count.split('.')[1] || '').length;
    if (reduce) { el.firstChild.nodeValue = fmt(end, dec); return; }
    const t0 = performance.now(), dur = 1400;
    const step = t => { const p = Math.min(1, (t - t0) / dur), k = 1 - Math.pow(1 - p, 3); el.firstChild.nodeValue = fmt(end * k, dec); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: 0.5 });
  if (!reduce) document.querySelectorAll('[data-count]').forEach(el => { el.firstChild.nodeValue = '0'; cio.observe(el); });

  // subtle 3D tilt on project cards (pointer devices only)
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.card').forEach(c => {
      c.addEventListener('mousemove', e => {
        const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        c.style.transform = `perspective(900px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-4px)`;
      });
      c.addEventListener('mouseleave', () => { c.style.transform = ''; });
    });
  }

  // lightbox for galleries
  const lb = document.createElement('div'); lb.className = 'lb';
  lb.innerHTML = '<button type="button" aria-label="Close">CLOSE ✕</button><img alt=""><div class="cap"></div>';
  document.body.appendChild(lb);
  const close = () => lb.classList.remove('open');
  lb.addEventListener('click', e => { if (e.target === lb || e.target.tagName === 'BUTTON') close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.querySelectorAll('.gallery figure').forEach(f => f.addEventListener('click', () => {
    const img = f.querySelector('img'); lb.querySelector('img').src = img.currentSrc || img.src; lb.querySelector('img').alt = img.alt;
    lb.querySelector('.cap').textContent = (f.querySelector('figcaption') || {}).textContent || ''; lb.classList.add('open');
  }));

  // table of contents highlight
  const toc = [...document.querySelectorAll('.toc a')];
  if (toc.length) {
    const tio = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) toc.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('.prose h2[id]').forEach(h => tio.observe(h));
  }
})();
