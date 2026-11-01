import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Heart, Info, LogOut, UserPlus, X } from 'lucide-react';
import Modal from '../Modal';
import UserAvatar from '../UserAvatar';

// The phone bottom bar's "More" sheet: the places that don't fit in five slots. It is a normal Modal
// (bottom sheet at 720px and under, with focus trap, Escape and focus return) and it only exists on a
// phone: if the window grows past the phone breakpoint while it is open, it closes itself.
const PHONE = '(max-width: 720px)';

function Badge({ count, label }) {
  if (!(count > 0)) return null;
  return <span className="nav-badge" aria-label={`${count} ${label}`}>{count > 99 ? '99+' : count}</span>;
}

export default function MoreSheet({ onClose, user, profileTarget, friendsUnread, unreadCount, onLogout }) {
  useEffect(() => {
    const query = window.matchMedia(PHONE);
    const onChange = () => { if (!query.matches) onClose(); };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [onClose]);

  return (
    <Modal onClose={onClose} labelledBy="more-sheet-title" className="more-sheet">
      <div className="modal-header">
        <h2 id="more-sheet-title">More</h2>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={20} aria-hidden="true" /></button>
      </div>
      <nav aria-label="More">
        <ul className="more-list">
          <li>
            <Link to="/wellbeing" className="more-link" onClick={onClose}>
              <Heart size={20} aria-hidden="true" /> <span>Wellbeing</span>
            </Link>
          </li>
          <li>
            <Link to="/friends" className="more-link" onClick={onClose}>
              <UserPlus size={20} aria-hidden="true" /> <span>Friends</span>
              <Badge count={friendsUnread} label="friend requests" />
            </Link>
          </li>
          <li>
            <Link to="/notifications" className="more-link" onClick={onClose}>
              <Bell size={20} aria-hidden="true" /> <span>Notifications</span>
              <Badge count={unreadCount} label="unread" />
            </Link>
          </li>
          <li>
            <Link to={profileTarget} className="more-link" onClick={onClose}>
              <UserAvatar name={user?.name} src={user?.avatar} size={24} /> <span>Profile</span>
            </Link>
          </li>
          <li>
            <Link to="/about" className="more-link" onClick={onClose}>
              <Info size={20} aria-hidden="true" /> <span>About</span>
            </Link>
          </li>
          <li>
            <button type="button" className="more-link" onClick={() => { onClose(); onLogout(); }}>
              <LogOut size={20} aria-hidden="true" /> <span>Sign out</span>
            </button>
          </li>
        </ul>
      </nav>
    </Modal>
  );
}
