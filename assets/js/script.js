// ===================== REFERENCE FILTER =====================
(function () {
    var pills = document.querySelectorAll('.filter-pill');
    var cards = document.querySelectorAll('.ref-card');

    pills.forEach(function (pill) {
        pill.addEventListener('click', function () {
            pills.forEach(function (p) { p.classList.remove('active'); });
            pill.classList.add('active');

            var filter = pill.getAttribute('data-filter');
            cards.forEach(function (card) {
                if (filter === 'all' || card.getAttribute('data-type') === filter) {
                    card.classList.remove('filter-hidden');
                } else {
                    card.classList.add('filter-hidden');
                }
            });
        });
    });
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
