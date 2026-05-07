// ===================== REFERENCE THUMB & FILTER =====================
(function () {
    var pills  = document.querySelectorAll('.filter-pill');
    var thumbs = document.querySelectorAll('.ref-thumb');
    var cards  = document.querySelectorAll('.ref-card.ref-detail');

    // --- Activate a reference card by data-ref (detail panel only) ---
    // DRUM PRISM: preserve-3d stage with front/top faces, rotates as rigid body
    var prismLock = null;

    function activateRef(ref, direction) {
        var panel       = document.querySelector('.ref-detail-panel');
        var newCard     = document.querySelector('.ref-card.ref-detail[data-ref="' + ref + '"]');
        if (!newCard) return;

        var dir = direction || 'right';

        // Cancel any running animation first, so finish() can settle the correct .active card
        if (prismLock) {
            clearTimeout(prismLock.timer);
            prismLock.finish();
            prismLock = null;
        }

        // Query currentCard AFTER finish() has resolved the previous animation state
        var currentCard = document.querySelector('.ref-card.ref-detail.active');
        if (currentCard === newCard) return;

        if (!currentCard) {
            newCard.classList.add('active');
            return;
        }

        var DUR    = 700;
        var mobile = window.innerWidth < 700;
        var axis   = mobile ? 'Y' : 'X';
        var h      = currentCard.offsetHeight;
        var r      = Math.round(mobile ? currentCard.offsetWidth / 2 : h / 2);

        // Measure new card height before building stage (it has display:none)
        newCard.style.display = 'grid';
        var newH = newCard.offsetHeight;
        newCard.style.display = '';

        // Stage with translateZ(-r) offset to keep front face at z=0
        var stage = document.createElement('div');
        stage.style.cssText =
            'position:relative;width:100%;height:' + h + 'px;' +
            'transform-style:preserve-3d;' +
            'transform:translateZ(-' + r + 'px) rotate' + axis + '(0deg);';

        panel.insertBefore(stage, currentCard);
        stage.appendChild(currentCard);
        stage.appendChild(newCard);

        // Front face: current card at z=+r (world z=0)
        currentCard.classList.remove('active');
        currentCard.style.cssText =
            'display:grid;position:absolute;top:0;left:0;width:100%;height:100%;' +
            'backface-visibility:hidden;' +
            'transform:rotate' + axis + '(0deg) translateZ(' + r + 'px);';

        // Side face: new card perpendicular
        // Y-axis (mobile): right → side=-90, drum=+90  (card comes from right)
        // X-axis (desktop): right → side=+90, drum=-90  (card comes from above)
        var sideAngle = mobile ? (dir === 'right' ? -90 : 90) : (dir === 'right' ? 90 : -90);
        newCard.style.cssText =
            'display:grid;position:absolute;top:0;left:0;width:100%;height:' + newH + 'px;' +
            'backface-visibility:hidden;' +
            'transform:rotate' + axis + '(' + sideAngle + 'deg) translateZ(' + r + 'px);';

        void stage.offsetWidth; // force layout

        // Animate height and drum simultaneously
        var drumAngle = mobile ? (dir === 'right' ? 90 : -90) : (dir === 'right' ? -90 : 90);
        stage.style.transition = 'transform ' + DUR + 'ms cubic-bezier(0.4,0,0.2,1), height ' + DUR + 'ms cubic-bezier(0.4,0,0.2,1)';
        stage.style.transform  = 'translateZ(-' + r + 'px) rotate' + axis + '(' + drumAngle + 'deg)';
        stage.style.height     = newH + 'px';

        function finish() {
            panel.insertBefore(currentCard, stage);
            panel.insertBefore(newCard, currentCard);
            panel.removeChild(stage);
            currentCard.style.cssText = '';
            newCard.classList.add('active');
            newCard.style.cssText = '';
        }

        prismLock = {
            finish: finish,
            timer: setTimeout(function () { finish(); prismLock = null; }, DUR + 60)
        };
    }

    // Expose for coverflow module
    window.__cfActivateRef = activateRef;

    // Thumb click is handled by coverflow IIFE via event delegation

    // --- Filter pills ---
    pills.forEach(function (pill) {
        pill.addEventListener('click', function () {
            pills.forEach(function (p) { p.classList.remove('active'); });
            pill.classList.add('active');

            var filter = pill.getAttribute('data-filter');

            thumbs.forEach(function (thumb) {
                if (filter === 'all' || thumb.getAttribute('data-type') === filter) {
                    thumb.classList.remove('filter-hidden');
                } else {
                    thumb.classList.add('filter-hidden');
                }
            });

            // Signal position update after filter
            if (window.__posUpdateAfterFilter) window.__posUpdateAfterFilter();
        });
    });
})();

