import { inView, animate, stagger } from "../js/vendor/motion.js";

// Initialise score circle stroke-dashoffsets before animations run
document.querySelectorAll('.score-circle-wrap').forEach(function (wrap) {
    var val = parseInt(wrap.querySelector('.score-val')?.textContent, 10);
    var fill = wrap.querySelector('.score-fill');
    if (!fill || isNaN(val)) return;
    var circumference = 2 * Math.PI * 40; // r=40, viewBox 100×100
    fill.style.strokeDashoffset = ((1 - val / 100) * circumference).toFixed(3);
});
// Respect reduced-motion and keep mobile UI static for smoother scrolling.
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.innerWidth < 700 ||
    navigator.connection?.saveData === true;

if (!reduced) {
    // Mark document as JS-animated (used by CSS to safely pre-hide elements).
    // Do not add it in reduced/mobile mode; otherwise pre-hidden content would
    // remain invisible because the animations below are intentionally skipped.
    document.documentElement.classList.add('motion-ready');

    // ── Scroll-triggered ──────────────────────────────────────────────────

    // Section heading
    inView('.references .section-heading', function (el) {
        animate(el, { opacity: [0, 1], y: [25, 0] }, { duration: 1.0, ease: [0.33, 1, 0.68, 1] });
    });

    // Filter pills – staggered
    inView('.ref-filter', function (el) {
        animate(
            el.querySelectorAll('.filter-pill'),
            { opacity: [0, 1], y: [12, 0] },
            { duration: 0.7, delay: stagger(0.12), ease: [0.33, 1, 0.68, 1] }
        );
    });



    // Footer
    inView('.site-footer', function (el) {
        animate(el, { opacity: [0, 1], y: [20, 0] }, { duration: 0.8, ease: [0.33, 1, 0.68, 1] });
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
