# How the Prospectus Access Code Is Checked (no server)

Each prospect gets their **own** access code. They enter it on the prospectus page, the page checks it, and if it's correct the prospectus PDF downloads. There's no Cloudflare Worker, AWS Lambda or any other server. Only GoHighLevel and the website are involved.

---

## The idea in one paragraph

A web page can't ask GHL whether a code is correct, because that needs a private API key. So the page has to **know the valid codes in advance**. To make that possible, you **generate the codes yourself** with a small script, `make-access-codes.js`, instead of letting GHL invent them. The script produces two files:

| File | Who sees it | What's in it |
|---|---|---|
| `access-codes.csv` | **Only you.** Never upload or publish it. | The real codes, for example `GPR-9A9JN-0426W`. You copy each one into a GHL contact. |
| `preview/js/gpr-access-codes.js` | Public, part of the website | No readable codes and **no readable PDF link**. Only scrambled values that the page uses to check a code. |

When a prospect enters a code, the page uses it to unlock the matching entry in the public file. Only a correct code unlocks the PDF link. A wrong code unlocks nothing.

---

## The full flow

```
 You (once per batch)              GHL                                  Prospect                    Prospectus page
 ────────────────────              ───                                  ────────                    ───────────────
 1. Upload the PDF and copy
    its link
 2. Run make-access-codes.js
    → access-codes.csv (private)
    → gpr-access-codes.js (public)
 3. Publish the website
                                   4. Prospect submits the GHL EOI form
                                      → contact created
 5. Take the next "unused" code
    from the CSV and put it in the
    contact's prospectus_access_code
    field. Mark it in the CSV.
                                   6. Workflow sends email + SMS:
                                      ".../prospectus-access.html?code=GPR-9A9JN-0426W"
                                                                        7. Taps the link ─────────► Code is filled in
                                                                        8. Clicks "Verify &         Checks the code in
                                                                           Download" ─────────────► the browser
                                                                                                    ├─ correct → PDF downloads
                                                                                                    └─ wrong → "That code isn't valid"
```

Prospects can also open the page directly and type the code from their email or SMS. Capital or small letters, spaces and dashes don't matter, and the letter "O" typed instead of a zero still works.

---

## Setup, step by step

### 1. Upload the PDF and get its link
Upload the prospectus somewhere that gives you an `https://` link, for example the **GHL Media Library**. **Don't** put the PDF in this repository.

### 2. Generate the codes
On your computer, in the project folder (needs [Node.js](https://nodejs.org) 18 or newer, no other installs):

```
node make-access-codes.js --pdf-url "https://<your PDF link>" --count 200
```

This creates 200 codes like `GPR-9A9JN-0426W`. Run it again with `--count 100` whenever you need more. Existing codes keep working.

### 3. Publish the website
Upload the updated `preview/js/gpr-access-codes.js` with the website. **Every time you run the script, publish this file again**, otherwise new codes won't work.

### 4. GHL: custom field
Settings → Custom Fields → Contact → add **`prospectus_access_code`** (single line text).

### 5. GHL: give each contact a code
When a prospect is approved, open `access-codes.csv`, take the next code with status `unused`, paste it into the contact's `prospectus_access_code` field, and in the CSV change its status to `assigned` and add the contact's email under `assigned_to`.

With many contacts, you can also fill the CSV's `assigned_to` column and bulk-update the contacts with GHL's **contact import** (match on email, map the code column to `prospectus_access_code`).

> GHL can't take the "next code from a list" automatically. You copy codes in by hand or by import. **Don't let GHL generate random codes**, because the page wouldn't know them.

### 6. GHL: send the code
In the workflow that runs after a code is assigned, send an email and an SMS with the code and this link:

```
https://<your-site>/prospectus-access.html?code={{contact.prospectus_access_code}}
```

(Check the exact merge-field name in GHL's custom field list.)

---

## Everyday tasks

| Task | What to do |
|---|---|
| Need more codes | `node make-access-codes.js --pdf-url "<same link>" --count 100`, then publish `gpr-access-codes.js` |
| Stop one code working | In `access-codes.csv`, set its status to `revoked`, re-run the script with `--count 0`, then publish `gpr-access-codes.js` |
| New version of the prospectus | Upload the new PDF, run `node make-access-codes.js --pdf-url "<new link>"`, publish, then **delete the old PDF** so old links stop working |
| Lost `access-codes.csv` | The codes can't be recovered from the website file. Generate new codes and send them out again. **Back up the CSV somewhere private.** |

---

## How safe is this?

**What's protected:**
- The website source contains **no readable codes and no readable PDF link**. Viewing the page source doesn't reveal them.
- Codes have 10 random characters (about a million billion combinations), and every check is deliberately slow, so guessing a code isn't realistic.

**What isn't protected (the cost of having no server):**
- **Anyone who gets the PDF link can share it.** Once a valid code has been used, the PDF link isn't secret any more. Changing the PDF link (see "New version of the prospectus") is the only way to cut off old links.
- **A code can be shared.** A prospect could pass their code to a colleague. The page can't limit each code to one person or one download.
- **Codes don't expire on their own.** Turn them off by hand with `revoked`.
- **The page doesn't check the email address**, only the code. It can't see GHL, so it can't tell who a code was given to.
- **Downloads aren't counted.** The page can't tell GHL who downloaded.

If you later need expiring codes, one-time downloads or download tracking, that requires a server. Everything on the page is already set up so a server could be added later.

---

## Golden rules

- **Never publish `access-codes.csv`.** `.gitignore` already stops it from being committed to Git.
- **Never commit the PDF.** GitHub Pages would make it public. `.gitignore` blocks `*.pdf`.
- **Re-publish `gpr-access-codes.js` after every run** of the script.
- Use codes generated by the script. Codes made up by hand or in GHL won't work.