// ===================== REFERENCE COVERFLOW =====================
(function () {
    var viewport = document.querySelector('.ref-thumbs-viewport');
    var row      = document.querySelector('.ref-thumbs-row');
    var prevBtn  = document.querySelector('.ref-thumbs-arrow--prev');
    var nextBtn  = document.querySelector('.ref-thumbs-arrow--next');
    if (!viewport) return;

    var activeIdx = 0;

    // 3-D config per relative position (clamped to ±3, beyond that hidden)
    var posCfg = {
        '-3': { ry:  54, scale: 0.76, overlay: 0.82 },
        '-2': { ry:  40, scale: 0.86, overlay: 0.62 },
        '-1': { ry:  28, scale: 0.94, overlay: 0.30 },
         '0': { ry:   0, scale: 1.00, overlay: 0 },
         '1': { ry: -28, scale: 0.94, overlay: 0.30 },
         '2': { ry: -40, scale: 0.86, overlay: 0.62 },
         '3': { ry: -54, scale: 0.76, overlay: 0.82 },
    };

    function getVisible() {
        return Array.from(row.querySelectorAll('.ref-thumb:not(.filter-hidden)'));
    }

    function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
    function wrapIdx(i, n) { return ((i % n) + n) % n; }

    function updatePositions() {
        var thumbs = getVisible();
        var n = thumbs.length;
        if (!n) return;

        activeIdx = wrapIdx(activeIdx, n);

        var vw    = window.innerWidth;
        var range        = vw < 700 ? 1 : 2;
        var overlapRatio = vw < 700 ? 0.88 : 0.60;

        var cardW = thumbs[0].offsetWidth;
        var half  = Math.round(cardW / 2);
        var step  = cardW * overlapRatio;
        var cardH = thumbs[0].offsetHeight;

        row.style.height = (cardH + 32) + 'px';

        thumbs.forEach(function (t, i) {
            var rel = i - activeIdx;
            if (rel >  Math.floor(n / 2)) rel -= n;
            if (rel < -Math.floor(n / 2)) rel += n;

            var relC = clamp(rel, -2, 2);
            var cfg  = posCfg[String(relC)];
            if (range === 1 && Math.abs(relC) === 1) {
                cfg = { ry: relC < 0 ? 46 : -46, scale: 0.78, overlay: 0.65 };
            }
            var tx   = rel * step;

            t.style.transition = 'transform 0.65s cubic-bezier(0.4,0,0.2,1)';
            t.style.transform  = 'perspective(900px) translateX(' + tx + 'px) rotateY(' + cfg.ry + 'deg) scale(' + cfg.scale + ')';
            t.style.opacity    = 1;
            t.style.zIndex     = 10 - Math.abs(rel);
            t.style.left       = 'calc(50% - ' + half + 'px)';

            t.style.setProperty('--cf-overlay', String(cfg.overlay));

            t.style.visibility = Math.abs(rel) > range ? 'hidden' : '';
        });
    }

    function setActive(newIdx) {
        var thumbs = getVisible();
        var n = thumbs.length;
        if (!n) return;

        // Determine direction before wrapping
        var delta = newIdx - activeIdx;
        if (delta >  Math.floor(n / 2)) delta -= n;
        if (delta < -Math.floor(n / 2)) delta += n;
        var dir = delta >= 0 ? 'right' : 'left';

        activeIdx = wrapIdx(newIdx, n);

        thumbs.forEach(function (t, i) {
            t.classList.toggle('active', i === activeIdx);
        });

        if (window.__cfActivateRef) {
            window.__cfActivateRef(thumbs[activeIdx].getAttribute('data-ref'), dir);
        }

        updatePositions();
        updateArrows();
    }

    function updateArrows() {
        var n = getVisible().length;
        // Never disable — infinite loop; disable only if ≤1 item
        if (prevBtn) prevBtn.disabled = n <= 1;
        if (nextBtn) nextBtn.disabled = n <= 1;
    }

    // --- Arrow buttons ---
    if (prevBtn) prevBtn.addEventListener('click', function () { setActive(activeIdx - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { setActive(activeIdx + 1); });

    // --- Click on a thumb ---
    var moved = false;
    row.addEventListener('click', function (e) {
        if (moved) { moved = false; return; }
        var t = e.target.closest('.ref-thumb');
        if (!t || t.classList.contains('filter-hidden')) return;
        var idx = getVisible().indexOf(t);
        if (idx === -1) return;
        setActive(idx);
        var detailPanel = document.querySelector('.ref-detail-panel');
        if (detailPanel) detailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    // --- Mouse drag (swipe gesture changes active card) ---
    var dragging  = false;
    var startX    = 0;
    var THRESHOLD = 55;

    viewport.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        dragging = true;
        startX   = e.clientX;
        moved    = false;
        e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
        if (!dragging) return;
        if (Math.abs(e.clientX - startX) > 6) moved = true;
    });

    document.addEventListener('mouseup', function (e) {
        if (!dragging) return;
        dragging = false;
        if (!moved) return;
        var dx = e.clientX - startX;
        if      (dx >  THRESHOLD) setActive(activeIdx - 1);
        else if (dx < -THRESHOLD) setActive(activeIdx + 1);
    });

    // --- Touch swipe ---
    var touchStartX = 0;
    viewport.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });

    viewport.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].clientX - touchStartX;
        if      (dx >  50) setActive(activeIdx - 1);
        else if (dx < -50) setActive(activeIdx + 1);
    }, { passive: true });

    // --- Mouse wheel → prev / next (debounced) ---
    // Only intercept horizontal-dominant wheel events (trackpad left/right swipe).
    // Vertical scroll passes through so the page snap engine can navigate sections.
    var wheelCooldown = false;
    viewport.addEventListener('wheel', function (e) {
        var absX = Math.abs(e.deltaX);
        var absY = Math.abs(e.deltaY);
        if (absY > absX) return; // vertical-dominant → let page snap handle it
        e.preventDefault();
        if (wheelCooldown) return;
        var delta = e.deltaX;
        if      (delta > 0) setActive(activeIdx + 1);
        else if (delta < 0) setActive(activeIdx - 1);
        wheelCooldown = true;
        setTimeout(function () { wheelCooldown = false; }, 320);
    }, { passive: false });

    // --- MutationObserver: sync if .active is toggled externally ---
    var mo = new MutationObserver(function () {
        var thumbs = getVisible();
        var ext = thumbs.findIndex(function (t) { return t.classList.contains('active'); });
        if (ext !== -1 && ext !== activeIdx) {
            activeIdx = ext;
            updatePositions();
            updateArrows();
        }
    });
    row.querySelectorAll('.ref-thumb').forEach(function (t) {
        mo.observe(t, { attributes: true, attributeFilter: ['class'] });
    });

    // --- Init ---
    (function init() {
        var thumbs = getVisible();
        if (!thumbs.length) return;
        // Detect pre-rendered active (set in HTML to avoid layout shift)
        var preActive = thumbs.findIndex(function (t) { return t.classList.contains('active'); });
        activeIdx = preActive !== -1 ? preActive : 0;
        if (preActive === -1) {
            thumbs[0].classList.add('active');
            if (window.__cfActivateRef) window.__cfActivateRef(thumbs[0].getAttribute('data-ref'));
        }
        updatePositions();
        updateArrows();

        // Enable panel height transition after initial render
        var panel = document.querySelector('.ref-detail-panel');
        if (panel) requestAnimationFrame(function () {
            requestAnimationFrame(function () { panel.classList.remove('no-transition'); });
        });
    })();

    // --- After filter: reset to first visible ---
    window.__posUpdateAfterFilter = function () {
        row.querySelectorAll('.ref-thumb').forEach(function (t) { t.classList.remove('active'); });
        activeIdx = 0;
        var thumbs = getVisible();
        if (thumbs.length) {
            thumbs[0].classList.add('active');
            if (window.__cfActivateRef) window.__cfActivateRef(thumbs[0].getAttribute('data-ref'));
        }
        updatePositions();
        updateArrows();
    };

    // --- Recalc on resize ---
    window.addEventListener('resize', function () { updatePositions(); });

    // --- Mobile navigation helpers ---
    window.__cfNext = function () { setActive(activeIdx + 1); };
    window.__cfPrev = function () { setActive(activeIdx - 1); };
})();

