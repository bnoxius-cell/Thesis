import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer" id="footer">
      <div className="footer-content">
        <div className="footer-left">
          <h3>StressCare</h3>
          <p>Web-Based Stress Management System for IT Students</p>
        </div>

        <div className="footer-center">
          <a href="#">Dashboard</a>
          <a href="#">Assessment</a>
          <a href="#">Reports</a>
        </div>

        <div className="footer-right">
          <p>(c) 2026 StressCare System</p>
          <p>All Rights Reserved</p>
        </div>
      </div>
    </footer>
  );
}
