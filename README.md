# GP Refresh — Our World (Landing Page)

The branded landing page for the existing draft page **https://www.gprefresh.com/our-world/** (WordPress page ID 17225): upcoming conferences, testimonial videos and group discounts.

## Files

| File | Purpose |
|---|---|
| `our-world-elementor-template.json` | Elementor template to import and insert into page 17225. It includes the page settings (Full Width template, hidden title, custom CSS). |
| `our-world.css` | Page-scoped CSS. The same CSS is embedded in the template's `custom_css`. Kept here as the source of truth. |
| `build.js` | Builds both the JSON and the preview from one content definition (Node 18+, no packages). Edit the copy here and rebuild. |
| `serve.js` | Local static server for testing the previews: `node serve.js`, then open http://localhost:8000/preview/our-world.html. |
| `preview/our-world.html` | Local preview. The live site's real Gala Dinner page shell (header, footer, theme CSS, scripts) with only the page body swapped. |
| `preview/social.html` | Source of the testimonial videos section. The build embeds it as-is, with its global CSS rules scoped to the section. |
| `preview/assets/melbourne.jpeg`, `sydney.jpeg`, `brisbane.jpeg` | Supplied city photos used by the conference cards. The preview reads these local files; the Elementor export embeds them. |
| `preview/assets/background image.jpeg` | Supplied cream, green and gold background for the compact social section. Embedded in the Elementor export. |
| `preview/thank-you.html` | Standalone copy of the thank-you message, for use as a GHL redirect target if ever needed. The landing page shows the same message in place of the form instead. No header or navigation. |
| `preview/prospectus-access.html` | Unique access code page for downloading the prospectus (code pre-filled from `?code=`). Full-screen split layout (branded photo panel + verification card) that fits the viewport with no scrolling, down to 320×568, including error states. No header or navigation. |
| `preview/js/gpr-config.js` | **The only file to edit when connecting the GHL form.** Public settings: EOI form embed / submit URL, page links, contact details. |
| `preview/js/gpr-validate.js` | Email, Australian phone and ABN checksum validators shared by both forms. |
| `preview/js/gpr-eoi.js` | EOI form validation, loading state and submission. The Elementor export inlines it with the two files above. |
| `preview/js/gpr-prospectus-verify.js` | Checks an access code in the browser against `gpr-access-codes.js` and decrypts the PDF link for a correct code. |
| `preview/js/gpr-access-codes.js` | **Generated, public.** Encrypted access-code data (no readable codes or link). Ships as an empty placeholder until `make-access-codes.js` is run. |
| `make-access-codes.js` | Generates unique prospectus access codes: writes the private `access-codes.csv` and the public `gpr-access-codes.js`. |
| `access-codes.csv` | **Private, git-ignored, created by the script.** The plain codes to copy into GHL contacts. Back it up; never publish it. |
| `ACCESS-CODE-VERIFICATION.md` | Plain-English guide to the access-code flow, GHL setup and its limits. |
| `preview/js/gpr-prospectus-access.js` | Access page UI: validation, loading state, messages and starting the authorised download. |
| `preview/css/gpr-pages.css` | Styles for the two standalone pages (same tokens and type as `our-world.css`). |
| `.gitignore` | Ignores `*.pdf` and `access-codes.csv`, so neither the prospectus nor the plain codes can be committed and published through GitHub Pages. |

Rebuild: `node build.js path/to/saved/gala-dinner.html`

To keep the current preview's shell (including the trimmed navbar), use the preview itself as the shell: `node build.js preview/our-world.html`

## Page sections (top to bottom)

1. **Hero** (unchanged).
2. **Expression of Interest** (`#expression-of-interest`): heading, description, a three-step "how it works" list and a **Download Prospectus** button (→ `prospectus-access.html`) on the left; the six-field form (First Name, Last Name, Email, Phone, ABN, Company Name, all required) in a white card on the right. After a confirmed submission the form is hidden and the thank-you message (`EOI_THANKS_*` in `build.js`) appears in the same card. Two columns on desktop, stacked on tablet, one field per row on mobile. Edit the copy and fields in `EOI_*` in `build.js`. See **GHL integration** below for how submissions are sent.
3. **Refresh | Reframe | Reignite** (unchanged).

