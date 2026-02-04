import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="home-page">
      <section className="hero">
        <h1>Welcome to Mini Shop</h1>
        <p>Your one-stop shop for awesome products</p>
        <Link to="/products" className="btn-primary">
          Browse Products
        </Link>
      </section>
      
      <section className="features">
        <div className="feature">
          <span className="feature-icon">🛍️</span>
          <h3>Quality Products</h3>
          <p>Carefully selected items for you</p>
        </div>
        <div className="feature">
          <span className="feature-icon">🚚</span>
          <h3>Fast Shipping</h3>
          <p>Quick delivery to your doorstep</p>
        </div>
        <div className="feature">
          <span className="feature-icon">💳</span>
          <h3>Secure Payment</h3>
          <p>Safe and secure checkout</p>
        </div>
      </section>
    </div>
  );
}
