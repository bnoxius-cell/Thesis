import { Children, useCallback } from 'react';
import Header from './Header';
import Footer from './Footer';
import PageTour from '../PageTour';

// The one wrapper every page uses: skip link, header (sidebar, phone top bar and bottom bar), the page's
// <main id="main">, footer and, when the page has one, the Guide panel.
//
//   variant   'app' (signed-in layout with the sidebar) or 'public' (signed-out layout, logo bar only)
//   width     'default' or 'reading' (the narrower measure for long text)
//   mainClassName   extra classes for <main> (a page's own, like "reviewer-page")
//   unframed  drop the shared "dashboard" class, for a page that lays out its own <main> (sign-in)
//   tour      { page, title, steps } if the page has a Guide
//
// Children go inside <main>, except a <ShellOverlays> child: dialogs and other fixed-position things
// that belong between <main> and the footer, as they always have.
export function ShellOverlays({ children }) {
  return children;
}

export default function AppShell({
  variant = 'app',
  width = 'default',
  mainClassName = '',
  unframed = false,
  tour,
  children,
}) {
  const all = Children.toArray(children);
  const overlays = all.filter((child) => child?.type === ShellOverlays);
  const content = all.filter((child) => child?.type !== ShellOverlays);
  const layout = variant === 'public' ? 'auth-layout' : 'app-layout';
  const mainClass = [unframed ? '' : 'dashboard', width === 'reading' ? 'is-reading' : '', mainClassName]
    .filter(Boolean)
    .join(' ');

  // A plain "#main" link would add a hash to the address bar and tell the router the page changed.
  const skipToMain = useCallback((e) => {
    const main = document.getElementById('main');
    if (!main) return;
    e.preventDefault();
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: 'start' });
  }, []);

  return (
    <div className={`app ${layout}`}>
      <a className="skip-link" href="#main" onClick={skipToMain}>Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1} className={mainClass}>
        {content}
      </main>
      {overlays}
      <Footer />
      {tour && <PageTour page={tour.page} title={tour.title} steps={tour.steps} />}
    </div>
  );
}