// ===================== MINIMAP =====================
(function () {
    var outers = document.querySelectorAll('.ref-image-outer');

    outers.forEach(function (outer) {
        var scrollEl = outer.querySelector('.ref-image-wrap');
        var minimap = outer.querySelector('.ref-minimap');
        if (!scrollEl || !minimap) return;

        var dimTop = minimap.querySelector('.ref-minimap-dim-top');
        var indicator = minimap.querySelector('.ref-minimap-indicator');
        var dimBottom = minimap.querySelector('.ref-minimap-dim-bottom');

        // --- Indicator sync ---
        function updateIndicator() {
            var scrollH = scrollEl.scrollHeight;
            var clientH = scrollEl.clientHeight;
            var scrollT = scrollEl.scrollTop;
            var mapH = minimap.clientHeight;
            if (!scrollH || !mapH) return;

            var indTop = (scrollT / scrollH) * mapH;
            var indH = Math.max((clientH / scrollH) * mapH, 4);

            dimTop.style.height = indTop + 'px';
            indicator.style.top = indTop + 'px';
            indicator.style.height = indH + 'px';
            dimBottom.style.top = (indTop + indH) + 'px';
            dimBottom.style.height = (mapH - indTop - indH) + 'px';
        }

        scrollEl.addEventListener('scroll', updateIndicator, { passive: true });

        var mainImg = scrollEl.querySelector('img');
        if (mainImg) {
            if (mainImg.complete) updateIndicator();
            else mainImg.addEventListener('load', updateIndicator);
        }

        // --- Minimap drag → scroll preview ---
        function minimapScrollTo(clientY) {
            var rect = minimap.getBoundingClientRect();
            var y = Math.max(0, Math.min(clientY - rect.top, minimap.clientHeight));
            var frac = y / minimap.clientHeight;
            scrollEl.scrollTop = frac * scrollEl.scrollHeight - scrollEl.clientHeight / 2;
        }

        var mmDragging = false;

        minimap.addEventListener('mousedown', function (e) {
            mmDragging = true;
            minimapScrollTo(e.clientY);
            e.preventDefault();
        });

        document.addEventListener('mousemove', function (e) {
            if (mmDragging) minimapScrollTo(e.clientY);
        });

        document.addEventListener('mouseup', function () {
            mmDragging = false;
        });

        minimap.addEventListener('touchstart', function (e) {
            minimapScrollTo(e.touches[0].clientY);
            e.preventDefault();
        }, { passive: false });

        minimap.addEventListener('touchmove', function (e) {
            minimapScrollTo(e.touches[0].clientY);
            e.preventDefault();
        }, { passive: false });

        // --- Mouse wheel → scroll preview ---
        scrollEl.addEventListener('wheel', function (e) {
            e.preventDefault();
            scrollEl.scrollTop += e.deltaY;
        }, { passive: false });

        // --- Preview mouse drag-to-scroll ---
        var prevDragging = false;
        var prevStartY = 0;
        var prevStartScroll = 0;
        var prevMoved = false;

        scrollEl.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            prevDragging = true;
            prevStartY = e.clientY;
            prevStartScroll = scrollEl.scrollTop;
            prevMoved = false;
            e.preventDefault();
        });

        document.addEventListener('mousemove', function (e) {
            if (!prevDragging) return;
            var dy = e.clientY - prevStartY;
            if (Math.abs(dy) > 3) {
                prevMoved = true;
                scrollEl.classList.add('is-dragging');
            }
            if (prevMoved) {
                scrollEl.scrollTop = prevStartScroll - dy;
            }
        });

        document.addEventListener('mouseup', function () {
            if (prevDragging) {
                prevDragging = false;
                scrollEl.classList.remove('is-dragging');
            }
        });

        // Prevent lightbox from opening after a drag
        scrollEl.addEventListener('click', function (e) {
            if (prevMoved) {
                e.stopImmediatePropagation();
                prevMoved = false;
            }
        }, true);

        // --- Preview touch drag-to-scroll ---
        var touchStartY = 0;
        var touchStartScroll = 0;
        var touchMoved = false;

        scrollEl.addEventListener('touchstart', function (e) {
            touchStartY = e.touches[0].clientY;
            touchStartScroll = scrollEl.scrollTop;
            touchMoved = false;
        }, { passive: true });

        scrollEl.addEventListener('touchmove', function (e) {
            var dy = e.touches[0].clientY - touchStartY;
            if (Math.abs(dy) > 5) {
                touchMoved = true;
                e.preventDefault();
                scrollEl.scrollTop = touchStartScroll - dy;
            }
        }, { passive: false });

        scrollEl.addEventListener('touchend', function (e) {
            if (touchMoved) {
                e.stopImmediatePropagation();
                touchMoved = false;
            }
        }, { passive: true });
    });

    // Re-sync on resize
    window.addEventListener('resize', function () {
        document.querySelectorAll('.ref-image-outer').forEach(function (outer) {
            var scrollEl = outer.querySelector('.ref-image-wrap');
            if (scrollEl) scrollEl.dispatchEvent(new Event('scroll'));
        });
    });
})();

