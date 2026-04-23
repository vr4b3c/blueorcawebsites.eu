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
