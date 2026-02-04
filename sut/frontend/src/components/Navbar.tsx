import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">🛒 Mini Shop</Link>
      </div>
      
      <div className="navbar-links">
        <Link to="/products">Products</Link>
        <Link to="/cart">Cart</Link>
        
        {isAuthenticated ? (
          <>
            <Link to="/orders">Orders</Link>
            <span className="user-name">Hi, {user?.full_name || user?.email}</span>
            <button onClick={handleLogout} className="btn-logout">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