// ===================== FLIP TILE TRANSITION =====================
// 5×4 dlaždic, každá má na přední straně výřez starého obrázku
// a na zadní straně výřez nového obrázku. Jšou diagonální vlna otočení.
// Slide swap se stane instantě, animace probhá pouze na obrázku.
(function () {
    var COLS     = 5;
    var ROWS     = 4;
    var FLIP_DUR = 0.45;  // s - délka otočení jedné dlaždice
    var SPREAD   = 0.55;  // s - diagonální stagger rozsah
    var DONE_MS  = Math.round((SPREAD + FLIP_DUR) * 1000 + 80);

    var transitioning = false;

    function buildGrid(frame) {
        var g = document.createElement('div');
        g.className = 'tile-flip-grid';
        for (var row = 0; row < ROWS; row++) {
            for (var col = 0; col < COLS; col++) {
                var tile  = document.createElement('div');
                tile.className = 'tf-tile';
                tile.style.setProperty('--tf-col', col);
                tile.style.setProperty('--tf-row', row);
                tile.style.setProperty('--tf-dur', FLIP_DUR + 's');
                var delay = ((col + row) / (COLS + ROWS - 2) * SPREAD).toFixed(3);
                tile.style.setProperty('--tf-delay', delay + 's');
                var front = document.createElement('div'); front.className = 'tf-front';
                var back  = document.createElement('div'); back.className  = 'tf-back';
                tile.appendChild(front);
                tile.appendChild(back);
                g.appendChild(tile);
            }
        }
        frame.style.position = 'relative';
        frame.appendChild(g);
        return g;
    }

    function getGrid(slide) {
        var frame = slide.querySelector('.cta-cms-visual-frame');
        if (!frame) return null;
        return frame.querySelector('.tile-flip-grid') || buildGrid(frame);
    }

    window.triggerFlipTransition = function (outSlide, inSlide) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            outSlide.classList.remove('is-active');
            inSlide.classList.add('is-active');
            return;
        }
        if (transitioning) return;
        transitioning = true;

        var outImg = outSlide.querySelector('.cta-cms-visual-frame img');
        var inImg  =  inSlide.querySelector('.cta-cms-visual-frame img');
        var grid   = getGrid(inSlide);

        if (!grid || !outImg || !inImg) {
            outSlide.classList.remove('is-active');
            inSlide.classList.add('is-active');
            transitioning = false;
            return;
        }

        // Nastav obrázky na přední a zadní strany
        grid.querySelectorAll('.tf-front').forEach(function (f) {
            f.style.backgroundImage = 'url("' + outImg.src + '")';
        });
        grid.querySelectorAll('.tf-back').forEach(function (b) {
            b.style.backgroundImage = 'url("' + inImg.src + '")';
        });

        // Reset dlaždic do výchozí polohy (bez animace)
        var tiles = grid.querySelectorAll('.tf-tile');
        tiles.forEach(function (t) {
            t.classList.add('tf-no-anim');
            t.classList.remove('is-flipping');
        });

        // Grid zakryje obrázek
        grid.style.opacity = '1';

        // rAF×2: browser vykreslí resetovaný stav, pak spustí přechod
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                tiles.forEach(function (t) { t.classList.remove('tf-no-anim'); });
                tiles.forEach(function (t) { t.classList.add('is-flipping'); });
            });
        });

        // Po dokončení: jen skryj grid – slide a text řeší show() nezávisle
        setTimeout(function () {
            grid.style.opacity = '0';
            transitioning = false;
        }, DONE_MS);
    };
})();

