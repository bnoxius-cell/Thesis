# StressCare known issues

Things to fix and things to avoid, collected from the panel evaluation and reviewer feedback. Tick a box when the fix has merged into `main`. Add new items under the right heading, with where they came from.

Sources:
- **JF**: Jo Anne Ferrer, IT expert evaluation (2026-10-27). Verdict: requires major revisions.
- **MJ**: Ma'am Jennilie.
- **MD**: Mr David.
- **Chat**: Messenger feedback ("high school level"). Not added yet.

## 1. Top priority: too much on screen
Raised by all three reviewers, so this comes first.

- [ ] Less text on every page. (JF, MJ, MD)
- [ ] Make pages "first-look" friendly: the main point is clear in a few seconds, without reading. (MJ)
- [ ] Use more icons and graphs instead of sentences. (MJ)
- [ ] Reduce redundancy: the same information shouldn't appear in several places. (MD)
- [ ] Fix spacing: group related things closer together, leave more empty space around groups (proximity and negative space). (MD)
- [ ] Fix contrast. (MD)
- [ ] Add some customizability, so students can choose what they see. (MD)
- [ ] Day-to-day practicality was rated 1 out of 5 and overall suitability for a pilot 1 out of 5. JF gave no reason for the practicality score, so ask her what felt impractical. Likely causes: too much task entry, too many pages, a dense interface. (JF)

## 2. Dashboard (Today)
- [ ] Fix the dashboard. (MD)
- [ ] Show the most important information first, like today's schedule. (MD)
- [ ] "Add task" should be minimizable. It shouldn't be the first thing students see. (MD)
- [ ] Show a weekly workload summary, a clear list of upcoming deadlines, and simple progress indicators, without overwhelming. (JF)
- [ ] Students can update or correct a task as priorities change over the semester. (JF)

## 3. Workload score and results
- [ ] Use more than task count: difficulty, estimated time, deadline urgency, and the student's free time. A multi-hour programming project must not weigh the same as a short written activity. (JF)
- [ ] Test the score on light weeks, exam periods and overlapping deadlines, so Low, Moderate and High feel fair and consistent. (JF)
- [ ] Every result gets a short explanation of why, and recommended actions: prioritize urgent items, split big projects, schedule breaks. (JF)
- [ ] Say clearly that results are workload estimates, not a measure of real psychological stress. (JF)
- [ ] Show the student's real situation with realistic advice. (JF)
- [ ] The visual presentation of the score should inform without causing anxiety. (JF)

## 4. Questionnaires: what happens after each result
Today the PSS-10 and WHO-5 scores only feed into the workload number (PSS weighted 0.18, WHO-5 inverted 0.17). Older check-ins drop out (PSS after 30 days, WHO-5 after 14). Nothing else changes in the app, so there is no defined response yet.

- [ ] Cite who made each questionnaire: PSS-10 (Cohen, Kamarck and Mermelstein, 1983) and WHO-5 (WHO, 1998). (MJ)
- [ ] Add a short introduction before each survey: what it measures and why it matters. (MJ)
- [ ] Define what changes for each result. A result leads to plan changes, specific recommendations and encouragement, not hotlines. To decide:
  - [ ] **WHO-5 low:** earlier bedtime in the sleep plan, fewer and lighter next steps on Today, tips about rest and breaks, a gentle Guidance Office mention if it stays low.
  - [ ] **PSS-10 high:** suggest moving or splitting the heaviest task, warn about overloaded weeks, offer shorter focus rounds.
  - [ ] **Both bad together:** the strongest response, with a plain explanation and the Guidance Office referral.
  - [ ] **Improving scores:** acknowledge it.
  - [ ] **Persistent over several check-ins:** stronger referral wording.
  - [ ] **Old or missing check-in:** ask for a new one instead of guessing.
- [ ] Decide the cut-off scores for each band. Use the published cut-offs for each instrument and cite them. Don't invent numbers.
- [ ] Decide whether the surveys stay inside the workload score or become a separate wellbeing signal. This ties to the "estimates, not stress" point in section 3.
- [ ] Get the response wording checked by someone qualified before it ships.

## 5. Safety and privacy
- [ ] Guidance Office referral exists, but the contact details are still placeholders. The owner supplies the real ones. Never invent them. (JF)
- [ ] Access controls and data security for student records. (JF)

## 6. Messenger feedback
- [ ] To add: the "high school level" message.

## Avoid
- Don't use `window.confirm`, `alert` or `prompt`. Use `ConfirmDialog`.
- Don't put red on ordinary buttons or labels. Red is for the logo, the active nav marker, overdue, delete and errors.
- Don't invent phone numbers, offices or team names. Leave the placeholders until the owner fills them in.
- Don't present scores as a diagnosis.
