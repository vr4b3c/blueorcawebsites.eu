const subscribers = new Set();

let listenersAttached = false;

function notifySubscribers(x, y, timestamp) {
    subscribers.forEach(function (subscriber) {
        subscriber(x, y, timestamp);
    });
}

function handleMouseMove(e) {
    notifySubscribers(e.clientX, e.clientY, performance.now());
}

function handleTouchMove(e) {
    if (!e.touches || e.touches.length === 0) return;
    notifySubscribers(e.touches[0].clientX, e.touches[0].clientY, performance.now());
}

function attachListeners() {
    if (listenersAttached || typeof document === 'undefined') return;
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    listenersAttached = true;
}

function detachListeners() {
    if (!listenersAttached || typeof document === 'undefined') return;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('touchmove', handleTouchMove);
    listenersAttached = false;
}

export function subscribePointerMove(handler) {
    if (typeof handler !== 'function') return function () {};

    subscribers.add(handler);
    attachListeners();

    return function () {
        unsubscribePointerMove(handler);
    };
}

export function unsubscribePointerMove(handler) {
    subscribers.delete(handler);
    if (subscribers.size === 0) {
        detachListeners();
    }
}