// ===================== CTA SLIDER =====================
(function () {
    var slider = document.querySelector('[data-slider]');
    if (!slider) return;

    var slides = Array.from(slider.querySelectorAll('[data-slide]'));
    var dots   = Array.from(slider.querySelectorAll('.cta-slider-dot'));
    var current = 0;
    var INTERVAL = 10000;
    var autoplayTimer;
    var remainingTime = INTERVAL;
    var tickStart = 0;
    var isPaused = false;

    function clearTimers() {
        clearTimeout(autoplayTimer);
        clearInterval(autoplayTimer);
    }

    function show(idx) {
        if (idx === current) return;
        var prevIdx = current;
        dots[current].classList.remove('is-active');
        current = (idx + slides.length) % slides.length;
        var newDot = dots[current];
        newDot.classList.remove('is-active');
        void newDot.offsetWidth; // force reflow → restartuje ::after animaci
        newDot.classList.add('is-active');

        var outSlide = slides[prevIdx];
        var inSlide  = slides[current];

        // TEXT: swap okamžitě – fadeout na outSlide, pak ihned fadein na inSlide
        outSlide.classList.add('is-text-out');
        outSlide.classList.remove('is-active');
        inSlide.classList.add('is-active');
        setTimeout(function () { outSlide.classList.remove('is-text-out'); }, 200);

        // OBRÁZEK: flip-tile animace běží zcela asynchronně, nezávisle na textu
        if (typeof triggerFlipTransition === 'function') {
            triggerFlipTransition(outSlide, inSlide);
        }
    }

    function next() { show(current + 1); }

    function startInterval() {
        clearTimers();
        remainingTime = INTERVAL;
        tickStart = Date.now();
        autoplayTimer = setInterval(function () {
            next();
            remainingTime = INTERVAL;
            tickStart = Date.now();
        }, INTERVAL);
    }

    // init – activate first slide directly (bypasses show() guard)
    slides[0].classList.add('is-active');
    dots[0].classList.add('is-active');
    startInterval();

    dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () {
            show(i);
            remainingTime = INTERVAL; // reset to full cycle on explicit navigation
            if (!isPaused) {
                startInterval();
            }
        });
    });

    // Pause on hover – continue from where it stopped
    slider.addEventListener('mouseenter', function () {
        if (isPaused) return;
        isPaused = true;
        var elapsed = Date.now() - tickStart;
        remainingTime = Math.max(remainingTime - elapsed, 0);
        clearTimers();
    });
    slider.addEventListener('mouseleave', function () {
        if (!isPaused) return;
        isPaused = false;
        clearTimers();
        tickStart = Date.now();
        autoplayTimer = setTimeout(function () {
            next();
            startInterval();
        }, remainingTime);
    });
})();

