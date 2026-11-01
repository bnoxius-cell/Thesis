import { Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { useAuth } from './authentication/AuthContext';

export default function NotFound() {
  const { isLoggedin } = useAuth();

  return (
    <AppShell variant={isLoggedin ? 'app' : 'public'} mainClassName="not-found">
        <span className="panel-kicker">Error 404</span>
        <h1>This page doesn't exist.</h1>
        <p>The link may be old, or the address may have a typo.</p>
        <Link to={isLoggedin ? '/dashboard' : '/'} className="primary-button">
          {isLoggedin ? 'Go to Today' : 'Go to sign in'}
        </Link>
    </AppShell>
  );
}
