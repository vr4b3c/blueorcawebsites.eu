var BlueOrca = window.BlueOrca = window.BlueOrca || {};
BlueOrca.carousel = {};

var afterNextPaint = BlueOrca.afterNextPaint || function (fn) {
    requestAnimationFrame(function () {
        requestAnimationFrame(fn);
    });
};

BlueOrca.afterNextPaint = afterNextPaint;

// ===================== REFERENCE THUMB & FILTER =====================
(function () {
    var pills  = document.querySelectorAll('.filter-pill');
    var thumbs = document.querySelectorAll('.ref-thumb');

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

        var DUR    = 1100;
        var mobile = window.innerWidth < 700;
        var axis   = mobile ? 'Y' : 'X';
        var h      = currentCard.offsetHeight;
        var r      = Math.round(mobile ? currentCard.offsetWidth / 2 : h / 2);

        // Measure new card height before building stage (it has display:none)
        newCard.style.display = 'grid';
        var newH = newCard.offsetHeight;
        // display reset omitted — newCard.style.cssText below overrides it immediately

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

        // Animate height and drum simultaneously
        var drumAngle = mobile ? (dir === 'right' ? 90 : -90) : (dir === 'right' ? -90 : 90);
        stage.style.height     = newH + 'px';
        afterNextPaint(function () {
            stage.style.transition = 'transform ' + DUR + 'ms cubic-bezier(0.4,0,0.2,1)';
            stage.style.transform  = 'translateZ(-' + r + 'px) rotate' + axis + '(' + drumAngle + 'deg)';
        });

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
    BlueOrca.carousel.activateRef = activateRef;

    // Lock .ref-detail-panel to the height of the tallest card so switching
    // cards never causes layout jumps or section-height flickering.
    function lockPanelHeight() {
        var panel = document.querySelector('.ref-detail-panel');
        if (!panel) return;
        var allCards = Array.from(panel.querySelectorAll('.ref-card.ref-detail'));
        var maxH = 0;
        allCards.forEach(function (c) {
            var savedCss = c.style.cssText;
            c.style.cssText = 'display:grid;position:absolute;visibility:hidden;width:100%;';
            var h = c.offsetHeight;
            c.style.cssText = savedCss;
            if (h > maxH) maxH = h;
        });
        if (maxH > 0) panel.style.minHeight = maxH + 'px';
    }

    // Run on load and on resize (debounced)
    lockPanelHeight();
    var _panelResizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(_panelResizeTimer);
        _panelResizeTimer = setTimeout(lockPanelHeight, 120);
    });

    // --- Filter pills ---
    pills.forEach(function (pill) {
        pill.addEventListener('click', function () {
            pills.forEach(function (p) { p.classList.remove('active'); p.setAttribute('aria-pressed', 'false'); });
            pill.classList.add('active');
            pill.setAttribute('aria-pressed', 'true');

            var filter = pill.getAttribute('data-filter');

            thumbs.forEach(function (thumb) {
                if (filter === 'all' || thumb.getAttribute('data-type') === filter) {
                    thumb.classList.remove('filter-hidden');
                } else {
                    thumb.classList.add('filter-hidden');
                }
            });

            // Signal position update after filter
            if (BlueOrca.carousel.posUpdateAfterFilter) BlueOrca.carousel.posUpdateAfterFilter();
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

    var activeIdx     = 0;
    var _animating    = false;
    var _queued       = null;   // last requested idx received during animation lock
    var _restoreTransitionRaf = 0;

    // Transition string used for animated moves
    var CF_TRANSITION = 'transform 1.0s cubic-bezier(0.4,0,0.2,1)';

    // 3-D config per relative position; rel=±(range+1) shares position with ±range
    // but sits one z-index layer below — always ready behind the boundary items.
    var posCfg = {
        '-3': { ry:  54, scale: 0.60, overlay: 0.82 },
        '-2': { ry:  40, scale: 0.72, overlay: 0.62 },
        '-1': { ry:  28, scale: 0.85, overlay: 0.30 },
         '0': { ry:   0, scale: 1.00, overlay: 0 },
         '1': { ry: -28, scale: 0.85, overlay: 0.30 },
         '2': { ry: -40, scale: 0.72, overlay: 0.62 },
         '3': { ry: -54, scale: 0.60, overlay: 0.82 },
    };

    // ── Helpers ────────────────────────────────────────────────────────────

    function getVisible() {
        return Array.from(row.querySelectorAll('.ref-thumb:not(.filter-hidden)'));
    }

    function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
    function wrapIdx(i, n)    { return ((i % n) + n) % n; }
    function normalizeDelta(d, n) {
        if (d >  Math.floor(n / 2)) d -= n;
        if (d < -Math.floor(n / 2)) d += n;
        return d;
    }

    // How many items to show each side of centre (responsive)
    // Desktop ≥1024: range 2 (5 visible); tablet <1024: range 1 (3 visible)
    function getRange() { return window.innerWidth < 1024 ? 1 : 2; }

    // rel=0 → 20, rel=+1 → 18, rel=-1 → 17, rel=+2 → 16, rel=-2 → 15,
    // rel=+3 → 14 (under +2), rel=-3 → 13 (under -2) ...
    function cfZIndex(rel) {
        return rel >= 0 ? (20 - rel * 2) : (20 + rel * 2 - 1);
    }

    // Apply all positional inline styles to a thumb in one place.
    // delayZIndex: defer z-index change to 1/3 through the animation so items
    // don't pop stacking layers at the very start of their move.
    function applyStyle(t, tx, cfg, rel, half, transition, delayZIndex) {
        t.style.transition = transition || 'none';
        t.style.transform  = 'perspective(900px) translateX(' + tx + 'px) rotateY(' + cfg.ry + 'deg) scale(' + cfg.scale + ')';
        if (delayZIndex) {
            var newZ = String(cfZIndex(rel));
            setTimeout(function () { t.style.zIndex = newZ; }, Math.round(CF_LOCK_MS / 5));
        } else {
            t.style.zIndex = String(cfZIndex(rel));
        }
        t.style.opacity    = '1';
        t.style.left       = 'calc(50% - ' + half + 'px)';
        t.style.setProperty('--cf-overlay', String(cfg.overlay));
        t.style.visibility = '';
    }

    // ── Position functions ─────────────────────────────────────────────────

    // Reset all thumbs to the centre (used when section scrolls out of view)
    function centerPositions() {
        var thumbs = getVisible();
        var n = thumbs.length;
        if (!n) return;
        var cardW = thumbs[0].offsetWidth;
        var half  = Math.round(cardW / 2);
        var cardH = thumbs[0].offsetHeight;
        row.style.height = (cardH + 32) + 'px';
        thumbs.forEach(function (t, i) {
            var rel = normalizeDelta(i - activeIdx, n);
            t.setAttribute('data-cf-rel', String(rel));
            t.style.transition = 'none';
            t.style.transform  = 'perspective(900px) translateX(0px) rotateY(0deg) scale(1)';
            t.style.opacity    = '1';
            t.style.zIndex     = String(cfZIndex(rel));
            t.style.left       = 'calc(50% - ' + half + 'px)';
            t.style.visibility = '';
            t.style.setProperty('--cf-overlay', '0');
        });
    }

    // Spread all thumbs into coverflow positions.
    // Items at |rel| == range+1 are positioned identically to |rel| == range
    // but with lower z-index — they act as permanent "underwings" so there's
    // never an empty gap when boundary items slide inward.
    // Items beyond range+1 are hidden (visibility:hidden).
    function updatePositions() {
        var thumbs = getVisible();
        var n = thumbs.length;
        if (!n) return;

        if (_restoreTransitionRaf) {
            cancelAnimationFrame(_restoreTransitionRaf);
            _restoreTransitionRaf = 0;
        }

        activeIdx = wrapIdx(activeIdx, n);

        var range        = getRange();
        var visRange     = range + 1;          // slots ±visRange are visible but underlaid
        var vw           = window.innerWidth;
        var overlapRatio = vw >= 1024 ? 0.60 : 0.72; // tablet: wider spacing between 3 items
        var cardW        = thumbs[0].offsetWidth;
        var half         = Math.round(cardW / 2);
        var step         = cardW * overlapRatio;
        var cardH        = thumbs[0].offsetHeight;
        var hiddenToShow = [];

        row.style.height = (cardH + 32) + 'px';

        thumbs.forEach(function (t, i) {
            var rel = normalizeDelta(i - activeIdx, n);

            // Items beyond visRange: invisible, no layout needed
            if (Math.abs(rel) > visRange) {
                t.style.visibility = 'hidden';
                t.setAttribute('data-cf-rel', String(rel));
                return;
            }

            // rel clamped for config lookup; ±visRange uses same visual config as ±range
            var relC = clamp(rel, -range, range);
            var cfg  = posCfg[String(relC)];

            // ±visRange items sit at the same tx as ±range (behind them, same position)
            var txRel = clamp(rel, -range, range);
            var tx    = txRel * step;

            var prevRel = parseInt(t.getAttribute('data-cf-rel') || String(rel), 10);
            var wasHidden = Math.abs(prevRel) > visRange;

            t.setAttribute('data-cf-rel', String(rel));

            if (wasHidden) {
                // Snap silently from off-screen into the underlaid slot
                applyStyle(t, tx, cfg, rel, half, null);
                hiddenToShow.push(t);
            } else {
                // Normal animated move — delay z-index swap so stacking order
                // changes at 1/3 through the animation, not at its start
                applyStyle(t, tx, cfg, rel, half, CF_TRANSITION, true);
            }
        });

        if (hiddenToShow.length) {
            _restoreTransitionRaf = requestAnimationFrame(function () {
                hiddenToShow.forEach(function (thumb) {
                    thumb.style.transition = CF_TRANSITION;
                });
                _restoreTransitionRaf = 0;
            });
        }
    }

    // ── Navigation ─────────────────────────────────────────────────────────

    function updateArrows() {
        var n = getVisible().length;
        if (prevBtn) prevBtn.disabled = n <= 1;
        if (nextBtn) nextBtn.disabled = n <= 1;
    }

    // Public entry point
    function setActive(newIdx) {
        // If an animation is running, queue the request and handle it after unlock
        if (_animating) {
            _queued = newIdx;
            return;
        }

        var thumbs = getVisible();
        var n = thumbs.length;
        if (!n) return;

        setOneStep(newIdx);
    }

    // Duration must match CF_TRANSITION (1.0s) + small buffer
    var CF_LOCK_MS = 1050;

    function setOneStep(newIdx) {
        var thumbs = getVisible();
        var n = thumbs.length;
        if (!n) return;

        var delta = normalizeDelta(newIdx - activeIdx, n);
        var dir = delta >= 0 ? 'right' : 'left';

        activeIdx = wrapIdx(newIdx, n);

        thumbs.forEach(function (t, i) {
            t.classList.toggle('active', i === activeIdx);
        });

        if (BlueOrca.carousel.activateRef) {
            BlueOrca.carousel.activateRef(thumbs[activeIdx].getAttribute('data-ref'), dir);
        }

        updatePositions();
        updateArrows();

        // Lock input for the duration of the transition, then handle any queued request
        _animating = true;
        setTimeout(function () {
            _animating = false;
            if (_queued !== null) {
                var q = _queued;
                _queued = null;
                setActive(q);
            }
        }, CF_LOCK_MS);
    }

    // ── Event listeners ────────────────────────────────────────────────────

    if (prevBtn) prevBtn.addEventListener('click', function () { setActive(activeIdx - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { setActive(activeIdx + 1); });

    // Click on a thumb
    var moved = false;
    row.addEventListener('click', function (e) {
        if (moved) { moved = false; return; }
        var t = e.target.closest('.ref-thumb');
        if (!t || t.classList.contains('filter-hidden')) return;
        var idx = getVisible().indexOf(t);
        if (idx === -1) return;
        // Temporarily disable mandatory scroll-snap so the panel height transition
        // doesn't cause the browser to snap to the next section
        var html = document.documentElement;
        html.style.scrollSnapType = 'none';
        setActive(idx);
        setTimeout(function () { html.style.scrollSnapType = ''; }, 1200);
    });

    // Mouse drag / swipe
    var dragging = false;
    var startX   = 0;
    var DRAG_THRESHOLD = 55;

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
    }, { passive: true });

    document.addEventListener('mouseup', function (e) {
        if (!dragging) return;
        dragging = false;
        if (!moved) return;
        var dx = e.clientX - startX;
        if      (dx >  DRAG_THRESHOLD) setActive(activeIdx - 1);
        else if (dx < -DRAG_THRESHOLD) setActive(activeIdx + 1);
    });

    // Touch swipe
    var touchStartX = 0;
    viewport.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });

    viewport.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].clientX - touchStartX;
        if      (dx >  50) setActive(activeIdx - 1);
        else if (dx < -50) setActive(activeIdx + 1);
    }, { passive: true });

    // Horizontal trackpad / mouse-wheel swipe (debounced)
    var wheelCooldown = false;
    viewport.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) return; // vertical → let page snap handle
        e.preventDefault();
        if (wheelCooldown) return;
        if      (e.deltaX > 0) setActive(activeIdx + 1);
        else if (e.deltaX < 0) setActive(activeIdx - 1);
        wheelCooldown = true;
        setTimeout(function () { wheelCooldown = false; }, 320);
    }, { passive: false });

    // Sync if .active is changed externally
    var mo = new MutationObserver(function () {
        var thumbs = getVisible();
        var ext = thumbs.findIndex(function (t) { return t.classList.contains('active'); });
        if (ext !== -1 && ext !== activeIdx) {
            activeIdx = ext;
            updatePositions();
            updateArrows();
        }
    });
    mo.observe(row, { subtree: true, attributes: true, attributeFilter: ['class'] });

    // Debounced resize → recalculate layout
    var _resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(updatePositions, 80);
    });

    // ── Init ───────────────────────────────────────────────────────────────

    (function init() {
        var thumbs = getVisible();
        if (!thumbs.length) return;
        var preActive = thumbs.findIndex(function (t) { return t.classList.contains('active'); });
        activeIdx = preActive !== -1 ? preActive : 0;
        if (preActive === -1) {
            thumbs[0].classList.add('active');
            if (BlueOrca.carousel.activateRef) BlueOrca.carousel.activateRef(thumbs[0].getAttribute('data-ref'));
        }
        centerPositions();
        updateArrows();

        // Enable panel height transition after initial render
        var panel = document.querySelector('.ref-detail-panel');
        if (panel) requestAnimationFrame(function () {
            requestAnimationFrame(function () { panel.classList.remove('no-transition'); });
        });
    })();

    // ── External hooks ─────────────────────────────────────────────────────

    // After filter pill change: reset to first visible item
    BlueOrca.carousel.posUpdateAfterFilter = function () {
        row.querySelectorAll('.ref-thumb').forEach(function (t) { t.classList.remove('active'); });
        activeIdx = 0;
        var thumbs = getVisible();
        if (thumbs.length) {
            thumbs[0].classList.add('active');
            if (BlueOrca.carousel.activateRef) BlueOrca.carousel.activateRef(thumbs[0].getAttribute('data-ref'));
        }
        updatePositions();
        updateArrows();
    };

    // Mobile navigation buttons
    BlueOrca.carousel.next = function () { setActive(activeIdx + 1); };
    BlueOrca.carousel.prev = function () { setActive(activeIdx - 1); };

    // Called by IntersectionObserver when section enters / leaves viewport
    BlueOrca.carousel.enter = function () { updatePositions(); };
    BlueOrca.carousel.leave = function () { centerPositions(); };
})();

