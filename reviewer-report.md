# AI Reviewer and Learning Mode: test and readiness report

Date: 2026-10-11. Covers the Gemini-powered PDF reviewer and Learning Mode (merged as PR #17) and the testing and fix pass done on branch `test/ai-reviewer-finalize`.

**Status: ready for thesis testing, not production-ready.** The whole workflow was verified end to end in automated tests, in a real browser against a test server, and with the real Gemini API on two real PDFs. It has not been tried by a real student on the live site or on a real phone yet (see "What you need to test by hand"). The limits in "Thesis limitations" are real and should go in the paper.

## Architecture

```
React 19 + Vite (plain CSS in App.css; Tailwind is installed but not wired up in this project)
  pages/Reviewers.jsx, components/reviewer/*
        |  axios, cookie session (JWT), same-origin /api through the Vercel rewrite
        v
Express 5 on Render (server/)
  routes/reviewerRoutes.js      login check (userAuth), then multer (PDF in memory, 10 MB max)
  controllers/reviewerController.js
        |
        |-- utils/pdfText.js       %PDF check, text extraction (unpdf / pdf.js), cleaning,
        |                          360k character cap, split into up to 3 parts of 120k
        |-- utils/reviewerContent.js   prompts, JSON schema, validation of the AI's answer
        |-- utils/gemini.js        the only file that calls Gemini (@google/genai, key from env)
        |-- utils/aiErrors.js      which failures to retry, and the message a student sees
        |-- utils/reviewerProgress.js  scores, per-topic accuracy, weak topics (pure functions)
        v
Gemini API (gemini-3.8-flash by default, JSON output with a response schema)
        v
MongoDB Atlas
  reviewers         one per uploaded PDF: extracted text, summary, topics, questions + answer key
  reviewerattempts  one per Learning Mode session: question order, graded answers, score
  airequests        one row per AI generation, for the daily limit (auto-deleted after 2 days)
        v
Learning Mode (graded on the server, one question at a time, results, weak topics,
targeted review)
```

How a reviewer is made: the upload request saves the reviewer as `processing` and answers at once. The AI call runs in the background on the server (so a slow AI never hits a proxy timeout), and the page checks `/status` every 3 seconds. Gemini's answer is checked and cleaned before anything is saved. Opening, studying and viewing results never call Gemini again.

## Files

**Created for the feature (PR #17)**
- Client: `client/src/pages/Reviewers.jsx`, `client/src/components/reviewer/` (`UploadReviewerDialog.jsx`, `ReviewerView.jsx`, `LearningMode.jsx`, `SessionResults.jsx`, `reviewerUtils.js`)
- Server: `controllers/reviewerController.js`, `routes/reviewerRoutes.js`, `models/reviewerModel.js`, `models/reviewerAttemptModel.js`, `models/aiRequestModel.js`, `utils/gemini.js`, `utils/pdfText.js`, `utils/reviewerContent.js`, `utils/reviewerProgress.js`, `scripts/geminiSmoke.js`
- Tests: `tests/reviewer.api.test.js`, `tests/reviewer.content.test.js`, `tests/helpers/pdf.js`

**Created in this pass**
- `server/utils/aiErrors.js`: retry rules and student-facing error messages, shared by the server and the smoke script
- `server/tests/reviewer.workflow.test.js`: scores, weak topics, AI call counts, refresh/resume, real PDFs, database records, checks on AI output
- `server/tests/reviewer.e2e.test.js`: the whole workflow with the real Gemini code talking HTTP to a fake Gemini
- `server/tests/gemini.http.test.js`: `utils/gemini.js` and the real SDK against a fake Gemini (bad key, rate limit, timeout, empty and cut-off answers)
- `server/tests/helpers/fakeGemini.js`: the fake Gemini server
- `server/tests/fixtures/stress-handout.pdf` (+ its `.html` source): a 3-page handout printed from Chrome with headings, a table, two columns and Filipino words
- `reviewer-report.md` (this file)

**Modified in this pass**
- `server/utils/gemini.js`: empty or cut-off answers are marked unusable (so they're retried), timeout raised to 150s and made adjustable
- `server/controllers/reviewerController.js`: shared retry logic, last answer closes the session, failed "New questions" keeps the old set, double-submit guard, clearer server logs, stuck-job cutoff 12 min
- `server/utils/reviewerContent.js`: a question without an explanation is dropped
- `server/scripts/geminiSmoke.js`: uses the same retry rules as the server
- `server/tests/helpers/pdf.js`: multi-page, password-protected and image-only PDFs
- `server/tests/reviewer.content.test.js`: more validation cases, threshold boundaries, score rounding
- `client/src/components/reviewer/ReviewerView.jsx`: says when "New questions" failed and the old set was kept
- `client/src/App.css`: long unbroken words no longer widen the reviewer past a phone screen

Also touched by the feature earlier: `server/app.js` (mounts `/api/reviewers`), `client/src/App.jsx` (route), `Header.jsx` (sidebar link), legal texts and `LEGAL_VERSION`, `render.yaml`, `server/.env.example`.

## Dependencies

Added by the feature (server only, none in this pass):
- `@google/genai`: Google's official Gemini SDK, to call the API with a JSON response schema.
- `multer`: reads the multipart PDF upload into memory (no disk on Render's free tier).
- `unpdf`: pulls text out of PDFs (a packaged build of Mozilla's pdf.js that runs in Node).

No client packages were added. Unrelated leftovers noticed but not removed: `rxjs` (used only by an old `services/auth.service.ts`) and `tailwindcss` in client devDependencies (not wired up).

## Environment variables

Backend (`server/.env` locally, Render dashboard in production):
```
PORT=
NODE_ENV=production
CLIENT_URL=            # Vercel URL, exact, for CORS
MONGO_URI=
JWT_SECRET=
GOOGLE_CLIENT_ID=
SENDER_EMAIL=
BREVO_API_KEY=         # or SMTP_HOST / SMTP_PORT / SMTP_NAME / SMTP_PASSWORD
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
GEMINI_API_KEY=        # server only
GEMINI_MODEL=          # optional, default gemini-3.8-flash; set it to switch models if one is overloaded
```

Frontend (`client/.env` locally, Vercel in production):
```
VITE_BACKEND_URL=      # production: the Vercel URL (the /api rewrite forwards to Render)
VITE_GOOGLE_CLIENT_ID=
```

There is no Gemini variable on the frontend, and there must never be one: anything starting with `VITE_` is copied into the public JavaScript.

## API endpoints

All need a logged-in session. A reviewer can only be reached by its owner; anyone else gets 404.

| Method | Path | What it does | Calls Gemini |
|---|---|---|---|
| POST | `/api/reviewers` | Upload a PDF (`pdf`, `title`, `course`, `questionCount` 10/15/20/30) | Yes, once (up to 3 at once for a long PDF) |
| GET | `/api/reviewers` | List, with daily limit and last score | No |
| GET | `/api/reviewers/:id` | One reviewer (no answer key) and any session to resume | No |
| GET | `/api/reviewers/:id/status` | Light check while the AI works | No |
| PATCH | `/api/reviewers/:id` | Rename, change course | No |
| POST | `/api/reviewers/:id/regenerate` | New question set from the stored text | Yes |
| POST | `/api/reviewers/:id/targeted` | 5 or 10 new questions on 1 to 3 chosen topics | Yes |
| DELETE | `/api/reviewers/:id` | Delete it and its sessions | No |
| GET | `/api/reviewers/:id/progress` | Topic levels, weak topics, history | No |
| POST | `/api/reviewers/:id/sessions` | Start Learning Mode (`mode`: all, weak, targeted) | No |
| GET | `/api/reviewers/:id/sessions/:sid` | Resume a session | No |
| POST | `/api/reviewers/:id/sessions/:sid/answer` | Answer one question; graded on the server | No |
| POST | `/api/reviewers/:id/sessions/:sid/finish` | End and score the session | No |

## How scores and weak topics work

- **Score** = correct answers / questions answered, rounded to a whole percent (`scorePercent` in `server/utils/reviewerProgress.js`). Ending a session early scores only what was answered. The browser never sends a score; the server grades each answer when it arrives and keeps only the first answer to each question.
- **Topic level** (`topicLevel`, same file): under 2 answers is "not tried yet"; accuracy under 60% (`WEAK_BELOW = 0.6`) is weak ("Needs review"); 80% and up (`STRONG_FROM = 0.8`) is strong; in between is "Getting there". It uses the 5 most recent finished sessions on the current question set (`RECENT_SESSIONS = 5`).
- **Weak topics** are the weak ones, weakest first. "Practice weak topics" serves only their questions; targeted review pre-selects them.

## Testing

### What was tested and how

1. **Automated server tests (Vitest + Supertest + in-memory MongoDB): 375 pass, 0 fail.** 117 of them are about reviewers:
   - `reviewer.api.test.js` (31): upload, limits, retries, owner-only access, Learning Mode, long PDFs, targeted review, plain 500s.
   - `reviewer.content.test.js` (29): validating the AI's answer, prompts, splitting long text, progress math, PDF text cleaning.
   - `reviewer.workflow.test.js` (34): everything in the thesis test plan below.
   - `reviewer.e2e.test.js` (6): the complete workflow using the real Gemini code over HTTP to a fake Gemini.
   - `gemini.http.test.js` (17): the real SDK against a fake Gemini, covering every error type.
2. **Browser test** (headless Chrome driving the real React app against the real server with an in-memory database and a fake Gemini): empty state, upload, processing, ready, Learning Mode click by click, results, refresh and resume, failed reviewer, bad key message, failed "New questions", long text, light and dark, at 320, 375, 768 and 1280 px.
3. **Real Gemini** (`npm run smoke:gemini`, same code path as the server, your free-tier key):
   - 3-page handout: answered in 17s, 10 of 10 questions kept, 5 topics, 3/5/2 easy/medium/hard; targeted review on one topic, 5 of 5 kept, all on that topic and taken from the handout.
   - 74-page PDF, 301,610 characters (chapters I to V of Darwin's *Origin of Species*, public domain): split into 3 parts sent at once. Gemini answered "503 high demand" twice; the retries got through and it finished in 71s with 15 of 15 questions over 8 topics. Targeted review: 5 of 5 kept, but it took 99.7s.
4. **Security checks**: searched the code, git history (all branches), the local build and the live site's JavaScript for the key, `AIza`, `GEMINI`, the Gemini API host, the SDK and other server secrets. None found outside `server/.env`. `server/.env` and `client/.env` are git-ignored and were never committed.

### Checklist results

| Area | Result |
|---|---|
| Complete workflow (upload to results to targeted review) | Pass (e2e test, browser, real Gemini) |
| Works only when logged in, only for the owner | Pass (every endpoint, including sessions and targeted) |
| Normal, small, multi-page PDFs, headings, tables, two columns, Filipino characters | Pass |
| Large PDF (10 MB cap, 360k character cap with a notice, split into 3) | Pass (real Gemini on a 74-page PDF) |
| Empty file, PNG renamed to .pdf, header-only, cut-in-half (damaged), password-protected, scanned (image-only), too little text | Pass: each gets a clear message, nothing is saved, Gemini isn't called |
| Gemini: success, missing key, invalid key, leaked key, unknown model, rate limit, overloaded, timeout, empty answer, cut-off JSON, not JSON, missing questions, 3 choices, repeated choices, answer index out of range or not a number, no explanation | Pass: each either retried or failed with a plain message; bad questions dropped; never saved unchecked |
| Stored questions have a topic, difficulty, 4 different choices, an answer that is one of them, and an explanation | Pass |
| Reopening a reviewer, starting Learning Mode, answering, results: no Gemini calls | Pass (counted at the HTTP level) |
| One question at a time, submit required, answer hidden until submitted, no double answers, numbering, progress bar | Pass (browser and API) |
| Refresh mid-session keeps the attempt | Pass, plus a fix (see below) |
| Scores 10/10 = 100%, 8/10 = 80%, 5/10 = 50%, 0/10 = 0%, per-topic scores | Pass |
| Fake score or "correct: true" sent by the browser | Ignored (pass) |
| Weak topics: 90% / 40% / 80% marks only the 40% topic; 60% exactly is not weak | Pass |
| Targeted review: right topic sent, original text sent, stored as its own batch, off-topic questions refused | Pass |
| Long names, titles, questions, choices, links, explanations at phone width | Pass after a fix (see below) |
| Database links (user to reviewer to session), delete cleans up, no duplicates, failed AI leaves no broken record | Pass, plus fixes |
| Gemini key only on the server | Pass |

### Problems found and fixed in this pass

1. **An empty, blocked or cut-off Gemini answer wasn't retried**, and the student got a vague message. It's now treated like any other unusable answer: asked again up to 3 times, then "We couldn't get good questions out of this PDF."
2. **An invalid, expired or blocked API key told students to "try a different PDF."** Key and model problems now say "Reviewers aren't working on our side right now," aren't retried, and the server log says to check `GEMINI_API_KEY` and `GEMINI_MODEL`.
3. **A timeout wasn't retried.** It now is, like a busy service.
4. **If "New questions" failed, a working reviewer became unusable** (marked failed, its questions locked). It now goes back to its existing questions and shows "New questions didn't come through."
5. **Answering the last question and then leaving or refreshing before "See results" lost the session** (it never counted toward progress). The last answer now closes and scores the session on the server.
6. **A retry of an answer after the session closed got an error** instead of the saved result. Fixed.
7. **A double submit of the same upload made two reviewers and used two of the daily 10.** The same file and question count, sent again while the first is still being made, now gets the first one back.
8. **A question with an empty explanation could be saved.** It's now dropped like any other malformed question.
9. **On phones, a long unbroken word in the notes (a URL or a long term) pushed the page past the screen edge** (492px wide on a 375px screen). Fixed, and checked at 320, 375, 768 and 1280 px in light and dark.
10. **Targeted review on a long PDF took 99.7s, just under the 100s limit per request.** The limit is now 150s; the "stuck job" cutoff went from 9 to 12 minutes to cover every retry.
11. Code cleanup: the smoke script had its own copy of the retry rules (with slightly different behavior); both now share `utils/aiErrors.js`. No debug logs, unused imports, hardcoded keys or hardcoded URLs were found in the reviewer code.

## Thesis limitations

- **Gemini free tier.** The key is free tier: requests per minute and per day are capped by Google, and the model often answers "high demand" (503) for a minute or so. On 2026-10-11 it did this twice during one test and also had a period of 504 timeouts. The app retries 3 times (4s, 12s, 30s), but a long outage still fails the reviewer. Each student can make 10 AI requests per 24 hours. There is no app-wide cap, so a whole class uploading at once can use up the shared key's quota.
- **Free-tier privacy.** On the free tier Google may keep and use the text sent to it, and people may review it. The app warns students not to upload anything personal, and the Privacy Policy says so.
- **AI content can be wrong.** The server checks the structure of every question (4 different choices, one marked correct, an explanation, a known topic) but can't check whether the marked answer is actually true. A plausible wrong answer key would get through. The app tells students to check anything that looks off against their notes. For the thesis, have a subject teacher review a sample of generated questions.
- **PDF extraction.** Only PDFs with a text layer work. Scanned pages and image-only slides are refused with a message (no OCR). Tables come out as rows of text and cells that wrap can get mixed; complex layouts from other PDF makers may extract in a different order than the Chrome-made test PDFs.
- **Length.** Up to 10 MB per file and 360,000 characters of text (about 150 dense pages); anything longer is cut and the reviewer says so. Text over 120,000 characters is split into up to 3 parts made separately and merged, so topics from different parts can overlap (the Darwin test produced two similar "Divergence of Character" topics).
- **Speed.** Short PDFs took 15 to 20 seconds; a full long part took 70 to 100 seconds. With retries, a reviewer can take up to about 11 minutes before it is marked failed.
- **Hosting.** Generation runs inside the one Render server process. If Render restarts mid-job, the job is lost (marked failed after 12 minutes, or the old questions come back). The free instance has limited memory; several 10 MB PDFs being read at once could strain it. It can't run on more than one server instance as built.
- **Score when ending early** counts only answered questions (3 of 3 answered = 100%, even out of 10). This is on purpose and the results page says how many were answered.
- **Prompt injection.** The PDF text is fenced off and Gemini is told to ignore instructions inside it, but no AI can promise to always obey that.
- **Testing gaps.** No client-side automated tests. The browser checks used headless Chrome at phone widths, not a real phone. The password-protected test used a generated PDF, not one made by Word or Acrobat.

## What you need to test by hand

1. **A real upload on the live site** (https://stresscare-art-8707.vercel.app/reviewers) with a real lecture PDF. Note how long it takes to become ready.
2. **A real phone** (Android Chrome and iPhone Safari): upload from phone storage or Google Drive, answer in Learning Mode, refresh in the middle, look at the results page.
3. **A scanned PDF** (a phone camera scan or a photocopied module): it should say there isn't enough text.
4. **A real password-protected PDF** (from Word or Acrobat): it should ask to remove the password.
5. **Several students at once**: 5 or more accounts uploading within a minute, to see how the free tier holds up.
6. **Answer accuracy**: have someone who knows the subject check 2 or 3 generated reviewers question by question. Useful numbers for the paper.
7. **Render settings**: `GEMINI_API_KEY` is set (it is, as of 2026-10-11). If Gemini keeps answering "busy," set `GEMINI_MODEL` to another model (e.g. `gemini-3.5-flash`) and redeploy.

## How to run the checks again

```
cd server
npm test                                                    # all 375 tests, no real Gemini, no Atlas
npm run smoke:gemini -- tests/fixtures/stress-handout.pdf 10   # real Gemini, uses about 2 requests
```
