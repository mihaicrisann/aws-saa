/* Lecture runtime: theme memory, scroll progress, reveal-on-scroll, and a
   bridge to the app reader when embedded in its iframe. */
(function () {
  var root = document.documentElement;
  var KEY = 'saa.theme';
  var embedded = window.self !== window.top;
  if (embedded) document.body.classList.add('embedded');

  var apply = function (t) { root.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light'); };
  try { apply(localStorage.getItem(KEY)); } catch (e) { apply('light'); }

  var btn = document.querySelector('.theme-btn');
  if (btn) {
    var paint = function () { btn.textContent = root.getAttribute('data-theme') === 'dark' ? '☀' : '☾'; };
    paint();
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      paint();
    });
  }
  // the app toggles its theme in the same key; follow it while embedded
  addEventListener('storage', function (e) { if (e.key === KEY) apply(e.newValue); });

  // print with every self-check answer visible
  addEventListener('beforeprint', function () {
    document.querySelectorAll('details.check').forEach(function (d) { d.dataset.wasOpen = d.open ? '1' : ''; d.open = true; });
  });
  addEventListener('afterprint', function () {
    document.querySelectorAll('details.check').forEach(function (d) { d.open = d.dataset.wasOpen === '1'; });
  });

  var bar = document.querySelector('.progress-rail > i');
  if (bar) {
    var tick = function () {
      var max = document.body.scrollHeight - window.innerHeight;
      bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
    };
    addEventListener('scroll', tick, { passive: true });
    addEventListener('resize', tick);
    tick();
  }

  var targets = document.querySelectorAll('.lecture .note, .lecture .table-wrap, .lecture .decisions, .lecture .takeaways');
  if (!('IntersectionObserver' in window)) {
    root.classList.add('no-anim');
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.05 });
    targets.forEach(function (t) { io.observe(t); });
    setTimeout(function () {
      targets.forEach(function (t) {
        if (t.getBoundingClientRect().top < window.innerHeight) t.classList.add('seen');
      });
    }, 40);
  }

  if (embedded) {
    var report = function () {
      parent.postMessage({ type: 'lecture:height', height: document.documentElement.scrollHeight }, '*');
    };
    report();
    new ResizeObserver(report).observe(document.body);
    document.addEventListener('toggle', report, true);
    // reveals inside an iframe: the parent scrolls, so show everything
    targets.forEach(function (t) { t.classList.add('seen'); });
    // deep links: the parent scrolls, so tell it where the section is
    var jump = function () {
      var id = location.hash.slice(1);
      var el = id && document.getElementById(id);
      if (!el) return;
      el.classList.add('target');
      parent.postMessage({ type: 'lecture:scrollTo', top: el.getBoundingClientRect().top + window.scrollY }, '*');
    };
    setTimeout(jump, 60);
    addEventListener('hashchange', jump);
    // let the reader's shortcuts work while the frame has focus
    addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      parent.postMessage({ type: 'lecture:key', key: e.key }, '*');
    });
  }
})();
