#!/usr/bin/env node
/*
 * Build the Our World landing page artefacts from one content definition.
 *
 * Outputs (next to this file):
 *   our-world-elementor-template.json  Elementor template for import into page 17225
 *   preview/our-world.html             Local preview using the live site's real page shell
 *
 * Usage (Node 18+, no packages needed):
 *   node build.js [path/to/gala-dinner.html]
 *
 * The preview shell is any live GP Refresh page that uses the Elementor Full Width
 * template (page-template-elementor_header_footer), e.g. a saved copy of
 * https://www.gprefresh.com/gala-dinner/. Its header, footer, theme CSS and scripts
 * are kept untouched; only the Elementor page body is swapped for this page's markup.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const HERE = __dirname;
const UPLOADS = "https://www.gprefresh.com/wp-content/uploads/2026/03";
const PAGE_ID = 17225; // existing draft page at https://www.gprefresh.com/our-world/

// ---------------------------------------------------------------- content

const REGISTER_URL = "https://events.gprefresh.com/";

// Hero: leads into the Expression of Interest below. Facts (talk count, CPD hours, no sponsored talks,
// 2027 cities) are the homepage's own.
const EYEBROW = "GP Refresh | Expression of Interest";
const TITLE_LINES = ["Explore Opportunities", "with GP Refresh"];
const LEDE = "From six-minute talks to expert panel discussions, GP Refresh brings GPs together for up to " +
  "53 CPD hours with no sponsored talks. Register your interest to request access to our exclusive prospectus.";
const STATUS = "Melbourne | Sydney | Brisbane";
const BUTTON = { text: "Register Your Interest", url: "#expression-of-interest" };

const PILLARS_EYEBROW = "Refresh | Reframe | Reignite"; // existing homepage eyebrow
const PILLARS_LINES = [ // existing homepage slide headings
  "Refresh the basics.",
  "Reframe the evidence.",
  "Reignite your passion for patient care.",
];
const PILLARS_COPY = "Up to 53 CPD hours, 77 six-minute talks, no sponsored talks, " +
  "and the Grand Gala Dinner to bring it all together.";

// Upcoming Conferences: copied from the homepage "Upcoming Conferences" block (verified 23 Oct 2026)
const EVENTS_EYEBROW = "GP Refresh Int’l Congress";
const EVENTS_TITLE = "Upcoming Conferences";
const EVENTS_LEDE = "Two days of six-minute talks, up to 53 CPD hours and the Gala Dinner, in a city near you.";
const EVENTS = [
  { date: "15–16 May ’27", city: "Melbourne",
    image: "assets/melbourne.jpeg", image_width: 1600, image_height: 1066,
    image_alt: "Melbourne city skyline overlooking Flinders Street Station",
    venue: "Melbourne Convention and Exhibition Centre (MCEC)", url: REGISTER_URL, cta: "Register Now" },
  { date: "26–27 June ’27", city: "Sydney",
    image: "assets/sydney.jpeg", image_width: 1600, image_height: 900,
    image_alt: "Sydney Opera House and city skyline beside the harbour",
    venue: "International Convention & Exhibition Centre (ICC Sydney)", url: REGISTER_URL, cta: "Register Now" },
  { date: "18–19 Sep ’27", city: "Brisbane",
    image: "assets/brisbane.jpeg", image_width: 1600, image_height: 1200,
    image_alt: "Brisbane city skyline and bridge spanning the Brisbane River",
    venue: "Brisbane Convention & Exhibition Centre (BCEC)", url: REGISTER_URL, cta: "Register Now" },
  { date: "Dec ’27", tbc: true, city: "Int’l Cruises",
    venue: "Dates and itinerary to be confirmed", url: "https://www.gprefresh.com/expression-of-interest/",
    cta: "Learn More" },
  { date: "8–9 Jan ’28", tbc: true, city: "Dubai",
    venue: "Venue to be confirmed", url: "https://www.gprefresh.com/dubai/", cta: "Learn More" },
];

// Counts down to the first conference date, not an unconfirmed session start time.
// May in Melbourne uses AEST (UTC+10); an explicit offset is independent of the visitor's timezone.
const COUNTDOWN_TARGET = "2027-05-15T00:00:00+10:00";
const COUNTDOWN_LABEL = "Until Melbourne";
const COUNTDOWN_DATE = "15 May 2027 · Melbourne time";

// Expression of Interest (third section). Submission settings live in preview/js/gpr-config.js;
// the README's "GHL integration" section explains them.
const EOI_ID = "expression-of-interest";
const EOI_EYEBROW = "GP Refresh | Prospectus";
const EOI_TITLE = "Expression of Interest";
const EOI_LEDE = "Interested in exploring opportunities with GP Refresh? " +
  "Register your interest below to request access to our exclusive prospectus.";
const EOI_STEPS = [
  "Register your interest with the form.",
  "The GP Refresh team sends your unique access code by email or SMS.",
  "Enter your code (or open the link we send you) to download the prospectus.",
];
const EOI_FIELDS = [
  { name: "firstName", label: "First Name", type: "text", autocomplete: "given-name",
    placeholder: "Your first name", maxlength: 80 },
  { name: "lastName", label: "Last Name", type: "text", autocomplete: "family-name",
    placeholder: "Your last name", maxlength: 80 },
  { name: "email", label: "Email Address", type: "email", autocomplete: "email",
    placeholder: "name@example.com", maxlength: 254, inputmode: "email" },
  { name: "phone", label: "Phone Number", type: "tel", autocomplete: "tel",
    placeholder: "0412 345 678", maxlength: 20, inputmode: "tel" },
  { name: "abn", label: "ABN", type: "text", autocomplete: "off",
    placeholder: "11-digit ABN", maxlength: 14, inputmode: "numeric" },
  { name: "companyName", label: "Company Name", type: "text", autocomplete: "organization",
    placeholder: "Your company name", maxlength: 160 },
];
const EOI_SUBMIT = "Submit Expression of Interest";
// Thank-you message that replaces the form after a confirmed submission
const EOI_THANKS_TITLE = "Thank You for Your Interest!";
const EOI_THANKS_TEXT = "Your Expression of Interest has been submitted successfully. The GP Refresh team will send " +
  "your unique prospectus access code to your registered email address or phone number.";
const EOI_THANKS_NOTE = "Once you receive your access code, return to the prospectus access page " +
  "to download your document.";
// Relative to preview/. On WordPress, point this at the hosted page.
const PROSPECTUS_ACCESS_URL = "prospectus-access.html";
// Loaded in order from preview/; the Elementor export inlines them so the widget is self-contained.
const EOI_SCRIPTS = ["js/gpr-config.js", "js/gpr-validate.js", "js/gpr-eoi.js"];
const CONTACT_EMAIL = "connect@gprefresh.com";

// Group Discounts: the "2nd Release" table on https://www.gprefresh.com/pricing/ (verified 23 Oct 2026).
// Keep in step with the admin panel; the 5+ price is listed there as excl. GST.
const GROUPS_EYEBROW = "Group Discounts | 2nd Release";
const GROUPS_TITLE = "Register together and save up to 50%.";
const GROUPS_LEDE = "Bring colleagues from your practice and every delegate pays less per Conference Pass. " +
  "Group discounts also apply to the Gala Dinner pass.";
const GROUP_TIERS = [
  { label: "Individual Pass", off: "30%", price: "A$979.30", gst: "incl. GST", was: "A$1399" },
  { label: "Group of 2", off: "33%", price: "A$937.33", gst: "incl. GST" },
  { label: "Group of 3", off: "36%", price: "A$895.36", gst: "incl. GST" },
  { label: "Group of 4", off: "40%", price: "A$839.40", gst: "incl. GST" },
  { label: "Group of 5+", off: "50%", price: "A$699.50", gst: "excl. GST", best: true },
];
const GROUP_NOTES = [
  "Conference Pass A$1399 (incl. GST): symposium program and materials, lunch and coffee breaks.",
  "Gala Dinner A$329: complimentary (special promotion). CPR Workshop: complimentary for all delegates.",
];
const TERMS_URL = "https://www.gprefresh.com/terms-conditions/";
const PRICING_URL = "https://www.gprefresh.com/pricing/";

// Discount artwork from the BLT group. Add one entry per image once supplied, e.g.
//   { src: "https://www.gprefresh.com/wp-content/uploads/2026/10/group-offer.webp", alt: "...", width: 1200, height: 900 }
const BLT_VISUALS = [];

// Testimonials: the self-contained section in preview/social.html, embedded as-is in an HTML widget
const SOCIAL_HTML = path.join(HERE, "preview", "social.html");

/* Text files are read with LF line endings, whatever the checkout uses. */
const readText = (file) => fs.readFileSync(file, "utf8").replace(/\r\n?/g, "\n");
const dataUrl = (file) => "data:image/jpeg;base64," + fs.readFileSync(file).toString("base64");