// ===================== HAMBURGER / MOBILE DRAWER =====================
(function () {
    var hamburger = document.querySelector('.nav-hamburger');
    var drawer    = document.querySelector('.mobile-drawer');
    var overlay   = document.querySelector('.mobile-overlay');
    if (!hamburger || !drawer || !overlay) return;

    function openDrawer() {
        drawer.classList.add('is-open');
        overlay.classList.add('is-open');
        document.body.classList.add('drawer-open');
        hamburger.setAttribute('aria-expanded', 'true');
        drawer.setAttribute('aria-hidden', 'false');
        overlay.setAttribute('aria-hidden', 'false');
        // focus first link for accessibility
        var first = drawer.querySelector('a, button');
        if (first) first.focus();
    }

    function closeDrawer() {
        drawer.classList.remove('is-open');
        overlay.classList.remove('is-open');
        document.body.classList.remove('drawer-open');
        hamburger.setAttribute('aria-expanded', 'false');
        drawer.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('aria-hidden', 'true');
        hamburger.focus();
    }

    hamburger.addEventListener('click', openDrawer);
    overlay.addEventListener('click', closeDrawer);
    drawer.querySelector('.mobile-drawer-close').addEventListener('click', closeDrawer);

    // Close on Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
            closeDrawer();
        }
    });

    // Close drawer when a link is clicked (navigation)
    drawer.querySelectorAll('.mobile-drawer-link').forEach(function (link) {
        link.addEventListener('click', closeDrawer);
    });
})();

