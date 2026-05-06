// ==UserScript==
// @name         YouTube Mono/Stereo Toggle
// @namespace    https://github.com/userscripts/youtube-mono-stereo
// @version      1.1.0
// @description  Adds a mono/stereo toggle button to the YouTube player controls
// @author       userscript
// @match        https://www.youtube.com/*
// @match        https://music.youtube.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let audioCtx   = null;
  let splitter   = null;
  let merger     = null;
  let sourceNode = null;
  let isMono     = GM_getValue('ytMonoEnabled', false);

  // ── Build SVG icon via DOM (no innerHTML — CSP safe) ──────────────────────
  function makeSvgIcon(label) {
    const NS  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width',  '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('fill',   'currentColor');

    label.split('').forEach((ch, i) => {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x',           String(i * 10 + 2));
      t.setAttribute('y',           '17');
      t.setAttribute('font-size',   '13');
      t.setAttribute('font-weight', 'bold');
      t.setAttribute('font-family', 'sans-serif');
      t.textContent = ch;
      svg.appendChild(t);
    });

    return svg;
  }

  // ── Audio graph ────────────────────────────────────────────────────────────
  function buildAudioGraph(video) {
    if (audioCtx) return;

    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    splitter   = audioCtx.createChannelSplitter(2);
    merger     = audioCtx.createChannelMerger(2);
    sourceNode = audioCtx.createMediaElementSource(video);

    sourceNode.connect(splitter);
    splitter.connect(merger, 0, 0);
    splitter.connect(merger, 1, 1);
    merger.connect(audioCtx.destination);
  }

  function rebuildMerger() {
    try { merger.disconnect(); } catch (_) {}
    merger = audioCtx.createChannelMerger(2);
    merger.connect(audioCtx.destination);
  }

  function applyMono(video) {
    if (!audioCtx) buildAudioGraph(video);

    rebuildMerger();

    if (isMono) {
      // Both output channels receive L + R (mono mix)
      splitter.connect(merger, 0, 0);
      splitter.connect(merger, 1, 0);
      splitter.connect(merger, 0, 1);
      splitter.connect(merger, 1, 1);
    } else {
      // True stereo passthrough
      splitter.connect(merger, 0, 0);
      splitter.connect(merger, 1, 1);
    }

    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  // ── Update button appearance ───────────────────────────────────────────────
  function updateButton(btn) {
    btn.title      = isMono ? 'Switch to Stereo' : 'Switch to Mono';
    btn.style.color = isMono ? '#ff4444' : 'white';

    while (btn.firstChild) btn.removeChild(btn.firstChild);
    btn.appendChild(makeSvgIcon(isMono ? 'MO' : 'ST'));
  }

  // ── Create button ──────────────────────────────────────────────────────────
  function createButton() {
    const btn = document.createElement('button');
    btn.className = 'ytp-button yt-mono-toggle';

    Object.assign(btn.style, {
      width:          '40px',
      height:         '40px',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      background:     'none',
      border:         'none',
      cursor:         'pointer',
      color:          isMono ? '#ff4444' : 'white',
      padding:        '0',
      outline:        'none',
      transition:     'color 0.2s, opacity 0.2s',
    });

    updateButton(btn);

    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.8'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1';   });

    btn.addEventListener('click', () => {
      const video = document.querySelector('video');
      if (!video) return;

      isMono = !isMono;
      GM_setValue('ytMonoEnabled', isMono);
      updateButton(btn);
      applyMono(video);
    });

    return btn;
  }

  // ── Inject into player controls ────────────────────────────────────────────
  function injectButton() {
    if (document.querySelector('.yt-mono-toggle')) return;

    const controls = document.querySelector('.ytp-right-controls');
    if (!controls) return;

    const btn = createButton();
    controls.insertBefore(btn, controls.firstChild);

    // Apply saved mono state once video is ready
    if (isMono) {
      const video = document.querySelector('video');
      if (video) {
        const apply = () => applyMono(video);
        if (video.readyState >= 2) apply();
        else video.addEventListener('canplay', apply, { once: true });
      }
    }
  }

  // ── Observer for SPA navigation ────────────────────────────────────────────
  const observer = new MutationObserver(injectButton);
  observer.observe(document.body, { childList: true, subtree: true });

  injectButton();

})();