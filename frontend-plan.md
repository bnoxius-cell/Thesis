# StressCare frontend plan (revamp, 2026-10-12)

This is the project's `frontend-plan.md`. It covers the frontend revamp (pages, content, navigation, design system) plus the few small server changes the new screens need. Security and bug work for the whole system stays in `system-review.md`; section 9 says how the two fit into the same three weeks.

Written by Opus after a walk through every page (desktop and phone width, light and dark, seeded with a realistic student account), a read of the client code, and web research. The second half is a work list for Sonnet.

**Status:** plan written, nothing built yet. The owner answered every open decision on 2026-10-12 (section 8), so it is ready to build. Start with section 9.

---

## 1. The short version

| | What | Why |
|---|---|---|
| **Keep** | The workload engine, schedule workspace, AI reviewers, groups and chat, check-ins (PSS-10, WHO-5), slate and navy look, red as the brand color, Karla, lucide icons, the Guide button | They work and they're the thesis. The revamp is about how they're presented. |
| **Change** | Navigation (5 places instead of 9), the dashboard (from 13 phone screens to about 3), the check-in flow (one question at a time, then a real result), every page header, task cards, the sign-in page copy, About copy | Too much on every screen, red used for everything, and a check-in currently ends with "Thanks" and no result. |
| **Move** | All tasks and the 7-day study plan: Dashboard to Schedule > Tasks. Score breakdown, week chart, tips, check-in cards: Dashboard and Profile to a new Wellbeing page. Settings into Me. Friends into People. Notifications to a bell. Notification preferences to Me. | Each page gets one job. |
| **Remove** | The hero plus dark "what you can do" box at the top of 7 pages, the marketing footer inside the app, the numeric "score 31.4" and "Created on" on task cards, emails on friend cards, "Auth Provider: local", the cartoon cats on Friends, the false "stored locally" text in Settings | Clutter, jargon, or wrong. The Guide already explains features. |
| **Add** | Phone bottom navigation, a check-in result screen (plan changes, a sleep suggestion, one small thing to do, encouragement), a Wellbeing page, a bedtime suggestion from tomorrow's first class, "done this week" and encouraging toasts, a setup checklist for new students, a 404 page, a Help section | The owner's answer: a bad result should change the plan and cheer the student on. |

---

## 2. Who it's for and what it should feel like