// ===================== SMOOTH SCROLL FOR ANCHOR LINKS =====================
(function () {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            var id = a.getAttribute('href').slice(1);
            var target = document.getElementById(id);
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
})();

// ===================== SCROLLSPY =====================
(function () {
    var sectionIds = ['uvod', 'reference', 'vyhody', 'cenik', 'kontakt'];
    var sections = sectionIds.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var navLinks = document.querySelectorAll('.site-page-nav-link[href^="#"]');
    if (!navLinks.length || !sections.length) return;

    var ratios = {};

    function setActive(id) {
        navLinks.forEach(function (link) {
            link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
        });
    }

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            ratios[entry.target.id] = entry.intersectionRatio;
        });
        var best = null;
        var bestRatio = 0;
        sections.forEach(function (sec) {
            var r = ratios[sec.id] || 0;
            if (r > bestRatio) { bestRatio = r; best = sec.id; }
        });
        if (best) setActive(best);
    }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });

    sections.forEach(function (sec) { observer.observe(sec); });
})();

// ===================== ORCA DOUBLE-CLICK EASTER EGG =====================
(function () {
    var logo = document.querySelector('.site-header-logo');
    if (!logo) return;
    var hidden = false;
    var timer = null;
    var DELAY = 380;

    logo.addEventListener('click', function (e) {
        if (timer) {
            // druhý klik — dvojklik detekován
            clearTimeout(timer);
            timer = null;
            e.preventDefault();
            hidden = !hidden;
            document.querySelectorAll('body > section, body > main, body > footer').forEach(function (el) {
                el.style.visibility = hidden ? 'hidden' : '';
                el.style.opacity    = hidden ? '0'       : '';
            });
        } else {
            // první klik — čekáme na případný druhý
            timer = setTimeout(function () {
                timer = null;
                // jednoduchý klik — naviguj normálně
                window.location.href = logo.getAttribute('href') || '/';
            }, DELAY);
            e.preventDefault();
        }
    });
})();

// ===================== HEADER SCROLL BEHAVIOUR =====================
// Removed – sticky snap sections keep header always visible and unscrolled.