Removed on request (30 Oct 2026): **Upcoming Conferences** (GP Refresh Int’l Congress, with the countdown), **What delegates say** (testimonials from `preview/social.html`) and **Group Discounts**. Their content and builders (`EVENTS`, `COUNTDOWN_*`, `GROUP_TIERS`, `eventsHtml()`, `countdownHtml()`, `testimonialsHtml()`, `groupsHtml()`) and CSS are still in `build.js` / `our-world.css`. To restore a section, add it back to `TREE` in `build.js` and rebuild.

## GHL integration (Expression of Interest and prospectus access)

Frontend only: there is no backend, database or API in this repository. GP Refresh's GoHighLevel account manages leads, email and SMS. The EOI settings live in `preview/js/gpr-config.js`, which is **public**. Never put a GHL API key, private integration token, plain access code or prospectus URL in it or anywhere else in this repo. Access codes are generated locally (see section 2).

### 1. EOI form → GHL

No GHL form, webhook or embed existed in this project or on the reference `/expression-of-interest/` page (it uses Elementor Pro forms), so the form ships **unconnected**. Until one of the options below is configured, a valid submission sends nothing and tells the visitor so, with GP Refresh's email and phone number. The thank-you message is never shown.

- **Option A: GHL-hosted form (recommended).** In GHL, build a form with the six fields (First Name, Last Name, Email, Phone, ABN and Company Name as custom fields), all required. Under the form's **On Submit** setting, choose *Display Message* and paste the thank-you copy, so GHL's message replaces its form in the same place. Copy the form's URL from **Integrate → Embed** (`https://api.leadconnectorhq.com/widget/form/<FORM_ID>`) into `eoi.ghlFormEmbedUrl`. The page then swaps the on-page form for the GHL iframe and loads GHL's `form_embed.js`. GHL validates, stores and shows the message. If the iframe doesn't resize, compare the attributes in `embedGhlForm()` (`gpr-eoi.js`) with GHL's current embed snippet.
- **Option B: the on-page form posts to a GHL workflow.** Create a workflow with the **Inbound Webhook** trigger and put its URL in `eoi.submitUrl`. The form POSTs JSON: `first_name`, `last_name`, `email`, `phone` (E.164, e.g. `+61412345678`, or a 13/1300/1800 number), `abn` (11 digits), `company_name`, `source`, `page_url`, `submitted_at`. Map those to the contact in the workflow. The form is hidden and the thank-you message appears in its place, in the same tab, **only if the browser can read a 2xx response**. That needs the endpoint to send CORS headers for the site's origin. I could not confirm whether GHL's inbound webhook does this, so test it first. If the browser blocks the response, the visitor sees an error, even if GHL received the data. The webhook URL is visible to anyone, so add spam protection in the workflow. If GHL's endpoint isn't suitable, use Option A.

If both are set, Option A wins.

### 2. Prospectus access codes (no server)

Full explanation, setup and limits: **[ACCESS-CODE-VERIFICATION.md](ACCESS-CODE-VERIFICATION.md)**.

- `node make-access-codes.js --pdf-url "https://<PDF link>" --count 200` generates unique codes (`GPR-XXXXX-XXXXX`).
  - `access-codes.csv` is **private** (git-ignored): the plain codes. The team copies one into each GHL contact's `prospectus_access_code` field, and a GHL workflow emails/texts `prospectus-access.html?code={{contact.prospectus_access_code}}`.
  - `preview/js/gpr-access-codes.js` is **public**: per code, a PBKDF2-derived lookup id and the PDF link encrypted with that code's key. It holds no readable codes or link.
- The access page fills the code in from `?code=`, removes it from the address bar, and checks it in the browser. Only a correct code decrypts the PDF link, which then downloads.
- Codes must come from the script, because the page can't see codes GHL generates. Re-publish `gpr-access-codes.js` after every run. Set a code's CSV status to `revoked` and re-run to disable it.
- Limits: the PDF link can be passed on once someone has downloaded it. Codes can be shared and don't expire or count downloads. The email isn't checked. Those need a server.