/* Escape text for HTML content and attribute values. */
const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

/*
 * <img> using the existing WordPress-generated crops of a gallery image (3:2).
 * Most gallery originals are 2304x1536 with 768 and 1536 crops; pass `original` and `crops`
 * for the ones WordPress sized differently.
 */
function picture(name, alt, sizes, loading, extra = "", original = [2304, 1536], crops = ["768x512", "1536x1024"]) {
  const candidates = crops.map((c) => [`${UPLOADS}/${name}-${c}.webp`, parseInt(c.split("x")[0], 10)]);
  candidates.push([`${UPLOADS}/${name}.webp`, original[0]]);
  const srcset = candidates.map(([url, w]) => `${url} ${w}w`).join(", ");
  const src = candidates.length > 2 ? candidates[candidates.length - 2][0] : candidates[candidates.length - 1][0];
  return `<img src="${src}" srcset="${srcset}" sizes="${sizes}" ` +
    `width="${original[0]}" height="${original[1]}" alt="${esc(alt)}" loading="${loading}" decoding="async"${extra}>`;
}

// conference-3 is 1600x1066 on the live site, with only a 768 crop
const HERO_IMG = picture(
  "conference-3",
  "A speaker presents at the lectern in front of the GP Refresh stage backdrop at The Langham, Gold Coast",
  "100vw", "eager", ' fetchpriority="high"', [1600, 1066], ["768x512"]);
