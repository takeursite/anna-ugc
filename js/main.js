// ---------- Общее: размер «пикселя макета» (--u) и признак мобильной раскладки ----------
var isMobile = window.matchMedia('(max-width: 900px)').matches;
var unitProbe = document.createElement('div');
unitProbe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;height:0;width:calc(100 * var(--u))';
document.body.appendChild(unitProbe);
function unitPx() { return unitProbe.getBoundingClientRect().width / 100; }

// Демо-форма: ничего не отправляем.
document.getElementById('inquiry').addEventListener('submit', function (e) {
  e.preventDefault();
});

// ---------- Selected Work: видео и плеер ----------
(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var ownActivation = false;
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) {
    addEventListener(t, function () { ownActivation = true; }, { capture: true, passive: true });
  });
  var hasActivation = function () {
    return (navigator.userActivation && navigator.userActivation.hasBeenActive) || ownActivation;
  };
  var pref = null; // выбор звука для всех карточек: null — не выбирали, true/false
  var HOVER_DELAY = 120;

  var cards = [].map.call(document.querySelectorAll('.cw'), function (cw) {
    return {
      cw: cw,
      v: cw.querySelector('video'),
      glow: cw.querySelector('.glow'),
      pp: cw.querySelector('.pp'),
      snd: cw.querySelector('.snd'),
      bar: cw.querySelector('.bar'),
      fill: cw.querySelector('.ln i'),
      visible: false, userPaused: false, hoverTimer: 0, glowTimer: 0, stopTimer: 0
    };
  });

  function play(c) {
    var p = c.v.play();
    if (p && p.catch) p.catch(function () {});
  }

  // Ленивая загрузка: источник подставляется чуть заранее, до входа в зону видимости
  var byVideo = new Map();
  var loader = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var v = e.target;
      if (!v.getAttribute('src')) v.src = v.dataset.src;
      loader.unobserve(v);
    });
  }, { rootMargin: '400px 0px' });

  // Воспроизведение только пока карточка видна на экране
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var c = byVideo.get(e.target);
      c.visible = e.isIntersecting;
      if (c.visible) {
        if (!c.v.getAttribute('src')) c.v.src = c.v.dataset.src;
        if (!c.userPaused) play(c);
      } else {
        c.v.pause();
      }
    });
  });
  cards.forEach(function (c) { c.v.muted = true; byVideo.set(c.v, c); loader.observe(c.v); io.observe(c.v); });

  function syncPP(c) { c.pp.classList.toggle('paused', c.v.paused); c.pp.setAttribute('aria-label', c.v.paused ? 'Play' : 'Pause'); }
  function syncSnd(c, attn) {
    c.snd.classList.toggle('muted', c.v.muted);
    c.snd.classList.toggle('attn', !!attn);
    c.snd.setAttribute('aria-label', c.v.muted ? 'Unmute' : 'Mute');
  }

  function applySound(c) {
    var want = pref === null ? true : pref;
    if (want && hasActivation()) {
      c.v.muted = false;
      if (c.v.paused && !c.userPaused && c.visible) {
        var p = c.v.play();
        if (p && p.catch) p.catch(function () { c.v.muted = true; syncSnd(c, true); });
      }
      syncSnd(c, false);
    } else {
      c.v.muted = true;
      syncSnd(c, want && !hasActivation());
    }
  }

  function drawGlow(c) {
    if (c.v.readyState < 2) return;
    try { c.glow.getContext('2d').drawImage(c.v, 0, 0, 32, 56); } catch (e) {}
  }

  function enter(c) {
    var r = c.cw.getBoundingClientRect();
    var s = 1, ty = 0, tx = 0;
    if (!reduced.matches) {
      s = Math.min(1.35, 0.9 * innerHeight / r.height);
      var halfH = r.height * s / 2, cy = r.top + r.height / 2;
      var top = document.querySelector('.header').offsetHeight + 12, bottom = innerHeight - 12;
      if (cy - halfH < top) ty = top - (cy - halfH);
      else if (cy + halfH > bottom) ty = bottom - (cy + halfH);
      var halfW = r.width * s / 2, cx = r.left + r.width / 2, edge = 8;
      if (cx - halfW < edge) tx = edge - (cx - halfW);
      else if (cx + halfW > innerWidth - edge) tx = innerWidth - edge - (cx + halfW);
    }
    c.cw.style.setProperty('--tx', tx + 'px');
    c.cw.style.setProperty('--s', s);
    c.cw.style.setProperty('--ty', ty + 'px');
    clearTimeout(c.stopTimer);
    c.cw.classList.add('on');
    applySound(c);
    syncPP(c);
    if (!reduced.matches) {
      drawGlow(c);
      clearInterval(c.glowTimer);
      c.glowTimer = setInterval(function () { drawGlow(c); }, 80);
    }
  }

  function leave(c) {
    clearTimeout(c.hoverTimer);
    c.cw.classList.remove('on');
    c.v.muted = true;
    syncSnd(c, false);
    if (c.userPaused) { c.userPaused = false; if (c.visible) play(c); }
    c.stopTimer = setTimeout(function () { clearInterval(c.glowTimer); }, 500);
  }

  cards.forEach(function (c) {
    // Ловим наведение на неподвижную обёртку; увеличенный .cs — её потомок, поэтому mouseleave не срабатывает на его краях.
    c.cw.addEventListener('mouseenter', function () {
      clearTimeout(c.hoverTimer);
      c.hoverTimer = setTimeout(function () { enter(c); }, HOVER_DELAY);
    });
    c.cw.addEventListener('mouseleave', function () { leave(c); });

    c.pp.addEventListener('click', function () {
      if (c.v.paused) { c.userPaused = false; play(c); } else { c.userPaused = true; c.v.pause(); }
    });
    c.v.addEventListener('play', function () { syncPP(c); });
    c.v.addEventListener('pause', function () { syncPP(c); });

    c.snd.addEventListener('click', function () {
      pref = c.v.muted; // следующее состояние: было без звука — включаем
      ownActivation = true;
      applySound(c);
    });

    c.bar.addEventListener('click', function (e) {
      var r = c.bar.getBoundingClientRect();
      if (c.v.duration) c.v.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * c.v.duration;
    });
    c.v.addEventListener('timeupdate', function () {
      if (c.v.duration) c.fill.style.width = (c.v.currentTime / c.v.duration * 100) + '%';
    });
  });
})();