### 3. The prospectus PDF

Host it anywhere with an `https://` link (for example GHL's Media Library) and pass that link to the script. **Never** commit it to this repo: GitHub Pages would make it public, and `.gitignore` blocks `*.pdf`. To cut off a link that has leaked, upload the PDF under a new link, re-run the script and delete the old file.

### WordPress / Elementor

The Elementor export inlines the three EOI scripts, with the config values as they were at build time. The relative `prospectus-access.html` link only works on GitHub Pages. Before importing to WordPress, set `PROSPECTUS_ACCESS_URL` in `build.js` to an absolute URL, then rebuild.

### Testing checklist

Serve the repo root (`node serve.js`) and open http://localhost:8000/preview/our-world.html.
- Empty submit: six messages, and focus moves to First Name. Bad email, phone (`555`) or ABN (`51 824 753 557`): specific messages. A valid ABN (`51824753556`) is reformatted to `51 824 753 556` on blur.
- Unconfigured: valid data shows the "not connected" message and stays on the page.
- With `submitUrl` set: the button shows "Submitting…" with a spinner. A non-2xx or CORS-blocked response shows an error. A readable 2xx hides the form and shows the thank-you message in the card, with focus on its heading.
- Access page: with no codes generated, the "not available yet" notice shows. After `make-access-codes.js` runs, `?code=<code>` fills in the field and is removed from the URL; a correct code (any case, with or without dashes) starts the download, and a wrong or revoked code shows "That code isn't valid". Tested 30 Oct 2026 with dummy codes and link (since removed).

## Install on WordPress (needs wp-admin, Elementor Pro)

1. **Templates → Saved Templates → Import Templates**, then upload `our-world-elementor-template.json`.
2. Open **Pages → Our World → Edit with Elementor**. In the folder icon (*My Templates*), insert "Our World — Landing Page". Accept the prompt to apply the template's page settings.
3. Check **Page Settings**:
   - Page Layout should be **Elementor Full Width**, the same as Gala Dinner.
   - **Hide Title** should be on.
   - **Advanced → Custom CSS** should contain `our-world.css`. If the import didn't carry it, paste it in.
4. Publish, then view at 1440 / 768 / 390.

Dates, venues and prices on the page are copied from the live homepage and /pricing/ (23 Oct 2026). Update them in build.js when they change.

## Audit findings: the design system used (verified from the live site, 15 Oct 2026)

- **Stack:** WordPress 7.1.3, Blocksy 2.1.50 (header, transparent on dark heroes), Elementor 4.3.5 + Elementor Pro 4.3.2 (page content, footer template 592).
- **Palette** (Blocksy `global.css`): `#020a0a` ink, `#1f443d` green (top bar), `#be9a5e` gold, `#ECECEA` / `#F2F2F0` / `#F5F4EE` warm neutrals (`#F5F4EE` = body).
  - The Elementor kit globals (`#6EC1E4`, Roboto…) are Elementor defaults that the site doesn't use, so they were ignored.
- **Type:** Urbanist throughout, letter-spacing 0.3px.
  - Gala hero: H1 80/60/41px at weight 400; eyebrow 14px/600/5px tracking, uppercase.
  - Section H2: 50/65px. Body: 17.6px/1.65.
- **Layout:**
  - Container 1300px. Side padding 70 / 30 / 20px.
  - Interior heroes are 900px (800px mobile) full-bleed photos under the transparent header.
  - Gala overlay: `rgb(25,25,23)` gradient.
- **Buttons:** pill radius. The hero uses the header's outline "Register Now" style; hover fills gold with ink text.

### Why the page needs an image hero
The site header is transparent, with white text. On the current blank `/our-world/` page, the logo and navigation are invisible on the cream background. A dark full-bleed hero, as on Home and Gala Dinner, fixes this.

## Assets

Conference photos use the supplied `preview/assets/melbourne.jpeg`, `preview/assets/sydney.jpeg` and `preview/assets/brisbane.jpeg`. They show the city skylines, with descriptive alt text and intrinsic dimensions, in the existing fixed-aspect-ratio frames. The local preview loads these files directly. The Elementor JSON embeds the same JPEG bytes as data URLs in its HTML widget, so these three photos do not require local paths on WordPress. This adds roughly 1.8 MB to the export. Check the images after importing into Elementor; the live import has not been verified. Cruises and Dubai retain text-only TBC entries.

- **Hero:** `2026/03/conference-3.webp` (homepage *GP Refresh Highlights → Conference* gallery), replacing `conference-8` on 30 Oct 2026. A speaker at the lectern in front of the GP Refresh backdrop (The Langham, Gold Coast).
  - The speaker stands just left of centre. The headline is set as two lines, "Explore Opportunities" / "with GP Refresh" (`TITLE_LINES` in `build.js`); on phones its font scales with the viewport so each line stays on one row. On desktop the end of the first line comes close to the speaker's face. On mobile the crop is centred on his face (`object-position: 46% 0%`) and the hero is 860px tall, so the text starts below it.
  - This image is 1600×1066 on the live site with only a 768 crop, so it's served with a 768 / 1600 `srcset` (see `picture()`'s `original` / `crops` arguments), plus `fetchpriority="high"` and width/height attributes (no layout shift).