const PILLARS_IMG = picture(
  "conference-6",
  "GP Refresh delegates seated at round tables during a conference session",
  "(max-width: 1024px) 100vw, 50vw", "lazy");

const lines = (list) => list.map((l) => `<span class="gpr-ow-line">${esc(l)}</span>`).join("");
const TITLE_HTML = lines(TITLE_LINES);
const PILLARS_TITLE_HTML = lines(PILLARS_LINES);

function eventsHtml(embedImages = false) {
  const rows = EVENTS.map((e) => {
    const tbc = e.tbc ? ' <span class="gpr-ow-event__tbc">TBC</span>' : "";
    // The preview uses the supplied JPEG files directly. Embed the same bytes in
    // the Elementor export so an import cannot point at nonexistent /assets URLs.
    let media = "";
    if (e.image) {
      let src = e.image;
      if (embedImages && src.startsWith("assets/")) src = dataUrl(path.join(HERE, "preview", src));
      media = `<div class="gpr-ow-event__media"><img src="${esc(src)}" ` +
        `alt="${esc(e.image_alt)}" width="${e.image_width}" ` +
        `height="${e.image_height}" loading="lazy" decoding="async"></div>`;
    }
    const modifier = media ? "" : " gpr-ow-event--compact";
    return `<li class="gpr-ow-event${modifier}">${media}` +
      '<div class="gpr-ow-event__content">' +
      `<p class="gpr-ow-event__date">${esc(e.date)}${tbc}</p>` +
      '<div class="gpr-ow-event__body">' +
      `<h3 class="gpr-ow-event__city">${esc(e.city)}</h3>` +
      `<p class="gpr-ow-event__venue">${esc(e.venue)}</p></div>` +
      `<a class="gpr-ow-pill" href="${e.url}" aria-label="${esc(e.cta)}: ${esc(e.city)}">` +
      `${esc(e.cta)}</a></div></li>`;
  });
  return `<ol class="gpr-ow-events__rows">${rows.join("")}</ol>`;
}