// ===================== REFERENCE SECTION SCROLL TRIGGER =====================
(function () {
    var refSection = document.getElementById('reference');
    if (!refSection) return;
    var entered = false;
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting && !entered) {
                entered = true;
                refSection.classList.add('in-view');
                if (BlueOrca.carousel.enter) BlueOrca.carousel.enter();
            } else if (!entry.isIntersecting && entered) {
                entered = false;
                refSection.classList.remove('in-view');
                if (BlueOrca.carousel.leave) BlueOrca.carousel.leave();
            }
        });
    }, { threshold: 0.25 });
    observer.observe(refSection);
})();

// ===================== MINIMAP =====================
(function () {
    var outers = document.querySelectorAll('.ref-image-outer');
    if (!outers.length) return;

    var instances = [];
    var activeMinimapDrag = null;
    var activePreviewDrag = null;

    function stopPreviewDrag() {
        if (!activePreviewDrag) return;
        if (activePreviewDrag.previewDragging) {
            activePreviewDrag.previewSuppressClick = true;
            activePreviewDrag.scrollEl.classList.remove('is-dragging');
        }
        activePreviewDrag = null;
    }

    document.addEventListener('mousemove', function (e) {
        if (activeMinimapDrag) {
            activeMinimapDrag.scrollTo(e.clientY);
        }

        if (!activePreviewDrag) return;

        var dy = e.clientY - activePreviewDrag.previewStartY;
        if (Math.abs(dy) > 3 && !activePreviewDrag.previewDragging) {
            activePreviewDrag.previewDragging = true;
            activePreviewDrag.scrollEl.classList.add('is-dragging');
        }

        if (activePreviewDrag.previewDragging) {
            activePreviewDrag.scrollEl.scrollTop = activePreviewDrag.previewStartScroll - dy;
        }
    }, { passive: true });

    document.addEventListener('mouseup', function () {
        activeMinimapDrag = null;
        stopPreviewDrag();
    });

    outers.forEach(function (outer) {
        var scrollEl = outer.querySelector('.ref-image-wrap');
        var minimap = outer.querySelector('.ref-minimap');
        if (!scrollEl || !minimap) return;

        var dimTop = minimap.querySelector('.ref-minimap-dim-top');
        var indicator = minimap.querySelector('.ref-minimap-indicator');
        var dimBottom = minimap.querySelector('.ref-minimap-dim-bottom');
        var metrics = {
            scrollHeight: 0,
            clientHeight: 0,
            mapHeight: 0,
            mapTop: 0,
            scrollRange: 0,
            indicatorHeight: 4,
            indicatorRange: 0,
        };
        var indicatorRaf = 0;
        var state = {
            scrollEl: scrollEl,
            previewStartY: 0,
            previewStartScroll: 0,
            previewDragging: false,
            previewSuppressClick: false,
            lastIndicatorHeight: null,
            lastIndicatorTop: null,
            lastTopScale: null,
            lastBottomScale: null,
            refreshIndicatorMetrics: refreshIndicatorMetrics,
            scrollTo: minimapScrollTo,
        };

        instances.push(state);

        function readMetrics() {
            var rect = minimap.getBoundingClientRect();
            metrics.scrollHeight = scrollEl.scrollHeight;
            metrics.clientHeight = scrollEl.clientHeight;
            metrics.mapHeight = minimap.clientHeight;
            metrics.mapTop = rect.top;
            metrics.scrollRange = Math.max(metrics.scrollHeight - metrics.clientHeight, 0);
            metrics.indicatorHeight = Math.max(
                metrics.scrollHeight > 0 ? (metrics.clientHeight / metrics.scrollHeight) * metrics.mapHeight : 0,
                4
            );
            metrics.indicatorRange = Math.max(metrics.mapHeight - metrics.indicatorHeight, 0);
        }

        // --- Indicator sync ---
        function updateIndicatorPosition() {
            var mapH = metrics.mapHeight;
            var indH = metrics.indicatorHeight;
            if (!mapH) return;

            var scrollT = Math.max(0, Math.min(scrollEl.scrollTop, metrics.scrollRange));
            var indTop = metrics.scrollRange > 0 ? (scrollT / metrics.scrollRange) * metrics.indicatorRange : 0;
            var topScale = indTop / mapH;
            var bottomScale = Math.max(mapH - indTop - indH, 0) / mapH;

            if (state.lastTopScale !== topScale) {
                dimTop.style.transform = 'scaleY(' + topScale + ')';
                state.lastTopScale = topScale;
            }

            if (state.lastIndicatorTop !== indTop) {
                indicator.style.transform = 'translateY(' + indTop + 'px)';
                state.lastIndicatorTop = indTop;
            }

            if (state.lastBottomScale !== bottomScale) {
                dimBottom.style.transform = 'scaleY(' + bottomScale + ')';
                state.lastBottomScale = bottomScale;
            }
        }

        function applyIndicatorMetrics() {
            if (state.lastIndicatorHeight !== metrics.indicatorHeight) {
                indicator.style.height = metrics.indicatorHeight + 'px';
                state.lastIndicatorHeight = metrics.indicatorHeight;
            }

            updateIndicatorPosition();
        }

        function scheduleIndicatorUpdate() {
            if (indicatorRaf) return;
            indicatorRaf = requestAnimationFrame(function () {
                indicatorRaf = 0;
                updateIndicatorPosition();
            });
        }

        function refreshIndicatorMetrics() {
            readMetrics();
            applyIndicatorMetrics();
        }

        refreshIndicatorMetrics();
        scrollEl.addEventListener('scroll', scheduleIndicatorUpdate, { passive: true });

        var mainImg = scrollEl.querySelector('img');
        if (mainImg) {
            if (mainImg.complete) refreshIndicatorMetrics();
            else mainImg.addEventListener('load', refreshIndicatorMetrics, { once: true });
        }

        // --- Minimap drag → scroll preview ---
        function minimapScrollTo(clientY) {
            var mapH = metrics.mapHeight;
            if (!mapH) return;
            var y = Math.max(0, Math.min(clientY - metrics.mapTop, mapH));
            var frac = y / mapH;
            var nextScrollTop = frac * metrics.scrollHeight - metrics.clientHeight / 2;
            scrollEl.scrollTop = Math.max(0, Math.min(nextScrollTop, metrics.scrollRange));
        }

        minimap.addEventListener('mousedown', function (e) {
            activeMinimapDrag = state;
            readMetrics();
            minimapScrollTo(e.clientY);
            e.preventDefault();
        });

        minimap.addEventListener('touchstart', function (e) {
            readMetrics();
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
            state.previewStartY = e.clientY;
            state.previewStartScroll = scrollEl.scrollTop;
            state.previewDragging = false;
            state.previewSuppressClick = false;
            activePreviewDrag = state;
            e.preventDefault();
        });

        // Prevent lightbox from opening after a drag
        scrollEl.addEventListener('click', function (e) {
            if (state.previewSuppressClick) {
                e.stopImmediatePropagation();
                state.previewSuppressClick = false;
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

        if (typeof ResizeObserver !== 'undefined') {
            var ro = new ResizeObserver(refreshIndicatorMetrics);
            ro.observe(scrollEl);
            ro.observe(minimap);
        }
    });

    // Re-sync on resize
    window.addEventListener('resize', function () {
        instances.forEach(function (instance) {
            instance.refreshIndicatorMetrics();
        });
    });
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
    var dotProgressPhase = false;
    var fadeCleanupTimer = 0;

    function clearTimers() {
        clearTimeout(autoplayTimer);
        clearInterval(autoplayTimer);
    }

    function syncActiveDotProgress() {
        dots.forEach(function (dot) {
            dot.classList.remove('is-progressing-a', 'is-progressing-b');
        });

        var activeDot = dots[current];
        if (!activeDot) return;

        dotProgressPhase = !dotProgressPhase;
        activeDot.classList.add(dotProgressPhase ? 'is-progressing-a' : 'is-progressing-b');
    }

    function show(idx) {
        if (idx === current) return;

        if (fadeCleanupTimer) {
            clearTimeout(fadeCleanupTimer);
            fadeCleanupTimer = 0;
        }
        slides.forEach(function (slide) {
            slide.classList.remove('is-text-out', 'is-leaving', 'is-image-fading');
        });

        var prevIdx = current;
        dots[current].classList.remove('is-active', 'is-progressing-a', 'is-progressing-b');
        current = (idx + slides.length) % slides.length;
        var newDot = dots[current];
        newDot.classList.add('is-active');
        syncActiveDotProgress();

        var outSlide = slides[prevIdx];
        var inSlide  = slides[current];

        // Text se přepne rychle, obrázek zůstane nad novým slidem a prostě vyfadeuje.
        outSlide.classList.add('is-text-out');
        outSlide.classList.add('is-leaving');
        outSlide.classList.remove('is-active');
        inSlide.classList.add('is-active');
        requestAnimationFrame(function () {
            if (outSlide.classList.contains('is-leaving')) {
                outSlide.classList.add('is-image-fading');
            }
        });
        fadeCleanupTimer = setTimeout(function () {
            outSlide.classList.remove('is-text-out', 'is-leaving', 'is-image-fading');
            fadeCleanupTimer = 0;
        }, 750);
    }

    function next() { show(current + 1); }

    function startInterval() {
        clearTimers();
        remainingTime = INTERVAL;
        tickStart = Date.now();
        syncActiveDotProgress();
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

    BlueOrca.ctaSlider = {
        next: function () { show(current + 1); startInterval(); },
        prev: function () { show(current - 1); startInterval(); }
    };
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
            // Use JS navigator if available (gives custom duration), else fallback
            if (BlueOrca.navigateTo && BlueOrca.nearestSectionIdx) {
                var snapSections = Array.from(document.querySelectorAll(
                    '.cta-cms, .references, .vyhody, .cenik, .contact'
                ));
                var idx = snapSections.indexOf(target);
                if (idx !== -1) { BlueOrca.navigateTo(idx); return; }
            }
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
    var activeId = null;

    function setActive(id) {
        if (id === activeId) return;
        activeId = id;
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
    if (typeof window === 'undefined') return;

    var el = document.createElement('div');
    el.id = 'fps-counter';
    el.textContent = '-- FPS (--)';
    document.body.appendChild(el);
    var lastText = el.textContent;

    // Read FPS from MasterRenderer instead of running a separate rAF loop.
    // Using setInterval avoids the duplicate requestAnimationFrame that competed
    // with MasterRenderer's own loop (confirmed as source of 2x rAF in DevTools trace).
    setInterval(function () {
        var master = window.blueOrcaMasterRenderer || null;
        var fps = master ? Math.round(master.currentFPS) : null;
        var maxPossible = master && Number.isFinite(master.maxDisplayFPS) && master.maxDisplayFPS > 0
            ? Math.round(master.maxDisplayFPS)
            : fps;
        var nextText = (fps !== null ? fps : '--')
            + ' FPS (' + (maxPossible !== null ? maxPossible : '--') + ')';
        if (nextText === lastText) return;
        lastText = nextText;
        el.textContent = nextText;
    }, 500);
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
    var rulerContents = [];
    var rulerTicks = [];

    navLinks.forEach(function (link, i) {
        var item = document.createElement('a');
        item.className = 'scroll-ruler-item';
        item.href = link.getAttribute('href');
        item.dataset.section = link.getAttribute('href').slice(1);

        var content = document.createElement('span');
        content.className = 'scroll-ruler-content';

        var label = document.createElement('span');
        label.className = 'scroll-ruler-label';
        label.textContent = link.textContent.replace(/\u00a0/g, '\u00a0').trim();

        var dot = document.createElement('span');
        dot.className = 'scroll-ruler-dot';
        dot.setAttribute('aria-hidden', 'true');

        content.appendChild(label);
        content.appendChild(dot);
        item.appendChild(content);
        ruler.appendChild(item);
        rulerItems.push(item);
        rulerContents.push(content);

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

        // Mirror the native scrollbar, accounting for arrow buttons on Linux:
        //  buttonH = height of each scrollbar arrow (top + bottom), read from CSS var
        //  trackH  = vh - 2*buttonH  (usable thumb travel area)
        //  thumbH  = trackH * vh / scrollH  (thumb represents visible fraction)
        //  thumbTop at section i = frac * (trackH - thumbH)  (relative to track start)
        //  ruler-y = buttonH + thumbTop[+thumbH] - headerH
        var vh        = window.innerHeight;
        var scrollH   = document.documentElement.scrollHeight;
        var scrollMax = scrollH - vh;
        var headerH   = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
        var buttonH   = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scrollbar-button-h')) || 0;
        var trackH    = vh - 2 * buttonH;         // effective track height
        var thumbH    = trackH * vh / scrollH;    // thumb height

        // First pass: compute tick Y values (lane boundaries) and thumb center Y per section
        var tickYs = [];
        var thumbCenters = [];
        sections.forEach(function (sec, i) {
            var docTop        = sec.getBoundingClientRect().top + window.scrollY;
            var snapScrollTop = Math.max(0, docTop - headerH);
            var frac          = scrollMax > 0 ? snapScrollTop / scrollMax : 0;
            var thumbTop      = frac * (trackH - thumbH);
            // center of thumb when this section is snapped (ruler coords)
            thumbCenters.push(buttonH + thumbTop + thumbH / 2 - headerH);
            if (i < sections.length - 1) {
                // tick at thumb bottom converted to ruler coords
                tickYs.push(Math.max(0, buttonH + thumbTop + thumbH - headerH));
            }
        });

        // Stretch each item over its full section lane.
        // First lane: top button is above the ruler (headerH > buttonH), so we extend
        //   the first lane's bottom boundary down by buttonH to compensate.
        // Last lane: bottom button is inside the ruler (last buttonH px of viewport),
        //   so we extend the last lane's top boundary up by buttonH to cover it.
        // Adjacent lanes compensate so there are no gaps.
        var n = rulerItems.length;
        rulerItems.forEach(function (item, i) {
            var laneTop    = i === 0 ? 0 : tickYs[i - 1];
            var laneBottom = i < tickYs.length ? tickYs[i] : rulerH;

            if (n >= 3) {
                if (i === 0)     laneBottom += buttonH;
                if (i === 1)     laneTop    += buttonH;
                if (i === n - 1) laneTop    -= buttonH;
                if (i === n - 2) laneBottom -= buttonH;
            }

            var adjLaneTop = Math.max(0, laneTop);
            item.style.top    = adjLaneTop + 'px';
            item.style.height = Math.max(0, laneBottom - laneTop) + 'px';

            // Position content (label + dot) at exact thumb center within the lane
            if (rulerContents[i]) {
                rulerContents[i].style.top = (thumbCenters[i] - adjLaneTop) + 'px';
            }
        });

        // Position tick elements at lane boundaries
        tickYs.forEach(function (tickY, i) {
            if (rulerTicks[i]) rulerTicks[i].style.top = tickY + 'px';
        });
    }

    positionItems();
    window.addEventListener('resize', positionItems);

    // animated scroll on click — routes through section navigator when possible
    rulerItems.forEach(function (item) {
        item.addEventListener('click', function (e) {
            var id = item.dataset.section;
            var target = document.getElementById(id);
            if (!target) return;
            e.preventDefault();
            if (BlueOrca.navigateTo) {
                var snapSections = Array.from(document.querySelectorAll(
                    '.cta-cms, .references, .vyhody, .cenik, .contact'
                ));
                var idx = snapSections.indexOf(target);
                if (idx !== -1) { BlueOrca.navigateTo(idx); return; }
            }
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // active state via IntersectionObserver
    var ratios = {};
    var activeSection = null;
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
        if (best && best !== activeSection) {
            activeSection = best;
            rulerItems.forEach(function (item) {
                item.classList.toggle('is-active', item.dataset.section === best);
            });
        }
    }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });

    sections.forEach(function (sec) { observer.observe(sec); });
})();

// ===================== HORIZONTAL KEYBOARD NAV (CTA slider / References carousel) =====================
(function () {
    var HEADER_H = 72;
    var snapSections = Array.from(document.querySelectorAll(
        '.cta-cms, .references, .vyhody, .cenik, .contact'
    ));
    if (!snapSections.length) return;

    function nearestIdx() {
        var sy = window.scrollY;
        var best = 0, bestD = Infinity;
        snapSections.forEach(function (s, i) {
            var top = Math.round(s.getBoundingClientRect().top + window.scrollY - HEADER_H);
            var d = Math.abs(top - sy);
            if (d < bestD) { bestD = d; best = i; }
        });
        return best;
    }

    document.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' ||
            e.target.isContentEditable) return;
        var isLeft  = e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A';
        var isRight = e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D';
        if (!isLeft && !isRight) return;
        var idx = nearestIdx();
        if (idx === 0 && BlueOrca.ctaSlider) {
            e.preventDefault();
            isLeft ? BlueOrca.ctaSlider.prev() : BlueOrca.ctaSlider.next();
        } else if (idx === 1 && BlueOrca.carousel) {
            e.preventDefault();
            isLeft ? BlueOrca.carousel.prev() : BlueOrca.carousel.next();
        }
    });

    BlueOrca.nearestSectionIdx = nearestIdx;
})();

// ===================== MOBILE SWIPE & NAV (DETAIL PANEL) =====================
(function () {
    var panel   = document.querySelector('.ref-detail-panel');
    var prevBtn = document.querySelector('.ref-mobile-nav-btn--prev');
    var nextBtn = document.querySelector('.ref-mobile-nav-btn--next');

    if (prevBtn) prevBtn.addEventListener('click', function () { if (BlueOrca.carousel.prev) BlueOrca.carousel.prev(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { if (BlueOrca.carousel.next) BlueOrca.carousel.next(); });

    if (!panel) return;
    var startX = 0;
    panel.addEventListener('touchstart', function (e) {
        startX = e.touches[0].clientX;
    }, { passive: true });
    panel.addEventListener('touchend', function (e) {
        if (window.innerWidth >= 700) return;
        var dx = e.changedTouches[0].clientX - startX;
        if      (dx >  50) { if (BlueOrca.carousel.next) BlueOrca.carousel.next(); }
        else if (dx < -50) { if (BlueOrca.carousel.prev) BlueOrca.carousel.prev(); }
    }, { passive: true });
})();

// HERO SLOGAN ROTATOR – animace řeší čistě CSS (@keyframes sloganDrum)


// ===================== INQUIRY SERVICE TAB SYSTEM =====================
(function () {
    'use strict';

    var SERVICE_PLACEHOLDERS = {
        web:      'Popište projekt \u2014 c\u00edlov\u00e1 skupina, rozsah, deadline\u2026',
        redesign: 'Odkaz na st\u00e1vaj\u00edc\u00ed web a co v\u00e1s na n\u011bm trap\u00ed\u2026',
        audit:    'URL webu, kter\u00fd chcete prov\u011b\u0159it\u2026',
        other:    'Popi\u0161te, co pot\u0159ebujete. Neb\u00f3jte se b\u00fdt konkr\u00e9tn\u00ed\u2026'
    };

    var tabs       = document.querySelectorAll('.inquiry-tab[data-service]');
    var panels     = document.querySelectorAll('.info-panel-content[data-service]');
    var serviceInp = document.getElementById('f-service');
    var msgField   = document.getElementById('f-message');

    if (!tabs.length) return;

    var prismLock = null;

    function activateService(key) {
        var prev = null;
        var next = null;
        panels.forEach(function (p) {
            if (p.classList.contains('is-active')) prev = p;
            if (p.dataset.service === key) next = p;
        });
        if (!next || next === prev) return;

        // Update tabs + inputs
        tabs.forEach(function (t) {
            var active = t.dataset.service === key;
            t.classList.toggle('is-active', active);
            t.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        if (serviceInp) serviceInp.value = key;
        if (msgField && SERVICE_PLACEHOLDERS[key]) {
            msgField.setAttribute('placeholder', SERVICE_PLACEHOLDERS[key]);
        }

        if (!prev) {
            next.classList.add('is-active');
            return;
        }

        // Abort any running prism
        if (prismLock) {
            clearTimeout(prismLock.timer);
            prismLock.finish();
            prismLock = null;
        }

        var slots  = prev.parentNode;   // .info-panel-slots
        var DUR    = 700;
        var h      = prev.offsetHeight;
        var r      = Math.round(prev.offsetWidth / 2);

        // Measure new card before hiding it inside stage
        next.style.display = 'flex';
        var newH = next.offsetHeight;

        // Build preserve-3d stage — identical to ref carousel
        var stage = document.createElement('div');
        stage.style.cssText =
            'grid-area:p;position:relative;width:100%;height:' + h + 'px;' +
            'transform-style:preserve-3d;' +
            'transform:translateZ(-' + r + 'px) rotateY(0deg);';

        slots.insertBefore(stage, prev);
        stage.appendChild(prev);
        stage.appendChild(next);

        // Front face (current) — at z = +r  →  world z = 0
        prev.classList.remove('is-active');
        prev.style.cssText =
            'display:flex;position:absolute;top:0;left:0;width:100%;height:100%;' +
            'backface-visibility:hidden;visibility:visible;opacity:1;pointer-events:none;' +
            'transform:rotateY(0deg) translateZ(' + r + 'px);';

        // Right face (new) — 90° to the right, at z = +r
        // drum rotates -90° → brings right face to front
        next.classList.add('is-active');
        next.style.cssText =
            'display:flex;position:absolute;top:0;left:0;width:100%;height:' + newH + 'px;' +
            'backface-visibility:hidden;visibility:visible;opacity:1;pointer-events:none;' +
            'transform:rotateY(90deg) translateZ(' + r + 'px);';

        afterNextPaint(function () {
            stage.style.transition = 'transform ' + DUR + 'ms cubic-bezier(0.4,0,0.2,1)';
            stage.style.transform  = 'translateZ(-' + r + 'px) rotateY(-90deg)';
        });

        function finish() {
            next.style.cssText = '';
            prev.style.cssText = '';
            next.classList.add('is-active');
            if (stage.parentNode) {
                slots.insertBefore(next, stage);
                slots.insertBefore(prev, stage);
                slots.removeChild(stage);
            }
        }

        var timer = setTimeout(function () {
            finish();
            prismLock = null;
        }, DUR + 50);

        prismLock = { timer: timer, finish: finish };

        stage.addEventListener('transitionend', function () {
            clearTimeout(timer);
            prismLock = null;
            finish();
        }, { once: true });
    }

    var VALID_KEYS = Array.from(tabs).map(function (t) { return t.dataset.service; });

    function activateServiceWithHash(key, pushState) {
        activateService(key);
        var hash = '#kontakt-' + key;
        if (pushState) {
            history.pushState(null, '', hash);
        } else {
            history.replaceState(null, '', hash);
        }
    }

    tabs.forEach(function (t) {
        t.addEventListener('click', function () { activateServiceWithHash(t.dataset.service, true); });
    });

    // Keyboard: left/right arrow navigation across tabs
    tabs.forEach(function (t, i) {
        t.addEventListener('keydown', function (e) {
            var dir = (e.key === 'ArrowRight') ? 1 : (e.key === 'ArrowLeft') ? -1 : 0;
            if (!dir) return;
            var next = tabs[(i + dir + tabs.length) % tabs.length];
            next.focus();
            activateServiceWithHash(next.dataset.service, true);
        });
    });

    // Back/forward browser navigation
    window.addEventListener('popstate', function () {
        var key = (location.hash.match(/^#kontakt-(.+)$/) || [])[1];
        if (key && VALID_KEYS.indexOf(key) !== -1) activateService(key);
    });

    // Init: read hash from URL, fallback to 'web'
    var initHash = (location.hash.match(/^#kontakt-(.+)$/) || [])[1];
    var initKey  = (initHash && VALID_KEYS.indexOf(initHash) !== -1) ? initHash : 'web';
    activateService(initKey);
    if (initKey !== 'web' || location.hash === '#kontakt-web') {
        history.replaceState(null, '', '#kontakt-' + initKey);
    }

    BlueOrca.activateInquiryService = function (key, push) { activateServiceWithHash(key, push); };
})();


// ===================== CTA → INQUIRY TAB BRIDGE =====================
(function () {
    'use strict';

    var pending = null;

    document.querySelectorAll('a[href="#kontakt"][data-service]').forEach(function (a) {
        a.addEventListener('click', function () { pending = a.dataset.service; });
    });

    var footer = document.getElementById('kontakt');
    if (!footer || !window.IntersectionObserver) return;

    new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting && pending) {
                if (BlueOrca.activateInquiryService) {
                    BlueOrca.activateInquiryService(pending, true);
                }
                pending = null;
            }
        });
    }, { threshold: 0.15 }).observe(footer);
})();


// ===================== CONTACT FORM – AJAX ODESLÁNÍ =====================
(function () {
    'use strict';

    var form      = document.querySelector('.contact-form');
    if (!form) return;

    var btnSubmit = form.querySelector('.contact-submit');
    var errBox    = form.querySelector('.footer-form-notice--error');
    var okBox     = form.querySelector('.footer-form-notice--success');
    var nameField = form.querySelector('#f-name');
    var emailField = form.querySelector('#f-email');
    var messageField = form.querySelector('#f-message');
    var startedAtField = form.querySelector('input[name="started_at"]');
    var btnHtml   = btnSubmit ? btnSubmit.innerHTML : '';

    function refreshBotProtection() {
        if (startedAtField) {
            startedAtField.value = String(Math.floor(Date.now() / 1000));
        }
    }

    refreshBotProtection();

    function setLoading(on) {
        if (!btnSubmit) return;
        btnSubmit.disabled = on;
        if (on) {
            btnSubmit.innerHTML = 'Odesílám\u2026';
        } else {
            btnSubmit.innerHTML = btnHtml;
        }
    }

    function setNoticeVisible(box, visible) {
        if (box) box.classList.toggle('is-visible', visible);
    }

    function clearNotices() {
        setNoticeVisible(errBox, false);
        setNoticeVisible(okBox, false);
    }

    function showError(msg) {
        if (errBox) {
            // Nahradit textový uzel (SVG ponechat)
            var nodes = errBox.childNodes;
            for (var i = nodes.length - 1; i >= 0; i--) {
                if (nodes[i].nodeType === 3) errBox.removeChild(nodes[i]);
            }
            errBox.appendChild(document.createTextNode(' ' + msg));
        }

        setNoticeVisible(errBox, true);
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        var name    = nameField ? nameField.value : '';
        var email   = emailField ? emailField.value : '';
        var message = messageField ? messageField.value : '';

        clearNotices();

        if (!name.trim() || !email.trim() || !message.trim()) {
            showError('Vyplňte prosím jméno, e-mail nebo telefon a zprávu.');
            return;
        }

        setLoading(true);

        fetch('contactform.php', {
            method: 'POST',
            body: new FormData(form)
        })
        .then(function (res) {
            return res.json().then(function (json) {
                return { ok: res.ok, json: json };
            });
        })
        .then(function (result) {
            if (result.json.ok) {
                setNoticeVisible(okBox, true);
                form.reset();
                // Reset tabs na výchozí
                if (BlueOrca.activateInquiryService) {
                    BlueOrca.activateInquiryService('web');
                }
                refreshBotProtection();
            } else {
                showError(result.json.error || 'Zprávu se nepodařilo odeslat. Zkuste to prosím znovu.');
            }
        })
        .catch(function () {
            showError('Připojení selhalo. Zkontrolujte internet a zkuste znovu.');
        })
        .finally(function () {
            setLoading(false);
        });
    });
})();

// ===================== CENÍK — DESIGN TOGGLE =====================
(function () {
    var toggle = document.getElementById('cenikDesignToggle');
    if (!toggle) return;

    var wrap = toggle.closest('.cenik-toggle-wrap');
    var activeCounters = [];

    function formatPrice(num) {
        return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    }

    function animateCounter(el, from, to, duration) {
        var start = null;
        var raf = requestAnimationFrame(function step(ts) {
            if (!start) start = ts;
            var progress = Math.min((ts - start) / duration, 1);
            // ease-out cubic
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = Math.round(from + (to - from) * eased);
            el.textContent = formatPrice(current);
            if (progress < 1) {
                activeCounters.push(requestAnimationFrame(step));
            }
        });
        activeCounters.push(raf);
    }

    function setDesignMode(active) {
        // cancel any running counters
        activeCounters.forEach(function (id) { cancelAnimationFrame(id); });
        activeCounters = [];

        toggle.setAttribute('aria-checked', active ? 'true' : 'false');
        wrap.classList.toggle('is-design', active);

        document.querySelectorAll('.cenik-card-price[data-base-price]').forEach(function (priceEl) {
            var base  = parseInt(priceEl.getAttribute('data-base-price'), 10);
            var addon = parseInt(priceEl.getAttribute('data-design-addon'), 10);
            var from  = active ? base : base + addon;
            var to    = active ? base + addon : base;
            var valueEl = priceEl.querySelector('.cenik-price-value');
            if (valueEl) animateCounter(valueEl, from, to, 480);
        });

        var designItem = document.getElementById('cenikDesignItem');
        if (designItem) {
            var span = designItem.querySelector('span:last-child');
            if (active) {
                span.className = '';
                span.innerHTML = 'Design: <strong class="text-white">Na míru</strong> přesně pro vás';
            } else {
                span.className = '';
                span.innerHTML = 'Design: <strong class="text-white">Upravená šablona</strong> přesně pro vás';
            }
        }

        document.querySelectorAll('.cenik-card-delivery[data-base-delivery]').forEach(function (el) {
            var base  = parseInt(el.getAttribute('data-base-delivery'), 10);
            var addon = parseInt(el.getAttribute('data-delivery-addon'), 10);
            var d = active ? base + addon : base;
            var textEl = el.querySelector('.cenik-delivery-text');
            if (!textEl) return;
            var label;
            if (d <= 7)       label = 'do 7 dní';
            else if (d <= 14) label = 'do 14 dní';
            else if (d <= 21) label = 'do 21 dní';
            else if (d <= 30) label = 'do měsíce';
            else {
                var w = Math.ceil(d / 7);
                var unit = w < 5 ? 'týdny' : 'týdnů';
                label = 'do ' + w + ' ' + unit;
            }
            textEl.textContent = 'Spuštění webu ' + label;
        });
    }

    toggle.addEventListener('click', function () {
        var isActive = toggle.getAttribute('aria-checked') === 'true';
        setDesignMode(!isActive);
    });

    wrap.querySelectorAll('[data-cenik-toggle-target]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            setDesignMode(btn.getAttribute('data-cenik-toggle-target') === 'true');
        });
    });

    setDesignMode(false);
})();
