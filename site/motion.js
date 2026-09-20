/* Motion layer: Lenis smooth scroll + GSAP reveals. Everything here is optional polish;
   the page is fully usable without it (reduced-motion users get the static version). */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
let lenis = null;

/* ---------- preloader (driven by the real data download) ---------- */
export function setProgress(k) {
  const p = Math.round(Math.min(1, k) * 100);
  $("#loader-pct").textContent = p; $("#loader-bar").style.transform = `scaleX(${p / 100})`;
}
export function hideLoader() {
  const l = $("#loader");
  if (reduced) { l.remove(); return Promise.resolve(); }
  return gsap.to(l, { yPercent: -100, duration: .9, ease: "power4.inOut", delay: .15, onComplete: () => l.remove() });
}

/* ---------- scrolling ---------- */
export function scrollTo(target, offset = -70) {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.2 });
  else (typeof target === "string" ? $(target) : target)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
}
export function lockScroll(on) { if (lenis) on ? lenis.stop() : lenis.start(); }
export function wipeTo(target, label) {
  if (!lenis || reduced) return scrollTo(target);
  const w = $("#wipe"); w.querySelector("span").textContent = label || "";
  gsap.timeline()
    .set(w, { display: "grid", clipPath: "inset(100% 0% 0% 0%)" })
    .to(w, { clipPath: "inset(0% 0% 0% 0%)", duration: .55, ease: "power4.inOut" })
    .from(w.querySelector("span"), { yPercent: 40, opacity: 0, duration: .45, ease: "power3.out" }, "-=.25")
    .add(() => { lenis.scrollTo(target, { immediate: true, offset: -70, force: true }); ScrollTrigger.refresh(); })
    .to(w, { clipPath: "inset(0% 0% 100% 0%)", duration: .6, ease: "power4.inOut", delay: .2 })
    .set(w, { display: "none" });
}

/* ---------- split text into masked words ---------- */
function split(el) {
  const wrap = node => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const t of n.textContent.split(/(\s+)/)) {
          if (!t) continue;
          if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(" ")); continue; }
          const w = document.createElement("span"), wi = document.createElement("span");
          w.className = "w"; wi.className = "wi"; wi.textContent = t; w.appendChild(wi); frag.appendChild(w);
        }
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== "BR") wrap(n);
    }
  };
  wrap(el);
  return el.querySelectorAll(".wi");
}