function countdownHtml() {
  const units = ["days", "hours", "minutes", "seconds"].map((unit) =>
    `<div class="gpr-ow-countdown__unit"><span data-unit="${unit}" ` +
    `class="gpr-ow-countdown__value">--</span><span class="gpr-ow-countdown__label">${unit}</span></div>`
  ).join("");
  return (
    `<div class="gpr-ow-countdown" data-gpr-countdown data-target="${esc(COUNTDOWN_TARGET)}">` +
    '<div class="gpr-ow-countdown__topline">' +
    '<span class="gpr-ow-countdown__eyebrow">Conference countdown</span>' +
    `<span class="gpr-ow-countdown__edition">${esc(COUNTDOWN_TARGET.slice(0, 4))}</span></div>` +
    `<p class="gpr-ow-countdown__heading">${esc(COUNTDOWN_LABEL)}</p>` +
    '<div class="gpr-ow-countdown__digits" role="timer" aria-live="off" ' +
    `aria-label="Countdown to Melbourne conference">${units}</div>` +
    `<p class="gpr-ow-countdown__date"><time datetime="${esc(COUNTDOWN_TARGET)}">` +
    `${esc(COUNTDOWN_DATE)}</time></p>` +
    '<p class="gpr-ow-countdown__status" role="status" hidden>Conference countdown complete.</p>' +
    "</div>" +
    String.raw`<script>
(function () {
    'use strict';
    document.querySelectorAll('[data-gpr-countdown]').forEach(function (root) {
        if (root.dataset.initialized) return;
        var target = Date.parse(root.dataset.target);
        if (!Number.isFinite(target)) return;
        root.dataset.initialized = 'true';
        var timer;
        function update() {
            if (!root.isConnected) {
                clearInterval(timer);
                return false;
            }
            var remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
            var values = {
                days: Math.floor(remaining / 86400),
                hours: Math.floor(remaining % 86400 / 3600),
                minutes: Math.floor(remaining % 3600 / 60),
                seconds: remaining % 60
            };
            Object.keys(values).forEach(function (unit) {
                root.querySelector('[data-unit="' + unit + '"]').textContent = String(values[unit]).padStart(2, '0');
            });
            if (remaining === 0) {
                root.querySelector('.gpr-ow-countdown__status').hidden = false;
                clearInterval(timer);
                return false;
            }
            return true;
        }
        if (update()) timer = setInterval(update, 1000);
    });
})();
</script>`
  );
}

function groupsHtml() {
  const tiers = GROUP_TIERS.map((t) => {
    const was = t.was ? `<s><span class="screen-reader-text">Was </span>${t.was}</s>` : "";
    return `<li class="gpr-ow-tier${t.best ? " gpr-ow-tier--best" : ""}">` +
      `<p class="gpr-ow-tier__label">${esc(t.label)}</p>` +
      `<p class="gpr-ow-tier__off">${t.off}<small>off</small></p>` +
      `<p class="gpr-ow-tier__price">${t.price}${was}` +
      `<span class="gpr-ow-tier__unit">per pass, ${t.gst}</span></p></li>`;
  });
  let notes = GROUP_NOTES.map((n) => `<li>${esc(n)}</li>`).join("");
  notes += `<li>See the <a href="${TERMS_URL}">terms and conditions</a>.</li>`;
  let visuals = "";
  if (BLT_VISUALS.length) {
    const imgs = BLT_VISUALS.map((v) =>
      `<img src="${v.src}" alt="${esc(v.alt)}" width="${v.width}" height="${v.height}" ` +
      'loading="lazy" decoding="async">').join("");
    visuals = `<div class="gpr-ow-visuals">${imgs}</div>`;
  }
  return `<ul class="gpr-ow-tiers">${tiers.join("")}</ul>` +
    '<div class="gpr-ow-groups__foot">' +
    `<ul class="gpr-ow-groups__notes">${notes}</ul>` +
    '<div class="gpr-ow-groups__actions">' +
    `<a class="gpr-ow-pill gpr-ow-pill--solid" href="${REGISTER_URL}">Book Your Group</a>` +
    `<a class="gpr-ow-pill" href="${PRICING_URL}">Full Pricing</a></div></div>` +
    visuals;
}

