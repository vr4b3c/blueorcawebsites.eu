(() => {
  // assets/js/vendor/motion.js
  function Yt(t, e) {
    t.indexOf(e) === -1 && t.push(e);
  }
  function rt(t, e) {
    let r = t.indexOf(e);
    r > -1 && t.splice(r, 1);
  }
  var K = (t, e, r) => r > e ? e : r < t ? t : r;
  var Dt = () => {
  };
  var H = () => {
  };
  var q = {};
  var Ze = (t) => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(t);
  function Je(t) {
    return typeof t == "object" && t !== null;
  }
  var Qe = (t) => /^0[^.\s]+$/u.test(t);
  function qt(t) {
    let e;
    return () => (e === void 0 && (e = t()), e);
  }
  var N = (t) => t;
  var pl = (t, e) => (r) => e(t(r));
  var Zt = (...t) => t.reduce(pl);
  var ht = (t, e, r) => {
    let o = e - t;
    return o === 0 ? 1 : (r - t) / o;
  };
  var Mt = class {
    constructor() {
      this.subscriptions = [];
    }
    add(e) {
      return Yt(this.subscriptions, e), () => rt(this.subscriptions, e);
    }
    notify(e, r, o) {
      let i = this.subscriptions.length;
      if (i) if (i === 1) this.subscriptions[0](e, r, o);
      else for (let s = 0; s < i; s++) {
        let n = this.subscriptions[s];
        n && n(e, r, o);
      }
    }
    getSize() {
      return this.subscriptions.length;
    }
    clear() {
      this.subscriptions.length = 0;
    }
  };
  var E = (t) => t * 1e3;
  var _ = (t) => t / 1e3;
  function Jt(t, e) {
    return e ? t * (1e3 / e) : 0;
  }
  var fi = (t, e, r) => {
    let o = e - t;
    return ((r - t) % o + o) % o + t;
  };
  var os = (t, e, r) => (((1 - 3 * r + 3 * e) * t + (3 * r - 6 * e)) * t + 3 * e) * t;
  var gl = 1e-7;
  var yl = 12;
  function xl(t, e, r, o, i) {
    let s, n, a = 0;
    do
      n = e + (r - e) / 2, s = os(n, o, i) - t, s > 0 ? r = n : e = n;
    while (Math.abs(s) > gl && ++a < yl);
    return n;
  }
  function Et(t, e, r, o) {
    if (t === e && r === o) return N;
    let i = (s) => xl(s, 0, 1, t, r);
    return (s) => s === 0 || s === 1 ? s : os(i(s), e, o);
  }
  var tr = (t) => (e) => e <= 0.5 ? t(2 * e) / 2 : (2 - t(2 * (1 - e))) / 2;
  var er = (t) => (e) => 1 - t(1 - e);
  var xo = Et(0.33, 1.53, 0.69, 0.99);
  var Ae = er(xo);
  var rr = tr(Ae);
  var or = (t) => t >= 1 ? 1 : (t *= 2) < 1 ? 0.5 * Ae(t) : 0.5 * (2 - Math.pow(2, -10 * (t - 1)));
  var ir = (t) => 1 - Math.sin(Math.acos(t));
  var nr = er(ir);
  var sr = tr(ir);
  var mi = Et(0.42, 0, 1, 1);
  var ui = Et(0, 0, 0.58, 1);
  var ar = Et(0.42, 0, 0.58, 1);
  var lr = (t) => Array.isArray(t) && typeof t[0] != "number";
  function cr(t, e) {
    return lr(t) ? t[fi(0, t.length, e)] : t;
  }
  var Qt = (t) => Array.isArray(t) && typeof t[0] == "number";
  var is = { linear: N, easeIn: mi, easeInOut: ar, easeOut: ui, circIn: ir, circInOut: sr, circOut: nr, backIn: Ae, backInOut: rr, backOut: xo, anticipate: or };
  var vl = (t) => typeof t == "string";
  var we = (t) => {
    if (Qt(t)) {
      H(t.length === 4, "Cubic bezier arrays must contain four numerical values.", "cubic-bezier-length");
      let [e, r, o, i] = t;
      return Et(e, r, o, i);
    } else if (vl(t)) return H(is[t] !== void 0, `Invalid easing type '${t}'`, "invalid-easing-type"), is[t];
    return t;
  };
  var te = ["setup", "read", "resolveKeyframes", "preUpdate", "update", "preRender", "render", "postRender"];
  var U = { value: null, addProjectionMetrics: null };
  function ns(t, e) {
    let r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), i = false, s = false, n = /* @__PURE__ */ new WeakSet(), a = { delta: 0, timestamp: 0, isProcessing: false }, l = 0;
    function f(m) {
      n.has(m) && (c.schedule(m), t()), l++, m(a);
    }
    let c = { schedule: (m, u = false, p = false) => {
      let d = p && i ? r : o;
      return u && n.add(m), d.add(m), m;
    }, cancel: (m) => {
      o.delete(m), n.delete(m);
    }, process: (m) => {
      if (a = m, i) {
        s = true;
        return;
      }
      i = true;
      let u = r;
      r = o, o = u, r.forEach(f), e && U.value && U.value.frameloop[e].push(l), l = 0, r.clear(), i = false, s && (s = false, c.process(m));
    } };
    return c;
  }
  var Vl = 40;
  function fr(t, e) {
    let r = false, o = true, i = { delta: 0, timestamp: 0, isProcessing: false }, s = () => r = true, n = te.reduce((T, v) => (T[v] = ns(s, e ? v : void 0), T), {}), { setup: a, read: l, resolveKeyframes: f, preUpdate: c, update: m, preRender: u, render: p, postRender: h } = n, d = () => {
      let T = q.useManualTiming, v = T ? i.timestamp : performance.now();
      r = false, T || (i.delta = o ? 1e3 / 60 : Math.max(Math.min(v - i.timestamp, Vl), 1)), i.timestamp = v, i.isProcessing = true, a.process(i), l.process(i), f.process(i), c.process(i), m.process(i), u.process(i), p.process(i), h.process(i), i.isProcessing = false, r && e && (o = false, t(d));
    }, g = () => {
      r = true, o = true, i.isProcessing || t(d);
    };
    return { schedule: te.reduce((T, v) => {
      let S = n[v];
      return T[v] = (R, F = false, w = false) => (r || g(), S.schedule(R, F, w)), T;
    }, {}), cancel: (T) => {
      for (let v = 0; v < te.length; v++) n[te[v]].cancel(T);
    }, state: i, steps: n };
  }
  var { schedule: A, cancel: L, state: j, steps: mr } = fr(typeof requestAnimationFrame < "u" ? requestAnimationFrame : N, true);
  var To;
  function bl() {
    To = void 0;
  }
  var I = { now: () => (To === void 0 && I.set(j.isProcessing || q.useManualTiming ? j.timestamp : performance.now()), To), set: (t) => {
    To = t, queueMicrotask(bl);
  } };
  var Z = { layout: 0, mainThread: 0, waapi: 0 };
  var ss = (t) => (e) => typeof e == "string" && e.startsWith(t);
  var ee = ss("--");
  var Sl = ss("var(--");
  var re = (t) => Sl(t) ? Al.test(t.split("/*")[0].trim()) : false;
  var Al = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;
  function vo(t) {
    return typeof t != "string" ? false : t.split("/*")[0].includes("var(--");
  }
  var dt = { test: (t) => typeof t == "number", parse: parseFloat, transform: (t) => t };
  var Vt = { ...dt, transform: (t) => K(0, 1, t) };
  var Pe = { ...dt, default: 1 };
  var Kt = (t) => Math.round(t * 1e5) / 1e5;
  var De = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;
  function as(t) {
    return t == null;
  }
  var ls = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu;
  var Me = (t, e) => (r) => !!(typeof r == "string" && ls.test(r) && r.startsWith(t) || e && !as(r) && Object.prototype.hasOwnProperty.call(r, e));
  var Vo = (t, e, r) => (o) => {
    if (typeof o != "string") return o;
    let [i, s, n, a] = o.match(De);
    return { [t]: parseFloat(i), [e]: parseFloat(s), [r]: parseFloat(n), alpha: a !== void 0 ? parseFloat(a) : 1 };
  };
  var wl = (t) => K(0, 255, t);
  var bo = { ...dt, transform: (t) => Math.round(wl(t)) };
  var gt = { test: Me("rgb", "red"), parse: Vo("red", "green", "blue"), transform: ({ red: t, green: e, blue: r, alpha: o = 1 }) => "rgba(" + bo.transform(t) + ", " + bo.transform(e) + ", " + bo.transform(r) + ", " + Kt(Vt.transform(o)) + ")" };
  function Pl(t) {
    let e = "", r = "", o = "", i = "";
    return t.length > 5 ? (e = t.substring(1, 3), r = t.substring(3, 5), o = t.substring(5, 7), i = t.substring(7, 9)) : (e = t.substring(1, 2), r = t.substring(2, 3), o = t.substring(3, 4), i = t.substring(4, 5), e += e, r += r, o += o, i += i), { red: parseInt(e, 16), green: parseInt(r, 16), blue: parseInt(o, 16), alpha: i ? parseInt(i, 16) / 255 : 1 };
  }
  var Ee = { test: Me("#"), parse: Pl, transform: gt.transform };
  var ur = (t) => ({ test: (e) => typeof e == "string" && e.endsWith(t) && e.split(" ").length === 1, parse: parseFloat, transform: (e) => `${e}${t}` });
  var yt = ur("deg");
  var ot = ur("%");
  var y = ur("px");
  var pi = ur("vh");
  var hi = ur("vw");
  var So = { ...ot, parse: (t) => ot.parse(t) / 100, transform: (t) => ot.transform(t * 100) };
  var Ct = { test: Me("hsl", "hue"), parse: Vo("hue", "saturation", "lightness"), transform: ({ hue: t, saturation: e, lightness: r, alpha: o = 1 }) => "hsla(" + Math.round(t) + ", " + ot.transform(Kt(e)) + ", " + ot.transform(Kt(r)) + ", " + Kt(Vt.transform(o)) + ")" };
  var k = { test: (t) => gt.test(t) || Ee.test(t) || Ct.test(t), parse: (t) => gt.test(t) ? gt.parse(t) : Ct.test(t) ? Ct.parse(t) : Ee.parse(t), transform: (t) => typeof t == "string" ? t : t.hasOwnProperty("red") ? gt.transform(t) : Ct.transform(t), getAnimatableNone: (t) => {
    let e = k.parse(t);
    return e.alpha = 0, k.transform(e);
  } };
  var cs = /(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu;
  function Dl(t) {
    return isNaN(t) && typeof t == "string" && (t.match(De)?.length || 0) + (t.match(cs)?.length || 0) > 0;
  }
  var ms = "number";
  var us = "color";
  var Ml = "var";
  var El = "var(";
  var fs = "${}";
  var Cl = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;
  function Rt(t) {
    let e = t.toString(), r = [], o = { color: [], number: [], var: [] }, i = [], s = 0, a = e.replace(Cl, (l) => (k.test(l) ? (o.color.push(s), i.push(us), r.push(k.parse(l))) : l.startsWith(El) ? (o.var.push(s), i.push(Ml), r.push(l)) : (o.number.push(s), i.push(ms), r.push(parseFloat(l))), ++s, fs)).split(fs);
    return { values: r, split: a, indexes: o, types: i };
  }
  function Rl(t) {
    return Rt(t).values;
  }
  function ps({ split: t, types: e }) {
    let r = t.length;
    return (o) => {
      let i = "";
      for (let s = 0; s < r; s++) if (i += t[s], o[s] !== void 0) {
        let n = e[s];
        n === ms ? i += Kt(o[s]) : n === us ? i += k.transform(o[s]) : i += o[s];
      }
      return i;
    };
  }
  function Bl(t) {
    return ps(Rt(t));
  }
  var Ol = (t) => typeof t == "number" ? 0 : k.test(t) ? k.getAnimatableNone(t) : t;
  var Ll = (t, e) => typeof t == "number" ? e?.trim().endsWith("/") ? t : 0 : Ol(t);
  function kl(t) {
    let e = Rt(t);
    return ps(e)(e.values.map((o, i) => Ll(o, e.split[i])));
  }
  var G = { test: Dl, parse: Rl, createTransformer: Bl, getAnimatableNone: kl };
  function di(t, e, r) {
    return r < 0 && (r += 1), r > 1 && (r -= 1), r < 1 / 6 ? t + (e - t) * 6 * r : r < 1 / 2 ? e : r < 2 / 3 ? t + (e - t) * (2 / 3 - r) * 6 : t;
  }
  function gi({ hue: t, saturation: e, lightness: r, alpha: o }) {
    t /= 360, e /= 100, r /= 100;
    let i = 0, s = 0, n = 0;
    if (!e) i = s = n = r;
    else {
      let a = r < 0.5 ? r * (1 + e) : r + e - r * e, l = 2 * r - a;
      i = di(l, a, t + 1 / 3), s = di(l, a, t), n = di(l, a, t - 1 / 3);
    }
    return { red: Math.round(i * 255), green: Math.round(s * 255), blue: Math.round(n * 255), alpha: o };
  }
  function oe(t, e) {
    return (r) => r > 0 ? e : t;
  }
  var D = (t, e, r) => t + (e - t) * r;
  var Ao = (t, e, r) => {
    let o = t * t, i = r * (e * e - o) + o;
    return i < 0 ? 0 : Math.sqrt(i);
  };
  var Fl = [Ee, gt, Ct];
  var Il = (t) => Fl.find((e) => e.test(t));
  function hs(t) {
    let e = Il(t);
    if (Dt(!!e, `'${t}' is not an animatable color. Use the equivalent color code instead.`, "color-not-animatable"), !e) return false;
    let r = e.parse(t);
    return e === Ct && (r = gi(r)), r;
  }
  var wo = (t, e) => {
    let r = hs(t), o = hs(e);
    if (!r || !o) return oe(t, e);
    let i = { ...r };
    return (s) => (i.red = Ao(r.red, o.red, s), i.green = Ao(r.green, o.green, s), i.blue = Ao(r.blue, o.blue, s), i.alpha = D(r.alpha, o.alpha, s), gt.transform(i));
  };
  var pr = /* @__PURE__ */ new Set(["none", "hidden"]);
  function yi(t, e) {
    return pr.has(t) ? (r) => r <= 0 ? t : e : (r) => r >= 1 ? e : t;
  }
  function Nl(t, e) {
    return (r) => D(t, e, r);
  }
  function hr(t) {
    return typeof t == "number" ? Nl : typeof t == "string" ? re(t) ? oe : k.test(t) ? wo : gs : Array.isArray(t) ? xi : typeof t == "object" ? k.test(t) ? wo : ds : oe;
  }
  function xi(t, e) {
    let r = [...t], o = r.length, i = t.map((s, n) => hr(s)(s, e[n]));
    return (s) => {
      for (let n = 0; n < o; n++) r[n] = i[n](s);
      return r;
    };
  }
  function ds(t, e) {
    let r = { ...t, ...e }, o = {};
    for (let i in r) t[i] !== void 0 && e[i] !== void 0 && (o[i] = hr(t[i])(t[i], e[i]));
    return (i) => {
      for (let s in o) r[s] = o[s](i);
      return r;
    };
  }
  function jl(t, e) {
    let r = [], o = { color: 0, var: 0, number: 0 };
    for (let i = 0; i < e.values.length; i++) {
      let s = e.types[i], n = t.indexes[s][o[s]], a = t.values[n] ?? 0;
      r[i] = a, o[s]++;
    }
    return r;
  }
  var gs = (t, e) => {
    let r = G.createTransformer(e), o = Rt(t), i = Rt(e);
    return o.indexes.var.length === i.indexes.var.length && o.indexes.color.length === i.indexes.color.length && o.indexes.number.length >= i.indexes.number.length ? pr.has(t) && !i.values.length || pr.has(e) && !o.values.length ? yi(t, e) : Zt(xi(jl(o, i), i.values), r) : (Dt(true, `Complex values '${t}' and '${e}' too different to mix. Ensure all colors are of the same type, and that each contains the same quantity of number and color values. Falling back to instant transition.`, "complex-values-different"), oe(t, e));
  };
  function dr(t, e, r) {
    return typeof t == "number" && typeof e == "number" && typeof r == "number" ? D(t, e, r) : hr(t)(t, e);
  }
  var ys = (t) => {
    let e = ({ timestamp: r }) => t(r);
    return { start: (r = true) => A.update(e, r), stop: () => L(e), now: () => j.isProcessing ? j.timestamp : I.now() };
  };
  var gr = (t, e, r = 10) => {
    let o = "", i = Math.max(Math.round(e / r), 2);
    for (let s = 0; s < i; s++) o += Math.round(t(s / (i - 1)) * 1e4) / 1e4 + ", ";
    return `linear(${o.substring(0, o.length - 2)})`;
  };
  function ie(t) {
    let e = 0, r = 50, o = t.next(e);
    for (; !o.done && e < 2e4; ) e += r, o = t.next(e);
    return e >= 2e4 ? 1 / 0 : e;
  }
  function xr(t, e = 100, r) {
    let o = r({ ...t, keyframes: [0, e] }), i = Math.min(ie(o), 2e4);
    return { type: "keyframes", ease: (s) => o.next(i * s).value / e, duration: _(i) };
  }
  var W = { stiffness: 100, damping: 10, mass: 1, velocity: 0, duration: 800, bounce: 0.3, visualDuration: 0.3, restSpeed: { granular: 0.01, default: 2 }, restDelta: { granular: 5e-3, default: 0.5 }, minDuration: 0.01, maxDuration: 10, minDamping: 0.05, maxDamping: 1 };
  function vi(t, e) {
    return t * Math.sqrt(1 - e * e);
  }
  var Wl = 12;
  function Kl(t, e, r) {
    let o = r;
    for (let i = 1; i < Wl; i++) o = o - t(o) / e(o);
    return o;
  }
  var Ti = 1e-3;
  function Ul({ duration: t = W.duration, bounce: e = W.bounce, velocity: r = W.velocity, mass: o = W.mass }) {
    let i, s;
    Dt(t <= E(W.maxDuration), "Spring duration must be 10 seconds or less", "spring-duration-limit");
    let n = 1 - e;
    n = K(W.minDamping, W.maxDamping, n), t = K(W.minDuration, W.maxDuration, _(t)), n < 1 ? (i = (f) => {
      let c = f * n, m = c * t, u = c - r, p = vi(f, n), h = Math.exp(-m);
      return Ti - u / p * h;
    }, s = (f) => {
      let m = f * n * t, u = m * r + r, p = Math.pow(n, 2) * Math.pow(f, 2) * t, h = Math.exp(-m), d = vi(Math.pow(f, 2), n);
      return (-i(f) + Ti > 0 ? -1 : 1) * ((u - p) * h) / d;
    }) : (i = (f) => {
      let c = Math.exp(-f * t), m = (f - r) * t + 1;
      return -Ti + c * m;
    }, s = (f) => {
      let c = Math.exp(-f * t), m = (r - f) * (t * t);
      return c * m;
    });
    let a = 5 / t, l = Kl(i, s, a);
    if (t = E(t), isNaN(l)) return { stiffness: W.stiffness, damping: W.damping, duration: t };
    {
      let f = Math.pow(l, 2) * o;
      return { stiffness: f, damping: n * 2 * Math.sqrt(o * f), duration: t };
    }
  }
  var Gl = ["duration", "bounce"];
  var zl = ["stiffness", "damping", "mass"];
  function xs(t, e) {
    return e.some((r) => t[r] !== void 0);
  }
  function $l(t) {
    let e = { velocity: W.velocity, stiffness: W.stiffness, damping: W.damping, mass: W.mass, isResolvedFromDuration: false, ...t };
    if (!xs(t, zl) && xs(t, Gl)) if (e.velocity = 0, t.visualDuration) {
      let r = t.visualDuration, o = 2 * Math.PI / (r * 1.2), i = o * o, s = 2 * K(0.05, 1, 1 - (t.bounce || 0)) * Math.sqrt(i);
      e = { ...e, mass: W.mass, stiffness: i, damping: s };
    } else {
      let r = Ul({ ...t, velocity: 0 });
      e = { ...e, ...r, mass: W.mass }, e.isResolvedFromDuration = true;
    }
    return e;
  }
  function Bt(t = W.visualDuration, e = W.bounce) {
    let r = typeof t != "object" ? { visualDuration: t, keyframes: [0, 1], bounce: e } : t, { restSpeed: o, restDelta: i } = r, s = r.keyframes[0], n = r.keyframes[r.keyframes.length - 1], a = { done: false, value: s }, { stiffness: l, damping: f, mass: c, duration: m, velocity: u, isResolvedFromDuration: p } = $l({ ...r, velocity: -_(r.velocity || 0) }), h = u || 0, d = f / (2 * Math.sqrt(l * c)), g = n - s, x = _(Math.sqrt(l / c)), V = Math.abs(g) < 5;
    o || (o = V ? W.restSpeed.granular : W.restSpeed.default), i || (i = V ? W.restDelta.granular : W.restDelta.default);
    let T, v, S, R, F, w;
    if (d < 1) S = vi(x, d), R = (h + d * x * g) / S, T = (b) => {
      let M = Math.exp(-d * x * b);
      return n - M * (R * Math.sin(S * b) + g * Math.cos(S * b));
    }, F = d * x * R + g * S, w = d * x * g - R * S, v = (b) => Math.exp(-d * x * b) * (F * Math.sin(S * b) + w * Math.cos(S * b));
    else if (d === 1) {
      T = (M) => n - Math.exp(-x * M) * (g + (h + x * g) * M);
      let b = h + x * g;
      v = (M) => Math.exp(-x * M) * (x * b * M - h);
    } else {
      let b = x * Math.sqrt(d * d - 1);
      T = (pt) => {
        let Tt = Math.exp(-d * x * pt), ut = Math.min(b * pt, 300);
        return n - Tt * ((h + d * x * g) * Math.sinh(ut) + b * g * Math.cosh(ut)) / b;
      };
      let M = (h + d * x * g) / b, z = d * x * M - g * b, nt = d * x * g - M * b;
      v = (pt) => {
        let Tt = Math.exp(-d * x * pt), ut = Math.min(b * pt, 300);
        return Tt * (z * Math.sinh(ut) + nt * Math.cosh(ut));
      };
    }
    let P = { calculatedDuration: p && m || null, velocity: (b) => E(v(b)), next: (b) => {
      if (!p && d < 1) {
        let z = Math.exp(-d * x * b), nt = Math.sin(S * b), pt = Math.cos(S * b), Tt = n - z * (R * nt + g * pt), ut = E(z * (F * nt + w * pt));
        return a.done = Math.abs(ut) <= o && Math.abs(n - Tt) <= i, a.value = a.done ? n : Tt, a;
      }
      let M = T(b);
      if (p) a.done = b >= m;
      else {
        let z = E(v(b));
        a.done = Math.abs(z) <= o && Math.abs(n - M) <= i;
      }
      return a.value = a.done ? n : M, a;
    }, toString: () => {
      let b = Math.min(ie(P), 2e4), M = gr((z) => P.next(b * z).value, b, 30);
      return b + "ms " + M;
    }, toTransition: () => {
    } };
    return P;
  }
  Bt.applyToOptions = (t) => {
    let e = xr(t, 100, Bt);
    return t.ease = e.ease, t.duration = E(e.duration), t.type = "keyframes", t;
  };
  var Hl = 5;
  function Po(t, e, r) {
    let o = Math.max(e - Hl, 0);
    return Jt(r - t(o), e - o);
  }
  function Ce({ keyframes: t, velocity: e = 0, power: r = 0.8, timeConstant: o = 325, bounceDamping: i = 10, bounceStiffness: s = 500, modifyTarget: n, min: a, max: l, restDelta: f = 0.5, restSpeed: c }) {
    let m = t[0], u = { done: false, value: m }, p = (w) => a !== void 0 && w < a || l !== void 0 && w > l, h = (w) => a === void 0 ? l : l === void 0 || Math.abs(a - w) < Math.abs(l - w) ? a : l, d = r * e, g = m + d, x = n === void 0 ? g : n(g);
    x !== g && (d = x - m);
    let V = (w) => -d * Math.exp(-w / o), T = (w) => x + V(w), v = (w) => {
      let P = V(w), b = T(w);
      u.done = Math.abs(P) <= f, u.value = u.done ? x : b;
    }, S, R, F = (w) => {
      p(u.value) && (S = w, R = Bt({ keyframes: [u.value, h(u.value)], velocity: Po(T, w, u.value), damping: i, stiffness: s, restDelta: f, restSpeed: c }));
    };
    return F(0), { calculatedDuration: null, next: (w) => {
      let P = false;
      return !R && S === void 0 && (P = true, v(w), F(w)), S !== void 0 && w >= S ? R.next(w - S) : (!P && v(w), u);
    } };
  }
  function _l(t, e, r) {
    let o = [], i = r || q.mix || dr, s = t.length - 1;
    for (let n = 0; n < s; n++) {
      let a = i(t[n], t[n + 1]);
      if (e) {
        let l = Array.isArray(e) ? e[n] || N : e;
        a = Zt(l, a);
      }
      o.push(a);
    }
    return o;
  }
  function ne(t, e, { clamp: r = true, ease: o, mixer: i } = {}) {
    let s = t.length;
    if (H(s === e.length, "Both input and output ranges must be the same length", "range-length"), s === 1) return () => e[0];
    if (s === 2 && e[0] === e[1]) return () => e[1];
    let n = t[0] === t[1];
    t[0] > t[s - 1] && (t = [...t].reverse(), e = [...e].reverse());
    let a = _l(e, o, i), l = a.length, f = (c) => {
      if (n && c < t[0]) return e[0];
      let m = 0;
      if (l > 1) for (; m < t.length - 2 && !(c < t[m + 1]); m++) ;
      let u = ht(t[m], t[m + 1], c);
      return a[m](u);
    };
    return r ? (c) => f(K(t[0], t[s - 1], c)) : f;
  }
  function Tr(t, e) {
    let r = t[t.length - 1];
    for (let o = 1; o <= e; o++) {
      let i = ht(0, e, o);
      t.push(D(r, 1, i));
    }
  }
  function se(t) {
    let e = [0];
    return Tr(e, t.length - 1), e;
  }
  function Vi(t, e) {
    return t.map((r) => r * e);
  }
  function Ts(t, e) {
    return t.map(() => e || ar).splice(0, t.length - 1);
  }
  function Ut({ duration: t = 300, keyframes: e, times: r, ease: o = "easeInOut" }) {
    let i = lr(o) ? o.map(we) : we(o), s = { done: false, value: e[0] }, n = Vi(r && r.length === e.length ? r : se(e), t), a = ne(n, e, { ease: Array.isArray(i) ? i : Ts(e, i) });
    return { calculatedDuration: t, next: (l) => (s.value = a(l), s.done = l >= t, s) };
  }
  var Xl = (t) => t !== null;
  function Ot(t, { repeat: e, repeatType: r = "loop" }, o, i = 1) {
    let s = t.filter(Xl), a = i < 0 || e && r !== "loop" && e % 2 === 1 ? 0 : s.length - 1;
    return !a || o === void 0 ? s[a] : o;
  }
  var Yl = { decay: Ce, inertia: Ce, tween: Ut, keyframes: Ut, spring: Bt };
  function Do(t) {
    typeof t.type == "string" && (t.type = Yl[t.type]);
  }
  var Gt = class {
    constructor() {
      this.updateFinished();
    }
    get finished() {
      return this._finished;
    }
    updateFinished() {
      this._finished = new Promise((e) => {
        this.resolve = e;
      });
    }
    notifyFinished() {
      this.resolve();
    }
    then(e, r) {
      return this.finished.then(e, r);
    }
  };
  var ql = (t) => t / 100;
  var st = class extends Gt {
    constructor(e) {
      super(), this.state = "idle", this.startTime = null, this.isStopped = false, this.currentTime = 0, this.holdTime = null, this.playbackSpeed = 1, this.delayState = { done: false, value: void 0 }, this.stop = () => {
        let { motionValue: r } = this.options;
        r && r.updatedAt !== I.now() && this.tick(I.now()), this.isStopped = true, this.state !== "idle" && (this.teardown(), this.options.onStop?.());
      }, Z.mainThread++, this.options = e, this.initAnimation(), this.play(), e.autoplay === false && this.pause();
    }
    initAnimation() {
      let { options: e } = this;
      Do(e);
      let { type: r = Ut, repeat: o = 0, repeatDelay: i = 0, repeatType: s, velocity: n = 0 } = e, { keyframes: a } = e, l = r || Ut;
      l !== Ut && typeof a[0] != "number" && (this.mixKeyframes = Zt(ql, dr(a[0], a[1])), a = [0, 100]);
      let f = l({ ...e, keyframes: a });
      s === "mirror" && (this.mirroredGenerator = l({ ...e, keyframes: [...a].reverse(), velocity: -n })), f.calculatedDuration === null && (f.calculatedDuration = ie(f));
      let { calculatedDuration: c } = f;
      this.calculatedDuration = c, this.resolvedDuration = c + i, this.totalDuration = this.resolvedDuration * (o + 1) - i, this.generator = f;
    }
    updateTime(e) {
      let r = Math.round(e - this.startTime) * this.playbackSpeed;
      this.holdTime !== null ? this.currentTime = this.holdTime : this.currentTime = r;
    }
    tick(e, r = false) {
      let { generator: o, totalDuration: i, mixKeyframes: s, mirroredGenerator: n, resolvedDuration: a, calculatedDuration: l } = this;
      if (this.startTime === null) return o.next(0);
      let { delay: f = 0, keyframes: c, repeat: m, repeatType: u, repeatDelay: p, type: h, onUpdate: d, finalKeyframe: g } = this.options;
      this.speed > 0 ? this.startTime = Math.min(this.startTime, e) : this.speed < 0 && (this.startTime = Math.min(e - i / this.speed, this.startTime)), r ? this.currentTime = e : this.updateTime(e);
      let x = this.currentTime - f * (this.playbackSpeed >= 0 ? 1 : -1), V = this.playbackSpeed >= 0 ? x < 0 : x > i;
      this.currentTime = Math.max(x, 0), this.state === "finished" && this.holdTime === null && (this.currentTime = i);
      let T = this.currentTime, v = o;
      if (m) {
        let w = Math.min(this.currentTime, i) / a, P = Math.floor(w), b = w % 1;
        !b && w >= 1 && (b = 1), b === 1 && P--, P = Math.min(P, m + 1), P % 2 && (u === "reverse" ? (b = 1 - b, p && (b -= p / a)) : u === "mirror" && (v = n)), T = K(0, 1, b) * a;
      }
      let S;
      V ? (this.delayState.value = c[0], S = this.delayState) : S = v.next(T), s && !V && (S.value = s(S.value));
      let { done: R } = S;
      !V && l !== null && (R = this.playbackSpeed >= 0 ? this.currentTime >= i : this.currentTime <= 0);
      let F = this.holdTime === null && (this.state === "finished" || this.state === "running" && R);
      return F && h !== Ce && (S.value = Ot(c, this.options, g, this.speed)), d && d(S.value), F && this.finish(), S;
    }
    then(e, r) {
      return this.finished.then(e, r);
    }
    get duration() {
      return _(this.calculatedDuration);
    }
    get iterationDuration() {
      let { delay: e = 0 } = this.options || {};
      return this.duration + _(e);
    }
    get time() {
      return _(this.currentTime);
    }
    set time(e) {
      e = E(e), this.currentTime = e, this.startTime === null || this.holdTime !== null || this.playbackSpeed === 0 ? this.holdTime = e : this.driver && (this.startTime = this.driver.now() - e / this.playbackSpeed), this.driver ? this.driver.start(false) : (this.startTime = 0, this.state = "paused", this.holdTime = e, this.tick(e));
    }
    getGeneratorVelocity() {
      let e = this.currentTime;
      if (e <= 0) return this.options.velocity || 0;
      if (this.generator.velocity) return this.generator.velocity(e);
      let r = this.generator.next(e).value;
      return Po((o) => this.generator.next(o).value, e, r);
    }
    get speed() {
      return this.playbackSpeed;
    }
    set speed(e) {
      let r = this.playbackSpeed !== e;
      r && this.driver && this.updateTime(I.now()), this.playbackSpeed = e, r && this.driver && (this.time = _(this.currentTime));
    }
    play() {
      if (this.isStopped) return;
      let { driver: e = ys, startTime: r } = this.options;
      this.driver || (this.driver = e((i) => this.tick(i))), this.options.onPlay?.();
      let o = this.driver.now();
      this.state === "finished" ? (this.updateFinished(), this.startTime = o) : this.holdTime !== null ? this.startTime = o - this.holdTime : this.startTime || (this.startTime = r ?? o), this.state === "finished" && this.speed < 0 && (this.startTime += this.calculatedDuration), this.holdTime = null, this.state = "running", this.driver.start();
    }
    pause() {
      this.state = "paused", this.updateTime(I.now()), this.holdTime = this.currentTime;
    }
    complete() {
      this.state !== "running" && this.play(), this.state = "finished", this.holdTime = null;
    }
    finish() {
      this.notifyFinished(), this.teardown(), this.state = "finished", this.options.onComplete?.();
    }
    cancel() {
      this.holdTime = null, this.startTime = 0, this.tick(0), this.teardown(), this.options.onCancel?.();
    }
    teardown() {
      this.state = "idle", this.stopDriver(), this.startTime = this.holdTime = null, Z.mainThread--;
    }
    stopDriver() {
      this.driver && (this.driver.stop(), this.driver = void 0);
    }
    sample(e) {
      return this.startTime = 0, this.tick(e, true);
    }
    attachTimeline(e) {
      return this.options.allowFlatten && (this.options.type = "keyframes", this.options.ease = "linear", this.initAnimation()), this.driver?.stop(), e.observe(this);
    }
  };
  function vr(t) {
    for (let e = 1; e < t.length; e++) t[e] ?? (t[e] = t[e - 1]);
  }
  var ae = (t) => t * 180 / Math.PI;
  var bi = (t) => {
    let e = ae(Math.atan2(t[1], t[0]));
    return Si(e);
  };
  var Jl = { x: 4, y: 5, translateX: 4, translateY: 5, scaleX: 0, scaleY: 3, scale: (t) => (Math.abs(t[0]) + Math.abs(t[3])) / 2, rotate: bi, rotateZ: bi, skewX: (t) => ae(Math.atan(t[1])), skewY: (t) => ae(Math.atan(t[2])), skew: (t) => (Math.abs(t[1]) + Math.abs(t[2])) / 2 };
  var Si = (t) => (t = t % 360, t < 0 && (t += 360), t);
  var vs = bi;
  var Vs = (t) => Math.sqrt(t[0] * t[0] + t[1] * t[1]);
  var bs = (t) => Math.sqrt(t[4] * t[4] + t[5] * t[5]);
  var Ql = { x: 12, y: 13, z: 14, translateX: 12, translateY: 13, translateZ: 14, scaleX: Vs, scaleY: bs, scale: (t) => (Vs(t) + bs(t)) / 2, rotateX: (t) => Si(ae(Math.atan2(t[6], t[5]))), rotateY: (t) => Si(ae(Math.atan2(-t[2], t[0]))), rotateZ: vs, rotate: vs, skewX: (t) => ae(Math.atan(t[4])), skewY: (t) => ae(Math.atan(t[1])), skew: (t) => (Math.abs(t[1]) + Math.abs(t[4])) / 2 };
  function Vr(t) {
    return t.includes("scale") ? 1 : 0;
  }
  function br(t, e) {
    if (!t || t === "none") return Vr(e);
    let r = t.match(/^matrix3d\(([-\d.e\s,]+)\)$/u), o, i;
    if (r) o = Ql, i = r;
    else {
      let a = t.match(/^matrix\(([-\d.e\s,]+)\)$/u);
      o = Jl, i = a;
    }
    if (!i) return Vr(e);
    let s = o[e], n = i[1].split(",").map(tc);
    return typeof s == "function" ? s(n) : n[s];
  }
  var Ai = (t, e) => {
    let { transform: r = "none" } = getComputedStyle(t);
    return br(r, e);
  };
  function tc(t) {
    return parseFloat(t.trim());
  }
  var it = ["transformPerspective", "x", "y", "z", "translateX", "translateY", "translateZ", "scale", "scaleX", "scaleY", "rotate", "rotateX", "rotateY", "rotateZ", "skew", "skewX", "skewY"];
  var J = new Set(it);
  var wi = (t) => t === dt || t === y;
  var ec = /* @__PURE__ */ new Set(["x", "y", "z"]);
  var rc = it.filter((t) => !ec.has(t));
  function Ss(t) {
    let e = [];
    return rc.forEach((r) => {
      let o = t.getValue(r);
      o !== void 0 && (e.push([r, o.get()]), o.set(r.startsWith("scale") ? 1 : 0));
    }), e;
  }
  var Lt = { width: ({ x: t }, { paddingLeft: e = "0", paddingRight: r = "0", boxSizing: o }) => {
    let i = t.max - t.min;
    return o === "border-box" ? i : i - parseFloat(e) - parseFloat(r);
  }, height: ({ y: t }, { paddingTop: e = "0", paddingBottom: r = "0", boxSizing: o }) => {
    let i = t.max - t.min;
    return o === "border-box" ? i : i - parseFloat(e) - parseFloat(r);
  }, top: (t, { top: e }) => parseFloat(e), left: (t, { left: e }) => parseFloat(e), bottom: ({ y: t }, { top: e }) => parseFloat(e) + (t.max - t.min), right: ({ x: t }, { left: e }) => parseFloat(e) + (t.max - t.min), x: (t, { transform: e }) => br(e, "x"), y: (t, { transform: e }) => br(e, "y") };
  Lt.translateX = Lt.x;
  Lt.translateY = Lt.y;
  var le = /* @__PURE__ */ new Set();
  var Pi = false;
  var Di = false;
  var Mi = false;
  function As() {
    if (Di) {
      let t = Array.from(le).filter((o) => o.needsMeasurement), e = new Set(t.map((o) => o.element)), r = /* @__PURE__ */ new Map();
      e.forEach((o) => {
        let i = Ss(o);
        i.length && (r.set(o, i), o.render());
      }), t.forEach((o) => o.measureInitialState()), e.forEach((o) => {
        o.render();
        let i = r.get(o);
        i && i.forEach(([s, n]) => {
          o.getValue(s)?.set(n);
        });
      }), t.forEach((o) => o.measureEndState()), t.forEach((o) => {
        o.suspendedScrollY !== void 0 && window.scrollTo(0, o.suspendedScrollY);
      });
    }
    Di = false, Pi = false, le.forEach((t) => t.complete(Mi)), le.clear();
  }
  function ws() {
    le.forEach((t) => {
      t.readKeyframes(), t.needsMeasurement && (Di = true);
    });
  }
  function Ei() {
    Mi = true, ws(), As(), Mi = false;
  }
  var kt = class {
    constructor(e, r, o, i, s, n = false) {
      this.state = "pending", this.isAsync = false, this.needsMeasurement = false, this.unresolvedKeyframes = [...e], this.onComplete = r, this.name = o, this.motionValue = i, this.element = s, this.isAsync = n;
    }
    scheduleResolve() {
      this.state = "scheduled", this.isAsync ? (le.add(this), Pi || (Pi = true, A.read(ws), A.resolveKeyframes(As))) : (this.readKeyframes(), this.complete());
    }
    readKeyframes() {
      let { unresolvedKeyframes: e, name: r, element: o, motionValue: i } = this;
      if (e[0] === null) {
        let s = i?.get(), n = e[e.length - 1];
        if (s !== void 0) e[0] = s;
        else if (o && r) {
          let a = o.readValue(r, n);
          a != null && (e[0] = a);
        }
        e[0] === void 0 && (e[0] = n), i && s === void 0 && i.set(e[0]);
      }
      vr(e);
    }
    setFinalKeyframe() {
    }
    measureInitialState() {
    }
    renderEndStyles() {
    }
    measureEndState() {
    }
    complete(e = false) {
      this.state = "complete", this.onComplete(this.unresolvedKeyframes, this.finalKeyframe, e), le.delete(this);
    }
    cancel() {
      this.state === "scheduled" && (le.delete(this), this.state = "pending");
    }
    resume() {
      this.state === "pending" && this.scheduleResolve();
    }
  };
  var Re = (t) => t.startsWith("--");
  function Sr(t, e, r) {
    Re(e) ? t.style.setProperty(e, r) : t.style[e] = r;
  }
  var Ci = {};
  function Ar(t, e) {
    let r = qt(t);
    return () => Ci[e] ?? r();
  }
  var wr = Ar(() => window.ScrollTimeline !== void 0, "scrollTimeline");
  var Ri = Ar(() => window.ViewTimeline !== void 0, "viewTimeline");
  var zt = Ar(() => {
    try {
      document.createElement("div").animate({ opacity: 0 }, { easing: "linear(0, 1)" });
    } catch {
      return false;
    }
    return true;
  }, "linearEasing");
  var $t = ([t, e, r, o]) => `cubic-bezier(${t}, ${e}, ${r}, ${o})`;
  var Be = { linear: "linear", ease: "ease", easeIn: "ease-in", easeOut: "ease-out", easeInOut: "ease-in-out", circIn: $t([0, 0.65, 0.55, 1]), circOut: $t([0.55, 0, 1, 0.45]), backIn: $t([0.31, 0.01, 0.66, -0.59]), backOut: $t([0.33, 1.53, 0.69, 0.99]) };
  function Oe(t, e) {
    if (t) return typeof t == "function" ? zt() ? gr(t, e) : "ease-out" : Qt(t) ? $t(t) : Array.isArray(t) ? t.map((r) => Oe(r, e) || Be.easeOut) : Be[t];
  }
  function Bi(t, e, r, { delay: o = 0, duration: i = 300, repeat: s = 0, repeatType: n = "loop", ease: a = "easeOut", times: l } = {}, f = void 0) {
    let c = { [e]: r };
    l && (c.offset = l);
    let m = Oe(a, i);
    Array.isArray(m) && (c.easing = m), U.value && Z.waapi++;
    let u = { delay: o, duration: i, easing: Array.isArray(m) ? "linear" : m, fill: "both", iterations: s + 1, direction: n === "reverse" ? "alternate" : "normal" };
    f && (u.pseudoElement = f);
    let p = t.animate(c, u);
    return U.value && p.finished.finally(() => {
      Z.waapi--;
    }), p;
  }
  function ce(t) {
    return typeof t == "function" && "applyToOptions" in t;
  }
  function Pr({ type: t, ...e }) {
    return ce(t) && zt() ? t.applyToOptions(e) : (e.duration ?? (e.duration = 300), e.ease ?? (e.ease = "easeOut"), e);
  }
  var at = class extends Gt {
    constructor(e) {
      if (super(), this.finishedTime = null, this.isStopped = false, this.manualStartTime = null, !e) return;
      let { element: r, name: o, keyframes: i, pseudoElement: s, allowFlatten: n = false, finalKeyframe: a, onComplete: l } = e;
      this.isPseudoElement = !!s, this.allowFlatten = n, this.options = e, H(typeof e.type != "string", `Mini animate() doesn't support "type" as a string.`, "mini-spring");
      let f = Pr(e);
      this.animation = Bi(r, o, i, f, s), f.autoplay === false && this.animation.pause(), this.animation.onfinish = () => {
        if (this.finishedTime = this.time, !s) {
          let c = Ot(i, this.options, a, this.speed);
          this.updateMotionValue && this.updateMotionValue(c), Sr(r, o, c), this.animation.cancel();
        }
        l?.(), this.notifyFinished();
      };
    }
    play() {
      this.isStopped || (this.manualStartTime = null, this.animation.play(), this.state === "finished" && this.updateFinished());
    }
    pause() {
      this.animation.pause();
    }
    complete() {
      this.animation.finish?.();
    }
    cancel() {
      try {
        this.animation.cancel();
      } catch {
      }
    }
    stop() {
      if (this.isStopped) return;
      this.isStopped = true;
      let { state: e } = this;
      e === "idle" || e === "finished" || (this.updateMotionValue ? this.updateMotionValue() : this.commitStyles(), this.isPseudoElement || this.cancel());
    }
    commitStyles() {
      let e = this.options?.element;
      !this.isPseudoElement && e?.isConnected && this.animation.commitStyles?.();
    }
    get duration() {
      let e = this.animation.effect?.getComputedTiming?.().duration || 0;
      return _(Number(e));
    }
    get iterationDuration() {
      let { delay: e = 0 } = this.options || {};
      return this.duration + _(e);
    }
    get time() {
      return _(Number(this.animation.currentTime) || 0);
    }
    set time(e) {
      let r = this.finishedTime !== null;
      this.manualStartTime = null, this.finishedTime = null, this.animation.currentTime = E(e), r && this.animation.pause();
    }
    get speed() {
      return this.animation.playbackRate;
    }
    set speed(e) {
      e < 0 && (this.finishedTime = null), this.animation.playbackRate = e;
    }
    get state() {
      return this.finishedTime !== null ? "finished" : this.animation.playState;
    }
    get startTime() {
      return this.manualStartTime ?? Number(this.animation.startTime);
    }
    set startTime(e) {
      this.manualStartTime = this.animation.startTime = e;
    }
    attachTimeline({ timeline: e, rangeStart: r, rangeEnd: o, observe: i }) {
      return this.allowFlatten && this.animation.effect?.updateTiming({ easing: "linear" }), this.animation.onfinish = null, e && wr() ? (this.animation.timeline = e, r && (this.animation.rangeStart = r), o && (this.animation.rangeEnd = o), N) : i(this);
    }
  };
  var Ps = { anticipate: or, backInOut: rr, circInOut: sr };
  function oc(t) {
    return t in Ps;
  }
  function Ds(t) {
    typeof t.ease == "string" && oc(t.ease) && (t.ease = Ps[t.ease]);
  }
  var Oi = 10;
  var Dr = class extends at {
    constructor(e) {
      Ds(e), Do(e), super(e), e.startTime !== void 0 && e.autoplay !== false && (this.startTime = e.startTime), this.options = e;
    }
    updateMotionValue(e) {
      let { motionValue: r, onUpdate: o, onComplete: i, element: s, ...n } = this.options;
      if (!r) return;
      if (e !== void 0) {
        r.set(e);
        return;
      }
      let a = new st({ ...n, autoplay: false }), l = Math.max(Oi, I.now() - this.startTime), f = K(0, Oi, l - Oi), c = a.sample(l).value, { name: m } = this.options;
      s && m && Sr(s, m, c), r.setWithVelocity(a.sample(Math.max(0, l - f)).value, c, f), a.stop();
    }
  };
  var Li = (t, e) => e === "zIndex" ? false : !!(typeof t == "number" || Array.isArray(t) || typeof t == "string" && (G.test(t) || t === "0") && !t.startsWith("url("));
  function ic(t) {
    let e = t[0];
    if (t.length === 1) return true;
    for (let r = 0; r < t.length; r++) if (t[r] !== e) return true;
  }
  function Ms(t, e, r, o) {
    let i = t[0];
    if (i === null) return false;
    if (e === "display" || e === "visibility") return true;
    let s = t[t.length - 1], n = Li(i, e), a = Li(s, e);
    return Dt(n === a, `You are trying to animate ${e} from "${i}" to "${s}". "${n ? s : i}" is not an animatable value.`, "value-not-animatable"), !n || !a ? false : ic(t) || (r === "spring" || ce(r)) && o;
  }
  function Le(t) {
    t.duration = 0, t.type = "keyframes";
  }
  var Mr = /* @__PURE__ */ new Set(["opacity", "clipPath", "filter", "transform"]);
  var nc = /^(?:oklch|oklab|lab|lch|color|color-mix|light-dark)\(/;
  function Es(t) {
    for (let e = 0; e < t.length; e++) if (typeof t[e] == "string" && nc.test(t[e])) return true;
    return false;
  }
  var sc = /* @__PURE__ */ new Set(["color", "backgroundColor", "outlineColor", "fill", "stroke", "borderColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"]);
  var ac = qt(() => Object.hasOwnProperty.call(Element.prototype, "animate"));
  function ki(t) {
    let { motionValue: e, name: r, repeatDelay: o, repeatType: i, damping: s, type: n, keyframes: a } = t;
    if (!(e?.owner?.current instanceof HTMLElement)) return false;
    let { onUpdate: f, transformTemplate: c } = e.owner.getProps();
    return ac() && r && (Mr.has(r) || sc.has(r) && Es(a)) && (r !== "transform" || !c) && !f && !o && i !== "mirror" && s !== 0 && n !== "inertia";
  }
  var lc = 40;
  var Er = class extends Gt {
    constructor({ autoplay: e = true, delay: r = 0, type: o = "keyframes", repeat: i = 0, repeatDelay: s = 0, repeatType: n = "loop", keyframes: a, name: l, motionValue: f, element: c, ...m }) {
      super(), this.stop = () => {
        this._animation && (this._animation.stop(), this.stopTimeline?.()), this.keyframeResolver?.cancel();
      }, this.createdAt = I.now();
      let u = { autoplay: e, delay: r, type: o, repeat: i, repeatDelay: s, repeatType: n, name: l, motionValue: f, element: c, ...m }, p = c?.KeyframeResolver || kt;
      this.keyframeResolver = new p(a, (h, d, g) => this.onKeyframesResolved(h, d, u, !g), l, f, c), this.keyframeResolver?.scheduleResolve();
    }
    onKeyframesResolved(e, r, o, i) {
      this.keyframeResolver = void 0;
      let { name: s, type: n, velocity: a, delay: l, isHandoff: f, onUpdate: c } = o;
      this.resolvedAt = I.now();
      let m = true;
      Ms(e, s, n, a) || (m = false, (q.instantAnimations || !l) && c?.(Ot(e, o, r)), e[0] = e[e.length - 1], Le(o), o.repeat = 0);
      let p = { startTime: i ? this.resolvedAt ? this.resolvedAt - this.createdAt > lc ? this.resolvedAt : this.createdAt : this.createdAt : void 0, finalKeyframe: r, ...o, keyframes: e }, h = m && !f && ki(p), d = p.motionValue?.owner?.current, g;
      if (h) try {
        g = new Dr({ ...p, element: d });
      } catch {
        g = new st(p);
      }
      else g = new st(p);
      g.finished.then(() => {
        this.notifyFinished();
      }).catch(N), this.pendingTimeline && (this.stopTimeline = g.attachTimeline(this.pendingTimeline), this.pendingTimeline = void 0), this._animation = g;
    }
    get finished() {
      return this._animation ? this.animation.finished : this._finished;
    }
    then(e, r) {
      return this.finished.finally(e).then(() => {
      });
    }
    get animation() {
      return this._animation || (this.keyframeResolver?.resume(), Ei()), this._animation;
    }
    get duration() {
      return this.animation.duration;
    }
    get iterationDuration() {
      return this.animation.iterationDuration;
    }
    get time() {
      return this.animation.time;
    }
    set time(e) {
      this.animation.time = e;
    }
    get speed() {
      return this.animation.speed;
    }
    get state() {
      return this.animation.state;
    }
    set speed(e) {
      this.animation.speed = e;
    }
    get startTime() {
      return this.animation.startTime;
    }
    attachTimeline(e) {
      return this._animation ? this.stopTimeline = this.animation.attachTimeline(e) : this.pendingTimeline = e, () => this.stop();
    }
    play() {
      this.animation.play();
    }
    pause() {
      this.animation.pause();
    }
    complete() {
      this.animation.complete();
    }
    cancel() {
      this._animation && this.animation.cancel(), this.keyframeResolver?.cancel();
    }
  };
  var bt = class {
    constructor(e) {
      this.stop = () => this.runAll("stop"), this.animations = e.filter(Boolean);
    }
    get finished() {
      return Promise.all(this.animations.map((e) => e.finished));
    }
    getAll(e) {
      return this.animations[0][e];
    }
    setAll(e, r) {
      for (let o = 0; o < this.animations.length; o++) this.animations[o][e] = r;
    }
    attachTimeline(e) {
      let r = this.animations.map((o) => o.attachTimeline(e));
      return () => {
        r.forEach((o, i) => {
          o && o(), this.animations[i].stop();
        });
      };
    }
    get time() {
      return this.getAll("time");
    }
    set time(e) {
      this.setAll("time", e);
    }
    get speed() {
      return this.getAll("speed");
    }
    set speed(e) {
      this.setAll("speed", e);
    }
    get state() {
      return this.getAll("state");
    }
    get startTime() {
      return this.getAll("startTime");
    }
    get duration() {
      return Cs(this.animations, "duration");
    }
    get iterationDuration() {
      return Cs(this.animations, "iterationDuration");
    }
    runAll(e) {
      this.animations.forEach((r) => r[e]());
    }
    play() {
      this.runAll("play");
    }
    pause() {
      this.runAll("pause");
    }
    cancel() {
      this.runAll("cancel");
    }
    complete() {
      this.runAll("complete");
    }
  };
  function Cs(t, e) {
    let r = 0;
    for (let o = 0; o < t.length; o++) {
      let i = t[o][e];
      i !== null && i > r && (r = i);
    }
    return r;
  }
  var fe = class extends bt {
    then(e, r) {
      return this.finished.finally(e).then(() => {
      });
    }
  };
  var Rs = /* @__PURE__ */ new WeakMap();
  var Fi = (t, e = "") => `${t}:${e}`;
  function Ii(t) {
    let e = Rs.get(t);
    return e || (e = /* @__PURE__ */ new Map(), Rs.set(t, e)), e;
  }
  var cc = /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u;
  function Bs(t) {
    let e = cc.exec(t);
    if (!e) return [,];
    let [, r, o, i] = e;
    return [`--${r ?? o}`, i];
  }
  var fc = 4;
  function Mo(t, e, r = 1) {
    H(r <= fc, `Max CSS variable fallback depth detected in property "${t}". This may indicate a circular fallback dependency.`, "max-css-var-depth");
    let [o, i] = Bs(t);
    if (!o) return;
    let s = window.getComputedStyle(e).getPropertyValue(o);
    if (s) {
      let n = s.trim();
      return Ze(n) ? parseFloat(n) : n;
    }
    return re(i) ? Mo(i, e, r + 1) : i;
  }
  var mc = { type: "spring", stiffness: 500, damping: 25, restSpeed: 10 };
  var uc = (t) => ({ type: "spring", stiffness: 550, damping: t === 0 ? 2 * Math.sqrt(550) : 30, restSpeed: 10 });
  var pc = { type: "keyframes", duration: 0.8 };
  var hc = { type: "keyframes", ease: [0.25, 0.1, 0.35, 1], duration: 0.3 };
  var Ni = (t, { keyframes: e }) => e.length > 2 ? pc : J.has(t) ? t.startsWith("scale") ? uc(e[1]) : mc : hc;
  function Rr(t, e) {
    if (t?.inherit && e) {
      let { inherit: r, ...o } = t;
      return { ...e, ...o };
    }
    return t;
  }
  function lt(t, e) {
    let r = t?.[e] ?? t?.default ?? t;
    return r !== t ? Rr(r, t) : r;
  }
  var dc = /* @__PURE__ */ new Set(["when", "delay", "delayChildren", "staggerChildren", "staggerDirection", "repeat", "repeatType", "repeatDelay", "from", "elapsed"]);
  function ji(t) {
    for (let e in t) if (!dc.has(e)) return true;
    return false;
  }
  var Br = (t, e, r, o = {}, i, s) => (n) => {
    let a = lt(o, t) || {}, l = a.delay || o.delay || 0, { elapsed: f = 0 } = o;
    f = f - E(l);
    let c = { keyframes: Array.isArray(r) ? r : [null, r], ease: "easeOut", velocity: e.getVelocity(), ...a, delay: -f, onUpdate: (u) => {
      e.set(u), a.onUpdate && a.onUpdate(u);
    }, onComplete: () => {
      n(), a.onComplete && a.onComplete();
    }, name: t, motionValue: e, element: s ? void 0 : i };
    ji(a) || Object.assign(c, Ni(t, c)), c.duration && (c.duration = E(c.duration)), c.repeatDelay && (c.repeatDelay = E(c.repeatDelay)), c.from !== void 0 && (c.keyframes[0] = c.from);
    let m = false;
    if ((c.type === false || c.duration === 0 && !c.repeatDelay) && (Le(c), c.delay === 0 && (m = true)), (q.instantAnimations || q.skipAnimations || i?.shouldSkipAnimations) && (m = true, Le(c), c.delay = 0), c.allowFlatten = !a.type && !a.ease, m && !s && e.get() !== void 0) {
      let u = Ot(c.keyframes, a);
      if (u !== void 0) {
        A.update(() => {
          c.onUpdate(u), c.onComplete();
        });
        return;
      }
    }
    return a.isSync ? new st(c) : new Er(c);
  };
  function Os(t) {
    let e = [{}, {}];
    return t?.values.forEach((r, o) => {
      e[0][o] = r.get(), e[1][o] = r.getVelocity();
    }), e;
  }
  function Or(t, e, r, o) {
    if (typeof e == "function") {
      let [i, s] = Os(o);
      e = e(r !== void 0 ? r : t.custom, i, s);
    }
    if (typeof e == "string" && (e = t.variants && t.variants[e]), typeof e == "function") {
      let [i, s] = Os(o);
      e = e(r !== void 0 ? r : t.custom, i, s);
    }
    return e;
  }
  function xt(t, e, r) {
    let o = t.getProps();
    return Or(o, e, r !== void 0 ? r : o.custom, t);
  }
  var Lr = /* @__PURE__ */ new Set(["width", "height", "top", "left", "right", "bottom", ...it]);
  var Ls = 30;
  var gc = (t) => !isNaN(parseFloat(t));
  var Fe = { current: void 0 };
  var St = class {
    constructor(e, r = {}) {
      this.canTrackVelocity = null, this.events = {}, this.updateAndNotify = (o) => {
        let i = I.now();
        if (this.updatedAt !== i && this.setPrevFrameValue(), this.prev = this.current, this.setCurrent(o), this.current !== this.prev && (this.events.change?.notify(this.current), this.dependents)) for (let s of this.dependents) s.dirty();
      }, this.hasAnimated = false, this.setCurrent(e), this.owner = r.owner;
    }
    setCurrent(e) {
      this.current = e, this.updatedAt = I.now(), this.canTrackVelocity === null && e !== void 0 && (this.canTrackVelocity = gc(this.current));
    }
    setPrevFrameValue(e = this.current) {
      this.prevFrameValue = e, this.prevUpdatedAt = this.updatedAt;
    }
    onChange(e) {
      return this.on("change", e);
    }
    on(e, r) {
      this.events[e] || (this.events[e] = new Mt());
      let o = this.events[e].add(r);
      return e === "change" ? () => {
        o(), A.read(() => {
          this.events.change.getSize() || this.stop();
        });
      } : o;
    }
    clearListeners() {
      for (let e in this.events) this.events[e].clear();
    }
    attach(e, r) {
      this.passiveEffect = e, this.stopPassiveEffect = r;
    }
    set(e) {
      this.passiveEffect ? this.passiveEffect(e, this.updateAndNotify) : this.updateAndNotify(e);
    }
    setWithVelocity(e, r, o) {
      this.set(r), this.prev = void 0, this.prevFrameValue = e, this.prevUpdatedAt = this.updatedAt - o;
    }
    jump(e, r = true) {
      this.updateAndNotify(e), this.prev = e, this.prevUpdatedAt = this.prevFrameValue = void 0, r && this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
    }
    dirty() {
      this.events.change?.notify(this.current);
    }
    addDependent(e) {
      this.dependents || (this.dependents = /* @__PURE__ */ new Set()), this.dependents.add(e);
    }
    removeDependent(e) {
      this.dependents && this.dependents.delete(e);
    }
    get() {
      return Fe.current && Fe.current.push(this), this.current;
    }
    getPrevious() {
      return this.prev;
    }
    getVelocity() {
      let e = I.now();
      if (!this.canTrackVelocity || this.prevFrameValue === void 0 || e - this.updatedAt > Ls) return 0;
      let r = Math.min(this.updatedAt - this.prevUpdatedAt, Ls);
      return Jt(parseFloat(this.current) - parseFloat(this.prevFrameValue), r);
    }
    start(e) {
      return this.stop(), new Promise((r) => {
        this.hasAnimated = true, this.animation = e(r), this.events.animationStart && this.events.animationStart.notify();
      }).then(() => {
        this.events.animationComplete && this.events.animationComplete.notify(), this.clearAnimation();
      });
    }
    stop() {
      this.animation && (this.animation.stop(), this.events.animationCancel && this.events.animationCancel.notify()), this.clearAnimation();
    }
    isAnimating() {
      return !!this.animation;
    }
    clearAnimation() {
      delete this.animation;
    }
    destroy() {
      this.dependents?.clear(), this.events.destroy?.notify(), this.clearListeners(), this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
    }
  };
  function $(t, e) {
    return new St(t, e);
  }
  var Ie = (t) => Array.isArray(t);
  function yc(t, e, r) {
    t.hasValue(e) ? t.getValue(e).set(r) : t.addValue(e, $(r));
  }
  function xc(t) {
    return Ie(t) ? t[t.length - 1] || 0 : t;
  }
  function Wi(t, e) {
    let r = xt(t, e), { transitionEnd: o = {}, transition: i = {}, ...s } = r || {};
    s = { ...s, ...o };
    for (let n in s) {
      let a = xc(s[n]);
      yc(t, n, a);
    }
  }
  var C = (t) => !!(t && t.getVelocity);
  function Ki(t) {
    return !!(C(t) && t.add);
  }
  function Ui(t, e) {
    let r = t.getValue("willChange");
    if (Ki(r)) return r.add(e);
    if (!r && q.WillChange) {
      let o = new q.WillChange("auto");
      t.addValue("willChange", o), o.add(e);
    }
  }
  function Ft(t) {
    return t.replace(/([A-Z])/g, (e) => `-${e.toLowerCase()}`);
  }
  var ks = "framerAppearId";
  var Gi = "data-" + Ft(ks);
  function kr(t) {
    return t.props[Gi];
  }
  function Tc({ protectedKeys: t, needsAnimating: e }, r) {
    let o = t.hasOwnProperty(r) && e[r] !== true;
    return e[r] = false, o;
  }
  function me(t, e, { delay: r = 0, transitionOverride: o, type: i } = {}) {
    let { transition: s, transitionEnd: n, ...a } = e, l = t.getDefaultTransition();
    s = s ? Rr(s, l) : l;
    let f = s?.reduceMotion;
    o && (s = o);
    let c = [], m = i && t.animationState && t.animationState.getState()[i];
    for (let u in a) {
      let p = t.getValue(u, t.latestValues[u] ?? null), h = a[u];
      if (h === void 0 || m && Tc(m, u)) continue;
      let d = { delay: r, ...lt(s || {}, u) }, g = p.get();
      if (g !== void 0 && !p.isAnimating() && !Array.isArray(h) && h === g && !d.velocity) {
        A.update(() => p.set(h));
        continue;
      }
      let x = false;
      if (window.MotionHandoffAnimation) {
        let v = kr(t);
        if (v) {
          let S = window.MotionHandoffAnimation(v, u, A);
          S !== null && (d.startTime = S, x = true);
        }
      }
      Ui(t, u);
      let V = f ?? t.shouldReduceMotion;
      p.start(Br(u, p, h, V && Lr.has(u) ? { type: false } : d, t, x));
      let T = p.animation;
      T && c.push(T);
    }
    if (n) {
      let u = () => A.update(() => {
        n && Wi(t, n);
      });
      c.length ? Promise.all(c).then(u) : u();
    }
    return c;
  }
  var Fs = { test: (t) => t === "auto", parse: (t) => t };
  var Ir = (t) => (e) => e.test(t);
  var Eo = [dt, y, ot, yt, hi, pi, Fs];
  var Co = (t) => Eo.find(Ir(t));
  function Is(t) {
    return typeof t == "number" ? t === 0 : t !== null ? t === "none" || t === "0" || Qe(t) : true;
  }
  var Vc = /* @__PURE__ */ new Set(["brightness", "contrast", "saturate", "opacity"]);
  function bc(t) {
    let [e, r] = t.slice(0, -1).split("(");
    if (e === "drop-shadow") return t;
    let [o] = r.match(De) || [];
    if (!o) return t;
    let i = r.replace(o, ""), s = Vc.has(e) ? 1 : 0;
    return o !== r && (s *= 100), e + "(" + s + i + ")";
  }
  var Sc = /\b([a-z-]*)\(.*?\)/gu;
  var Nr = { ...G, getAnimatableNone: (t) => {
    let e = t.match(Sc);
    return e ? e.map(bc).join(" ") : t;
  } };
  var jr = { ...G, getAnimatableNone: (t) => {
    let e = G.parse(t);
    return G.createTransformer(t)(e.map((o) => typeof o == "number" ? 0 : typeof o == "object" ? { ...o, alpha: 1 } : o));
  } };
  var $i = { ...dt, transform: Math.round };
  var Hi = { rotate: yt, rotateX: yt, rotateY: yt, rotateZ: yt, scale: Pe, scaleX: Pe, scaleY: Pe, scaleZ: Pe, skew: yt, skewX: yt, skewY: yt, distance: y, translateX: y, translateY: y, translateZ: y, x: y, y, z: y, perspective: y, transformPerspective: y, opacity: Vt, originX: So, originY: So, originZ: y };
  var It = { borderWidth: y, borderTopWidth: y, borderRightWidth: y, borderBottomWidth: y, borderLeftWidth: y, borderRadius: y, borderTopLeftRadius: y, borderTopRightRadius: y, borderBottomRightRadius: y, borderBottomLeftRadius: y, width: y, maxWidth: y, height: y, maxHeight: y, top: y, right: y, bottom: y, left: y, inset: y, insetBlock: y, insetBlockStart: y, insetBlockEnd: y, insetInline: y, insetInlineStart: y, insetInlineEnd: y, padding: y, paddingTop: y, paddingRight: y, paddingBottom: y, paddingLeft: y, paddingBlock: y, paddingBlockStart: y, paddingBlockEnd: y, paddingInline: y, paddingInlineStart: y, paddingInlineEnd: y, margin: y, marginTop: y, marginRight: y, marginBottom: y, marginLeft: y, marginBlock: y, marginBlockStart: y, marginBlockEnd: y, marginInline: y, marginInlineStart: y, marginInlineEnd: y, fontSize: y, backgroundPositionX: y, backgroundPositionY: y, ...Hi, zIndex: $i, fillOpacity: Vt, strokeOpacity: Vt, numOctaves: $i };
  var Ns = { ...It, color: k, backgroundColor: k, outlineColor: k, fill: k, stroke: k, borderColor: k, borderTopColor: k, borderRightColor: k, borderBottomColor: k, borderLeftColor: k, filter: Nr, WebkitFilter: Nr, mask: jr, WebkitMask: jr };
  var Wr = (t) => Ns[t];
  var Ac = /* @__PURE__ */ new Set([Nr, jr]);
  function Kr(t, e) {
    let r = Wr(t);
    return Ac.has(r) || (r = G), r.getAnimatableNone ? r.getAnimatableNone(e) : void 0;
  }
  var wc = /* @__PURE__ */ new Set(["auto", "none", "0"]);
  function js(t, e, r) {
    let o = 0, i;
    for (; o < t.length && !i; ) {
      let s = t[o];
      typeof s == "string" && !wc.has(s) && Rt(s).values.length && (i = t[o]), o++;
    }
    if (i && r) for (let s of e) t[s] = Kr(r, i);
  }
  var Ur = class extends kt {
    constructor(e, r, o, i, s) {
      super(e, r, o, i, s, true);
    }
    readKeyframes() {
      let { unresolvedKeyframes: e, element: r, name: o } = this;
      if (!r || !r.current) return;
      super.readKeyframes();
      for (let c = 0; c < e.length; c++) {
        let m = e[c];
        if (typeof m == "string" && (m = m.trim(), re(m))) {
          let u = Mo(m, r.current);
          u !== void 0 && (e[c] = u), c === e.length - 1 && (this.finalKeyframe = m);
        }
      }
      if (this.resolveNoneKeyframes(), !Lr.has(o) || e.length !== 2) return;
      let [i, s] = e, n = Co(i), a = Co(s), l = vo(i), f = vo(s);
      if (l !== f && Lt[o]) {
        this.needsMeasurement = true;
        return;
      }
      if (n !== a) if (wi(n) && wi(a)) for (let c = 0; c < e.length; c++) {
        let m = e[c];
        typeof m == "string" && (e[c] = parseFloat(m));
      }
      else Lt[o] && (this.needsMeasurement = true);
    }
    resolveNoneKeyframes() {
      let { unresolvedKeyframes: e, name: r } = this, o = [];
      for (let i = 0; i < e.length; i++) (e[i] === null || Is(e[i])) && o.push(i);
      o.length && js(e, o, r);
    }
    measureInitialState() {
      let { element: e, unresolvedKeyframes: r, name: o } = this;
      if (!e || !e.current) return;
      o === "height" && (this.suspendedScrollY = window.pageYOffset), this.measuredOrigin = Lt[o](e.measureViewportBox(), window.getComputedStyle(e.current)), r[0] = this.measuredOrigin;
      let i = r[r.length - 1];
      i !== void 0 && e.getValue(o, i).jump(i, false);
    }
    measureEndState() {
      let { element: e, name: r, unresolvedKeyframes: o } = this;
      if (!e || !e.current) return;
      let i = e.getValue(r);
      i && i.jump(this.measuredOrigin, false);
      let s = o.length - 1, n = o[s];
      o[s] = Lt[r](e.measureViewportBox(), window.getComputedStyle(e.current)), n !== null && this.finalKeyframe === void 0 && (this.finalKeyframe = n), this.removedTransforms?.length && this.removedTransforms.forEach(([a, l]) => {
        e.getValue(a).set(l);
      }), this.resolveNoneKeyframes();
    }
  };
  var Ws = /* @__PURE__ */ new Set(["borderWidth", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderRadius", "borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius", "width", "maxWidth", "height", "maxHeight", "top", "right", "bottom", "left", "inset", "insetBlock", "insetBlockStart", "insetBlockEnd", "insetInline", "insetInlineStart", "insetInlineEnd", "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "paddingBlock", "paddingBlockStart", "paddingBlockEnd", "paddingInline", "paddingInlineStart", "paddingInlineEnd", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft", "marginBlock", "marginBlockStart", "marginBlockEnd", "marginInline", "marginInlineStart", "marginInlineEnd", "fontSize", "backgroundPositionX", "backgroundPositionY"]);
  function _i(t, e) {
    for (let r = 0; r < t.length; r++) typeof t[r] == "number" && Ws.has(e) && (t[r] = t[r] + "px");
  }
  var Pc = qt(() => {
    try {
      document.createElement("div").animate({ opacity: [1] });
    } catch {
      return false;
    }
    return true;
  });
  function Q(t, e, r) {
    if (t == null) return [];
    if (t instanceof EventTarget) return [t];
    if (typeof t == "string") {
      let o = document;
      e && (o = e.current);
      let i = r?.[t] ?? o.querySelectorAll(t);
      return i ? Array.from(i) : [];
    }
    return Array.from(t).filter((o) => o != null);
  }
  function Ne(t) {
    return (e, r) => {
      let o = Q(e), i = [];
      for (let s of o) {
        let n = t(s, r);
        i.push(n);
      }
      return () => {
        for (let s of i) s();
      };
    };
  }
  var ue = (t, e) => e && typeof t == "number" ? e.transform(t) : t;
  var Ro = class {
    constructor() {
      this.latest = {}, this.values = /* @__PURE__ */ new Map();
    }
    set(e, r, o, i, s = true) {
      let n = this.values.get(e);
      n && n.onRemove();
      let a = () => {
        let c = r.get();
        s ? this.latest[e] = ue(c, It[e]) : this.latest[e] = c, o && A.render(o);
      };
      a();
      let l = r.on("change", a);
      i && r.addDependent(i);
      let f = () => {
        l(), o && L(o), this.values.delete(e), i && r.removeDependent(i);
      };
      return this.values.set(e, { value: r, onRemove: f }), f;
    }
    get(e) {
      return this.values.get(e)?.value;
    }
  };
  function Ht(t) {
    let e = /* @__PURE__ */ new WeakMap();
    return (r, o) => {
      let i = e.get(r) ?? new Ro();
      e.set(r, i);
      let s = [];
      for (let n in o) {
        let a = o[n], l = t(r, i, n, a);
        s.push(l);
      }
      return () => {
        for (let n of s) n();
      };
    };
  }
  function Dc(t, e) {
    if (!(e in t)) return false;
    let r = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(t), e) || Object.getOwnPropertyDescriptor(t, e);
    return r && typeof r.set == "function";
  }
  var Gr = (t, e, r, o) => {
    let i = Dc(t, r), s = i ? r : r.startsWith("data") || r.startsWith("aria") ? Ft(r) : r, n = i ? () => {
      t[s] = e.latest[r];
    } : () => {
      let a = e.latest[r];
      a == null ? t.removeAttribute(s) : t.setAttribute(s, String(a));
    };
    return e.set(r, o, n);
  };
  var Mc = Ne(Ht(Gr));
  var Ec = Ht((t, e, r, o) => e.set(r, o, () => {
    t[r] = e.latest[r];
  }, void 0, false));
  function pe(t) {
    return Je(t) && "offsetHeight" in t && !("ownerSVGElement" in t);
  }
  var Cc = { x: "translateX", y: "translateY", z: "translateZ", transformPerspective: "perspective" };
  function Us(t) {
    let e = "", r = true;
    for (let o = 0; o < it.length; o++) {
      let i = it[o], s = t.latest[i];
      if (s === void 0) continue;
      let n = true;
      if (typeof s == "number") n = s === (i.startsWith("scale") ? 1 : 0);
      else {
        let a = parseFloat(s);
        n = i.startsWith("scale") ? a === 1 : a === 0;
      }
      if (!n) {
        r = false;
        let a = Cc[i] || i;
        e += `${a}(${s}) `;
      }
    }
    return r ? "none" : e.trim();
  }
  var Rc = /* @__PURE__ */ new Set(["originX", "originY", "originZ"]);
  var zr = (t, e, r, o) => {
    let i, s;
    return J.has(r) ? (e.get("transform") || (!pe(t) && !e.get("transformBox") && zr(t, e, "transformBox", new St("fill-box")), e.set("transform", new St("none"), () => {
      t.style.transform = Us(e);
    })), s = e.get("transform")) : Rc.has(r) ? (e.get("transformOrigin") || e.set("transformOrigin", new St(""), () => {
      let n = e.latest.originX ?? "50%", a = e.latest.originY ?? "50%", l = e.latest.originZ ?? 0;
      t.style.transformOrigin = `${n} ${a} ${l}`;
    }), s = e.get("transformOrigin")) : Re(r) ? i = () => {
      t.style.setProperty(r, e.latest[r]);
    } : i = () => {
      t.style[r] = e.latest[r];
    }, e.set(r, o, i, s);
  };
  var Bc = Ne(Ht(zr));
  function Oc(t, e, r, o) {
    return A.render(() => t.setAttribute("pathLength", "1")), r === "pathOffset" ? e.set(r, o, () => {
      let i = e.latest[r];
      t.setAttribute("stroke-dashoffset", `${-i}`);
    }) : (e.get("stroke-dasharray") || e.set("stroke-dasharray", new St("1 1"), () => {
      let { pathLength: i = 1, pathSpacing: s } = e.latest;
      t.setAttribute("stroke-dasharray", `${i} ${s ?? 1 - Number(i)}`);
    }), e.set(r, o, void 0, e.get("stroke-dasharray")));
  }
  var Lc = (t, e, r, o) => r.startsWith("path") ? Oc(t, e, r, o) : r.startsWith("attr") ? Gr(t, e, Fc(r), o) : (r in t.style ? zr : Gr)(t, e, r, o);
  var kc = Ne(Ht(Lc));
  function Fc(t) {
    return t.replace(/^attr([A-Z])/, (e, r) => r.toLowerCase());
  }
  var { schedule: he, cancel: Ic } = fr(queueMicrotask, false);
  function Lo(t, e) {
    let r = window.getComputedStyle(t);
    return Re(e) ? r.getPropertyValue(e) : r[e];
  }
  function Nt(t) {
    return Je(t) && "ownerSVGElement" in t;
  }
  var _s = (t, e, r) => (o, i) => i && i[0] ? i[0][t + "Size"] : Nt(o) && "getBBox" in o ? o.getBBox()[e] : o[r];
  var $c = _s("inline", "width", "offsetWidth");
  var Hc = _s("block", "height", "offsetHeight");
  function _r(t) {
    return Nt(t) && t.tagName === "svg";
  }
  function Zs(t, e) {
    if (t === "first") return 0;
    {
      let r = e - 1;
      return t === "last" ? r : r / 2;
    }
  }
  function tf(t = 0.1, { startDelay: e = 0, from: r = 0, ease: o } = {}) {
    return (i, s) => {
      let n = typeof r == "number" ? r : Zs(r, s), a = Math.abs(n - i), l = t * a;
      if (o) {
        let f = s * t;
        l = we(o)(l / f) * f;
      }
      return e + l;
    };
  }
  var nf = [...Eo, k, G];
  var nn = (t) => nf.find(Ir(t));
  var cn = () => ({ translate: 0, scale: 1, origin: 0, originPoint: 0 });
  var _t = () => ({ x: cn(), y: cn() });
  var fn = () => ({ min: 0, max: 0 });
  var O = () => ({ x: fn(), y: fn() });
  var ft = /* @__PURE__ */ new WeakMap();
  function Yr(t) {
    return t !== null && typeof t == "object" && typeof t.start == "function";
  }
  function de(t) {
    return typeof t == "string" || Array.isArray(t);
  }
  var qr = ["animate", "whileInView", "whileFocus", "whileHover", "whileTap", "whileDrag", "exit"];
  var Ke = ["initial", ...qr];
  function Ko(t) {
    return Yr(t.animate) || Ke.some((e) => de(t[e]));
  }
  function mn(t) {
    return !!(Ko(t) || t.variants);
  }
  function un(t, e, r) {
    for (let o in e) {
      let i = e[o], s = r[o];
      if (C(i)) t.addValue(o, i);
      else if (C(s)) t.addValue(o, $(i, { owner: t }));
      else if (s !== i) if (t.hasValue(o)) {
        let n = t.getValue(o);
        n.liveStyle === true ? n.jump(i) : n.hasAnimated || n.set(i);
      } else {
        let n = t.getStaticValue(o);
        t.addValue(o, $(n !== void 0 ? n : i, { owner: t }));
      }
    }
    for (let o in r) e[o] === void 0 && t.removeValue(o);
    return e;
  }
  var Ue = { current: null };
  var Zr = { current: false };
  var mf = typeof window < "u";
  function pn() {
    if (Zr.current = true, !!mf) if (window.matchMedia) {
      let t = window.matchMedia("(prefers-reduced-motion)"), e = () => Ue.current = t.matches;
      t.addEventListener("change", e), e();
    } else Ue.current = false;
  }
  var sa = ["AnimationStart", "AnimationComplete", "Update", "BeforeLayoutMeasure", "LayoutMeasure", "LayoutAnimationStart", "LayoutAnimationComplete"];
  var Uo = {};
  var ge = class {
    scrapeMotionValuesFromProps(e, r, o) {
      return {};
    }
    constructor({ parent: e, props: r, presenceContext: o, reducedMotionConfig: i, skipAnimations: s, blockInitialAnimation: n, visualState: a }, l = {}) {
      this.current = null, this.children = /* @__PURE__ */ new Set(), this.isVariantNode = false, this.isControllingVariants = false, this.shouldReduceMotion = null, this.shouldSkipAnimations = false, this.values = /* @__PURE__ */ new Map(), this.KeyframeResolver = kt, this.features = {}, this.valueSubscriptions = /* @__PURE__ */ new Map(), this.prevMotionValues = {}, this.hasBeenMounted = false, this.events = {}, this.propEventSubscriptions = {}, this.notifyUpdate = () => this.notify("Update", this.latestValues), this.render = () => {
        this.current && (this.triggerBuild(), this.renderInstance(this.current, this.renderState, this.props.style, this.projection));
      }, this.renderScheduledAt = 0, this.scheduleRender = () => {
        let p = I.now();
        this.renderScheduledAt < p && (this.renderScheduledAt = p, A.render(this.render, false, true));
      };
      let { latestValues: f, renderState: c } = a;
      this.latestValues = f, this.baseTarget = { ...f }, this.initialValues = r.initial ? { ...f } : {}, this.renderState = c, this.parent = e, this.props = r, this.presenceContext = o, this.depth = e ? e.depth + 1 : 0, this.reducedMotionConfig = i, this.skipAnimationsConfig = s, this.options = l, this.blockInitialAnimation = !!n, this.isControllingVariants = Ko(r), this.isVariantNode = mn(r), this.isVariantNode && (this.variantChildren = /* @__PURE__ */ new Set()), this.manuallyAnimateOnMount = !!(e && e.current);
      let { willChange: m, ...u } = this.scrapeMotionValuesFromProps(r, {}, this);
      for (let p in u) {
        let h = u[p];
        f[p] !== void 0 && C(h) && h.set(f[p]);
      }
    }
    mount(e) {
      if (this.hasBeenMounted) for (let r in this.initialValues) this.values.get(r)?.jump(this.initialValues[r]), this.latestValues[r] = this.initialValues[r];
      this.current = e, ft.set(e, this), this.projection && !this.projection.instance && this.projection.mount(e), this.parent && this.isVariantNode && !this.isControllingVariants && (this.removeFromVariantTree = this.parent.addVariantChild(this)), this.values.forEach((r, o) => this.bindToMotionValue(o, r)), this.reducedMotionConfig === "never" ? this.shouldReduceMotion = false : this.reducedMotionConfig === "always" ? this.shouldReduceMotion = true : (Zr.current || pn(), this.shouldReduceMotion = Ue.current), this.shouldSkipAnimations = this.skipAnimationsConfig ?? false, this.parent?.addChild(this), this.update(this.props, this.presenceContext), this.hasBeenMounted = true;
    }
    unmount() {
      this.projection && this.projection.unmount(), L(this.notifyUpdate), L(this.render), this.valueSubscriptions.forEach((e) => e()), this.valueSubscriptions.clear(), this.removeFromVariantTree && this.removeFromVariantTree(), this.parent?.removeChild(this);
      for (let e in this.events) this.events[e].clear();
      for (let e in this.features) {
        let r = this.features[e];
        r && (r.unmount(), r.isMounted = false);
      }
      this.current = null;
    }
    addChild(e) {
      this.children.add(e), this.enteringChildren ?? (this.enteringChildren = /* @__PURE__ */ new Set()), this.enteringChildren.add(e);
    }
    removeChild(e) {
      this.children.delete(e), this.enteringChildren && this.enteringChildren.delete(e);
    }
    bindToMotionValue(e, r) {
      if (this.valueSubscriptions.has(e) && this.valueSubscriptions.get(e)(), r.accelerate && Mr.has(e) && this.current instanceof HTMLElement) {
        let { factory: n, keyframes: a, times: l, ease: f, duration: c } = r.accelerate, m = new at({ element: this.current, name: e, keyframes: a, times: l, ease: f, duration: E(c) }), u = n(m);
        this.valueSubscriptions.set(e, () => {
          u(), m.cancel();
        });
        return;
      }
      let o = J.has(e);
      o && this.onBindTransform && this.onBindTransform();
      let i = r.on("change", (n) => {
        this.latestValues[e] = n, this.props.onUpdate && A.preRender(this.notifyUpdate), o && this.projection && (this.projection.isTransformDirty = true), this.scheduleRender();
      }), s;
      typeof window < "u" && window.MotionCheckAppearSync && (s = window.MotionCheckAppearSync(this, e, r)), this.valueSubscriptions.set(e, () => {
        i(), s && s(), r.owner && r.stop();
      });
    }
    sortNodePosition(e) {
      return !this.current || !this.sortInstanceNodePosition || this.type !== e.type ? 0 : this.sortInstanceNodePosition(this.current, e.current);
    }
    updateFeatures() {
      let e = "animation";
      for (e in Uo) {
        let r = Uo[e];
        if (!r) continue;
        let { isEnabled: o, Feature: i } = r;
        if (!this.features[e] && i && o(this.props) && (this.features[e] = new i(this)), this.features[e]) {
          let s = this.features[e];
          s.isMounted ? s.update() : (s.mount(), s.isMounted = true);
        }
      }
    }
    triggerBuild() {
      this.build(this.renderState, this.latestValues, this.props);
    }
    measureViewportBox() {
      return this.current ? this.measureInstanceViewportBox(this.current, this.props) : O();
    }
    getStaticValue(e) {
      return this.latestValues[e];
    }
    setStaticValue(e, r) {
      this.latestValues[e] = r;
    }
    update(e, r) {
      (e.transformTemplate || this.props.transformTemplate) && this.scheduleRender(), this.prevProps = this.props, this.props = e, this.prevPresenceContext = this.presenceContext, this.presenceContext = r;
      for (let o = 0; o < sa.length; o++) {
        let i = sa[o];
        this.propEventSubscriptions[i] && (this.propEventSubscriptions[i](), delete this.propEventSubscriptions[i]);
        let s = "on" + i, n = e[s];
        n && (this.propEventSubscriptions[i] = this.on(i, n));
      }
      this.prevMotionValues = un(this, this.scrapeMotionValuesFromProps(e, this.prevProps || {}, this), this.prevMotionValues), this.handleChildMotionValue && this.handleChildMotionValue();
    }
    getProps() {
      return this.props;
    }
    getVariant(e) {
      return this.props.variants ? this.props.variants[e] : void 0;
    }
    getDefaultTransition() {
      return this.props.transition;
    }
    getTransformPagePoint() {
      return this.props.transformPagePoint;
    }
    getClosestVariantNode() {
      return this.isVariantNode ? this : this.parent ? this.parent.getClosestVariantNode() : void 0;
    }
    addVariantChild(e) {
      let r = this.getClosestVariantNode();
      if (r) return r.variantChildren && r.variantChildren.add(e), () => r.variantChildren.delete(e);
    }
    addValue(e, r) {
      let o = this.values.get(e);
      r !== o && (o && this.removeValue(e), this.bindToMotionValue(e, r), this.values.set(e, r), this.latestValues[e] = r.get());
    }
    removeValue(e) {
      this.values.delete(e);
      let r = this.valueSubscriptions.get(e);
      r && (r(), this.valueSubscriptions.delete(e)), delete this.latestValues[e], this.removeValueFromRenderState(e, this.renderState);
    }
    hasValue(e) {
      return this.values.has(e);
    }
    getValue(e, r) {
      if (this.props.values && this.props.values[e]) return this.props.values[e];
      let o = this.values.get(e);
      return o === void 0 && r !== void 0 && (o = $(r === null ? void 0 : r, { owner: this }), this.addValue(e, o)), o;
    }
    readValue(e, r) {
      let o = this.latestValues[e] !== void 0 || !this.current ? this.latestValues[e] : this.getBaseTargetFromProps(this.props, e) ?? this.readValueFromInstance(this.current, e, this.options);
      return o != null && (typeof o == "string" && (Ze(o) || Qe(o)) ? o = parseFloat(o) : !nn(o) && G.test(r) && (o = Kr(e, r)), this.setBaseTarget(e, C(o) ? o.get() : o)), C(o) ? o.get() : o;
    }
    setBaseTarget(e, r) {
      this.baseTarget[e] = r;
    }
    getBaseTarget(e) {
      let { initial: r } = this.props, o;
      if (typeof r == "string" || typeof r == "object") {
        let s = Or(this.props, r, this.presenceContext?.custom);
        s && (o = s[e]);
      }
      if (r && o !== void 0) return o;
      let i = this.getBaseTargetFromProps(this.props, e);
      return i !== void 0 && !C(i) ? i : this.initialValues[e] !== void 0 && o === void 0 ? void 0 : this.baseTarget[e];
    }
    on(e, r) {
      return this.events[e] || (this.events[e] = new Mt()), this.events[e].add(r);
    }
    notify(e, ...r) {
      this.events[e] && this.events[e].notify(...r);
    }
    scheduleRenderMicrotask() {
      he.render(this.render);
    }
  };
  var ye = class extends ge {
    constructor() {
      super(...arguments), this.KeyframeResolver = Ur;
    }
    sortInstanceNodePosition(e, r) {
      return e.compareDocumentPosition(r) & 2 ? 1 : -1;
    }
    getBaseTargetFromProps(e, r) {
      let o = e.style;
      return o ? o[r] : void 0;
    }
    removeValueFromRenderState(e, { vars: r, style: o }) {
      delete r[e], delete o[e];
    }
    handleChildMotionValue() {
      this.childSubscription && (this.childSubscription(), delete this.childSubscription);
      let { children: e } = this.props;
      C(e) && (this.childSubscription = e.on("change", (r) => {
        this.current && (this.current.textContent = `${r}`);
      }));
    }
  };
  function dn({ top: t, left: e, right: r, bottom: o }) {
    return { x: { min: e, max: r }, y: { min: t, max: o } };
  }
  function gn(t, e) {
    if (!e) return t;
    let r = e({ x: t.left, y: t.top }), o = e({ x: t.right, y: t.bottom });
    return { top: r.y, left: r.x, bottom: o.y, right: o.x };
  }
  function yn(t) {
    return t === void 0 || t === 1;
  }
  function Jr({ scale: t, scaleX: e, scaleY: r }) {
    return !yn(t) || !yn(e) || !yn(r);
  }
  function At(t) {
    return Jr(t) || Go(t) || t.z || t.rotate || t.rotateX || t.rotateY || t.skewX || t.skewY;
  }
  function Go(t) {
    return aa(t.x) || aa(t.y);
  }
  function aa(t) {
    return t && t !== "0%";
  }
  function Ge(t, e, r) {
    let o = t - r, i = e * o;
    return r + i;
  }
  function xn(t, e, r, o, i) {
    return i !== void 0 && (t = Ge(t, i, o)), Ge(t, r, o) + e;
  }
  function zo(t, e = 0, r = 1, o, i) {
    t.min = xn(t.min, e, r, o, i), t.max = xn(t.max, e, r, o, i);
  }
  function $o(t, { x: e, y: r }) {
    zo(t.x, e.translate, e.scale, e.originPoint), zo(t.y, r.translate, r.scale, r.originPoint);
  }
  var la = 0.999999999999;
  var ca = 1.0000000000001;
  function vn(t, e, r, o = false) {
    let i = r.length;
    if (!i) return;
    e.x = e.y = 1;
    let s, n;
    for (let a = 0; a < i; a++) {
      s = r[a], n = s.projectionDelta;
      let { visualElement: l } = s.options;
      l && l.props.style && l.props.style.display === "contents" || (o && s.options.layoutScroll && s.scroll && s !== s.root && (mt(t.x, -s.scroll.offset.x), mt(t.y, -s.scroll.offset.y)), n && (e.x *= n.x.scale, e.y *= n.y.scale, $o(t, n)), o && At(s.latestValues) && ze(t, s.latestValues, s.layout?.layoutBox));
    }
    e.x < ca && e.x > la && (e.x = 1), e.y < ca && e.y > la && (e.y = 1);
  }
  function mt(t, e) {
    t.min += e, t.max += e;
  }
  function Tn(t, e, r, o, i = 0.5) {
    let s = D(t.min, t.max, i);
    zo(t, e, r, s, o);
  }
  function fa(t, e) {
    return typeof t == "string" ? parseFloat(t) / 100 * (e.max - e.min) : t;
  }
  function ze(t, e, r) {
    let o = r ?? t;
    Tn(t.x, fa(e.x, o.x), e.scaleX, e.scale, e.originX), Tn(t.y, fa(e.y, o.y), e.scaleY, e.scale, e.originY);
  }
  function Ho(t, e) {
    return dn(gn(t.getBoundingClientRect(), e));
  }
  var gf = { x: "translateX", y: "translateY", z: "translateZ", transformPerspective: "perspective" };
  var yf = it.length;
  function Vn(t, e, r) {
    let o = "", i = true;
    for (let s = 0; s < yf; s++) {
      let n = it[s], a = t[n];
      if (a === void 0) continue;
      let l = true;
      if (typeof a == "number") l = a === (n.startsWith("scale") ? 1 : 0);
      else {
        let f = parseFloat(a);
        l = n.startsWith("scale") ? f === 1 : f === 0;
      }
      if (!l || r) {
        let f = ue(a, It[n]);
        if (!l) {
          i = false;
          let c = gf[n] || n;
          o += `${c}(${f}) `;
        }
        r && (e[n] = f);
      }
    }
    return o = o.trim(), r ? o = r(e, i ? "" : o) : i && (o = "none"), o;
  }
  function Qr(t, e, r) {
    let { style: o, vars: i, transformOrigin: s } = t, n = false, a = false;
    for (let l in e) {
      let f = e[l];
      if (J.has(l)) {
        n = true;
        continue;
      } else if (ee(l)) {
        i[l] = f;
        continue;
      } else {
        let c = ue(f, It[l]);
        l.startsWith("origin") ? (a = true, s[l] = c) : o[l] = c;
      }
    }
    if (e.transform || (n || r ? o.transform = Vn(e, t.transform, r) : o.transform && (o.transform = "none")), a) {
      let { originX: l = "50%", originY: f = "50%", originZ: c = 0 } = s;
      o.transformOrigin = `${l} ${f} ${c}`;
    }
  }
  function to(t, { style: e, vars: r }, o, i) {
    let s = t.style, n;
    for (n in e) s[n] = e[n];
    i?.applyProjectionStyles(s, o);
    for (n in r) s.setProperty(n, r[n]);
  }
  function bn(t, e) {
    return e.max === e.min ? 0 : t / (e.max - e.min) * 100;
  }
  var xe = { correct: (t, e) => {
    if (!e.target) return t;
    if (typeof t == "string") if (y.test(t)) t = parseFloat(t);
    else return t;
    let r = bn(t, e.target.x), o = bn(t, e.target.y);
    return `${r}% ${o}%`;
  } };
  var Sn = { correct: (t, { treeScale: e, projectionDelta: r }) => {
    let o = t, i = G.parse(t);
    if (i.length > 5) return o;
    let s = G.createTransformer(t), n = typeof i[0] != "number" ? 1 : 0, a = r.x.scale * e.x, l = r.y.scale * e.y;
    i[0 + n] /= a, i[1 + n] /= l;
    let f = D(a, l, 0.5);
    return typeof i[2 + n] == "number" && (i[2 + n] /= f), typeof i[3 + n] == "number" && (i[3 + n] /= f), s(i);
  } };
  var Xt = { borderRadius: { ...xe, applyTo: ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"] }, borderTopLeftRadius: xe, borderTopRightRadius: xe, borderBottomLeftRadius: xe, borderBottomRightRadius: xe, boxShadow: Sn };
  function An(t, { layout: e, layoutId: r }) {
    return J.has(t) || t.startsWith("origin") || (e || r !== void 0) && (!!Xt[t] || t === "opacity");
  }
  function eo(t, e, r) {
    let o = t.style, i = e?.style, s = {};
    if (!o) return s;
    for (let n in o) (C(o[n]) || i && C(i[n]) || An(n, t) || r?.getValue(n)?.liveStyle !== void 0) && (s[n] = o[n]);
    return s;
  }
  function Tf(t) {
    return window.getComputedStyle(t);
  }
  var Te = class extends ye {
    constructor() {
      super(...arguments), this.type = "html", this.renderInstance = to;
    }
    readValueFromInstance(e, r) {
      if (J.has(r)) return this.projection?.isProjecting ? Vr(r) : Ai(e, r);
      {
        let o = Tf(e), i = (ee(r) ? o.getPropertyValue(r) : o[r]) || 0;
        return typeof i == "string" ? i.trim() : i;
      }
    }
    measureInstanceViewportBox(e, { transformPagePoint: r }) {
      return Ho(e, r);
    }
    build(e, r, o) {
      Qr(e, r, o.transformTemplate);
    }
    scrapeMotionValuesFromProps(e, r, o) {
      return eo(e, r, o);
    }
  };
  function vf(t, e) {
    return t in e;
  }
  var ro = class extends ge {
    constructor() {
      super(...arguments), this.type = "object";
    }
    readValueFromInstance(e, r) {
      if (vf(r, e)) {
        let o = e[r];
        if (typeof o == "string" || typeof o == "number") return o;
      }
    }
    getBaseTargetFromProps() {
    }
    removeValueFromRenderState(e, r) {
      delete r.output[e];
    }
    measureInstanceViewportBox() {
      return O();
    }
    build(e, r) {
      Object.assign(e.output, r);
    }
    renderInstance(e, { output: r }) {
      Object.assign(e, r);
    }
    sortInstanceNodePosition() {
      return 0;
    }
  };
  var Vf = { offset: "stroke-dashoffset", array: "stroke-dasharray" };
  var bf = { offset: "strokeDashoffset", array: "strokeDasharray" };
  function wn(t, e, r = 1, o = 0, i = true) {
    t.pathLength = 1;
    let s = i ? Vf : bf;
    t[s.offset] = `${-o}`, t[s.array] = `${e} ${r}`;
  }
  var Sf = ["offsetDistance", "offsetPath", "offsetRotate", "offsetAnchor"];
  function Pn(t, { attrX: e, attrY: r, attrScale: o, pathLength: i, pathSpacing: s = 1, pathOffset: n = 0, ...a }, l, f, c) {
    if (Qr(t, a, f), l) {
      t.style.viewBox && (t.attrs.viewBox = t.style.viewBox);
      return;
    }
    t.attrs = t.style, t.style = {};
    let { attrs: m, style: u } = t;
    m.transform && (u.transform = m.transform, delete m.transform), (u.transform || m.transformOrigin) && (u.transformOrigin = m.transformOrigin ?? "50% 50%", delete m.transformOrigin), u.transform && (u.transformBox = c?.transformBox ?? "fill-box", delete m.transformBox);
    for (let p of Sf) m[p] !== void 0 && (u[p] = m[p], delete m[p]);
    e !== void 0 && (m.x = e), r !== void 0 && (m.y = r), o !== void 0 && (m.scale = o), i !== void 0 && wn(m, i, s, n, false);
  }
  var oo = /* @__PURE__ */ new Set(["baseFrequency", "diffuseConstant", "kernelMatrix", "kernelUnitLength", "keySplines", "keyTimes", "limitingConeAngle", "markerHeight", "markerWidth", "numOctaves", "targetX", "targetY", "surfaceScale", "specularConstant", "specularExponent", "stdDeviation", "tableValues", "viewBox", "gradientTransform", "pathLength", "startOffset", "textLength", "lengthAdjust"]);
  var Dn = (t) => typeof t == "string" && t.toLowerCase() === "svg";
  function Mn(t, e, r, o) {
    to(t, e, void 0, o);
    for (let i in e.attrs) t.setAttribute(oo.has(i) ? i : Ft(i), e.attrs[i]);
  }
  function En(t, e, r) {
    let o = eo(t, e, r);
    for (let i in t) if (C(t[i]) || C(e[i])) {
      let s = it.indexOf(i) !== -1 ? "attr" + i.charAt(0).toUpperCase() + i.substring(1) : i;
      o[s] = t[i];
    }
    return o;
  }
  var io = class extends ye {
    constructor() {
      super(...arguments), this.type = "svg", this.isSVGTag = false, this.measureInstanceViewportBox = O;
    }
    getBaseTargetFromProps(e, r) {
      return e[r];
    }
    readValueFromInstance(e, r) {
      if (J.has(r)) {
        let o = Wr(r);
        return o && o.default || 0;
      }
      return r = oo.has(r) ? r : Ft(r), e.getAttribute(r);
    }
    scrapeMotionValuesFromProps(e, r, o) {
      return En(e, r, o);
    }
    build(e, r, o) {
      Pn(e, r, this.isSVGTag, o.transformTemplate, o.style);
    }
    renderInstance(e, r, o, i) {
      Mn(e, r, o, i);
    }
    mount(e) {
      this.isSVGTag = Dn(e.tagName), super.mount(e);
    }
  };
  var Af = Ke.length;
  var wf = [...qr].reverse();
  var Pf = qr.length;
  function no(t, e) {
    t.min = e.min, t.max = e.max;
  }
  function X(t, e) {
    no(t.x, e.x), no(t.y, e.y);
  }
  function Xo(t, e) {
    t.translate = e.translate, t.scale = e.scale, t.originPoint = e.originPoint, t.origin = e.origin;
  }
  var pa = 1e-4;
  var Ef = 1 - pa;
  var Cf = 1 + pa;
  var ha = 0.01;
  var Rf = 0 - ha;
  var Bf = 0 + ha;
  function et(t) {
    return t.max - t.min;
  }
  function Ln(t, e, r) {
    return Math.abs(t - e) <= r;
  }
  function Rn(t, e, r, o = 0.5) {
    t.origin = o, t.originPoint = D(e.min, e.max, t.origin), t.scale = et(r) / et(e), t.translate = D(r.min, r.max, t.origin) - t.originPoint, (t.scale >= Ef && t.scale <= Cf || isNaN(t.scale)) && (t.scale = 1), (t.translate >= Rf && t.translate <= Bf || isNaN(t.translate)) && (t.translate = 0);
  }
  function Ve(t, e, r, o) {
    Rn(t.x, e.x, r.x, o ? o.originX : void 0), Rn(t.y, e.y, r.y, o ? o.originY : void 0);
  }
  function Bn(t, e, r, o = 0) {
    let i = o ? D(r.min, r.max, o) : r.min;
    t.min = i + e.min, t.max = t.min + et(e);
  }
  function kn(t, e, r, o) {
    Bn(t.x, e.x, r.x, o?.x), Bn(t.y, e.y, r.y, o?.y);
  }
  function On(t, e, r, o = 0) {
    let i = o ? D(r.min, r.max, o) : r.min;
    t.min = e.min - i, t.max = t.min + et(e);
  }
  function $e(t, e, r, o) {
    On(t.x, e.x, r.x, o?.x), On(t.y, e.y, r.y, o?.y);
  }
  function Fn(t, e, r, o, i) {
    return t -= e, t = Ge(t, 1 / r, o), i !== void 0 && (t = Ge(t, 1 / i, o)), t;
  }
  function da(t, e = 0, r = 1, o = 0.5, i, s = t, n = t) {
    if (ot.test(e) && (e = parseFloat(e), e = D(n.min, n.max, e / 100) - n.min), typeof e != "number") return;
    let a = D(s.min, s.max, o);
    t === s && (a -= e), t.min = Fn(t.min, e, r, a, i), t.max = Fn(t.max, e, r, a, i);
  }
  function In(t, e, [r, o, i], s, n) {
    da(t, e[r], e[o], e[i], e.scale, s, n);
  }
  var Of = ["x", "scaleX", "originX"];
  var Lf = ["y", "scaleY", "originY"];
  function Yo(t, e, r, o) {
    In(t.x, e, Of, r ? r.x : void 0, o ? o.x : void 0), In(t.y, e, Lf, r ? r.y : void 0, o ? o.y : void 0);
  }
  function ga(t) {
    return t.translate === 0 && t.scale === 1;
  }
  function qo(t) {
    return ga(t.x) && ga(t.y);
  }
  function Nn(t, e) {
    return t.min === e.min && t.max === e.max;
  }
  function Wn(t, e) {
    return Nn(t.x, e.x) && Nn(t.y, e.y);
  }
  function jn(t, e) {
    return Math.round(t.min) === Math.round(e.min) && Math.round(t.max) === Math.round(e.max);
  }
  function Zo(t, e) {
    return jn(t.x, e.x) && jn(t.y, e.y);
  }
  function Jo(t) {
    return et(t.x) / et(t.y);
  }
  function Qo(t, e) {
    return t.translate === e.translate && t.scale === e.scale && t.originPoint === e.originPoint;
  }
  function ti(t) {
    return [t("x"), t("y")];
  }
  function Kn(t, e, r) {
    let o = "", i = t.x.translate / e.x, s = t.y.translate / e.y, n = r?.z || 0;
    if ((i || s || n) && (o = `translate3d(${i}px, ${s}px, ${n}px) `), (e.x !== 1 || e.y !== 1) && (o += `scale(${1 / e.x}, ${1 / e.y}) `), r) {
      let { transformPerspective: f, rotate: c, rotateX: m, rotateY: u, skewX: p, skewY: h } = r;
      f && (o = `perspective(${f}px) ${o}`), c && (o += `rotate(${c}deg) `), m && (o += `rotateX(${m}deg) `), u && (o += `rotateY(${u}deg) `), p && (o += `skewX(${p}deg) `), h && (o += `skewY(${h}deg) `);
    }
    let a = t.x.scale * e.x, l = t.y.scale * e.y;
    return (a !== 1 || l !== 1) && (o += `scale(${a}, ${l})`), o || "none";
  }
  var va = ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"];
  var kf = va.length;
  var ya = (t) => typeof t == "string" ? parseFloat(t) : t;
  var xa = (t) => typeof t == "number" || y.test(t);
  function Un(t, e, r, o, i, s) {
    i ? (t.opacity = D(0, r.opacity ?? 1, Ff(o)), t.opacityExit = D(e.opacity ?? 1, 0, If(o))) : s && (t.opacity = D(e.opacity ?? 1, r.opacity ?? 1, o));
    for (let n = 0; n < kf; n++) {
      let a = va[n], l = Ta(e, a), f = Ta(r, a);
      if (l === void 0 && f === void 0) continue;
      l || (l = 0), f || (f = 0), l === 0 || f === 0 || xa(l) === xa(f) ? (t[a] = Math.max(D(ya(l), ya(f), o), 0), (ot.test(f) || ot.test(l)) && (t[a] += "%")) : t[a] = f;
    }
    (e.rotate || r.rotate) && (t.rotate = D(e.rotate || 0, r.rotate || 0, o));
  }
  function Ta(t, e) {
    return t[e] !== void 0 ? t[e] : t.borderRadius;
  }
  var Ff = Va(0, 0.5, nr);
  var If = Va(0.5, 0.95, N);
  function Va(t, e, r) {
    return (o) => o < t ? 0 : o > e ? 1 : r(ht(t, e, o));
  }
  function so(t, e, r) {
    let o = C(t) ? t : $(t);
    return o.start(Br("", o, e, r)), o.animation;
  }
  function Gn(t, e, r, o = { passive: true }) {
    return t.addEventListener(e, r, o), () => t.removeEventListener(e, r);
  }
  var zn = (t, e) => t.depth - e.depth;
  var ao = class {
    constructor() {
      this.children = [], this.isDirty = false;
    }
    add(e) {
      Yt(this.children, e), this.isDirty = true;
    }
    remove(e) {
      rt(this.children, e), this.isDirty = true;
    }
    forEach(e) {
      this.isDirty && this.children.sort(zn), this.isDirty = false, this.children.forEach(e);
    }
  };
  function ei(t, e) {
    let r = I.now(), o = ({ timestamp: i }) => {
      let s = i - r;
      s >= e && (L(o), t(s - e));
    };
    return A.setup(o, true), () => L(o);
  }
  function lo(t) {
    return C(t) ? t.get() : t;
  }
  var co = class {
    constructor() {
      this.members = [];
    }
    add(e) {
      Yt(this.members, e);
      for (let r = this.members.length - 1; r >= 0; r--) {
        let o = this.members[r];
        if (o === e || o === this.lead || o === this.prevLead) continue;
        let i = o.instance;
        (!i || i.isConnected === false) && !o.snapshot && (rt(this.members, o), o.unmount());
      }
      e.scheduleRender();
    }
    remove(e) {
      if (rt(this.members, e), e === this.prevLead && (this.prevLead = void 0), e === this.lead) {
        let r = this.members[this.members.length - 1];
        r && this.promote(r);
      }
    }
    relegate(e) {
      for (let r = this.members.indexOf(e) - 1; r >= 0; r--) {
        let o = this.members[r];
        if (o.isPresent !== false && o.instance?.isConnected !== false) return this.promote(o), true;
      }
      return false;
    }
    promote(e, r) {
      let o = this.lead;
      if (e !== o && (this.prevLead = o, this.lead = e, e.show(), o)) {
        o.updateSnapshot(), e.scheduleRender();
        let { layoutDependency: i } = o.options, { layoutDependency: s } = e.options;
        (i === void 0 || i !== s) && (e.resumeFrom = o, r && (o.preserveOpacity = true), o.snapshot && (e.snapshot = o.snapshot, e.snapshot.latestValues = o.animationValues || o.latestValues), e.root?.isUpdating && (e.isLayoutDirty = true)), e.options.crossfade === false && o.hide();
      }
    }
    exitAnimationComplete() {
      this.members.forEach((e) => {
        e.options.onExitComplete?.(), e.resumingFrom?.options.onExitComplete?.();
      });
    }
    scheduleRender() {
      this.members.forEach((e) => e.instance && e.scheduleRender(false));
    }
    removeLeadSnapshot() {
      this.lead?.snapshot && (this.lead.snapshot = void 0);
    }
  };
  var fo = { hasAnimatedSinceResize: true, hasEverUpdated: false };
  var be = { nodes: 0, calculatedTargetDeltas: 0, calculatedProjections: 0 };
  var $n = ["", "X", "Y", "Z"];
  var Nf = 1e3;
  var jf = 0;
  function Hn(t, e, r, o) {
    let { latestValues: i } = e;
    i[t] && (r[t] = i[t], e.setStaticValue(t, 0), o && (o[t] = 0));
  }
  function Ra(t) {
    if (t.hasCheckedOptimisedAppear = true, t.root === t) return;
    let { visualElement: e } = t.options;
    if (!e) return;
    let r = kr(e);
    if (window.MotionHasOptimisedAnimation(r, "transform")) {
      let { layout: i, layoutId: s } = t.options;
      window.MotionCancelOptimisedAnimation(r, "transform", A, !(i || s));
    }
    let { parent: o } = t;
    o && !o.hasCheckedOptimisedAppear && Ra(o);
  }
  function mo({ attachResizeListener: t, defaultParent: e, measureScroll: r, checkIsScrollRoot: o, resetTransform: i }) {
    return class {
      constructor(n = {}, a = e?.()) {
        this.id = jf++, this.animationId = 0, this.animationCommitId = 0, this.children = /* @__PURE__ */ new Set(), this.options = {}, this.isTreeAnimating = false, this.isAnimationBlocked = false, this.isLayoutDirty = false, this.isProjectionDirty = false, this.isSharedProjectionDirty = false, this.isTransformDirty = false, this.updateManuallyBlocked = false, this.updateBlockedByResize = false, this.isUpdating = false, this.isSVG = false, this.needsReset = false, this.shouldResetTransform = false, this.hasCheckedOptimisedAppear = false, this.treeScale = { x: 1, y: 1 }, this.eventHandlers = /* @__PURE__ */ new Map(), this.hasTreeAnimated = false, this.layoutVersion = 0, this.updateScheduled = false, this.scheduleUpdate = () => this.update(), this.projectionUpdateScheduled = false, this.checkUpdateFailed = () => {
          this.isUpdating && (this.isUpdating = false, this.clearAllSnapshots());
        }, this.updateProjection = () => {
          this.projectionUpdateScheduled = false, U.value && (be.nodes = be.calculatedTargetDeltas = be.calculatedProjections = 0), this.nodes.forEach(Ba), this.nodes.forEach(Hf), this.nodes.forEach(_f), this.nodes.forEach(Oa), U.addProjectionMetrics && U.addProjectionMetrics(be);
        }, this.resolvedRelativeTargetAt = 0, this.linkedParentVersion = 0, this.hasProjected = false, this.isVisible = true, this.animationProgress = 0, this.sharedNodes = /* @__PURE__ */ new Map(), this.latestValues = n, this.root = a ? a.root || a : this, this.path = a ? [...a.path, a] : [], this.parent = a, this.depth = a ? a.depth + 1 : 0;
        for (let l = 0; l < this.path.length; l++) this.path[l].shouldResetTransform = true;
        this.root === this && (this.nodes = new ao());
      }
      addEventListener(n, a) {
        return this.eventHandlers.has(n) || this.eventHandlers.set(n, new Mt()), this.eventHandlers.get(n).add(a);
      }
      notifyListeners(n, ...a) {
        let l = this.eventHandlers.get(n);
        l && l.notify(...a);
      }
      hasListeners(n) {
        return this.eventHandlers.has(n);
      }
      mount(n) {
        if (this.instance) return;
        this.isSVG = Nt(n) && !_r(n), this.instance = n;
        let { layoutId: a, layout: l, visualElement: f } = this.options;
        if (f && !f.current && f.mount(n), this.root.nodes.add(this), this.parent && this.parent.children.add(this), this.root.hasTreeAnimated && (l || a) && (this.isLayoutDirty = true), t) {
          let c, m = 0, u = () => this.root.updateBlockedByResize = false;
          A.read(() => {
            m = window.innerWidth;
          }), t(n, () => {
            let p = window.innerWidth;
            p !== m && (m = p, this.root.updateBlockedByResize = true, c && c(), c = ei(u, 250), fo.hasAnimatedSinceResize && (fo.hasAnimatedSinceResize = false, this.nodes.forEach(wa)));
          });
        }
        a && this.root.registerSharedNode(a, this), this.options.animate !== false && f && (a || l) && this.addEventListener("didUpdate", ({ delta: c, hasLayoutChanged: m, hasRelativeLayoutChanged: u, layout: p }) => {
          if (this.isTreeAnimationBlocked()) {
            this.target = void 0, this.relativeTarget = void 0;
            return;
          }
          let h = this.options.transition || f.getDefaultTransition() || Jf, { onLayoutAnimationStart: d, onLayoutAnimationComplete: g } = f.getProps(), x = !this.targetLayout || !Zo(this.targetLayout, p), V = !m && u;
          if (this.options.layoutRoot || this.resumeFrom || V || m && (x || !this.currentAnimation)) {
            this.resumeFrom && (this.resumingFrom = this.resumeFrom, this.resumingFrom.resumingFrom = void 0);
            let T = { ...lt(h, "layout"), onPlay: d, onComplete: g };
            (f.shouldReduceMotion || this.options.layoutRoot) && (T.delay = 0, T.type = false), this.startAnimation(T), this.setAnimationOrigin(c, V);
          } else m || wa(this), this.isLead() && this.options.onExitComplete && this.options.onExitComplete();
          this.targetLayout = p;
        });
      }
      unmount() {
        this.options.layoutId && this.willUpdate(), this.root.nodes.remove(this);
        let n = this.getStack();
        n && n.remove(this), this.parent && this.parent.children.delete(this), this.instance = void 0, this.eventHandlers.clear(), L(this.updateProjection);
      }
      blockUpdate() {
        this.updateManuallyBlocked = true;
      }
      unblockUpdate() {
        this.updateManuallyBlocked = false;
      }
      isUpdateBlocked() {
        return this.updateManuallyBlocked || this.updateBlockedByResize;
      }
      isTreeAnimationBlocked() {
        return this.isAnimationBlocked || this.parent && this.parent.isTreeAnimationBlocked() || false;
      }
      startUpdate() {
        this.isUpdateBlocked() || (this.isUpdating = true, this.nodes && this.nodes.forEach(Xf), this.animationId++);
      }
      getTransformTemplate() {
        let { visualElement: n } = this.options;
        return n && n.getProps().transformTemplate;
      }
      willUpdate(n = true) {
        if (this.root.hasTreeAnimated = true, this.root.isUpdateBlocked()) {
          this.options.onExitComplete && this.options.onExitComplete();
          return;
        }
        if (window.MotionCancelOptimisedAnimation && !this.hasCheckedOptimisedAppear && Ra(this), !this.root.isUpdating && this.root.startUpdate(), this.isLayoutDirty) return;
        this.isLayoutDirty = true;
        for (let c = 0; c < this.path.length; c++) {
          let m = this.path[c];
          m.shouldResetTransform = true, (typeof m.latestValues.x == "string" || typeof m.latestValues.y == "string") && (m.isLayoutDirty = true), m.updateScroll("snapshot"), m.options.layoutRoot && m.willUpdate(false);
        }
        let { layoutId: a, layout: l } = this.options;
        if (a === void 0 && !l) return;
        let f = this.getTransformTemplate();
        this.prevTransformTemplateValue = f ? f(this.latestValues, "") : void 0, this.updateSnapshot(), n && this.notifyListeners("willUpdate");
      }
      update() {
        if (this.updateScheduled = false, this.isUpdateBlocked()) {
          let l = this.updateBlockedByResize;
          this.unblockUpdate(), this.updateBlockedByResize = false, this.clearAllSnapshots(), l && this.nodes.forEach(Gf), this.nodes.forEach(Sa);
          return;
        }
        if (this.animationId <= this.animationCommitId) {
          this.nodes.forEach(Aa);
          return;
        }
        this.animationCommitId = this.animationId, this.isUpdating ? (this.isUpdating = false, this.nodes.forEach(zf), this.nodes.forEach($f), this.nodes.forEach(Wf), this.nodes.forEach(Kf)) : this.nodes.forEach(Aa), this.clearAllSnapshots();
        let a = I.now();
        j.delta = K(0, 1e3 / 60, a - j.timestamp), j.timestamp = a, j.isProcessing = true, mr.update.process(j), mr.preRender.process(j), mr.render.process(j), j.isProcessing = false;
      }
      didUpdate() {
        this.updateScheduled || (this.updateScheduled = true, he.read(this.scheduleUpdate));
      }
      clearAllSnapshots() {
        this.nodes.forEach(Uf), this.sharedNodes.forEach(Yf);
      }
      scheduleUpdateProjection() {
        this.projectionUpdateScheduled || (this.projectionUpdateScheduled = true, A.preRender(this.updateProjection, false, true));
      }
      scheduleCheckAfterUnmount() {
        A.postRender(() => {
          this.isLayoutDirty ? this.root.didUpdate() : this.root.checkUpdateFailed();
        });
      }
      updateSnapshot() {
        this.snapshot || !this.instance || (this.snapshot = this.measure(), this.snapshot && !et(this.snapshot.measuredBox.x) && !et(this.snapshot.measuredBox.y) && (this.snapshot = void 0));
      }
      updateLayout() {
        if (!this.instance || (this.updateScroll(), !(this.options.alwaysMeasureLayout && this.isLead()) && !this.isLayoutDirty)) return;
        if (this.resumeFrom && !this.resumeFrom.instance) for (let l = 0; l < this.path.length; l++) this.path[l].updateScroll();
        let n = this.layout;
        this.layout = this.measure(false), this.layoutVersion++, this.layoutCorrected || (this.layoutCorrected = O()), this.isLayoutDirty = false, this.projectionDelta = void 0, this.notifyListeners("measure", this.layout.layoutBox);
        let { visualElement: a } = this.options;
        a && a.notify("LayoutMeasure", this.layout.layoutBox, n ? n.layoutBox : void 0);
      }
      updateScroll(n = "measure") {
        let a = !!(this.options.layoutScroll && this.instance);
        if (this.scroll && this.scroll.animationId === this.root.animationId && this.scroll.phase === n && (a = false), a && this.instance) {
          let l = o(this.instance);
          this.scroll = { animationId: this.root.animationId, phase: n, isRoot: l, offset: r(this.instance), wasRoot: this.scroll ? this.scroll.isRoot : l };
        }
      }
      resetTransform() {
        if (!i) return;
        let n = this.isLayoutDirty || this.shouldResetTransform || this.options.alwaysMeasureLayout, a = this.projectionDelta && !qo(this.projectionDelta), l = this.getTransformTemplate(), f = l ? l(this.latestValues, "") : void 0, c = f !== this.prevTransformTemplateValue;
        n && this.instance && (a || At(this.latestValues) || c) && (i(this.instance, f), this.shouldResetTransform = false, this.scheduleRender());
      }
      measure(n = true) {
        let a = this.measurePageBox(), l = this.removeElementScroll(a);
        return n && (l = this.removeTransform(l)), Qf(l), { animationId: this.root.animationId, measuredBox: a, layoutBox: l, latestValues: {}, source: this.id };
      }
      measurePageBox() {
        let { visualElement: n } = this.options;
        if (!n) return O();
        let a = n.measureViewportBox();
        if (!(this.scroll?.wasRoot || this.path.some(tm))) {
          let { scroll: f } = this.root;
          f && (mt(a.x, f.offset.x), mt(a.y, f.offset.y));
        }
        return a;
      }
      removeElementScroll(n) {
        let a = O();
        if (X(a, n), this.scroll?.wasRoot) return a;
        for (let l = 0; l < this.path.length; l++) {
          let f = this.path[l], { scroll: c, options: m } = f;
          f !== this.root && c && m.layoutScroll && (c.wasRoot && X(a, n), mt(a.x, c.offset.x), mt(a.y, c.offset.y));
        }
        return a;
      }
      applyTransform(n, a = false, l) {
        let f = l || O();
        X(f, n);
        for (let c = 0; c < this.path.length; c++) {
          let m = this.path[c];
          !a && m.options.layoutScroll && m.scroll && m !== m.root && (mt(f.x, -m.scroll.offset.x), mt(f.y, -m.scroll.offset.y)), At(m.latestValues) && ze(f, m.latestValues, m.layout?.layoutBox);
        }
        return At(this.latestValues) && ze(f, this.latestValues, this.layout?.layoutBox), f;
      }
      removeTransform(n) {
        let a = O();
        X(a, n);
        for (let l = 0; l < this.path.length; l++) {
          let f = this.path[l];
          if (!At(f.latestValues)) continue;
          let c;
          f.instance && (Jr(f.latestValues) && f.updateSnapshot(), c = O(), X(c, f.measurePageBox())), Yo(a, f.latestValues, f.snapshot?.layoutBox, c);
        }
        return At(this.latestValues) && Yo(a, this.latestValues), a;
      }
      setTargetDelta(n) {
        this.targetDelta = n, this.root.scheduleUpdateProjection(), this.isProjectionDirty = true;
      }
      setOptions(n) {
        this.options = { ...this.options, ...n, crossfade: n.crossfade !== void 0 ? n.crossfade : true };
      }
      clearMeasurements() {
        this.scroll = void 0, this.layout = void 0, this.snapshot = void 0, this.prevTransformTemplateValue = void 0, this.targetDelta = void 0, this.target = void 0, this.isLayoutDirty = false;
      }
      forceRelativeParentToResolveTarget() {
        this.relativeParent && this.relativeParent.resolvedRelativeTargetAt !== j.timestamp && this.relativeParent.resolveTargetDelta(true);
      }
      resolveTargetDelta(n = false) {
        let a = this.getLead();
        this.isProjectionDirty || (this.isProjectionDirty = a.isProjectionDirty), this.isTransformDirty || (this.isTransformDirty = a.isTransformDirty), this.isSharedProjectionDirty || (this.isSharedProjectionDirty = a.isSharedProjectionDirty);
        let l = !!this.resumingFrom || this !== a;
        if (!(n || l && this.isSharedProjectionDirty || this.isProjectionDirty || this.parent?.isProjectionDirty || this.attemptToResolveRelativeTarget || this.root.updateBlockedByResize)) return;
        let { layout: c, layoutId: m } = this.options;
        if (!this.layout || !(c || m)) return;
        this.resolvedRelativeTargetAt = j.timestamp;
        let u = this.getClosestProjectingParent();
        u && this.linkedParentVersion !== u.layoutVersion && !u.options.layoutRoot && this.removeRelativeTarget(), !this.targetDelta && !this.relativeTarget && (this.options.layoutAnchor !== false && u && u.layout ? this.createRelativeTarget(u, this.layout.layoutBox, u.layout.layoutBox) : this.removeRelativeTarget()), !(!this.relativeTarget && !this.targetDelta) && (this.target || (this.target = O(), this.targetWithTransforms = O()), this.relativeTarget && this.relativeTargetOrigin && this.relativeParent && this.relativeParent.target ? (this.forceRelativeParentToResolveTarget(), kn(this.target, this.relativeTarget, this.relativeParent.target, this.options.layoutAnchor || void 0)) : this.targetDelta ? (this.resumingFrom ? this.applyTransform(this.layout.layoutBox, false, this.target) : X(this.target, this.layout.layoutBox), $o(this.target, this.targetDelta)) : X(this.target, this.layout.layoutBox), this.attemptToResolveRelativeTarget && (this.attemptToResolveRelativeTarget = false, this.options.layoutAnchor !== false && u && !!u.resumingFrom == !!this.resumingFrom && !u.options.layoutScroll && u.target && this.animationProgress !== 1 ? this.createRelativeTarget(u, this.target, u.target) : this.relativeParent = this.relativeTarget = void 0), U.value && be.calculatedTargetDeltas++);
      }
      getClosestProjectingParent() {
        if (!(!this.parent || Jr(this.parent.latestValues) || Go(this.parent.latestValues))) return this.parent.isProjecting() ? this.parent : this.parent.getClosestProjectingParent();
      }
      isProjecting() {
        return !!((this.relativeTarget || this.targetDelta || this.options.layoutRoot) && this.layout);
      }
      createRelativeTarget(n, a, l) {
        this.relativeParent = n, this.linkedParentVersion = n.layoutVersion, this.forceRelativeParentToResolveTarget(), this.relativeTarget = O(), this.relativeTargetOrigin = O(), $e(this.relativeTargetOrigin, a, l, this.options.layoutAnchor || void 0), X(this.relativeTarget, this.relativeTargetOrigin);
      }
      removeRelativeTarget() {
        this.relativeParent = this.relativeTarget = void 0;
      }
      calcProjection() {
        let n = this.getLead(), a = !!this.resumingFrom || this !== n, l = true;
        if ((this.isProjectionDirty || this.parent?.isProjectionDirty) && (l = false), a && (this.isSharedProjectionDirty || this.isTransformDirty) && (l = false), this.resolvedRelativeTargetAt === j.timestamp && (l = false), l) return;
        let { layout: f, layoutId: c } = this.options;
        if (this.isTreeAnimating = !!(this.parent && this.parent.isTreeAnimating || this.currentAnimation || this.pendingAnimation), this.isTreeAnimating || (this.targetDelta = this.relativeTarget = void 0), !this.layout || !(f || c)) return;
        X(this.layoutCorrected, this.layout.layoutBox);
        let m = this.treeScale.x, u = this.treeScale.y;
        vn(this.layoutCorrected, this.treeScale, this.path, a), n.layout && !n.target && (this.treeScale.x !== 1 || this.treeScale.y !== 1) && (n.target = n.layout.layoutBox, n.targetWithTransforms = O());
        let { target: p } = n;
        if (!p) {
          this.prevProjectionDelta && (this.createProjectionDeltas(), this.scheduleRender());
          return;
        }
        !this.projectionDelta || !this.prevProjectionDelta ? this.createProjectionDeltas() : (Xo(this.prevProjectionDelta.x, this.projectionDelta.x), Xo(this.prevProjectionDelta.y, this.projectionDelta.y)), Ve(this.projectionDelta, this.layoutCorrected, p, this.latestValues), (this.treeScale.x !== m || this.treeScale.y !== u || !Qo(this.projectionDelta.x, this.prevProjectionDelta.x) || !Qo(this.projectionDelta.y, this.prevProjectionDelta.y)) && (this.hasProjected = true, this.scheduleRender(), this.notifyListeners("projectionUpdate", p)), U.value && be.calculatedProjections++;
      }
      hide() {
        this.isVisible = false;
      }
      show() {
        this.isVisible = true;
      }
      scheduleRender(n = true) {
        if (this.options.visualElement?.scheduleRender(), n) {
          let a = this.getStack();
          a && a.scheduleRender();
        }
        this.resumingFrom && !this.resumingFrom.instance && (this.resumingFrom = void 0);
      }
      createProjectionDeltas() {
        this.prevProjectionDelta = _t(), this.projectionDelta = _t(), this.projectionDeltaWithTransform = _t();
      }
      setAnimationOrigin(n, a = false) {
        let l = this.snapshot, f = l ? l.latestValues : {}, c = { ...this.latestValues }, m = _t();
        (!this.relativeParent || !this.relativeParent.options.layoutRoot) && (this.relativeTarget = this.relativeTargetOrigin = void 0), this.attemptToResolveRelativeTarget = !a;
        let u = O(), p = l ? l.source : void 0, h = this.layout ? this.layout.source : void 0, d = p !== h, g = this.getStack(), x = !g || g.members.length <= 1, V = !!(d && !x && this.options.crossfade === true && !this.path.some(Zf));
        this.animationProgress = 0;
        let T;
        this.mixTargetDelta = (v) => {
          let S = v / 1e3;
          Pa(m.x, n.x, S), Pa(m.y, n.y, S), this.setTargetDelta(m), this.relativeTarget && this.relativeTargetOrigin && this.layout && this.relativeParent && this.relativeParent.layout && ($e(u, this.layout.layoutBox, this.relativeParent.layout.layoutBox, this.options.layoutAnchor || void 0), qf(this.relativeTarget, this.relativeTargetOrigin, u, S), T && Wn(this.relativeTarget, T) && (this.isProjectionDirty = false), T || (T = O()), X(T, this.relativeTarget)), d && (this.animationValues = c, Un(c, f, this.latestValues, S, V, x)), this.root.scheduleUpdateProjection(), this.scheduleRender(), this.animationProgress = S;
        }, this.mixTargetDelta(this.options.layoutRoot ? 1e3 : 0);
      }
      startAnimation(n) {
        this.notifyListeners("animationStart"), this.currentAnimation?.stop(), this.resumingFrom?.currentAnimation?.stop(), this.pendingAnimation && (L(this.pendingAnimation), this.pendingAnimation = void 0), this.pendingAnimation = A.update(() => {
          fo.hasAnimatedSinceResize = true, Z.layout++, this.motionValue || (this.motionValue = $(0)), this.motionValue.jump(0, false), this.currentAnimation = so(this.motionValue, [0, 1e3], { ...n, velocity: 0, isSync: true, onUpdate: (a) => {
            this.mixTargetDelta(a), n.onUpdate && n.onUpdate(a);
          }, onStop: () => {
            Z.layout--;
          }, onComplete: () => {
            Z.layout--, n.onComplete && n.onComplete(), this.completeAnimation();
          } }), this.resumingFrom && (this.resumingFrom.currentAnimation = this.currentAnimation), this.pendingAnimation = void 0;
        });
      }
      completeAnimation() {
        this.resumingFrom && (this.resumingFrom.currentAnimation = void 0, this.resumingFrom.preserveOpacity = void 0);
        let n = this.getStack();
        n && n.exitAnimationComplete(), this.resumingFrom = this.currentAnimation = this.animationValues = void 0, this.notifyListeners("animationComplete");
      }
      finishAnimation() {
        this.currentAnimation && (this.mixTargetDelta && this.mixTargetDelta(Nf), this.currentAnimation.stop()), this.completeAnimation();
      }
      applyTransformsToTarget() {
        let n = this.getLead(), { targetWithTransforms: a, target: l, layout: f, latestValues: c } = n;
        if (!(!a || !l || !f)) {
          if (this !== n && this.layout && f && La(this.options.animationType, this.layout.layoutBox, f.layoutBox)) {
            l = this.target || O();
            let m = et(this.layout.layoutBox.x);
            l.x.min = n.target.x.min, l.x.max = l.x.min + m;
            let u = et(this.layout.layoutBox.y);
            l.y.min = n.target.y.min, l.y.max = l.y.min + u;
          }
          X(a, l), ze(a, c), Ve(this.projectionDeltaWithTransform, this.layoutCorrected, a, c);
        }
      }
      registerSharedNode(n, a) {
        this.sharedNodes.has(n) || this.sharedNodes.set(n, new co()), this.sharedNodes.get(n).add(a);
        let f = a.options.initialPromotionConfig;
        a.promote({ transition: f ? f.transition : void 0, preserveFollowOpacity: f && f.shouldPreserveFollowOpacity ? f.shouldPreserveFollowOpacity(a) : void 0 });
      }
      isLead() {
        let n = this.getStack();
        return n ? n.lead === this : true;
      }
      getLead() {
        let { layoutId: n } = this.options;
        return n ? this.getStack()?.lead || this : this;
      }
      getPrevLead() {
        let { layoutId: n } = this.options;
        return n ? this.getStack()?.prevLead : void 0;
      }
      getStack() {
        let { layoutId: n } = this.options;
        if (n) return this.root.sharedNodes.get(n);
      }
      promote({ needsReset: n, transition: a, preserveFollowOpacity: l } = {}) {
        let f = this.getStack();
        f && f.promote(this, l), n && (this.projectionDelta = void 0, this.needsReset = true), a && this.setOptions({ transition: a });
      }
      relegate() {
        let n = this.getStack();
        return n ? n.relegate(this) : false;
      }
      resetSkewAndRotation() {
        let { visualElement: n } = this.options;
        if (!n) return;
        let a = false, { latestValues: l } = n;
        if ((l.z || l.rotate || l.rotateX || l.rotateY || l.rotateZ || l.skewX || l.skewY) && (a = true), !a) return;
        let f = {};
        l.z && Hn("z", n, f, this.animationValues);
        for (let c = 0; c < $n.length; c++) Hn(`rotate${$n[c]}`, n, f, this.animationValues), Hn(`skew${$n[c]}`, n, f, this.animationValues);
        n.render();
        for (let c in f) n.setStaticValue(c, f[c]), this.animationValues && (this.animationValues[c] = f[c]);
        n.scheduleRender();
      }
      applyProjectionStyles(n, a) {
        if (!this.instance || this.isSVG) return;
        if (!this.isVisible) {
          n.visibility = "hidden";
          return;
        }
        let l = this.getTransformTemplate();
        if (this.needsReset) {
          this.needsReset = false, n.visibility = "", n.opacity = "", n.pointerEvents = lo(a?.pointerEvents) || "", n.transform = l ? l(this.latestValues, "") : "none";
          return;
        }
        let f = this.getLead();
        if (!this.projectionDelta || !this.layout || !f.target) {
          this.options.layoutId && (n.opacity = this.latestValues.opacity !== void 0 ? this.latestValues.opacity : 1, n.pointerEvents = lo(a?.pointerEvents) || ""), this.hasProjected && !At(this.latestValues) && (n.transform = l ? l({}, "") : "none", this.hasProjected = false);
          return;
        }
        n.visibility = "";
        let c = f.animationValues || f.latestValues;
        this.applyTransformsToTarget();
        let m = Kn(this.projectionDeltaWithTransform, this.treeScale, c);
        l && (m = l(c, m)), n.transform = m;
        let { x: u, y: p } = this.projectionDelta;
        n.transformOrigin = `${u.origin * 100}% ${p.origin * 100}% 0`, f.animationValues ? n.opacity = f === this ? c.opacity ?? this.latestValues.opacity ?? 1 : this.preserveOpacity ? this.latestValues.opacity : c.opacityExit : n.opacity = f === this ? c.opacity !== void 0 ? c.opacity : "" : c.opacityExit !== void 0 ? c.opacityExit : 0;
        for (let h in Xt) {
          if (c[h] === void 0) continue;
          let { correct: d, applyTo: g, isCSSVariable: x } = Xt[h], V = m === "none" ? c[h] : d(c[h], f);
          if (g) {
            let T = g.length;
            for (let v = 0; v < T; v++) n[g[v]] = V;
          } else x ? this.options.visualElement.renderState.vars[h] = V : n[h] = V;
        }
        this.options.layoutId && (n.pointerEvents = f === this ? lo(a?.pointerEvents) || "" : "none");
      }
      clearSnapshot() {
        this.resumeFrom = this.snapshot = void 0;
      }
      resetTree() {
        this.root.nodes.forEach((n) => n.currentAnimation?.stop()), this.root.nodes.forEach(Sa), this.root.sharedNodes.clear();
      }
    };
  }
  function Wf(t) {
    t.updateLayout();
  }
  function Kf(t) {
    let e = t.resumeFrom?.snapshot || t.snapshot;
    if (t.isLead() && t.layout && e && t.hasListeners("didUpdate")) {
      let { layoutBox: r, measuredBox: o } = t.layout, { animationType: i } = t.options, s = e.source !== t.layout.source;
      if (i === "size") ti((c) => {
        let m = s ? e.measuredBox[c] : e.layoutBox[c], u = et(m);
        m.min = r[c].min, m.max = m.min + u;
      });
      else if (i === "x" || i === "y") {
        let c = i === "x" ? "y" : "x";
        no(s ? e.measuredBox[c] : e.layoutBox[c], r[c]);
      } else La(i, e.layoutBox, r) && ti((c) => {
        let m = s ? e.measuredBox[c] : e.layoutBox[c], u = et(r[c]);
        m.max = m.min + u, t.relativeTarget && !t.currentAnimation && (t.isProjectionDirty = true, t.relativeTarget[c].max = t.relativeTarget[c].min + u);
      });
      let n = _t();
      Ve(n, r, e.layoutBox);
      let a = _t();
      s ? Ve(a, t.applyTransform(o, true), e.measuredBox) : Ve(a, r, e.layoutBox);
      let l = !qo(n), f = false;
      if (!t.resumeFrom) {
        let c = t.getClosestProjectingParent();
        if (c && !c.resumeFrom) {
          let { snapshot: m, layout: u } = c;
          if (m && u) {
            let p = t.options.layoutAnchor || void 0, h = O();
            $e(h, e.layoutBox, m.layoutBox, p);
            let d = O();
            $e(d, r, u.layoutBox, p), Zo(h, d) || (f = true), c.options.layoutRoot && (t.relativeTarget = d, t.relativeTargetOrigin = h, t.relativeParent = c);
          }
        }
      }
      t.notifyListeners("didUpdate", { layout: r, snapshot: e, delta: a, layoutDelta: n, hasLayoutChanged: l, hasRelativeLayoutChanged: f });
    } else if (t.isLead()) {
      let { onExitComplete: r } = t.options;
      r && r();
    }
    t.options.transition = void 0;
  }
  function Ba(t) {
    U.value && be.nodes++, t.parent && (t.isProjecting() || (t.isProjectionDirty = t.parent.isProjectionDirty), t.isSharedProjectionDirty || (t.isSharedProjectionDirty = !!(t.isProjectionDirty || t.parent.isProjectionDirty || t.parent.isSharedProjectionDirty)), t.isTransformDirty || (t.isTransformDirty = t.parent.isTransformDirty));
  }
  function Oa(t) {
    t.isProjectionDirty = t.isSharedProjectionDirty = t.isTransformDirty = false;
  }
  function Uf(t) {
    t.clearSnapshot();
  }
  function Sa(t) {
    t.clearMeasurements();
  }
  function Gf(t) {
    t.isLayoutDirty = true, t.updateLayout();
  }
  function Aa(t) {
    t.isLayoutDirty = false;
  }
  function zf(t) {
    t.isAnimationBlocked && t.layout && !t.isLayoutDirty && (t.snapshot = t.layout, t.isLayoutDirty = true);
  }
  function $f(t) {
    let { visualElement: e } = t.options;
    e && e.getProps().onBeforeLayoutMeasure && e.notify("BeforeLayoutMeasure"), t.resetTransform();
  }
  function wa(t) {
    t.finishAnimation(), t.targetDelta = t.relativeTarget = t.target = void 0, t.isProjectionDirty = true;
  }
  function Hf(t) {
    t.resolveTargetDelta();
  }
  function _f(t) {
    t.calcProjection();
  }
  function Xf(t) {
    t.resetSkewAndRotation();
  }
  function Yf(t) {
    t.removeLeadSnapshot();
  }
  function Pa(t, e, r) {
    t.translate = D(e.translate, 0, r), t.scale = D(e.scale, 1, r), t.origin = e.origin, t.originPoint = e.originPoint;
  }
  function Da(t, e, r, o) {
    t.min = D(e.min, r.min, o), t.max = D(e.max, r.max, o);
  }
  function qf(t, e, r, o) {
    Da(t.x, e.x, r.x, o), Da(t.y, e.y, r.y, o);
  }
  function Zf(t) {
    return t.animationValues && t.animationValues.opacityExit !== void 0;
  }
  var Jf = { duration: 0.45, ease: [0.4, 0, 0.1, 1] };
  var Ma = (t) => typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().includes(t);
  var Ea = Ma("applewebkit/") && !Ma("chrome/") ? Math.round : N;
  function Ca(t) {
    t.min = Ea(t.min), t.max = Ea(t.max);
  }
  function Qf(t) {
    Ca(t.x), Ca(t.y);
  }
  function La(t, e, r) {
    return t === "position" || t === "preserve-aspect" && !Ln(Jo(e), Jo(r), 0.2);
  }
  function tm(t) {
    return t !== t.root && t.scroll?.wasRoot;
  }
  var _n = mo({ attachResizeListener: (t, e) => Gn(t, "resize", e), measureScroll: () => ({ x: document.documentElement.scrollLeft || document.body?.scrollLeft || 0, y: document.documentElement.scrollTop || document.body?.scrollTop || 0 }), checkIsScrollRoot: () => true });
  var ri = { current: void 0 };
  var Xn = mo({ measureScroll: (t) => ({ x: t.scrollLeft, y: t.scrollTop }), defaultParent: () => {
    if (!ri.current) {
      let t = new _n({});
      t.mount(window), t.setOptions({ layoutScroll: true }), ri.current = t;
    }
    return ri.current;
  }, resetTransform: (t, e) => {
    t.style.transform = e !== void 0 ? e : "none";
  }, checkIsScrollRoot: (t) => window.getComputedStyle(t).position === "fixed" });
  var um = te.reduce((t, e) => (t[e] = (r) => L(r), t), {});
  function uo(t) {
    return typeof t == "object" && !Array.isArray(t);
  }
  function oi(t, e, r, o) {
    return t == null ? [] : typeof t == "string" && uo(e) ? Q(t, r, o) : t instanceof NodeList ? Array.from(t) : Array.isArray(t) ? t.filter((i) => i != null) : [t];
  }
  function Na(t, e, r) {
    return t * (e + 1);
  }
  function qn(t, e, r, o) {
    return typeof e == "number" ? e : e.startsWith("-") || e.startsWith("+") ? Math.max(0, t + parseFloat(e)) : e === "<" ? r : e.startsWith("<") ? Math.max(0, r + parseFloat(e.slice(1))) : o.get(e) ?? t;
  }
  function pm(t, e, r) {
    for (let o = 0; o < t.length; o++) {
      let i = t[o];
      i.at > e && i.at < r && (rt(t, i), o--);
    }
  }
  function ja(t, e, r, o, i, s) {
    pm(t, i, s);
    for (let n = 0; n < e.length; n++) t.push({ value: e[n], at: D(i, s, o[n]), easing: cr(r, n) });
  }
  function Wa(t, e) {
    for (let r = 0; r < t.length; r++) t[r] = t[r] / (e + 1);
  }
  function Ka(t, e) {
    return t.at === e.at ? t.value === null ? 1 : e.value === null ? -1 : 0 : t.at - e.at;
  }
  var hm = "easeInOut";
  var dm = 20;
  function za(t, { defaultTransition: e = {}, ...r } = {}, o, i) {
    let s = e.duration || 0.3, n = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map(), l = {}, f = /* @__PURE__ */ new Map(), c = 0, m = 0, u = 0;
    for (let p = 0; p < t.length; p++) {
      let h = t[p];
      if (typeof h == "string") {
        f.set(h, m);
        continue;
      } else if (!Array.isArray(h)) {
        f.set(h.name, qn(m, h.at, c, f));
        continue;
      }
      let [d, g, x = {}] = h;
      x.at !== void 0 && (m = qn(m, x.at, c, f));
      let V = 0, T = (v, S, R, F = 0, w = 0) => {
        let P = gm(v), { delay: b = 0, times: M = se(P), type: z = e.type || "keyframes", repeat: nt, repeatType: pt, repeatDelay: Tt = 0, ...ut } = S, { ease: wt = e.ease || "easeOut", duration: B } = S, Y = typeof b == "function" ? b(F, w) : b, vt = P.length, Pt = ce(z) ? z : i?.[z || "keyframes"];
        if (vt <= 2 && Pt) {
          let Xe = 100;
          if (vt === 2 && Tm(P)) {
            let Ye = P[1] - P[0];
            Xe = Math.abs(Ye);
          }
          let go = { ...e, ...ut };
          B !== void 0 && (go.duration = E(B));
          let yo = xr(go, Xe, Pt);
          wt = yo.ease, B = yo.duration;
        }
        B ?? (B = s);
        let ho = m + Y;
        M.length === 1 && M[0] === 0 && (M[1] = 1);
        let ts = M.length - P.length;
        if (ts > 0 && Tr(M, ts), P.length === 1 && P.unshift(null), nt) {
          H(nt < dm, "Repeat count too high, must be less than 20", "repeat-count-high"), B = Na(B, nt);
          let Xe = [...P], go = [...M];
          wt = Array.isArray(wt) ? [...wt] : [wt];
          let yo = [...wt];
          for (let Ye = 0; Ye < nt; Ye++) {
            P.push(...Xe);
            for (let qe = 0; qe < Xe.length; qe++) M.push(go[qe] + (Ye + 1)), wt.push(qe === 0 ? "linear" : cr(yo, qe - 1));
          }
          Wa(M, nt);
        }
        let es = ho + B;
        ja(R, P, wt, M, ho, es), V = Math.max(Y + B, V), u = Math.max(es, u);
      };
      if (C(d)) {
        let v = Ua(d, a);
        T(g, x, Ga("default", v));
      } else {
        let v = oi(d, g, o, l), S = v.length;
        for (let R = 0; R < S; R++) {
          g = g, x = x;
          let F = v[R], w = Ua(F, a);
          for (let P in g) T(g[P], ym(x, P), Ga(P, w), R, S);
        }
      }
      c = m, m += V;
    }
    return a.forEach((p, h) => {
      for (let d in p) {
        let g = p[d];
        g.sort(Ka);
        let x = [], V = [], T = [];
        for (let F = 0; F < g.length; F++) {
          let { at: w, value: P, easing: b } = g[F];
          x.push(P), V.push(ht(0, u, w)), T.push(b || "easeOut");
        }
        V[0] !== 0 && (V.unshift(0), x.unshift(x[0]), T.unshift(hm)), V[V.length - 1] !== 1 && (V.push(1), x.push(null)), n.has(h) || n.set(h, { keyframes: {}, transition: {} });
        let v = n.get(h);
        v.keyframes[d] = x;
        let { type: S, ...R } = e;
        v.transition[d] = { ...R, duration: u, ease: T, times: V, ...r };
      }
    }), n;
  }
  function Ua(t, e) {
    return !e.has(t) && e.set(t, {}), e.get(t);
  }
  function Ga(t, e) {
    return e[t] || (e[t] = []), e[t];
  }
  function gm(t) {
    return Array.isArray(t) ? t : [t];
  }
  function ym(t, e) {
    return t && t[e] ? { ...t, ...t[e] } : { ...t };
  }
  var xm = (t) => typeof t == "number";
  var Tm = (t) => t.every(xm);
  function $a(t) {
    let e = { presenceContext: null, props: {}, visualState: { renderState: { transform: {}, transformOrigin: {}, style: {}, vars: {}, attrs: {} }, latestValues: {} } }, r = Nt(t) && !_r(t) ? new io(e) : new Te(e);
    r.mount(t), ft.set(t, r);
  }
  function Ha(t) {
    let e = { presenceContext: null, props: {}, visualState: { renderState: { output: {} }, latestValues: {} } }, r = new ro(e);
    r.mount(t), ft.set(t, r);
  }
  function vm(t, e) {
    return C(t) || typeof t == "number" || typeof t == "string" && !uo(e);
  }
  function ii(t, e, r, o) {
    let i = [];
    if (vm(t, e)) i.push(so(t, uo(e) && e.default || e, r && (r.default || r)));
    else {
      if (t == null) return i;
      let s = oi(t, e, o), n = s.length;
      H(!!n, "No valid elements provided.", "no-valid-elements");
      for (let a = 0; a < n; a++) {
        let l = s[a], f = l instanceof Element ? $a : Ha;
        ft.has(l) || f(l);
        let c = ft.get(l), m = { ...r };
        "delay" in m && typeof m.delay == "function" && (m.delay = m.delay(a, n)), i.push(...me(c, { ...e, transition: m }, {}));
      }
    }
    return i;
  }
  function _a(t, e, r) {
    let o = [], i = t.map((n) => {
      if (Array.isArray(n) && typeof n[0] == "function") {
        let a = n[0], l = $(0);
        return l.on("change", a), n.length === 1 ? [l, [0, 1]] : n.length === 2 ? [l, [0, 1], n[1]] : [l, n[1], n[2]];
      }
      return n;
    });
    return za(i, e, r, { spring: Bt }).forEach(({ keyframes: n, transition: a }, l) => {
      o.push(...ii(l, n, a));
    }), o;
  }
  function Vm(t) {
    return Array.isArray(t) && t.some(Array.isArray);
  }
  function Xa(t = {}) {
    let { scope: e, reduceMotion: r } = t;
    function o(i, s, n) {
      let a = [], l;
      if (Vm(i)) {
        let { onComplete: c, ...m } = s || {};
        typeof c == "function" && (l = c), a = _a(i, r !== void 0 ? { reduceMotion: r, ...m } : m, e);
      } else {
        let { onComplete: c, ...m } = n || {};
        typeof c == "function" && (l = c), a = ii(i, s, r !== void 0 ? { reduceMotion: r, ...m } : m, e);
      }
      let f = new fe(a);
      return l && f.finished.then(l), e && (e.animations.push(f), f.finished.then(() => {
        rt(e.animations, f);
      })), f;
    }
    return o;
  }
  var bm = Xa();
  function Ya(t, e, r, o) {
    if (t == null) return [];
    let i = Q(t, o), s = i.length;
    H(!!s, "No valid elements provided.", "no-valid-elements");
    let n = [];
    for (let l = 0; l < s; l++) {
      let f = i[l], c = { ...r };
      typeof c.delay == "function" && (c.delay = c.delay(l, s));
      for (let m in e) {
        let u = e[m];
        Array.isArray(u) || (u = [u]);
        let p = { ...lt(c, m) };
        p.duration && (p.duration = E(p.duration)), p.delay && (p.delay = E(p.delay));
        let h = Ii(f), d = Fi(m, p.pseudoElement || ""), g = h.get(d);
        g && g.stop(), n.push({ map: h, key: d, unresolvedKeyframes: u, options: { ...p, element: f, name: m, allowFlatten: !c.type && !c.ease } });
      }
    }
    for (let l = 0; l < n.length; l++) {
      let { unresolvedKeyframes: f, options: c } = n[l], { element: m, name: u, pseudoElement: p } = c;
      !p && f[0] === null && (f[0] = Lo(m, u)), vr(f), _i(f, u), !p && f.length < 2 && f.unshift(Lo(m, u)), c.keyframes = f;
    }
    let a = [];
    for (let l = 0; l < n.length; l++) {
      let { map: f, key: c, options: m } = n[l], u = new at(m);
      f.set(c, u), u.finished.finally(() => f.delete(c)), a.push(u);
    }
    return a;
  }
  var Sm = (t) => {
    function e(r, o, i) {
      return new fe(Ya(r, o, i, t));
    }
    return e;
  };
  var Am = Sm();
  var Se = { Enter: [[0, 1], [1, 1]], Exit: [[0, 0], [1, 0]], Any: [[1, 0], [0, 1]], All: [[0, 0], [1, 1]] };
  var Rm = [[Se.Enter, "entry"], [Se.Exit, "exit"], [Se.Any, "cover"], [Se.All, "contain"]];
  var Im = { some: 0, all: 1 };
  function Nm(t, e, { root: r, margin: o, amount: i = "some" } = {}) {
    let s = Q(t), n = /* @__PURE__ */ new WeakMap(), a = (f) => {
      f.forEach((c) => {
        let m = n.get(c.target);
        if (c.isIntersecting !== !!m) if (c.isIntersecting) {
          let u = e(c.target, c);
          typeof u == "function" ? n.set(c.target, u) : l.unobserve(c.target);
        } else typeof m == "function" && (m(c), n.delete(c.target));
      });
    }, l = new IntersectionObserver(a, { root: r, rootMargin: o, threshold: typeof i == "number" ? i : Im[i] });
    return s.forEach((f) => l.observe(f)), () => l.disconnect();
  }

  // assets/js/animations.js
  document.querySelectorAll(".score-circle-wrap").forEach(function(wrap) {
    var val = parseInt(wrap.querySelector(".score-val")?.textContent, 10);
    var fill = wrap.querySelector(".score-fill");
    if (!fill || isNaN(val)) return;
    var circumference = 2 * Math.PI * 40;
    fill.style.strokeDashoffset = ((1 - val / 100) * circumference).toFixed(3);
  });
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("motion-ready");
  if (!reduced) {
    Nm(".references h2", function(el) {
      bm(el, { opacity: [0, 1], y: [25, 0] }, { duration: 0.6, ease: [0.33, 1, 0.68, 1] });
    });
    Nm(".ref-filter", function(el) {
      bm(
        el.querySelectorAll(".filter-pill"),
        { opacity: [0, 1], y: [12, 0] },
        { duration: 0.4, delay: tf(0.08), ease: [0.33, 1, 0.68, 1] }
      );
    });
    Nm(".site-footer", function(el) {
      bm(el, { opacity: [0, 1], y: [20, 0] }, { duration: 0.5, ease: [0.33, 1, 0.68, 1] });
    });
  }
})();
