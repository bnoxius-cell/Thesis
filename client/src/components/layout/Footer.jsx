import { Link } from 'react-router-dom';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';
import Logo from '../../assets/logo.svg';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer site-footer">
      <div className="site-footer-top">
        <div className="site-footer-brand">
          <Link to="/" className="logo-link">
            <img src={Logo} alt="StressCare Logo" className="logo-svg" />
            <div className="logo-text">Stress<span>Care</span></div>
          </Link>
          <p className="site-footer-tagline">
            Plan tasks early, spread the pressure, and protect your energy.
          </p>
          <div className="site-footer-socials">
            <a href="#" aria-label="Twitter"><Twitter size={20} /></a>
            <a href="#" aria-label="LinkedIn"><Linkedin size={20} /></a>
            <a href="#" aria-label="GitHub"><Github size={20} /></a>
            <a href="mailto:support@student.fatima.edu.ph" aria-label="Email Support"><Mail size={20} /></a>
          </div>
        </div>
        
        <div className="site-footer-links">
          <div className="site-footer-column">
            <h4>Product</h4>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/create-task">Tasks</Link>
            <Link to="/groups">Groups</Link>
            <Link to="/friends">Friends</Link>
          </div>
          <div className="site-footer-column">
            <h4>Resources</h4>
            <Link to="/about">About Us</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/notifications">Alerts</Link>
            <a href="mailto:support@student.fatima.edu.ph">Contact Support</a>
          </div>
          <div className="site-footer-column">
            <h4>Legal</h4>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms-of-service">Terms of Service</Link>
            <Link to="/cookie-policy">Cookie Policy</Link>
          </div>
        </div>
      </div>

      <div className="site-footer-bottom">
        <p>&copy; {new Date().getFullYear()} StressCare. All rights reserved.</p>
        <p className="site-footer-made-by">Built for OLFU IT Students</p>
      </div>
    </footer>
  );
}
