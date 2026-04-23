import { inView, animate, stagger } from "https://cdn.jsdelivr.net/npm/motion@latest/+esm";

// Respect prefers-reduced-motion
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Mark document as JS-animated (used by CSS to safely pre-hide elements)
document.documentElement.classList.add('motion-ready');

if (reduced) {
    // Just reveal everything the CSS pre-hid
    document.querySelectorAll(
        '.hero-logo, .hero h1, .hero-slogan, .hero-tagline, .hero-contacts'
    ).forEach(function (el) { el.style.opacity = '1'; });
} else {

    // ── HERO entrance ─────────────────────────────────────────────────────

    animate('.hero-logo',
        { opacity: [0, 1], scale: [0.82, 1] },
        { duration: 0.9, ease: [0.16, 1, 0.3, 1] }
    );
    animate('.hero h1',
        { opacity: [0, 1], y: [35, 0] },
        { duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }
    );
    animate('.hero-slogan',
        { opacity: [0, 1], y: [22, 0] },
        { duration: 0.6, delay: 0.4, ease: [0.33, 1, 0.68, 1] }
    );
    animate('.hero-tagline',
        { opacity: [0, 1], y: [18, 0] },
        { duration: 0.6, delay: 0.55, ease: [0.33, 1, 0.68, 1] }
    );
    animate('.hero-contacts',
        { opacity: [0, 1], y: [18, 0] },
        { duration: 0.6, delay: 0.7, ease: [0.33, 1, 0.68, 1] }
    );

    // ── Scroll-triggered ──────────────────────────────────────────────────

    // Section heading
    inView('.references h2', function (el) {
        animate(el, { opacity: [0, 1], y: [25, 0] }, { duration: 0.6, ease: [0.33, 1, 0.68, 1] });
    });

    // Filter pills – staggered
    inView('.ref-filter', function (el) {
        animate(
            el.querySelectorAll('.filter-pill'),
            { opacity: [0, 1], y: [12, 0] },
            { duration: 0.4, delay: stagger(0.08), ease: [0.33, 1, 0.68, 1] }
        );
    });

    // ── Reference cards – rich per-element animations ─────────────────────
    inView('.ref-card', function (el) {

        // 1. Card wrapper: slide up + fade
        animate(el,
            { opacity: [0, 1], y: [50, 0] },
            { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
        );

        // 2. Image: subtle scale reveal
        var img = el.querySelector('.ref-image-wrap');
        if (img) {
            animate(img,
                { scale: [1.04, 1], opacity: [0, 1] },
                { duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }
            );
        }

        // 3. Project title + visit button: slide up
        var header = el.querySelector('.ref-header');
        if (header) {
            animate(header,
                { opacity: [0, 1], y: [18, 0] },
                { duration: 0.5, delay: 0.18, ease: [0.33, 1, 0.68, 1] }
            );
        }

        // 4. Info rows: stagger from right
        var rows = el.querySelectorAll('.ref-row');
        if (rows.length) {
            animate(rows,
                { opacity: [0, 1], x: [16, 0] },
                { duration: 0.4, delay: stagger(0.07, { start: 0.28 }), ease: [0.33, 1, 0.68, 1] }
            );
        }

        // 5. Feature tags: stagger scale-in
        var tags = el.querySelectorAll('.ref-tag');
        if (tags.length) {
            animate(tags,
                { opacity: [0, 1], scale: [0.75, 1] },
                { duration: 0.28, delay: stagger(0.05, { start: 0.3 }), ease: [0.34, 1.56, 0.64, 1] }
            );
        }

        // 6. PageSpeed score circles: draw the arc in
        el.querySelectorAll('.score-fill').forEach(function (circle) {
            var finalOffset = parseFloat(circle.style.strokeDashoffset);
            if (!isNaN(finalOffset)) {
                animate(circle,
                    { strokeDashoffset: [251.327, finalOffset] },
                    { duration: 1.1, delay: 0.42, ease: [0.16, 1, 0.3, 1] }
                );
            }
        });

        // 7. Score numbers: count up from 0
        el.querySelectorAll('.score-val').forEach(function (val) {
            var target = parseInt(val.textContent, 10);
            if (!isNaN(target)) {
                val.textContent = '0';
                countUp(val, target, 1.1, 0.42);
            }
        });

    }, { margin: '-60px' });

    // Footer
    inView('.site-footer', function (el) {
        animate(el, { opacity: [0, 1], y: [20, 0] }, { duration: 0.5, ease: [0.33, 1, 0.68, 1] });
    });
}

// Count up helper
function countUp(el, target, duration, delay) {
    setTimeout(function () {
        var start = performance.now();
        var ms = duration * 1000;
        function step(now) {
            var t = Math.min((now - start) / ms, 1);
            el.textContent = Math.round(easeOutCubic(t) * target);
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }, delay * 1000);
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}