// ---------- Meet Anna: видео-слоты на баннере (без звука и плеера) ----------
(function () {
  var vids = [].slice.call(document.querySelectorAll('.aslot video'));
  var loader = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      if (!e.target.getAttribute('src')) e.target.src = e.target.dataset.src;
      loader.unobserve(e.target);
    });
  }, { rootMargin: '400px 0px' });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        if (!v.getAttribute('src')) v.src = v.dataset.src;
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        v.pause();
      }
    });
  });
  vids.forEach(function (v) { v.muted = true; loader.observe(v); io.observe(v); });
})();

// ---------- How It Works: точка едет по кривой вместе со скроллом ----------
(function () {
  var section = document.querySelector('.how');
  var curve = section && section.querySelector(isMobile ? '.curve.mob' : '.curve.desk');
  var path = curve && curve.querySelector('.cp');
  var dot = curve && curve.querySelector('.dot');
  if (!path || !dot || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  var L = path.getTotalLength();
  // Привязки шагов (координаты в системе SVG), по порядку обхода кривой 01 → 02 → 03 → 04
  var anchors = isMobile
    ? [[250.7, 9.7], [86.8, 358.4], [375.2, 200.1], [397.6, 517.2]]          // кривая телефона (621.7×519.2)
    : [[517.178, 19.3501], [589.178, 545.35], [1225.18, 76.3501], [1477.18, 796.35]];
  // Длина пути до ближайшей к привязке точки кривой
  var stepAt = anchors.map(function (a) {
    var best = 0, bd = Infinity;
    for (var i = 0; i <= 2000; i++) {
      var l = L * i / 2000, pt = path.getPointAtLength(l);
      var d = (pt.x - a[0]) * (pt.x - a[0]) + (pt.y - a[1]) * (pt.y - a[1]);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  });
  var steps = [1, 2, 3, 4].map(function (n) { return [].slice.call(section.querySelectorAll('[data-s="' + n + '"]')); });

  path.style.strokeDasharray = L;

  function place(len) {
    var pt = path.getPointAtLength(len);
    gsap.set(dot, { x: pt.x, y: pt.y });
    path.style.strokeDashoffset = L - len;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    place(L); // без анимации: линия целиком, тексты видны
    return;
  }

  var shown = [false, false, false, false];
  steps.forEach(function (els) { gsap.set(els, { opacity: 0, y: 28 }); });
  place(0);

  var state = { p: 0 };
  gsap.to(state, {
    p: 1,
    ease: 'none',
    scrollTrigger: { trigger: section, start: 'top 60%', end: 'bottom 70%', scrub: 0.8 },
    onUpdate: function () {
      var len = L * state.p;
      place(len);
      stepAt.forEach(function (at, i) {
        var on = len >= at;
        if (on === shown[i]) return;
        shown[i] = on;
        gsap.to(steps[i], { opacity: on ? 1 : 0, y: on ? 0 : 28, duration: 0.6, ease: 'power2.out', overwrite: true, stagger: 0.08 });
      });
    }
  });
})();

// ---------- FAQ: падение листочков, «дыхание» и живая бумага при наведении ----------
(function () {
  var section = document.querySelector('.faq');
  if (!section || !window.gsap || !window.ScrollTrigger) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; // листочки остаются статичными
  gsap.registerPlugin(ScrollTrigger);

  var uPx = unitPx;
  var num = function (el, name) { return parseFloat(el.style.getPropertyValue(name)); };
  var RAD = Math.PI / 180;

  var papers = [].slice.call(section.querySelectorAll('.fi')).map(function (fi) {
    var th = num(fi, '--r'), w = num(fi, '--w'), h = num(fi, '--h');
    var sh = fi.querySelector('.sh'), tx = fi.querySelector('.tx');
    var sv = fi.style.getPropertyValue('--sh').trim().split(/\s+/).map(parseFloat); // x y blur
    return {
      fi: fi, sh: sh, tx: tx, hit: fi.querySelector('.hit'),
      pair: [sh, tx], th: th, w: w, h: h, y0: num(fi, '--y'), sv: sv, z: +fi.style.getPropertyValue('--z'),
      ss: isMobile ? (300 * innerWidth / 390) / w : 1, // масштаб теней на мобильном
      k: { v: 0 }, // глубина тени: 0 — базовая, 1 — максимальная
      breath: null
    };
  });

  // Тот же вид, что в CSS (поворот вокруг центра), но вращение вокруг верхнего края:
  // компенсируем сдвиг в процентах от размера бокса, поэтому на ресайзе ничего не уезжает.
  function base(p) {
    var r = p.th * RAD;
    return {
      transformOrigin: '50% 0%',
      xPercent: 50 * (p.h / p.w) * Math.sin(r),
      yPercent: 50 * (1 - Math.cos(r)),
      rotation: p.th
    };
  }

  function shadow(p) {
    var k = p.k.v, s = p.sv;
    p.sh.style.filter = 'drop-shadow(' + (p.ss * s[0] * (1 + 0.9 * k)).toFixed(2) + 'px ' + (p.ss * s[1] * (1 + 1.1 * k)).toFixed(2) + 'px ' +
      (p.ss * s[2] * (1 + 2.2 * k)).toFixed(2) + 'px rgba(0,0,0,' + (0.25 + 0.12 * k).toFixed(3) + '))';
  }

  papers.forEach(function (p) {
    gsap.set(p.pair, base(p));
    // старт: листок над секцией (секция обрезает, поэтому его не видно)
    p.startY = isMobile ? -120 * innerWidth / 390 : -(p.y0 + p.h + 120) * uPx();
    p.kick = (p.th >= 0 ? 1 : -1) * 16;
    gsap.set(p.pair, { y: p.startY, rotation: p.th + p.kick, opacity: isMobile ? 0 : 1 });
    p.k.v = 1; shadow(p);
  });

  function breathe(p, i) {
    p.breath = gsap.fromTo(p.fi, { y: -3 * uPx() }, {
      y: 3 * uPx(), duration: 3.6 + i * 0.55, ease: 'sine.inOut', yoyo: true, repeat: -1
    });
    p.breath.progress((i * 0.37) % 1);
  }

  function land(p, i, delay) {
    var u = uPx(), s = (p.th >= 0 ? 1 : -1);
    var tl = gsap.timeline({ delay: delay, onComplete: function () { p.dropped = true; breathe(p, i); } });
    if (isMobile) tl.to(p.pair, { opacity: 1, duration: 0.25, ease: 'none' }, 0);
    tl.to(p.pair, { y: 16 * u, rotation: p.th - s * 2.5, duration: 0.62, ease: 'power2.in' }, 0)    // падение с «перелётом»
      .to(p.k, { v: 0, duration: 0.62, ease: 'power2.in', onUpdate: function () { shadow(p); } }, 0)
      .to(p.pair, { y: 0, rotation: p.th, duration: 0.5, ease: 'back.out(2.2)' });                  // отскок и успокоение
  }

  function drop() {
    // порядок слоёв снизу вверх: 3 → 5 → 4 → 1 → 2, каждый следующий падает на предыдущий
    [3, 5, 4, 1, 2].forEach(function (n, i) {
      var p = papers.filter(function (q) { return q.z === ({ 3: 1, 5: 2, 4: 3, 1: 4, 2: 5 })[n]; })[0];
      land(p, i, 0.12 + i * 0.16);
    });
  }

  if (isMobile) {
    // на мобильном листочки стоят стопкой: каждый падает, когда доскроллили до него
    papers.forEach(function (p, i) {
      ScrollTrigger.create({ trigger: p.fi, start: 'top 88%', once: true, onEnter: function () { land(p, i, 0); } });
    });
  } else {
    ScrollTrigger.create({ trigger: section, start: 'top 30%', once: true, onEnter: drop });
  }

  // Hover: подъём, глубже тень, затухающая дрожь вокруг базового поворота
  papers.forEach(function (p) {
    p.hit.addEventListener('mouseenter', function (e) {
      if (!p.dropped) return;
      var u = uPx(), r = p.hit.getBoundingClientRect();
      var s = e.clientX < r.left + r.width / 2 ? -1 : 1;
      gsap.killTweensOf(p.pair, 'y,rotation');
      gsap.killTweensOf(p.k);
      gsap.to(p.pair, { y: -14 * u, duration: 0.35, ease: 'power2.out' });
      gsap.to(p.k, { v: 1, duration: 0.35, ease: 'power2.out', onUpdate: function () { shadow(p); } });
      gsap.timeline()
        .to(p.pair, { rotation: p.th + s * 2.8, duration: 0.11, ease: 'sine.out' })
        .to(p.pair, { rotation: p.th - s * 1.8, duration: 0.13, ease: 'sine.inOut' })
        .to(p.pair, { rotation: p.th + s * 0.9, duration: 0.12, ease: 'sine.inOut' })
        .to(p.pair, { rotation: p.th - s * 0.3, duration: 0.09, ease: 'sine.inOut' })
        .to(p.pair, { rotation: p.th, duration: 0.08, ease: 'sine.out' });
    });
    p.hit.addEventListener('mouseleave', function () {
      if (!p.dropped) return;
      gsap.killTweensOf(p.pair, 'y');
      gsap.killTweensOf(p.k);
      gsap.to(p.pair, { y: 0, duration: 0.5, ease: 'power2.out' });
      gsap.to(p.k, { v: 0, duration: 0.5, ease: 'power2.out', onUpdate: function () { shadow(p); } });
    });
  });
})();

// ---------- Мобильное меню (бургер) ----------
(function () {
  var header = document.querySelector('.header');
  var btn = header && header.querySelector('.burger');
  if (!btn) return;
  function set(open) { header.classList.toggle('open', open); btn.setAttribute('aria-expanded', open); }
  btn.addEventListener('click', function (e) { e.stopPropagation(); set(!header.classList.contains('open')); });
  header.querySelectorAll('.mmenu a').forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
  document.addEventListener('click', function (e) { if (!header.contains(e.target)) set(false); });
  addEventListener('scroll', function () { if (header.classList.contains('open')) set(false); }, { passive: true });
})();
