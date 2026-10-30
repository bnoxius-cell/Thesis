import { BookOpen, Calendar, ChartColumn, CircleCheck, FileText, Leaf } from 'lucide-react';

// The right half of the sign-in page: the headline text, then three mock-up cards. The cards and the
// backdrop are decoration with made-up sample data, so they are hidden from assistive tech.
// Styles: styles/auth.css.

// Schedule card: a block is [tone, height in px at full size].
const WEEK = [
  ['M', [['accent', 44], ['good', 28]]],
  ['T', [['accent', 62]]],
  ['W', [['watch', 34], ['accent', 46]]],
  ['T', [['good', 28], ['accent', 54]]],
  ['F', [['accent', 66]]],
];
// Workload card: one bar per day, the fourth is the heavy one.
const LOAD = [['M', 50], ['T', 78], ['W', 104], ['T', 124], ['F', 62], ['S', 36], ['S', 26]];
const HEAVY_DAY = 3;
const OPTIONS = [['Hash table', true], ['Linked list', false], ['Binary heap', false]];

const SPRITES = [
  { Icon: Calendar, x: 1720, y: 138, size: 56, rot: -12, k: 1 },
  { Icon: Leaf, x: 1005, y: 70, size: 48, rot: 18, k: 1.3 },
  { Icon: CircleCheck, x: 1790, y: 880, size: 60, rot: 0, k: 0.8 },
  { Icon: Leaf, x: 880, y: 971, size: 44, rot: -25, k: 1.1 },
  { Icon: Calendar, x: 1613, y: 300, size: 40, rot: 10, k: 0.9, wideOnly: true },
  { Icon: CircleCheck, x: 1330, y: 40, size: 36, rot: 0, k: 1.2 },
];
// Blobs: centre and diameter on the 1920 x 1080 design, and how strong the accent tint is (%).
const BLOBS = [
  { x: 1730, y: 120, d: 780, a: 32, k: 1 },
  { x: 900, y: 900, d: 740, a: 14, k: 1.25 },
  { x: 1790, y: 870, d: 680, a: 16, k: 0.85 },
  { x: 1290, y: 110, d: 600, a: 14, k: 1.1 },
];

// Soft blobs and faint icons behind the page. Positions are in design pixels; the CSS scales them.
export function AuthBackdrop() {
  return (
    <div className="auth-backdrop" aria-hidden="true">
      {BLOBS.map(({ x, y, d, a, k }) => (
        <i key={`${x}-${y}`} className="auth-blob" style={{ '--x': x, '--y': y, '--d': d, '--a': `${a}%`, '--k': k }} />
      ))}
      {SPRITES.map(({ Icon, x, y, size, rot, k, wideOnly }) => (
        <Icon key={`${x}-${y}`} className={wideOnly ? 'auth-sprite is-wide-only' : 'auth-sprite'} strokeWidth={1.25}
          style={{ '--x': x, '--y': y, '--s': size, '--r': rot, '--k': k }} />
      ))}
    </div>
  );
}

function PreviewCard({ className, Icon, title, caption, sub, children }) {
  return (
    <div className={`auth-pcard ${className}`}>
      <div className="auth-pcard-head">
        <span className="auth-pcard-icon"><Icon className="auth-ic" strokeWidth={1.75} /></span>
        {title}
      </div>
      <div className="auth-pcard-preview">{children}</div>
      <div className="auth-pcard-caption">
        <strong>{caption}</strong>
        <span>{sub}</span>
      </div>
    </div>
  );
}

export default function AuthShowcase() {
  return (
    <div className="auth-showcase">
      <div className="auth-showcase-text">
        <span className="auth-showcase-eyebrow">For OLFU IT students</span>
        <h1>Your classes, your load, your notes. One calm place.</h1>
        <p>
          See your timetable and deadlines in one week, watch how heavy each day gets, and turn your
          own notes into practice questions.
        </p>
      </div>

      <div className="auth-stage" aria-hidden="true">
        <div className="auth-fan">
          <PreviewCard className="is-schedule" Icon={Calendar} title="Schedule"
            caption="Your week at a glance" sub="Classes and deadlines in one place.">
            <b className="auth-week-label">Nov 3 – 7</b>
            <div className="auth-week">
              {WEEK.map(([day, blocks], i) => (
                <div key={i} className="auth-week-day">
                  <span>{day}</span>
                  {blocks.map(([tone, h]) => <i key={h} className={`is-${tone}`} style={{ '--h': h }} />)}
                </div>
              ))}
            </div>
            <span className="auth-chip is-watch">Report due Wed</span>
          </PreviewCard>

          <PreviewCard className="is-workload" Icon={ChartColumn} title="Workload"
            caption="See which days are too heavy" sub="Plus a quick check-in on how you feel.">
            <div className="auth-bars">
              {LOAD.map(([day, h], i) => (
                <div key={i}>
                  <i className={i === HEAVY_DAY ? 'is-heavy' : ''} style={{ '--h': h }} />
                  <span>{day}</span>
                </div>
              ))}
            </div>
            <span className="auth-chip is-watch">Thu is heavy</span>
            <div className="auth-score">
              <b>68</b>
              <div>
                <span>WHO-5 check-in</span>
                <span className="auth-chip is-good">Doing okay</span>
              </div>
            </div>
          </PreviewCard>

          <PreviewCard className="is-reviewers" Icon={BookOpen} title="Reviewers"
            caption="Practice from your own notes" sub="Questions made from what you study.">
            <span className="auth-source"><FileText className="auth-ic is-small" strokeWidth={1.75} />Data Structures notes</span>
            <span className="auth-qcount">QUESTION 3 OF 10</span>
            <p className="auth-question">Which structure gives O(1) average lookup by key?</p>
            {OPTIONS.map(([label, correct]) => (
              <span key={label} className={`auth-option${correct ? ' is-correct' : ''}`}>
                <i />{label}
              </span>
            ))}
            <div className="auth-progress"><i /></div>
          </PreviewCard>
        </div>
      </div>
    </div>
  );
}
