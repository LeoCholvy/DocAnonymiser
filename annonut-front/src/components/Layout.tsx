import { NavLink, Outlet } from 'react-router-dom';
import { ShieldIcon } from './Icons';

export default function Layout() {
    return (
        <div className="app-container">
            <header className="header">
                <div className="header-logo">
                    <div className="header-logo-icon"><ShieldIcon /></div>
                    <div className="header-logo-text">
                        <div className="header-logo-title">ANNON.UT</div>
                        <div className="header-logo-subtitle">RGPD · LOCAL · MVP</div>
                    </div>
                </div>

                <nav className="header-nav">
                    <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>Upload Manuel</NavLink>
                    <NavLink to="/drive" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>Google Drive Batch</NavLink>
                    <NavLink to="/whitelist" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>Liste Blanche</NavLink>
                </nav>
            </header>

            <main className="main-content">
                <Outlet /> {/* C'est ici que les pages vont s'injecter */}
            </main>

            <footer className="footer">
                <div className="footer-title">AUCUNE DONNÉE N'EST ENVOYÉE À UN SERVICE EXTERNE HORS GOOGLE DRIVE (SI AUTORISÉ).</div>
                <div className="footer-muted">AnnonUT - Version Découpée</div>
            </footer>
        </div>
    );
}