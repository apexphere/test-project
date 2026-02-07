import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    navigate('/');
  };

  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" onClick={handleLinkClick}>🛒 Mini Shop</Link>
      </div>

      <button 
        className="navbar-toggle"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="Toggle navigation menu"
        aria-expanded={isMenuOpen}
      >
        {isMenuOpen ? '✕' : '☰'}
      </button>
      
      <div className={`navbar-links ${isMenuOpen ? 'open' : ''}`}>
        <Link to="/products" onClick={handleLinkClick}>Products</Link>
        <Link to="/cart" onClick={handleLinkClick}>Cart</Link>
        
        {isAuthenticated ? (
          <>
            <Link to="/orders" onClick={handleLinkClick}>Orders</Link>
            <span className="user-name">Hi, {user?.full_name || user?.email}</span>
            <button onClick={handleLogout} className="btn-logout">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" onClick={handleLinkClick}>Login</Link>
            <Link to="/register" onClick={handleLinkClick}>Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