function eoiAccessHtml() {
  const steps = EOI_STEPS.map((s) => `<li>${esc(s)}</li>`).join("");
  return `<ol class="gpr-ow-eoi__steps">${steps}</ol>` +
    '<div class="gpr-ow-eoi__access">' +
    "<p>Already received your access code?</p>" +
    `<a class="gpr-ow-pill gpr-ow-pill--solid" href="${PROSPECTUS_ACCESS_URL}">Download Prospectus</a></div>`;
}

function eoiFormHtml(embedScripts = false) {
  const fields = EOI_FIELDS.map((f) => {
    const fid = `gpr-eoi-${f.name}`;
    const inputmode = f.inputmode ? ` inputmode="${f.inputmode}"` : "";
    return '<div class="gpr-ow-field">' +
      `<label for="${fid}">${esc(f.label)} <span class="gpr-ow-field__req" aria-hidden="true">*</span></label>` +
      `<input id="${fid}" name="${f.name}" type="${f.type}" autocomplete="${f.autocomplete}"${inputmode} ` +
      `placeholder="${esc(f.placeholder)}" maxlength="${f.maxlength}" required ` +
      `aria-describedby="${fid}-error">` +
      `<p class="gpr-ow-field__error" id="${fid}-error" hidden></p></div>`;
  });
  const scripts = EOI_SCRIPTS.map((s) => embedScripts
    ? `<script>${readText(path.join(HERE, "preview", s))}</script>`
    : `<script src="${s}"></script>`).join("");
  return '<div class="gpr-ow-eoi__card" data-gpr-eoi>' +
    '<form class="gpr-ow-form" data-gpr-eoi-form novalidate aria-labelledby="gpr-eoi-form-title">' +
    '<p class="gpr-ow-form__title" id="gpr-eoi-form-title">Register your interest</p>' +
    `<div class="gpr-ow-form__grid">${fields.join("")}</div>` +
    '<p class="gpr-ow-form__status" data-gpr-eoi-status role="alert" hidden></p>' +
    '<div class="gpr-ow-form__foot">' +
    '<button class="gpr-ow-pill gpr-ow-pill--solid gpr-ow-form__submit" type="submit" disabled>' +
    `<span data-label>${esc(EOI_SUBMIT)}</span></button>` +
    '<p class="gpr-ow-form__note"><span aria-hidden="true">*</span> All fields are required.</p></div>' +
    '<noscript><p class="gpr-ow-form__status">Please enable JavaScript to submit this form, or email ' +
    `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p></noscript>` +
    "</form>" +
    '<div class="gpr-ow-eoi__embed" data-gpr-eoi-embed hidden></div>' +
    eoiThanksHtml() +
    `</div>${scripts}`;
}

/* Shown in place of the form once the submission is confirmed (same copy as preview/thank-you.html). */
function eoiThanksHtml() {
  return '<div class="gpr-ow-eoi__thanks" data-gpr-eoi-thanks hidden>' +
    '<span class="gpr-ow-eoi__mark" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' +
    `<p class="gpr-ow-form__title" id="gpr-eoi-thanks-title" tabindex="-1">${esc(EOI_THANKS_TITLE)}</p>` +
    `<p class="gpr-ow-eoi__thanks-text">${esc(EOI_THANKS_TEXT)}</p>` +
    `<p class="gpr-ow-eoi__thanks-note">${esc(EOI_THANKS_NOTE)}</p>` +
    '<div class="gpr-ow-eoi__thanks-actions">' +
    `<a class="gpr-ow-pill gpr-ow-pill--solid" href="${PROSPECTUS_ACCESS_URL}">Access Prospectus</a>` +
    '<a class="gpr-ow-pill" href="#main">Back to GP Refresh</a></div></div>';
}