From the owner (2026-10-12):
- **Audience: OLFU IT students only.** Copy, examples and the About page say so. (Sign-up still takes any email; that's an auth rule, not a design one.)
- **Check-in scores are for the system,** so it can know the student and manage their schedule and tasks. They are not a diagnosis. When a result is bad, the app should rearrange (suggest moving a task to another day), recommend specific things (sleep earlier if sleep isn't enough) and give positive feedback.
- **Deadline: under 3 weeks** to the panel. Section 9 is a must-have core; everything else is parked.

Principles that follow:
1. **One screen, one job.** A student opening the app between classes should see what's next and whether the week is okay, in one glance on a phone.
2. **Words before numbers.** Bands and check-ins are described in plain sentences. Numbers exist (the thesis needs them) but live one tap deeper, on the Wellbeing page.
3. **Every bad signal comes with a next step.** Never show "Critical Overload" or "High Stress" without the plan change or the small action that goes with it.
4. **Red means stop.** Red is the brand mark and the color for overdue, delete and errors. It is not the color of buttons, labels or "busy".
5. **No pressure mechanics.** No streaks, points or guilt copy. Missing a check-in is fine.
6. **Phone first.** Most students will open this on a phone (see `mobile-rules.md`).

---

## 3. What I saw (the current app)

Checked 2026-10-12 against an in-memory API with a seeded 3rd-year BSIT student (6 classes, 2 exams, 6 tasks, check-ins, 2 groups, a friend, a pending request, a reviewer) and a brand-new account. Screenshots at 1280px and 375px.

**Across the app**
- Every page except Dashboard and Reviewers opens with the same large hero plus a dark navy box listing features (Schedule, Groups, Friends, Notifications, Profile, Settings, About). On a laptop the real content starts below the fold; on a phone it starts two screens down.
- Red does five jobs at once: brand, section kickers ("This morning"), secondary buttons, ghost buttons, and alarms (overdue, "doesn't fit", Critical Overload ring). Nothing stands out because everything is red.
- 9 navigation items plus Logout. On a phone they become a 56px icon rail on the left, which takes 15% of a 375px screen and has no labels.
- A full marketing footer (Product, Resources, Support, Legal columns) sits under every signed-in page.
- Corner radius varies between 8, 10, 12, 14, 16 and 20px; fonts are set in about 9 separate `font-family` lines (plus 5 monospace ones) with no tokens.

**Dashboard**
- 5,240px tall on a laptop, **10,792px on a phone** (about 13 screens): check-in banner, Today, How you're doing, week chart, 5 guidance tips, smart suggestions, import form, every task card, and a 7-day study plan.
- The ring says "Critical Overload, 84 / 100" in salmon on navy, and the week chart is red on 6 of 7 days. For a student who is already stressed, that's the loudest thing on the page.
- Task cards show a raw "31.4 score", "Created on", a share tag and three black circular buttons. On a phone each card is about 400px tall.
- The "Next exam" pill wraps into three narrow columns at 375px (known).

**Check-ins**
- 10 PSS questions on one long scroll. A tap outside the dialog closes it and loses the answers (system-review B7).
- After "Submit Survey" the student sees "Thanks for checking in" for 1.8 seconds and the dialog closes. **They never see what their answers meant or what changed.**

**Other pages**
- Schedule list: the hero fills the first screen; the student's actual schedule is below it. Opening the schedule itself is good (week grid, Join buttons, holiday calendar), but the holiday calendar sits under the week and makes the page long.
- Reviewers: the list card squeezes the title into a narrow column ("Information / Assurance: / Risk / Management"). The open reviewer is in good shape.
- Groups: works. On a phone the chat composer's placeholder wraps letter by letter ("Message Capston e Team 4") because of left padding.
- Friends: cartoon cats around "Add a Friend", emails on every card, no Decline.
- Profile: "Profile & Capacity Settings" hero, an Edit mode toggle, "Auth Provider: local", emoji in headings, survey cards with clinical labels ("Moderate Stress").
- Settings: two theme buttons, a false privacy line, a disabled "coming soon" button. Almost empty.
- About: says the bands are "Balanced · Watchlist · High Pressure" (the app uses Light/Moderate/Heavy/Critical).
- Sign-in page: the headline is about "group work from one dashboard", nothing about stress. Three feature chips look like buttons but aren't. On a phone the form starts below the fold.
- New account: lands on "Add your first task" with an empty task board. Nothing asks for study hours, sleep or travel time, which the workload needs.
- There is no 404 page (unknown URLs bounce to `/`).

---

## 4. Research notes

What I looked up and what it changed in this plan. Most design sources are practitioner guidance rather than trials; I've said so where it matters.

- **Calm UI for stressed users.** Guidance converges on low-saturation palettes, less clutter, progressive disclosure, and reassuring non-clinical copy; harsh saturated colors are flagged as anxiety-inducing ([UXmatters, Designing calm UX](https://www.uxmatters.com/mt/archives/2025/05/designing-calm-ux-principles-for-reducing-users-anxiety.php), [UX Collective, Designing for mental wellness](https://bootcamp.uxdesign.cc/designing-for-mental-wellness-ui-ux-strategies-for-stress-free-digital-interactions-971e0db60300), [Biz4Group](https://www.biz4group.com/blog/best-practices-in-mental-health-design)). Changed: red off everyday UI, one question at a time in check-ins, shorter pages.
- **Result feedback.** A stress app described in the literature gives feedback right after the questionnaire built around three questions: what the result means, what to do, where to get help ([VUB, users' perceptions of a stress self-monitoring app](https://researchportal.vub.be/nl/publications/users-perceptions-of-a-personalized-stress-self-monitoring-applic/)). A content analysis of 61 mental health apps warns that apps can medicalize normal stress ([Annals of Family Medicine 2018](https://www.annfammed.org/content/16/4/338.full.pdf)). Changed: the result screen follows "what it means / what changes / one thing to do", and the owner's answer replaces "where to get help" with plan changes and encouragement.
- **Check-in apps students actually use.** How We Feel narrows from a broad state to a specific feeling, colors by intensity, and follows every check-in with strategies ([Yale Medicine](https://medicine.yale.edu/news-article/the-how-we-feel-app-helping-emotions-work-for-us-not-against-us/), [screensdesign](https://screensdesign.com/showcase/how-we-feel)). Finch ties small real-world self-care to a visible payoff ([screensdesign](https://screensdesign.com/showcase/finch-self-care-pet)). Changed: a check-in always ends with something visible changing (the plan), and finished tasks are acknowledged.
- **Streaks.** A systematic review found gamification in mental health apps is rarely grounded in behavior-change theory ([Cheng et al., JMIR Mental Health 2019](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6617915/)); commentary on consumer research reports that people who break a streak often quit ([The Decision Lab](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification)). Changed: no streaks or points; "done this week" counts work without punishing a gap.
- **Student stress interventions work.** An 8-week RCT of the Calm app with stressed undergraduates (PSS 14+) reduced stress ([JMIR mHealth 2019](https://pubmed.ncbi.nlm.nih.gov/31237569/)); an internet- and app-based stress program for students kept its effect at 3 months ([Harrer et al.](https://cris.fau.de/publications/222321778/)). Five minutes a day of exhale-focused "cyclic sighing" improved mood more than mindfulness meditation in a 30-day study ([Balban et al. 2023, Stanford summary](https://med.stanford.edu/news/insights/2023/02/cyclic-sighing-can-help-breathe-away-anxiety.html)). Changed: "one small thing to do" uses short, specific actions; a 1 to 5 minute breather is a stretch item.
- **Filipino undergraduates.** A six-university Philippine study found academic stressors were the main driver of distress ([RMRJ](https://rmrj.usjr.edu.ph/rmrj/index.php/RMRJ/article/view/714)). Supports keeping the app centered on workload, deadlines and exams rather than generic mood tracking.
- **Study techniques.** Practice testing and spaced practice are the only two "high utility" techniques in Dunlosky et al. 2013 ([APS](https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html)). Supports keeping Reviewers (practice questions) and giving it a top-level "Study" place.
- **WHO-5.** 50 or under is the usual screening cut-off for low well-being ([INSPQ](https://www.inspq.qc.ca/en/post-disaster-mental-health-impacts-surveillance-toolkit/standardized-measurement-instruments/information-sheets-standardized-measurement-instruments-recommended/well-being), [PsyToolkit](https://us.psytoolkit.org/survey-library/who5.html)). The app already uses under 50 in `isStrained`; keep it.
- **Mobile navigation.** Material guidance: 3 to 5 destinations in a bottom bar, a drawer only past 5 or 6; visible bottom bars suit task apps better than hidden menus ([Material Components](https://chromium.googlesource.com/external/github.com/material-components/material-components-ios/+/v55.5.0/components/BottomNavigation/README.md), [Uxcel](https://uxcel.com/lessons/navigation-678)). Changed: 5 destinations, bottom bar on phones.
- **Philippine crisis lines** (for the "Talk to someone" placeholders in section 8; the owner verifies them): NCMH Crisis Hotline 1553 (24/7, English and Filipino), Hopeline, In Touch ([findahelpline: NCMH](https://findahelpline.com/organizations/ncmh-crisis-hotline), [The Beat Asia list](https://thebeat.asia/manila/ohana/health-wellness/mental-health-helplines-apps)). Numbers differ between directories; confirm with NCMH before publishing. I couldn't find an OLFU Guidance office contact online ([OLFU contact page](https://www.fatima.edu.ph/contact-us/) lists only admissions, registrar and concierge).
- **Visual references.** Dribbble searches for "mental health app dashboard", "student wellbeing app" and "study planner app": the good ones use one check-in row at the top, soft tinted cards with a single focus each, and big rounded type for the one number that matters. The study-planner results are mostly purple gradients with 3D robot mascots, which is exactly the templated look to avoid.

---

## 5. New structure

### Navigation (5 places)

| Place | Label | Icon (lucide) | Route | What lives there |
|---|---|---|---|---|
| 1 | Today | `House` | `/dashboard` (URL unchanged) | What's next, is the week okay, one next step |
| 2 | Schedule | `CalendarDays` | `/schedule` | Week, Tasks, Days off (tabs) |
| 3 | Study | `BookOpenCheck` | `/reviewers` (URL unchanged) | AI reviewers and Learning Mode |
| 4 | People | `Users` | `/groups` (URL unchanged) | Groups, Friends (tabs) |
| 5 | Me | `CircleUser` | `/profile/:id` (URL unchanged) | Profile, your week, appearance, notifications, privacy, help, sign out |

Plus a **bell** (`Bell`, unread count) that opens `/notifications`, and **Wellbeing** (`/wellbeing`, new), reached from the Today "This week" card and from Me.

- **Laptop (over 720px):** left sidebar, 232px, with the 5 places. At the bottom of the sidebar: the bell with its count, then the student's avatar and first name (links to Me). Group labels (Plan / Together / You) go away; 5 items don't need them.
- **Phone (720px and under):** a 56px top bar (logo on the left linking to Today, bell and avatar on the right) and a bottom bar with the 5 places, icons with labels, at least 48px tall plus `env(safe-area-inset-bottom)`. The icon rail goes away. The Guide button moves up to sit above the bottom bar.
- **Footer:** signed-in pages get a one-line footer (copyright, Privacy, Terms, Help). The full footer stays only on public pages (sign-in, About, legal).

### Routes

| Old | New | Note |
|---|---|---|
| `/dashboard` | same, labelled "Today" | Content changes (section 6) |
| `/schedule` | opens the **main schedule** directly | The list of all schedules moves to `/schedule?view=all`. `?s=`, `?task=new`, `?code=` keep working. |
| `/schedule?s=<id>` | adds `&tab=` with `week`, `tasks` or `days-off` | Default tab is `week` |
| `/reviewers` | same, labelled "Study" | |
| `/groups` | adds `?tab=` with `groups` or `friends` | `?g=<id>` still opens a chat |
| `/friends` | redirect to `/groups?tab=friends` | |
| `/profile/:id` | Me (own) / public profile (others) | Sections, not tabs, on one page |
| `/settings` | redirect to own profile, `#appearance` | |
| `/notifications` | same, opened from the bell | Preferences move to Me (`#notifications`), the page links there |
| (none) | `/wellbeing` | New |
| `/about` | same, rewritten, public | |
| `*` | `NotFound` page | Instead of bouncing to `/` |

---

## 6. Page by page

Order is top to bottom on a phone. On a laptop, sections may sit in two columns where noted.

### Today (`/dashboard`)
Goal: under about 2,400px tall on a 375px phone with the seeded account (it's 10,792 now).

1. **Check-in banner** (only when one is due). Same rules as now, compact: one line of text, "Start" and "Not today".
2. **Greeting** and the one-line day summary (keep `summarizeDay`).
3. **Today panel** (keep `buildFocus`): happening now, later today, due soon (max 3, "+N more" links to Schedule > Tasks), next exam as one wrapped line, tomorrow in the evening. Actions: "Add task", "Open schedule".
4. **This week card** (the one bold navy surface on the page): band in words ("Full week"), the one-sentence message, the top two reasons in words ("Mostly deadlines: 3 tasks due by Thursday"), and "See what's behind this" linking to `/wellbeing`. **No number here.** The ring stays but shows only the word, colored teal for Light and Steady, amber for Full and Too much (never red).
5. **Next step card**: exactly one thing, the first that applies:
   - new student: the setup checklist (below);
   - after 6 PM with an early class tomorrow: the bedtime suggestion (section 7.2);
   - the top move suggestion ("Move 'Chapter 3 draft' to Wed", Move it / Not now);
   - otherwise the top guidance tip.
6. **Week strip**: the existing chart in a compact form (7 thin columns, no legend), tasks that don't fit shown amber. Tapping it opens `/wellbeing#week`.
7. **Done this week**: one small line, "You've finished 4 tasks this week." Hidden when it's 0.

Removed from Today: the full task board, the import form, the 7-day study plan (to Schedule > Tasks), the driver bars, the full chart, the other tips and suggestions (to Wellbeing).

**New student setup checklist** (replaces the "Add your first task" hero; each row ticks itself off from real data, and the card disappears when all four are done or the student hides it):
1. Add your classes (opens the schedule, Add > Class)
2. Tell us about your week: study hours a day, sleep hours, usual bedtime and wake time, travel time (an inline form on the card, saves to `PUT /api/user/profile`)
3. Take your first check-in (PSS-10)
4. Add a task

### Wellbeing (`/wellbeing`, new)
"How you're doing", with the detail Today leaves out.
1. Header: band in words, the message, then "Workload score 84 of 100" in muted text.
2. **What's shaping your week**: the driver list from Today (keep `parts`), each with a word and a sentence, not just a bar.
3. **Your week** (`#week`): the full chart and legend (moved from Today).
4. **What to focus on**: all tips, max 5 (moved).
5. **Ideas to lighten the week**: `SuggestionsPanel` (moved; the top one also shows on Today).
6. **Check-ins**: one card each for stress (PSS-10) and well-being (WHO-5): when last taken, a plain-language reading (section 7.1), the score in small muted text with its scale, when it's due again, "Take it" / "Retake", and the last 5 results as a small list with dates (new endpoint, section 10).
7. **Sleep**: your target, usual bedtime and wake time, tonight's suggested bedtime if there's an early class (section 7.2).
8. **How this works** (collapsed by default): what goes into the score, in plain words, with the PSS-10 and WHO-5 citations. Good for the thesis panel.

### Schedule (`/schedule`)
- Opens the main schedule. The header has the schedule title with a switcher (main, extras, shared with you, "All schedules", "New extra schedule"). A student with no schedule sees the existing empty state with "Create your schedule".
- **Tabs: Week | Tasks | Days off.**
  - Week: the current week grid, unchanged in function.
  - **Tasks** (new home of the task board): Open / Done filter, sorted by due date. Each task is a compact row: a round "done" checkbox on the left, title, course, a due chip ("Tomorrow", "Overdue" in red, "Fri" otherwise), hours, and an overflow menu (Edit, Share code, Delete). The 7-day study plan sits beside the list on a laptop and under a "Your study plan" disclosure on a phone. "Add from code" (the 6-digit import) is a button here and in the Add menu.
  - Days off: the holiday calendar (moved out from under the week).
- The page hero goes away. Owner-only controls stay where they are.

### Study (`/reviewers`)
- Compact page header ("Reviewers", one-line description, "Upload a PDF" on the right).
- Fix the list card so the title gets the full card width.
- Everything else stays.

### People (`/groups`)
- Compact header with "Create group" and "Join with a code". **Tabs: Groups | Friends.**
- Groups tab: the current group cards. The chat view is unchanged except the composer padding fix.
- Friends tab: your friend code (the old "profile tag") with Copy, "Add a friend" as a real form, requests with Accept and Decline, sent requests with Cancel (server part is system-review Batch 8), the friends list **without emails**. No cats.

### Me (`/profile/:id`, own)
One page of sections with an in-page index at the top on a laptop:
1. **You**: photo (existing `PictureField`), friend code with Copy, and the profile fields: name, program (select: "BS Information Technology" or "BS Computer Science", section 8), bio (200). Always editable, one Save button, a success toast.
2. **Your week** (the numbers the planner uses): study hours a day, sleep hours, usual bedtime, usual wake time, travel time on school days, and "How should we pace you?" (the wellbeing goal: Lighter, Balanced or Fuller pace, with the one-line hints from section 8). Always editable, its own Save button, a success toast. No Edit mode anywhere.
3. **Appearance** (`#appearance`): Light / Dark / Match my device.
4. **Notifications** (`#notifications`): the existing `NotificationPreferences` component, moved here.
5. **Check-ins**: a short line with the last dates and a link to Wellbeing.
6. **Privacy and data**: an accurate paragraph (text in system-review B2), links to the Privacy Policy and Terms, and "Ask us to delete your account" as a mailto to the support emails.
7. **Help and more**: "Each page has a Guide button (bottom right)", links to About, support emails, and the "Talk to someone" block with the contacts from `helpContacts.js` (section 8; placeholders until the owner fills them in).
8. **Sign out**.

Removed: "Auth Provider", "Account Verified", the Profile & Capacity hero, emoji headings. Another student's profile (`PublicProfile.jsx`) only gets the new page header.

### Notifications (`/notifications`)
- Compact header with "Mark all read" and "Clear all" (clear all in the overflow menu, it's destructive).
- Items grouped "Today" and "Earlier". Read/delete become small quiet icon buttons (44px tap area), not black circles. Unread items get a left dot, not an orange fill.
- "Notification settings" links to Me `#notifications`.

### Sign-in (`/`)
- Headline about the student's week, not "group work". Suggested: **"See your week clearly and keep it manageable."** Body: "StressCare puts your classes, deadlines and quick check-ins together, then helps you spread the work so no day is too much. Made for OLFU IT students."
- Three plain points with icons (not button-shaped chips): "Your timetable and deadlines in one week", "A plan that moves work off your heaviest days", "Practice questions from your own notes".
- On a phone the form comes first, under a one-line headline.
- "Forgot password?" (system-review Batch 2) under the password field.

### About (`/about`, public)
Rewrite to match the app: what StressCare is (one paragraph), how it works in 4 steps (classes, tasks, check-ins, a plan), the workload score (the real bands and inputs, check-in validity windows, PSS-10 and WHO-5 with citations), what it isn't (not a diagnosis or treatment), who made it (a placeholder line until the owner gives names: "Made by [team member names] as a thesis project at Our Lady of Fatima University"; **never invent names**), contact.

### 404
"This page doesn't exist." plus a link to Today (or to sign-in when signed out).

---

## 7. What happens after a check-in (owner's answer, specified)

The PSS-10 and WHO-5 dialogs become a stepper: one question per screen with the five (or six) answers as big tappable rows, a progress bar, Back, and auto-advance on pick. Closing with answers started asks first (system-review B7). The last step is "See what changes", which submits and shows the result screen in the same dialog.

### 7.1 Result screen

Four blocks, in this order, all built from data the app already has. Pure function `buildCheckInResult()` in `client/src/utils/checkinResult.js`.

1. **What it means** (one sentence, no clinical label):
   - PSS-10, 0 to 13: "Your stress has been on the lower side this past month."
   - PSS-10, 14 to 26: "You've had a fair amount of stress this past month."
   - PSS-10, 27 to 40: "This past month has been a lot."
   - WHO-5, over 50: "You've been feeling mostly okay lately."
   - WHO-5, 29 to 50: "Your energy and mood have been lower than they could be."
   - WHO-5, 28 or under: "The last two weeks have been hard."
   - If there's an earlier result, add the direction: "That's better than last time." / "That's about the same as last time." / "That's harder than last time."
   The score itself shows small and muted under the sentence ("PSS-10: 22 of 40").
2. **What we changed in your plan** (only what's true):
   - When the student is now strained (`isStrained`), the top `suggestMoves` result with "Move it" and "Not now", reusing the dashboard's apply and undo code.
   - "We'll warn you sooner when a day gets full" when strained, since strained already lowers the move threshold.
   - Nothing to move: "Your week fits as it is. We'll keep an eye on it."
3. **One thing for today** (pick one):
   - Early class tomorrow and the computed bedtime is earlier than the usual bedtime: the bedtime suggestion (7.2).
   - High PSS: "Pick the smallest task and give it 25 minutes. Then stop." (Later: "Take a 5-minute breather", see Parked.)
   - Low WHO-5: "Put one thing you enjoy in your week, even 30 minutes."
   - Otherwise: "Keep your sleep and meals steady this week."
4. **Encouragement** from real data, never invented:
   - Tasks finished in the last 7 days > 0: "You've finished 4 tasks this week. That counts."
   - An exam passed in the last 7 days: "You got through [exam title]. Give yourself some credit."
   - Neither: "Checking in is a good step. Let's make this week lighter."
   - High stress or low well-being adds: "You don't have to fix the whole week today."

"Done" closes the dialog and refreshes Today. The banner disappears.

### 7.2 Bedtime suggestion

Pure function `sleepPlan()` in `client/src/utils/sleepPlan.js`:
- Inputs: tomorrow's first class or exam start, `travelMinutesPerDay` (one way assumed to be half), a fixed 60 minutes to get ready, `sleepHours` (target), `usualSleepStart`.
- `wake = firstStart - travel/2 - 60min`, `bedtime = wake - sleepHours`.
- Show it when tomorrow has a class or exam and `bedtime` is earlier than `usualSleepStart` (or when the student has no usual bedtime set): "Your first class tomorrow is at 7:30 and it takes you about 30 minutes to get there. To get 7 hours, be in bed by 10:30."
- Shown on Today's Next step card after 6 PM, on the result screen (7.1), and in the Wellbeing Sleep section. This uses the bedtime and wake fields that are collected but unused today (system-review R5/D2: keep them, now they have a use).

### 7.3 Encouragement elsewhere
- Marking a task done shows a short toast from a small fixed list ("Done. One less thing.", "Nice, that's off your plate.", "Finished. Take a breath before the next one."). No emoji.
- "Done this week" line on Today (7 days back, from `completedAt`, section 10).
- Never: streaks, "you missed X days", confetti, points.

---

## 8. Decisions

### Decided
- **Audience is OLFU IT students only** (owner, 2026-10-12).
- **Bad check-in results lead to plan changes, a specific recommendation and encouragement**; scores are for the system to know the student, not a diagnosis (owner, 2026-10-12). Specified in section 7.
- **Under 3 weeks**: must-have core only, rest parked (owner, 2026-10-12).
- **Keep the sleep fields and use them** for the bedtime suggestion (follows from the owner's answer; settles the "keep or remove" half of system-review R5/D2).
- **Revamp structure, content and color roles; keep the visual identity.** Slate and navy surfaces, red brand mark, Karla. Reason: 3 weeks, and the owner already reverted one full palette change (commits `405f65d`, `fa649bb`). (Opus, delegated)
- **Plain CSS with tokens, no Tailwind.** Tailwind was never wired up and system-review R2 removes it. This replaces pass 3 ("apply Tailwind") of the global frontend pipeline for this project: apply the tokens in section 11 instead. (Opus, delegated)
- **No new UI libraries.** lucide-react for icons, react-toastify for toasts, nothing else. The global pipeline's pass 2 (Figma, Stitch, component libraries) is skipped: there's no Figma file, and 3 weeks doesn't allow re-platforming components. Ask the owner before adding any package. (Opus, delegated)
- **URLs stay** (`/dashboard`, `/reviewers`, `/groups`, `/profile/:id`); only labels change. Old links in notifications and chats keep working. (Opus, delegated)
- **Numbers one tap deeper**: Today shows words only; Wellbeing shows the workload score and check-in scores. (Opus, delegated, follows the owner's "scores are for the system")
- **Fraunces only for page titles (h1) and the Today greeting**; everything else, including panel titles, in Karla. The app is a tool; a display serif on every card title reads as decoration. (Opus, delegated)

Answered by the owner on 2026-10-12 (these were the Open list):
- **Student-facing band names** (owner: "you suggest"): "Light week", "Steady week", "Full week", "Too much this week" on screen. The code and the thesis keep Light/Moderate/Heavy Workload and Critical Overload: add a display map (`BAND_LABEL` in `workload.js`) and rename nothing, since `isStrained` and the tests compare the internal names.
- **Red off buttons and labels** (owner: "sure, fix the restored red"): navy (`--accent`) for primary and secondary actions, slate (`--text-muted`) for kickers, red (`--brand`, `--danger`) only for the logo, the active nav marker, overdue, delete and errors. "Doesn't fit" and Full weeks use amber (`--watch`).
- **"Talk to someone" line, with placeholders** (owner will look up the details). One short block in Me > Help and More (section 6), never on result screens: "If things feel like too much, you don't have to handle it alone. You can reach:" followed by the contacts. All contact text lives in one file, `client/src/utils/helpContacts.js`, as a list of `{ name, detail }`. Until the owner fills it in, `detail` shows a visible placeholder such as "[Contact details to be added]". **Never fill in numbers yourself.** For the owner to verify (put these in a code comment, not on screen): NCMH Crisis Hotline 1553 (24/7, English and Filipino); OLFU Guidance and Counseling Office (contact not found online).
- **Wellbeing goal** (owner: wellbeing first, but formal). This also settles system-review B3. Labels and effect on the score (internal values stay `catch-up`, `steady`, `high-performance`):
  - "Lighter pace": "Flags a heavy week sooner. Good when you're catching up or worn out." Adds +10 to the score, so warnings come earlier.
  - "Balanced pace" (default): "The standard reading." No change.
  - "Fuller pace": "Allows a busier week before flagging it." Subtracts 10, **but only while the latest fresh check-ins aren't strained** (PSS under 27 and WHO-5 at 50 or more, or no fresh check-in). When a check-in says the student is struggling, the app stops allowing the heavier load. Tip text in `buildTips` matches this. Done in FE-4.
- **Privacy Policy** (owner: yes): list sleep target, usual bedtime and wake time, travel time, task completion times and check-in history in "What we collect", and bump `LEGAL_VERSION` (`server/utils/legal.js`) and `LEGAL_UPDATED` (`legalContent.js`), so everyone re-accepts once. Done in FE-5, after FE-3 adds `completedAt`. Settles system-review D2.
- **Program list** (owner: "you tell me"): a select with "BS Information Technology" (default) and "BS Computer Science", the two degrees OLFU's College of Computer Studies lists ([OLFU programs](https://fatima.edu.ph/category/programs/college/page/2)). If a student's saved program is anything else, keep it as an extra option so nothing is lost.
- **Team names on About**: placeholder for now ("Made by [team member names] as a thesis project at Our Lady of Fatima University"). Never invent names.

### Open (owner)
None right now. New questions go here, with a recommendation and what they block.

**Placeholders the owner fills in before the panel:** the contacts in `client/src/utils/helpContacts.js` (OLFU Guidance office, crisis line), and the team names on the About page. FE-6 lists any placeholder still showing.

### Considered and rejected
- **A new visual identity** (the sage, ochre and clay palette, or anything else). Owner reverted it once; not worth the risk in 3 weeks.
- **Tailwind or a component library** (shadcn, Aceternity, Magic UI). Migration cost with no time to absorb it.
- **Streaks, points, a virtual pet.** Adds pressure; see research notes.
- **Hotlines or counselor alerts on result screens.** Owner chose plan changes and encouragement; contacts only appear in Me > Help and More.
- **Clinical labels** ("High Stress", "Very Poor Well-being") anywhere a student sees them.
- **A separate Tasks page in the navigation.** Tasks belong with the week they're due in.
- **A multi-step onboarding wizard.** A skippable checklist on Today does the same job and never blocks the app.
- **An AI chat companion.** Out of scope and a safety risk without clinical oversight.
- **Splitting `App.css` into files now.** Worth doing, not in 3 weeks (parked).

---

## 9. The next three weeks

Assumes the panel is around Nov 1, 2026; slide the dates if it isn't. "SR" means a batch in `system-review.md`. Server-only SR batches can run in the same week as frontend work (different files).

| Week | Frontend (this plan) | system-review alongside |
|---|---|---|
| **1** (Oct 12 to 18) | FE-1 Foundations and shell, FE-2 Today and Schedule tasks | SR Batch 1 (auth hardening, Opus review), SR Batch 3 (server checks; S5 server-side survey scoring matters before check-in results ship) |
| **2** (Oct 19 to 25) | FE-3 Check-ins and Wellbeing, FE-4 Me, People, Notifications | SR Batch 7 (shared Modal) **before** FE-3, SR Batch 5 (session expiry, Opus review), SR Batch 4 (task share tags), SR Batch 8 server part with FE-4 |
| **3** (Oct 26 to Nov 1) | FE-5 Public pages, FE-6 QA, a real phone pass with the owner | SR Batch 2 (forgot password) inside FE-5, SR Batch 11 (code splitting) if time, SR Batch 10 (delete-user script) if time |

FE batches absorb these SR items, so don't do them twice: Batch 9 (dark surfaces) goes into FE-1; Batch 6 items B2, B3, B10, B11, B17 and R6 go into FE-2 and FE-4; R5 and D2 (Privacy Policy) go into FE-5; Batch 8 UI goes into FE-4; Batch 2 goes into FE-5.

Must-have core (if time runs out, stop after these): FE-1, FE-2, FE-3, FE-6, plus SR Batches 1, 2, 3, 7.

---

## 10. Small server changes the new screens need

1. **`completedAt` on tasks.** `taskModel`: `completedAt: Date, default null`. `updateTask`: set it to now when `isCompleted` goes from false to true, clear it when it goes back. Test in a task test file (create, complete, reopen). Used by "done this week" and the result screen.
2. **`GET /api/surveys/history`.** Returns the caller's last 5 PSS and last 5 WHO results (`score`, `createdAt`), newest first, from `PSSResponse` / `WHOResponse`. Owner only (from the token). Test in `server/tests/survey.test.js` (created by SR Batch 3, or create it).
3. Nothing else. The bedtime suggestion, result screen and encouragement are client-side from data already sent.

---

## 11. Design system (what changes in `client/src/App.css`)

Keep the existing token names so nothing breaks; add the role tokens below at the top of `:root` and `.dark-theme`, then point components at the roles.

### Color roles

| Role | Light | Dark | Used for |
|---|---|---|---|
| `--bg-app` | `#f8fafc` (keep) | `#0b1220` | Page background (also on `body`, see SR B15) |
| `--surface` | `#ffffff` | `#131b2c` | Panels, cards, dialogs |
| `--surface-2` | `#f1f5f9` | `#1b2539` | Inset areas, inputs, the bold card in dark mode |
| `--border` | `#e2e8f0` | `#263248` | Card and input borders (today's are near-invisible) |
| `--text-primary` | `#0f172a` | `#e8edf5` | Body and headings |
| `--text-secondary` | `#475569` | `#a7b1c2` | Descriptions |
| `--text-muted` | `#5b6b7f` | `#8c97aa` | Kickers, timestamps, small numbers |
| `--accent` | `#14213d` | `#c7d2fe` | Primary buttons, links, selected tab, focus ring |
| `--on-accent` | `#ffffff` | `#0b1220` | Text on `--accent` |
| `--accent-soft` | `#e6eaf2` | `#1f2a44` | Secondary buttons, selected chips, hover |
| `--brand` | `#dc2626` | `#f87171` | Logo wordmark, active nav marker. Nothing else. |
| `--good` / `--good-soft` | `#0f766e` / `#ccfbf1` | `#5eead4` / `#123c39` | Done, on track, Light and Steady weeks |
| `--watch` / `--watch-soft` | `#92400e` / `#fef3c7` | `#fcd34d` / `#3d2e0a` | Full week, doesn't fit, due soon |
| `--danger` / `--danger-soft` | `#b91c1c` / `#fee2e2` | `#fca5a5` / `#451a1a` | Overdue, delete, errors |
| `--hero-bg` / `--hero-text` | `#14213d` / `#e8edf5` | `#1b2539` / `#e8edf5` | The one bold card on Today |

Measured contrast (WCAG, 2026-10-12): every text pair above is 4.5:1 or better on every surface it's meant for. Lowest in light mode: `--text-muted` on `--accent-soft` 4.52, `--brand` on `--surface` 4.83, `--good` on `--good-soft` 4.86, `--text-muted` on `--surface-2` 4.97. Lowest in dark mode: `--text-muted` on `--accent-soft` 4.84; the rest are 5.2:1 or better. This also fixes the two known dark-mode gaps in CLAUDE.md (secondary text 4.04, kicker 3.74). Re-measure any new pair before using it.

Mapping from today's tokens: `--sage` (red today) becomes `--accent` for actions and `--text-muted` for kickers; `--ochre` (red today) becomes `--accent` (peer touches no longer need their own color); `--clay` becomes `--danger`; `--sage-deep` becomes `--hero-bg`. Schedule themes (`[data-sched-theme]`) stay as they are.

### Type
- `--font-ui: "Karla", system-ui, sans-serif` everywhere; `--font-display: "Fraunces", Georgia, serif` only for `h1` page titles and the Today greeting. Replace the hard-coded Karla and Fraunces `font-family` lines (about 9; the monospace ones stay) with these.
- Fixed rem scale (ratio about 1.2, no clamp): `--text-xs 0.8125rem` (13px, the floor), `--text-sm 0.875rem`, `--text-md 1rem`, `--text-lg 1.125rem`, `--text-xl 1.375rem`, `--text-2xl 1.75rem`, `--text-3xl 2.25rem` (greeting and h1 on a laptop; `--text-2xl` on a phone).
- Kickers: `--text-xs`, weight 600, `--text-muted`, sentence case. Panel titles: `--text-xl`, Karla 700.
- Buttons and labels in sentence case ("Add task", not "Import Task").

### Space, shape, depth
- Spacing (4px base): `--space-1 4px`, `--space-2 8px`, `--space-3 12px`, `--space-4 16px`, `--space-5 24px`, `--space-6 32px`, `--space-7 48px`. Panel padding `--space-5` (laptop) / `--space-4` (phone). Gap between sections `--space-5`.
- Radius: `--radius-sm 8px` (inputs, chips, small buttons), `--radius-md 12px` (rows and cards inside panels), `--radius-lg 16px` (panels, dialogs), `--radius-pill 999px`. Replace the 10, 14 and 20px values.
- Shadows: `--shadow-1` (panels: a 1px border plus a very soft shadow), `--shadow-2` (menus, dialogs, the bottom bar). Nothing else.

### Components (new or changed)
- `components/layout/Header.jsx`: becomes the shell: laptop sidebar (5 places, bell, user chip) and, under 720px, the top bar plus bottom bar. Keep it rendered per page as now (no router layout refactor).
- `components/layout/Footer.jsx`: `variant="app"` renders the one-line footer; public pages keep the full one.
- `components/PageHeader.jsx` (new): back link (optional), kicker (optional), title, one-line description, actions on the right (they wrap under the title on a phone). Replaces every `.hero` + `.hero-panel` pair except Today.
- `components/Tabs.jsx` (new): accessible tablist (`role="tablist"`, arrow keys), synced to a `?tab=` query param.
- `components/EmptyState.jsx` (new): icon, one sentence, one action.
- `components/Modal.jsx`: from SR Batch 7. Check-ins and every new dialog use it.
- Buttons: `.primary-button` (filled `--accent`), `.secondary-button` (`--accent-soft` fill, `--accent` text), `.ghost-button` (no fill, `--accent` text), `.danger-button` (new, `--danger`). Icon buttons: 44px tap area, quiet by default, never black circles.
- Status chips: one `.chip` with tone modifiers (`is-good`, `is-watch`, `is-danger`, `is-neutral`).

### Motion
Keep the existing polish-pass motion and its `prefers-reduced-motion` guard. Add only: bottom-bar active item transition (150ms), stepper slide between check-in questions (200ms, opacity plus 8px), and the result screen's blocks rising in one after another. Nothing loops except the existing ring breathing.

### Copy rules
- Plain, warm, short. Second person. Contractions. No em-dashes, no "not just X, it's Y", no exclamation marks in a row, no emoji (global rule).
- Never "Critical", "High Stress", "Very Poor". Never "you failed" or "you missed".
- Every warning has a next step in the same block.
- Renames: "Import Task" to "Add from code", "Task tag" to "Share code", "Profile Tag" to "Friend code", "Logout" to "Sign out", "Submit Survey" to "See what changes", "Reviewers" nav to "Study", "Dashboard" nav to "Today".

---

## 12. Work list for Sonnet

### Rules for every batch
1. Start each session by reading `CLAUDE.md`, `handout.md`, this file and `mobile-rules.md`. Every UI change is done for phones in the same change: check at 320, 375, 768 and 1280px, light and dark (`mobile-rules.md` has how).
2. This file is the frontend plan, so the global planning gate is satisfied. Don't ask design questions; follow sections 6, 7 and 11. If you hit an **Open** item from section 8, ask the owner in one short question and carry on with the rest. When the owner answers, move it to Decided here.
3. One branch per batch, named below. Git rules from the global CLAUDE.md: no `Co-Authored-By` or `Claude-Session` lines; when moving to the next batch, commit, push and merge the finished one into `main`; never delete branches.
4. Use the installed skills on UI work: `impeccable` (`adapt` for phone layouts, `clarify` for copy, `distill` for the Today page, `polish` at the end of each batch, and `C:/Users/radri/.claude/skills/impeccable/scripts/impeccable detect --json <changed files>` once per batch). `PRODUCT.md` in the project root has the product context it asks for. Treat this as an established visual world: don't run Impeccable's concept-seed or direction rounds, and don't write a DESIGN.md until FE-6.
5. Never start test servers on port 5000. For UI checks, use the in-memory harness described in `handout.md` (Gotchas): API on 5070, Vite on 5174, a seeded student plus a brand-new account.
6. `npx vite build` in `client/` must pass; lint must not get worse. Server changes get tests in `server/tests/` and `npm test` must pass. New pure utils in `client/src/utils/` get tests in `server/tests/` (the client has no runner; `workload.guidance.test.js` shows how to import client utils).
7. When sections move, update the Guide steps in `client/src/utils/tours.js` and the `data-tour` attributes so every step still finds its section.
8. Tick the boxes below as items land, and update CLAUDE.md for anything that changes how the app behaves.

### FE-1 `design/tokens-and-shell` (Week 1)
- [ ] **1. Tokens.** Add the role, type, space, radius and shadow tokens from section 11 to the top of `App.css` (`:root` and `.dark-theme`). Replace the hard-coded Karla and Fraunces `font-family` lines with `--font-ui` / `--font-display`. Include SR Batch 9 (B15): inline theme script in `client/index.html`, `color-scheme` on `:root` and `.dark-theme`, `body` background from `--bg-app`, and remove the red gradient from `index.css`.
- [ ] **2. Color roles.** Point buttons, kickers, chips, links, the workload ring and the chart's "doesn't fit" at the new roles. Red is left only on the logo, the active nav marker, overdue, delete and errors. Re-measure any text pair you introduce (4.5:1 minimum).
- [ ] **3. Shared components.** `PageHeader`, `Tabs`, `EmptyState` (section 11). Buttons and `.chip` as described.
- [ ] **4. Shell.** Rebuild `Header.jsx`: 5 places, bell with count, user chip, and under 720px a top bar plus a bottom bar (labels, 48px plus safe area). Move the Guide button above the bottom bar. Remove the icon rail and the group labels. `Footer variant="app"` on signed-in pages.
- [ ] **5. Routes.** `/friends` redirects to `/groups?tab=friends`, `/settings` to the own profile `#appearance`, unknown paths render `NotFound.jsx` (section 6).
- [ ] **6. Check.** Every page at 320/375/768/1280, light and dark: no horizontal scroll, nothing hidden under the bottom bar, the Guide button clear of the bar and of Learning Mode's Submit.

### FE-2 `redesign/today` (Week 1)
- [ ] **0. One place for the week maths.** Today, Wellbeing and Schedule > Tasks all need the same data (profile, tasks, week overview, `buildWeek`, `computeWorkload`, survey status). Extract the loading and calculations from `Dashboard.jsx` into a `useWorkload()` hook (`client/src/utils/useWorkload.js`) and use it in each. Read the profile from `AuthContext`'s `userData` instead of fetching `/api/user/data` again (SR R7); refresh it with `getUserData()` after a check-in or a profile save.
- [ ] **1. Tasks move to Schedule.** Add the Week | Tasks | Days off tabs to the open schedule (`Schedule.jsx`, `?tab=`). Move `TaskBoard` and the import-by-code form into Tasks as they are for now; move the holiday calendar into Days off. Make `/schedule` open the main schedule, and the old list `/schedule?view=all` (section 5).
- [ ] **2. Task rows.** Rework `TaskBoard.jsx` into the compact rows from section 6 (done checkbox, due chip, overflow menu with Edit, Share code, Delete). Remove the numeric score and "Created on". The 7-day study plan sits beside the list on a laptop, in a disclosure on a phone. Done shows an encouraging toast (7.3). Include SR B11: task actions toast on failure, and "Moved... Undo" only after a successful move.
- [ ] **3. Today.** Rebuild `Dashboard.jsx` in the order from section 6: banner, greeting, Today panel, This week card (words, two reasons, link to `/wellbeing`, ring in teal or amber, no number, band names from `BAND_LABEL` in section 8), Next step card (one item, rules in section 6), compact week strip (`WorkloadChart compact`), done-this-week line (after FE-3 adds `completedAt`; hide until then). Fix the next-exam wrap (SR B17). Remove `isExamWeek` (SR R6) while you're in there.
- [ ] **4. Setup checklist** for new students (section 6), replacing the welcome hero. The "Your week" mini form saves to `PUT /api/user/profile`.
- [ ] **5. Bedtime suggestion.** `client/src/utils/sleepPlan.js` (section 7.2) with tests in `server/tests/sleepPlan.test.js` (early class, no class, no usual bedtime, travel 0, midnight wrap). Wire it into the Next step card after 6 PM.
- [ ] **6. Check.** Today with the seeded account is under about 2,400px tall at 375px. New account shows the checklist. Update the dashboard Guide steps.

### FE-3 `feature/checkin-results` (Week 2, after SR Batch 7's `Modal` and SR Batch 3's S5)
- [ ] **1. Server.** `completedAt` on tasks and `GET /api/surveys/history` (section 10), with tests.
- [ ] **2. Stepper.** Rebuild `PSSSurveyModal.jsx` and `WHOSurveyModal.jsx` on `Modal`: one question per screen, big answer rows, progress, Back, auto-advance, confirm before closing with answers started, citation kept on the first screen. Same scoring and payload as now.
- [ ] **3. Result screen.** `client/src/utils/checkinResult.js` (`buildCheckInResult`, section 7.1) with tests in `server/tests/checkinResult.test.js` (each band for both scales, better/same/worse, strained with and without a suggestion, encouragement with and without finished tasks). Render it as the dialog's last step. "Move it" reuses the dashboard's apply and undo.
- [ ] **4. Wellbeing page.** `pages/Wellbeing.jsx` at `/wellbeing` with the 8 sections from section 6, built on `useWorkload()`, moving the drivers, full chart and tips out of `Dashboard.jsx` and `SuggestionsPanel` into its own file (`components/SuggestionsPanel.jsx`; Today keeps showing only its first item), and the survey cards out of `Profile.jsx`. Check-in history from the new endpoint. Add a Guide for it in `tours.js`.
- [ ] **5. Done this week** on Today from `completedAt` (7.3).
- [ ] **6. Check.** Take both check-ins with the seeded account and a new one, on a phone and a laptop, light and dark. A stray tap outside no longer loses answers.

### FE-4 `redesign/me-and-people` (Week 2)
- [ ] **1. Me.** Restructure `Profile.jsx` into the sections from section 6. Inline-editable "Your week" with one Save and a toast; on success call `getUserData()` so the sidebar name updates (SR B10). Appearance with Light / Dark / Match my device (add `setTheme` and a `system` mode to `ThemeContext.jsx`, following `prefers-color-scheme`; SR B2). Move `NotificationPreferences` here. Accurate Privacy and data text (SR B2). Remove Auth Provider, emoji, the hero. Program becomes the two-option select from section 8. Add `client/src/utils/helpContacts.js` with placeholder details and render the "Talk to someone" block in Help and more (section 8; never fill in real numbers).
- [ ] **1b. Pace (SR B3).** Relabel the wellbeing goal to Lighter / Balanced / Fuller pace with the hints from section 8. In `computeWorkload` (`workload.js`): `catch-up` adds +10, `high-performance` subtracts 10 only when the fresh check-ins aren't strained (PSS under 27 and WHO-5 at 50 or more, or none fresh). Make the two tips in `buildTips` say the same thing. Update `server/tests/workload.guidance.test.js` (both directions, and Fuller pace ignored when PSS is 27+), tick B3 in `system-review.md`, and fix the "Workload score" section of CLAUDE.md.
- [ ] **2. Settings.** Delete `pages/Settings.jsx` once the redirect from FE-1 is in.
- [ ] **3. People.** `/groups` gets the Groups | Friends tabs. Move the Friends page body into the Friends tab (extract it from `Friends.jsx`), with the friend code, a real add-friend form, Decline and sent requests (SR Batch 8 server part first), no emails, no cats, react-toastify only (SR R13). Fix the chat composer padding on phones.
- [ ] **4. Notifications.** `PageHeader`, Today / Earlier groups, quiet icon actions, "Clear all" in an overflow menu with `ConfirmDialog`, link to Me `#notifications`.
- [ ] **5. Check.** All four views on a phone and a laptop, light and dark. Update Guide steps where sections moved.

### FE-5 `redesign/public-pages` (Week 3)
- [ ] **1. Sign-in.** New copy and layout (section 6), form first on phones, Forgot password (SR Batch 2, if not already merged).
- [ ] **2. About.** Rewrite (section 6). Use the team-names placeholder from section 8.
- [ ] **3. Study.** `PageHeader` on Reviewers, fix the list card title width.
- [ ] **4. Remaining headers.** Swap any `.hero` left (Schedule list view, PublicProfile, legal pages if needed) for `PageHeader`. Remove CSS for the old hero panels only where nothing uses them (search first).
- [ ] **5. Privacy Policy** (section 8, needs FE-3's `completedAt` merged first). In `client/src/pages/legal/legalContent.js`, add sleep target, usual bedtime and wake time, travel time, task completion times and check-in history to "What we collect". Bump `LEGAL_VERSION` in `server/utils/legal.js` and `LEGAL_UPDATED` in `legalContent.js` to the merge date, so everyone sees the Terms prompt once. Tick D2 and R5 in `system-review.md`.

### FE-6 `chore/frontend-qa` (Week 3)
- [ ] Go through the pre-ship list in the global `docs/frontend.md` (no horizontal scroll, no broken links or buttons, mobile menu, favicon, page titles per route, meta description, footer links, custom 404, current copyright year, compressed images, success and error messages, no placeholder text, no dead nav items, logo links home, `mailto:` links) and fix what fails.
- [ ] Every route at 320/375/768/1280, light and dark, with the seeded account and a new one. Contrast spot checks on anything new.
- [ ] Run `impeccable detect` across `client/src`, then `impeccable polish` on Today, Wellbeing and the check-in flow.
- [ ] List every placeholder still showing (search for `[` in `helpContacts.js` and About) and remind the owner to fill them in before the panel.
- [ ] Ask the owner whether to record the result as a DESIGN.md (Impeccable's `document` command).
- [ ] Write up what changed in CLAUDE.md (navigation, routes, Wellbeing, check-in results, tokens) and remove the stale notes (the "no frontend-plan" note, the sage/ochre/clay description).
- [ ] Owner: a real phone pass on the deployed site (bottom bar, check-in stepper, safe areas on iPhone, keyboard over inputs).

---

## 13. Parked (after the panel, or if a week finishes early)

- **Breather**: a 1 to 5 minute guided cyclic-sighing exercise (Balban et al. 2023), offered as "one thing for today" after a high-stress result and from Wellbeing. Client only, about a day of work.
- **Daily check-in**: one tap for mood and one for last night's sleep, on Today. Needs a new model and endpoint. Would let "sleep earlier" use real sleep, not just the target.
- **Focus timer** tied to a task (25 or 50 minutes), counting hours done against the estimate.
- Link a reviewer to an exam on the schedule; "reviewer ready" notification; weak topics on Wellbeing.
- Split `App.css` into per-area files; remove unused CSS (SR R10).
- Light Taglish touches in encouragement lines (owner's call).
- Group chat "load older messages" (SR Known limits).