/* ---------- main ---------- */
export function startMotion() {
  document.documentElement.classList.add("has-motion");
  if (reduced) { $$("[data-split]").forEach(el => el.classList.add("shown")); return; }

  lenis = new Lenis({ lerp: .09, wheelMultiplier: 1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.documentElement.classList.add("smooth-on");

  // nav: hide on scroll down, show on scroll up
  let last = 0; const nav = $(".nav");
  lenis.on("scroll", ({ scroll }) => { nav.classList.toggle("hide", scroll > last && scroll > 120); last = scroll; });

  // hero intro
  const words = split($(".hero h1"));
  gsap.timeline({ defaults: { ease: "power4.out" } })
    .from(words, { yPercent: 110, duration: 1.1, stagger: .06 }, .1)
    .from(".hero .kicker, .hero .lede, .hero .ctas, .hero-legend", { y: 24, opacity: 0, duration: .9, stagger: .08 }, .4)
    .from(".receipt", { y: 80, rotate: 6, opacity: 0, duration: 1.2, ease: "power3.out" }, .3)
    .from(".marquee", { opacity: 0, duration: .8 }, .9);

  // hero gallery: stagger in, float, parallax with pointer and scroll
  const pics = $$("#gallery .pic");
  if (pics.length) {
    gsap.from(pics, { scale: .5, opacity: 0, y: 60, rotate: () => gsap.utils.random(-16, 16), duration: 1.2, ease: "back.out(1.6)", stagger: .09, delay: .7 });
    pics.forEach((p, i) => {
      const inner = p.querySelector(".pic-in"), depth = +p.dataset.depth || 1;
      gsap.to(inner, { y: `+=${8 + depth * 6}`, rotation: `+=${gsap.utils.random(-2.5, 2.5)}`, duration: 2.6 + i * .35, yoyo: true, repeat: -1, ease: "sine.inOut" });
      gsap.to(p, { y: -140 * depth, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: .6 } });
      if (fine) p.addEventListener("mouseenter", () => gsap.to(inner, { scale: 1.08, duration: .5, ease: "power3.out", overwrite: "auto" }));
      if (fine) p.addEventListener("mouseleave", () => gsap.to(inner, { scale: 1, duration: .6, ease: "power3.out", overwrite: "auto" }));
    });
    if (fine) $(".hero").addEventListener("mousemove", e => { const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5; pics.forEach(p => gsap.to(p, { x: x * 36 * +p.dataset.depth, rotation: x * 3 * +p.dataset.depth, duration: 1, ease: "power2.out", overwrite: "auto" })); });
  }

  // receipt tilt follows the pointer
  if (fine) {
    const r = $(".receipt"), hero = $(".hero");
    hero.addEventListener("mousemove", e => { const b = hero.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5; gsap.to(r, { rotateY: x * 14, rotateX: -y * 10, rotate: -1.2 + x * 2, transformPerspective: 900, duration: .6, ease: "power2.out" }); });
    hero.addEventListener("mouseleave", () => gsap.to(r, { rotateY: 0, rotateX: 0, rotate: -1.2, duration: .8 }));
  }

  // theme morphs as you move from one topic to the next
  $$("[data-theme]").forEach(sec => ScrollTrigger.create({ trigger: sec, start: "top 55%", end: "bottom 55%", onToggle: t => { if (t.isActive) document.body.dataset.theme = sec.dataset.theme; } }));

  // paragraphs fill in word by word as you scroll through them
  $$(".sub, .chapter .story, figure.panel figcaption, .foot p:not(.foot-big)").forEach(el => {
    const w = split(el); if (!w.length) return;
    gsap.fromTo(w, { opacity: .18 }, { opacity: 1, stagger: .015, ease: "none", scrollTrigger: { trigger: el, start: "top 88%", end: "bottom 60%", scrub: .4 } });
  });

  // lists stagger in: traits, stats, thread cards, tiles, rows
  $$(".chapter .items, #rituals, #anthems, #results, .filters").forEach(box => {
    const items = box.querySelectorAll(":scope > .trait, :scope > .stat, :scope > .thread, :scope > .rcpt, :scope > .tile, :scope > .chips > .chip");
    const side = box.classList.contains("items"); // sideways lists slide in from the left
    if (items.length) gsap.from(items, { [side ? "x" : "y"]: 20, opacity: 0, duration: .6, ease: "power3.out", stagger: .05, scrollTrigger: { trigger: box, start: "top 88%", once: true } });
  });

  // pictures pop in and tilt toward the pointer; the rhythms clock hand sweeps with scroll
  $$(".keep, .sec-pic").forEach(box => gsap.from(box.querySelectorAll(".pic"), { scale: .6, opacity: 0, y: 30, duration: 1, ease: "back.out(1.6)", stagger: .12, scrollTrigger: { trigger: box, start: "top 85%", once: true } }));
  if (fine) $$(".keep .pic, .sec-pic .pic").forEach(p => {
    const inner = p.querySelector(".pic-in");
    p.addEventListener("mousemove", e => { const b = p.getBoundingClientRect(); gsap.to(inner, { rotateY: ((e.clientX - b.left) / b.width - .5) * 26, rotateX: -((e.clientY - b.top) / b.height - .5) * 20, scale: 1.06, transformPerspective: 700, duration: .5, ease: "power2.out", overwrite: "auto" }); });
    p.addEventListener("mouseleave", () => gsap.to(inner, { rotateY: 0, rotateX: 0, scale: 1, duration: .7, ease: "power3.out", overwrite: "auto" }));
  });
  const hand = $("#clock-hand");
  if (hand) gsap.to(hand, { rotation: 360, transformOrigin: "50% 100%", ease: "none", scrollTrigger: { trigger: "#rhythms", start: "top bottom", end: "bottom top", scrub: .5 } });

  // section headings: masked word reveal on scroll
  $$("h2[data-split]").forEach(h => {
    const w = split(h);
    gsap.from(w, { yPercent: 110, duration: .9, ease: "power4.out", stagger: .05, scrollTrigger: { trigger: h, start: "top 85%", once: true } });
  });
  $$(".eyebrow").forEach(el => gsap.from(el, { x: -20, opacity: 0, duration: .8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } }));

  // cards & panels rise in with a stagger per section
  $$(".section").forEach(sec => {
    const items = sec.querySelectorAll(".chapter, figure.panel, .filters, .chart-wrap");
    if (items.length) gsap.from(items, { y: 40, opacity: 0, duration: .9, ease: "power3.out", stagger: .08, scrollTrigger: { trigger: sec, start: "top 75%", once: true } });
  });

  // numbers count up when their chapter enters
  $$(".chapter .stat .v, #rituals .tile .v").forEach(v => {
    const m = v.textContent.match(/^([₹+]?)([\d,]+)(%?)$/); if (!m) return;
    const n = +m[2].replace(/,/g, ""), o = { k: 0 };
    gsap.to(o, { k: 1, duration: 1.4, ease: "power2.out", scrollTrigger: { trigger: v, start: "top 90%", once: true }, onUpdate: () => v.textContent = m[1] + Math.round(n * o.k).toLocaleString("en-IN") + m[3] });
  });

  // journey chart draws itself in
  const jc = $("#journey-chart svg");
  if (jc) {
    gsap.from(jc.querySelectorAll("rect:not(.hit)"), { scaleY: 0, transformOrigin: "50% 100%", duration: .7, ease: "power2.out", stagger: { each: .004, from: "start" }, scrollTrigger: { trigger: jc, start: "top 80%", once: true } });
    gsap.from(jc.querySelectorAll("path"), { opacity: 0, y: 20, duration: 1, ease: "power2.out", scrollTrigger: { trigger: jc, start: "top 80%", once: true } });
    gsap.from(jc.querySelectorAll(".pin"), { opacity: 0, y: -8, duration: .5, stagger: .05, delay: .5, scrollTrigger: { trigger: jc, start: "top 80%", once: true } });
  }

  // big footer type
  gsap.from(split($(".foot-big")), { yPercent: 110, duration: 1, ease: "power4.out", stagger: .05, scrollTrigger: { trigger: ".foot", start: "top 80%", once: true } });

  // magnetic CTAs
  if (fine) $$(".cta, .nav .links a").forEach(el => {
    el.addEventListener("mousemove", e => { const b = el.getBoundingClientRect(); gsap.to(el, { x: (e.clientX - b.left - b.width / 2) * .25, y: (e.clientY - b.top - b.height / 2) * .35, duration: .4, ease: "power2.out" }); });
    el.addEventListener("mouseleave", () => gsap.to(el, { x: 0, y: 0, duration: .6, ease: "elastic.out(1, .4)" }));
  });

  // custom cursor
  if (fine) {
    const c = $("#cursor"); c.classList.add("on");
    const pos = { x: innerWidth / 2, y: innerHeight / 2 }, cur = { ...pos };
    addEventListener("mousemove", e => { pos.x = e.clientX; pos.y = e.clientY; });
    gsap.ticker.add(() => { cur.x += (pos.x - cur.x) * .18; cur.y += (pos.y - cur.y) * .18; c.style.transform = `translate(${cur.x}px, ${cur.y}px)`; });
    const hot = "a, button, [role=button], input, select, label, .hit";
    addEventListener("mouseover", e => { c.classList.toggle("hot", !!e.target.closest(hot)); c.classList.toggle("drag", !!e.target.closest(".chapter .items")); });
    addEventListener("mousedown", () => c.classList.add("down")); addEventListener("mouseup", () => c.classList.remove("down"));
  }

  // late layout changes (charts re-render, "show more") → refresh triggers
  addEventListener("resize", () => ScrollTrigger.refresh());
  $("#more")?.addEventListener("click", () => setTimeout(() => ScrollTrigger.refresh(), 50));
}
