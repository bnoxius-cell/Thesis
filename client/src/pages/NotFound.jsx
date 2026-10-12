import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { useAuth } from './authentication/AuthContext';

export default function NotFound() {
  const { isLoggedin } = useAuth();

  return (
    <div className={`app ${isLoggedin ? 'app-layout' : 'auth-layout'}`}>
      <Header />
      <main className="dashboard not-found">
        <span className="panel-kicker">Error 404</span>
        <h1>This page doesn't exist.</h1>
        <p>The link may be old, or the address may have a typo.</p>
        <Link to={isLoggedin ? '/dashboard' : '/'} className="primary-button">
          {isLoggedin ? 'Go to Today' : 'Go to sign in'}
        </Link>
      </main>
      <Footer />
    </div>
  );
}
