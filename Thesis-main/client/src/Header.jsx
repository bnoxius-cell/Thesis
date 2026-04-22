import "./Header.css";

export default function Header() {
  return (
    <header className="header">
      <div className="logo">
        Stress<span>Care</span>
      </div>

      <nav className="nav">
        <a href="#dashboard">Dashboard</a>
        <a href="#assessment">Assessment</a>
        <a href="#reports">Reports</a>
        <a href="#footer">About</a>
      </nav>
    </header>
  );
}
