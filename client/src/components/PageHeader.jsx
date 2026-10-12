import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// The title block at the top of a page: optional back link and kicker, the title, one line of
// description, and actions on the right (they wrap under the title on a phone).
export default function PageHeader({ title, kicker, description, back, actions, children }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {back && (
          <Link to={back.to} className="page-header-back">
            <ArrowLeft size={16} aria-hidden="true" /> {back.label}
          </Link>
        )}
        {kicker && <span className="panel-kicker">{kicker}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {children}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