- **Supporting section:** `2026/03/conference-6.webp` (delegates at round tables), lazy-loaded.
- The hero and supporting image remain linked to existing site uploads in Elementor HTML widgets. The three conference photos are embedded in the export; no files have been uploaded to WordPress.

## Copy
- Hero copy leads into the Expression of Interest: eyebrow "GP Refresh | Expression of Interest", headline "Explore Opportunities with GP Refresh". The lede's facts (six-minute talks, up to 53 CPD hours, no sponsored talks) come from the homepage; the gold line lists the 2027 cities. There's no "Coming Soon" wording.
- "Refresh | Reframe | Reignite" and the three lines ("Refresh the basics." / "Reframe the evidence." / "Reignite your passion for patient care.") are existing homepage headings.
- Hero button: **Register Your Interest → `#expression-of-interest`** (smooth-scrolls to the form). The conference registration link (`REGISTER_URL`, https://events.gprefresh.com/) is no longer on the page.

## QA performed (local preview inside the live page shell, Chrome)

- **Overflow:** none at 1440, 1280, 768, 390 or 320. The only element extending past the viewport is the site's own scrolling date bar.
- **Headings:** a single H1, then one H2. The eyebrow and status are `<p>`, so the heading order has no gaps.
- **Images:** alt text on both; correct `srcset` candidate chosen at each width.
- **Keyboard:** the button is reachable, with a visible 2px focus outline. Touch target 214×44.
- **Contrast** (WCAG, conservative background estimate):
  - Gold status on hero: 5.5:1.
  - Eyebrow: 12:1.
  - Lede: 9.7:1.
  - Ink on cream: 18:1.
  - Button hover (ink on gold): 7.6:1.
  - The site's white-on-gold button (2.6:1) was deliberately not used.
- **Responsive refinements made after review:**
  - Headline kept off the subject's face at 1280 and 768.
  - Hero CTA kept clear of the site's global floating "Register Now / 1300 GP REFRESH" buttons on tablet and mobile.
- **Motion:** short, once-per-element fade-and-rise entrances for the hero copy, section headings, countdown, conference cards, discount tiers and closing section. Desktop hover gently lifts cards and buttons and zooms conference photos. New effects respect `prefers-reduced-motion`, including changes while the page is open. Content stays visible when JavaScript or animation APIs are unavailable; keyboard focus cancels entrance motion on the focused element. No animation library is required. Browser playback has not been verified in this environment.
- **Scope:** all CSS is under `.gpr-ow-*` classes. Shared header, footer, theme and kit are untouched.

## Limitations

- No wp-admin access from here, so nothing has been imported or published. The live page is still blank until the steps above are done.
- The preview approximates Elementor's generated per-element CSS. The custom CSS sets layout explicitly so it doesn't depend on that CSS, but confirm once in Elementor's own preview.
- In the local preview, the footer's icon-font glyphs show as boxes. This is a cross-origin font restriction when served from localhost; they render normally on gprefresh.com.