/*
 * The section from preview/social.html, made safe to drop into a live page.
 * Scope the standalone document's reset and tokens to this section. The social
 * script already scopes its cards and viewing dialog to the section root.
 */
function testimonialsHtml(embedImages = false) {
  const src = readText(SOCIAL_HTML);
  let css = src.match(/<style>([\s\S]*?)<\/style>/)[1];
  const section = src.match(/<section class="gpr-testimonials-section"[\s\S]*?<\/section>/)[0];
  const script = src.match(/<script>([\s\S]*?)<\/script>/)[1];

  const font = css.match(/@import url\('([^']+)'\);/)[1];
  const scope = ".gpr-testimonials-section";
  const swaps = [
    [/@import url\('[^']+'\);/, ""],
    [/\*, \*::before, \*::after \{/, `${scope}, ${scope} *, ${scope} *::before, ${scope} *::after {`],
    [/html, body \{[\s\S]*?\}/, ""],
    [/:root \{/, `${scope} {`],
  ];
  for (const [pattern, repl] of swaps) {
    if (!pattern.test(css)) throw new Error(`social.html CSS changed shape; update testimonialsHtml() (${pattern.source})`);
    css = css.replace(pattern, () => repl);
  }
  if (embedImages) {
    css = css.split("assets/background%20image.jpeg").join(dataUrl(path.join(HERE, "preview", "assets", "background image.jpeg")));
  }
  return `<link rel="stylesheet" href="${esc(font)}">` +
    `<style>${css}</style>${section}<script>${script}</script>`;
}

/* Animate elements as they enter view; content stays visible without JS support. */
function motionHtml() {
  return String.raw`<script>
(function () {
    'use strict';
    var root = (document.currentScript && document.currentScript.closest('[data-elementor-type="wp-page"]'))
        || document.querySelector('.elementor-PAGE_ID');
    if (!root || root.dataset.gprMotionReady || !window.matchMedia
        || !('IntersectionObserver' in window) || !Element.prototype.animate) return;
    root.dataset.gprMotionReady = 'true';
    var preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    var active = new Set();
    var observer;
    var selectors = '.gpr-ow-hero__content > .elementor-widget, .gpr-ow-hero__meta, '
        + '.gpr-ow-events__header > .gpr-ow-head, .gpr-ow-countdown, .gpr-ow-event, '
        + '.gpr-ow-eoi__intro, .gpr-ow-eoi__card, '
        + '.gpr-ow-groups .gpr-ow-head, .gpr-ow-tier, .gpr-ow-pillars__media, .gpr-ow-pillars__text';
    function stop() {
        if (observer) observer.disconnect();
        active.forEach(function (animation) { animation.cancel(); });
        active.clear();
    }
    function start() {
        if (preference.matches) return;
        observer = new IntersectionObserver(function (entries) {
            var order = 0;
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);
                if (preference.matches || entry.target.dataset.gprRevealed) return;
                entry.target.dataset.gprRevealed = 'true';
                if (entry.target.contains(document.activeElement)) return;
                var animation = entry.target.animate([
                    { opacity: 0, transform: 'translateY(14px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ], {
                    duration: 550, delay: (order++ % 3) * 70,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards'
                });
                active.add(animation);
                animation.onfinish = animation.oncancel = function () { active.delete(animation); };
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });
        root.querySelectorAll(selectors).forEach(function (element) {
            if (!element.dataset.gprRevealed) observer.observe(element);
        });
    }
    root.addEventListener('focusin', function (event) {
        active.forEach(function (animation) {
            if (animation.effect.target.contains(event.target)) animation.cancel();
        });
    });
    function changed() { stop(); start(); }
    if (preference.addEventListener) preference.addEventListener('change', changed);
    start();
})();
</script>`.split("PAGE_ID").join(String(PAGE_ID));
}

// ---------------------------------------------------------------- element tree

let lastId = 0;
const nextId = () => "0w" + (++lastId).toString(16).padStart(5, "0");

function container(classes, children, { boxed = false, inner = false, elementId = null } = {}) {
  const settings = { content_width: boxed ? "boxed" : "full", css_classes: classes };
  if (elementId) settings._element_id = elementId; // Advanced > CSS ID
  return { id: nextId(), elType: "container", isInner: inner, settings, elements: children };
}

function widget(kind, classes, settings) {
  return { id: nextId(), elType: "widget", widgetType: kind, settings: { ...settings, _css_classes: classes }, elements: [] };
}

function sectionHead(eyebrow, title, lede) {
  return container("gpr-ow-head", [
    widget("heading", "gpr-ow-eyebrow", { title: eyebrow, header_size: "p" }),
    widget("heading", "gpr-ow-head__title", { title: esc(title), header_size: "h2" }),
    widget("text-editor", "gpr-ow-head__lede", { editor: `<p>${esc(lede)}</p>` }),
  ], { inner: true });
}

const TREE = [
  container("gpr-ow-hero", [
    widget("html", "gpr-ow-hero__media", { html: HERO_IMG }),
    container("gpr-ow-hero__content", [
      widget("heading", "gpr-ow-eyebrow", { title: EYEBROW, header_size: "p" }),
      widget("heading", "gpr-ow-title", { title: TITLE_HTML, header_size: "h1" }),
      widget("text-editor", "gpr-ow-lede", { editor: `<p>${esc(LEDE)}</p>` }),
      container("gpr-ow-hero__meta", [
        widget("heading", "gpr-ow-status", { title: STATUS, header_size: "p" }),
        widget("button", "gpr-ow-button", { text: BUTTON.text, size: "sm",
          link: { url: BUTTON.url, is_external: "", nofollow: "" } }),
      ], { inner: true }),
    ], { inner: true }),
  ], { boxed: true }),
  // Upcoming Conferences (gpr-ow-events), testimonials and Group Discounts were removed from the page
  // on request (30 Oct 2026). Their content and builders (eventsHtml, countdownHtml, testimonialsHtml,
  // groupsHtml) remain above for reinstatement.
  container("gpr-ow-eoi", [
    container("gpr-ow-eoi__intro", [
      sectionHead(EOI_EYEBROW, EOI_TITLE, EOI_LEDE),
      widget("html", "gpr-ow-eoi__next", { html: eoiAccessHtml() }),
    ], { inner: true }),
    widget("html", "gpr-ow-eoi__form", { html: eoiFormHtml() }),
  ], { boxed: true, elementId: EOI_ID }),
  container("gpr-ow-pillars", [
    widget("html", "gpr-ow-pillars__media", { html: PILLARS_IMG }),
    container("gpr-ow-pillars__text", [
      widget("heading", "gpr-ow-eyebrow", { title: PILLARS_EYEBROW, header_size: "p" }),
      widget("heading", "gpr-ow-pillars__title", { title: PILLARS_TITLE_HTML, header_size: "h2" }),
      widget("text-editor", "gpr-ow-pillars__copy", { editor: `<p>${esc(PILLARS_COPY)}</p>` }),
      widget("html", "gpr-ow-motion", { html: motionHtml() }),
    ], { inner: true }),
  ]),
];

// ---------------------------------------------------------------- render (mirrors Elementor 4.x frontend markup)

function render(el) {
  const s = el.settings;
  if (el.elType === "container") {
    const kind = s.content_width === "boxed" ? "e-con-boxed" : "e-con-full";
    const role = el.isInner ? "e-child" : "e-parent";
    let kids = el.elements.map(render).join("");
    if (kind === "e-con-boxed") kids = `<div class="e-con-inner">${kids}</div>`;
    const idAttr = s._element_id ? ` id="${s._element_id}"` : "";
    return `<div${idAttr} class="elementor-element elementor-element-${el.id} ${kind} e-flex e-con ${role} ${s.css_classes}" ` +
      `data-id="${el.id}" data-element_type="container">${kids}</div>`;
  }
  const w = el.widgetType;
  let body;
  if (w === "heading") {
    const tag = s.header_size;
    body = `<${tag} class="elementor-heading-title elementor-size-default">${s.title}</${tag}>`;
  } else if (w === "text-editor") {
    body = s.editor;
  } else if (w === "html") {
    body = s.html;
  } else if (w === "button") {
    body = '<div class="elementor-button-wrapper">' +
      `<a class="elementor-button elementor-button-link elementor-size-${s.size}" href="${s.link.url}">` +
      `<span class="elementor-button-content-wrapper"><span class="elementor-button-text">${esc(s.text)}</span></span></a></div>`;
  }
  return `<div class="elementor-element elementor-element-${el.id} elementor-widget elementor-widget-${w} ${s._css_classes}" ` +
    `data-id="${el.id}" data-element_type="widget" data-widget_type="${w}.default">` +
    `<div class="elementor-widget-container">${body}</div></div>`;
}

function buildTemplate(css) {
  const content = structuredClone(TREE);
  for (const section of content) {
    for (const element of section.elements) {
      const cls = element.settings._css_classes;
      if (cls === "gpr-ow-events__list") element.settings.html = eventsHtml(true);
      else if (cls === "gpr-ow-testimonials__embed") element.settings.html = testimonialsHtml(true);
      else if (cls === "gpr-ow-eoi__form") element.settings.html = eoiFormHtml(true);
    }
  }
  return {
    version: "0.4",
    title: "Our World — Landing Page",
    type: "page",
    page_settings: {
      template: "elementor_header_footer", // same Full Width template as Gala Dinner
      hide_title: "yes",
      custom_css: css,
    },
    content,
  };
}

function buildPreview(shellPath, css) {
  const shell = readText(shellPath);
  // \s+ also matches a shell that has been through Prettier (attributes on their own lines)
  const start = shell.search(/<div\s+data-elementor-type="wp-page"/);
  if (start === -1) throw new Error(`${shellPath} has no Elementor wp-page wrapper`);
  // find the matching </div> for the wp-page wrapper
  let depth = 0, end = -1;
  for (const m of shell.slice(start).matchAll(/<div\b|<\/div>/g)) {
    depth += m[0] === "<div" ? 1 : -1;
    if (depth === 0) {
      end = start + m.index + m[0].length;
      break;
    }
  }
  const page = `<div data-elementor-type="wp-page" data-elementor-id="${PAGE_ID}" ` +
    `class="elementor elementor-${PAGE_ID}" data-elementor-post-type="page">` +
    TREE.map(render).join("") + "</div>";
  let out = shell.slice(0, start) + page + shell.slice(end);
  out = out.replace(/<title>[^<]*<\/title>/, () => "<title>Our World - GP REFRESH Conference</title>");
  const style = `<style id="gpr-our-world-css">\n${css}\n</style>`;
  // Re-running on an existing preview replaces its page CSS instead of adding a second copy
  const existing = /<style id="gpr-our-world-css">[\s\S]*?<\/style>/;
  out = existing.test(out) ? out.replace(existing, () => style) : out.replace("</head>", () => `${style}\n</head>`);
  return out;
}

function main() {
  const css = readText(path.join(HERE, "our-world.css"));
  fs.writeFileSync(path.join(HERE, "our-world-elementor-template.json"),
    JSON.stringify(buildTemplate(css), null, 2), "utf8");
  if (process.argv[2]) {
    fs.mkdirSync(path.join(HERE, "preview"), { recursive: true });
    fs.writeFileSync(path.join(HERE, "preview", "our-world.html"), buildPreview(process.argv[2], css), "utf8");
  }
  console.log("built");
}

main();
