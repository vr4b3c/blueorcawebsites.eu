(function () {
    'use strict';

    var lightbox = document.getElementById('lightbox');
    var lightboxImg = document.getElementById('lightbox-img');
    var lightboxCounter = document.getElementById('lightbox-counter');
    var btnClose = lightbox.querySelector('.lightbox-close');
    var btnPrev = lightbox.querySelector('.lightbox-prev');
    var btnNext = lightbox.querySelector('.lightbox-next');
    var overlay = lightbox.querySelector('.lightbox-overlay');

    var galleryImages = [];
    var currentIndex = 0;

    // Najdi všechny klikatelné obrázky v galeriích
    var triggers = document.querySelectorAll('[data-gallery] img');

    triggers.forEach(function (img, idx) {
        img.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openLightbox(img);
        });

        // Klik na celý wrapper (overlay ikonku)
        var wrap = img.closest('[data-gallery]');
        if (wrap) {
            wrap.addEventListener('click', function (e) {
                if (e.target.closest('a')) return;
                e.preventDefault();
                openLightbox(img);
            });
        }
    });

    function openLightbox(clickedImg) {
        var galleryName = clickedImg.closest('[data-gallery]').getAttribute('data-gallery');

        // Sesbírej všechny obrázky ve stejné galerii
        galleryImages = [];
        var allWraps = document.querySelectorAll('[data-gallery="' + galleryName + '"]');
        allWraps.forEach(function (wrap) {
            var imgs = wrap.querySelectorAll('img');
            imgs.forEach(function (img) {
                galleryImages.push({
                    src: img.getAttribute('data-full') || img.src,
                    alt: img.alt
                });
            });
        });

        // Najdi index kliknutého obrázku
        var clickedSrc = clickedImg.getAttribute('data-full') || clickedImg.src;
        currentIndex = 0;
        for (var i = 0; i < galleryImages.length; i++) {
            if (galleryImages[i].src === clickedSrc) {
                currentIndex = i;
                break;
            }
        }

        showImage();
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Zobraz/skryj navigaci
        updateNav();
    }

    function showImage() {
        if (!galleryImages[currentIndex]) return;
        lightboxImg.src = galleryImages[currentIndex].src;
        lightboxImg.alt = galleryImages[currentIndex].alt;
        lightboxCounter.textContent = (currentIndex + 1) + ' / ' + galleryImages.length;
    }

    function updateNav() {
        var showNav = galleryImages.length > 1;
        btnPrev.style.display = showNav ? '' : 'none';
        btnNext.style.display = showNav ? '' : 'none';
        lightboxCounter.style.display = showNav ? '' : 'none';
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        lightboxImg.src = '';
        galleryImages = [];
    }

    function prevImage() {
        if (galleryImages.length <= 1) return;
        currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
        showImage();
    }

    function nextImage() {
        if (galleryImages.length <= 1) return;
        currentIndex = (currentIndex + 1) % galleryImages.length;
        showImage();
    }

    // Event listenery
    btnClose.addEventListener('click', closeLightbox);
    overlay.addEventListener('click', closeLightbox);
    btnPrev.addEventListener('click', function (e) { e.stopPropagation(); prevImage(); });
    btnNext.addEventListener('click', function (e) { e.stopPropagation(); nextImage(); });

    // Klávesnice
    document.addEventListener('keydown', function (e) {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') prevImage();
        if (e.key === 'ArrowRight') nextImage();
    });

    // Touch swipe podpora
    var touchStartX = 0;
    var touchEndX = 0;

    lightbox.addEventListener('touchstart', function (e) {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', function (e) {
        touchEndX = e.changedTouches[0].screenX;
        var diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) nextImage();
            else prevImage();
        }
    }, { passive: true });

})();

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
