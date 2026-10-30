/* Track Daily — touch feedback: a press "squish" on buttons plus a soft ripple from the tap point.
   The ripple lives in its own fixed overlay, so it never changes the layout or clipping of the tapped element. */
(function () {
  'use strict';
  if (window.__tdTouch) return;
  window.__tdTouch = true;

  var css =
    'button:not(.eye):not([disabled]),[role="button"],[role="tab"],.tap{transition:transform .12s ease,filter .12s ease;-webkit-tap-highlight-color:transparent}' +
    'button:not(.eye):not([disabled]):active,[role="button"]:active,[role="tab"]:active,.tap:active{transform:scale(.96);filter:brightness(.96)}' +
    '.td-ripple-host{position:fixed;pointer-events:none;overflow:hidden;z-index:2147483000}' +
    '.td-ripple{position:absolute;border-radius:50%;background:currentColor;opacity:.22;transform:scale(0);animation:td-ripple .55s ease-out forwards}' +
    '@keyframes td-ripple{to{transform:scale(1);opacity:0}}' +
    '.td-press{transform:scale(.975) !important;transition:transform .1s ease !important}' +
    '@keyframes td-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}' +
    '@keyframes td-pop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}' +
    '.page:not(.hidden) > *:not(.stagger-in):not(.form-section){animation:td-rise .45s cubic-bezier(.22,.8,.3,1) backwards}' +
    '.page:not(.hidden) .card:not(.stagger-in):not(.form-section),.page:not(.hidden) .grid > *:not(.stagger-in):not(.form-section){animation:td-pop .45s cubic-bezier(.22,.8,.3,1) backwards}' +
    '.page:not(.hidden) > *:nth-child(2):not(.stagger-in):not(.form-section){animation-delay:.05s}.page:not(.hidden) > *:nth-child(3):not(.stagger-in):not(.form-section){animation-delay:.1s}' +
    '.page:not(.hidden) > *:nth-child(4):not(.stagger-in):not(.form-section){animation-delay:.15s}.page:not(.hidden) > *:nth-child(n+5):not(.stagger-in):not(.form-section){animation-delay:.2s}' +
    '.page:not(.hidden) .card:nth-child(2):not(.stagger-in):not(.form-section){animation-delay:.08s}.page:not(.hidden) .card:nth-child(3):not(.stagger-in):not(.form-section){animation-delay:.16s}' +
    '.page:not(.hidden) .card:nth-child(n+4):not(.stagger-in):not(.form-section){animation-delay:.24s}' +
    '@media (prefers-reduced-motion:reduce){.page:not(.hidden) > *:not(.stagger-in):not(.form-section),.page:not(.hidden) .card:not(.stagger-in):not(.form-section),.page:not(.hidden) .grid > *:not(.stagger-in):not(.form-section){animation:none !important}.td-ripple-host{display:none}' +
    'button:active,[role="button"]:active,[role="tab"]:active,.tap:active{transform:none !important}}';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var TARGET = 'button:not([disabled]),[role="button"],[role="tab"],.tap,.card,[onclick]';
  var pressed = null;
  function release() { if (pressed) { pressed.classList.remove('td-press'); pressed = null; } }
  document.addEventListener('pointerup', release, { passive: true });
  document.addEventListener('pointercancel', release, { passive: true });
  document.addEventListener('scroll', release, { passive: true, capture: true });

  document.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    var el = e.target.closest && e.target.closest(TARGET);
    if (!el) return;
    // Cards and plain clickable elements only react when they actually look clickable.
    var generic = !el.matches('button,[role="button"],[role="tab"],.tap');
    if (generic && getComputedStyle(el).cursor !== 'pointer') return;
    if (generic) { release(); pressed = el; el.classList.add('td-press'); }
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;

    var host = document.createElement('span');
    host.className = 'td-ripple-host';
    host.style.left = r.left + 'px';
    host.style.top = r.top + 'px';
    host.style.width = r.width + 'px';
    host.style.height = r.height + 'px';
    host.style.borderRadius = getComputedStyle(el).borderRadius;
    host.style.color = getComputedStyle(el).color;

    var size = Math.max(r.width, r.height) * 2.2;
    var dot = document.createElement('span');
    dot.className = 'td-ripple';
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = (e.clientX - r.left - size / 2) + 'px';
    dot.style.top = (e.clientY - r.top - size / 2) + 'px';
    host.appendChild(dot);
    document.body.appendChild(host);
    dot.addEventListener('animationend', function () { host.remove(); });
    setTimeout(function () { host.remove(); }, 900);
  }, { passive: true });
})();