// ===================== FPS COUNTER =====================
(function () {
    var el = document.createElement('div');
    el.id = 'fps-counter';
    el.textContent = '-- fps';
    document.body.appendChild(el);

    var frames = 0;
    var last = performance.now();

    function tick() {
        frames++;
        var now = performance.now();
        if (now - last >= 500) {
            el.textContent = Math.round(frames * 1000 / (now - last)) + ' fps';
            frames = 0;
            last = now;
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
})();

// ===================== SCROLL RULER =====================
(function () {
    var navLinks = document.querySelectorAll('.site-page-nav-link[href^="#"]');
    if (!navLinks.length) return;

    var ruler = document.createElement('nav');
    ruler.className = 'scroll-ruler';
    ruler.setAttribute('aria-label', 'Navigace sekcemi');
    ruler.setAttribute('aria-hidden', 'true');

    var rulerItems = [];
    var rulerTicks = [];

    navLinks.forEach(function (link, i) {
        var item = document.createElement('a');
        item.className = 'scroll-ruler-item';
        item.href = link.getAttribute('href');
        item.dataset.section = link.getAttribute('href').slice(1);

        var label = document.createElement('span');
        label.className = 'scroll-ruler-label';
        label.textContent = link.textContent.replace(/\u00a0/g, '\u00a0').trim();

        var dot = document.createElement('span');
        dot.className = 'scroll-ruler-dot';
        dot.setAttribute('aria-hidden', 'true');

        item.appendChild(label);
        item.appendChild(dot);
        ruler.appendChild(item);
        rulerItems.push(item);

        if (i < navLinks.length - 1) {
            var tick = document.createElement('div');
            tick.className = 'scroll-ruler-tick';
            tick.setAttribute('aria-hidden', 'true');
            ruler.appendChild(tick);
            rulerTicks.push(tick);
        }
    });

    document.body.appendChild(ruler);

    // Position each item proportionally to its section's scroll offset
    var sectionIds = Array.from(navLinks).map(function (l) { return l.getAttribute('href').slice(1); });
    var sections = sectionIds.map(function (id) { return document.getElementById(id); }).filter(Boolean);

    function positionItems() {
        var rulerH = ruler.offsetHeight;
        if (rulerH <= 0 || !sections.length) return;

        // Mirror the native scrollbar exactly:
        //  trackH = 100vh (full viewport, scrollbar track spans whole screen)
        //  thumbH = trackH * trackH / scrollHeight  (browser formula)
        //  thumbTop at section i = scrollTop_i / scrollMax * (trackH - thumbH)
        //  dot = center of thumb → thumbTop + thumbH/2
        //  tick = bottom of thumb at section i → thumbTop + thumbH
        //  All screen-y values offset by headerH to get ruler-y
        var vh       = window.innerHeight;
        var scrollH  = document.documentElement.scrollHeight;
        var scrollMax = scrollH - vh;
        var headerH  = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
        var trackH   = vh;                        // scrollbar track = full viewport
        var thumbH   = trackH * trackH / scrollH; // native browser thumb formula

        sections.forEach(function (sec, i) {
            var docTop       = sec.getBoundingClientRect().top + window.scrollY;
            var snapScrollTop = Math.max(0, docTop - headerH);
            var frac         = scrollMax > 0 ? snapScrollTop / scrollMax : 0;
            var thumbTop     = frac * (trackH - thumbH);

            // dot at thumb centre
            var dotY = thumbTop + thumbH / 2 - headerH;
            if (rulerItems[i]) rulerItems[i].style.top = Math.max(0, dotY) + 'px';

            // tick at thumb bottom (= where next thumb top begins)
            if (i < sections.length - 1 && rulerTicks[i]) {
                var tickY = thumbTop + thumbH - headerH;
                rulerTicks[i].style.top = Math.max(0, tickY) + 'px';
            }
        });
    }

    positionItems();
    window.addEventListener('resize', positionItems);

    // smooth scroll on click
    rulerItems.forEach(function (item) {
        item.addEventListener('click', function (e) {
            var id = item.dataset.section;
            var target = document.getElementById(id);
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // active state via IntersectionObserver
    var ratios = {};
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            ratios[entry.target.id] = entry.intersectionRatio;
        });
        var best = null;
        var bestRatio = 0;
        sections.forEach(function (sec) {
            var r = ratios[sec.id] || 0;
            if (r > bestRatio) { bestRatio = r; best = sec.id; }
        });
        if (best) {
            rulerItems.forEach(function (item) {
                item.classList.toggle('is-active', item.dataset.section === best);
            });
        }
    }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });

    sections.forEach(function (sec) { observer.observe(sec); });
})();

// ===================== MOBILE SWIPE & NAV (DETAIL PANEL) =====================
(function () {
    var panel   = document.querySelector('.ref-detail-panel');
    var prevBtn = document.querySelector('.ref-mobile-nav-btn--prev');
    var nextBtn = document.querySelector('.ref-mobile-nav-btn--next');

    if (prevBtn) prevBtn.addEventListener('click', function () { if (window.__cfPrev) window.__cfPrev(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { if (window.__cfNext) window.__cfNext(); });

    if (!panel) return;
    var startX = 0;
    panel.addEventListener('touchstart', function (e) {
        startX = e.touches[0].clientX;
    }, { passive: true });
    panel.addEventListener('touchend', function (e) {
        if (window.innerWidth >= 700) return;
        var dx = e.changedTouches[0].clientX - startX;
        if      (dx >  50) { if (window.__cfNext) window.__cfNext(); }
        else if (dx < -50) { if (window.__cfPrev) window.__cfPrev(); }
    }, { passive: true });
})();
