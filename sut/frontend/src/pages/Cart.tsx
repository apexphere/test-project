import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cartApi, ordersApi } from '../services/api';
import type { Cart as CartType } from '../types';

export function Cart() {
  const navigate = useNavigate();
  
  const [cart, setCart] = useState<CartType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);

  const fetchCart = async () => {
    try {
      const data = await cartApi.get();
      setCart(data);
    } catch (err) {
      setError('Failed to load cart');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const handleUpdateQuantity = async (itemId: number, quantity: number) => {
    if (quantity < 1) {
      await handleRemoveItem(itemId);
      return;
    }
    
    try {
      await cartApi.updateItem(itemId, quantity);
      fetchCart();
    } catch (err) {
      setError('Failed to update item');
    }
  };

  const handleRemoveItem = async (itemId: number) => {
    try {
      await cartApi.removeItem(itemId);
      fetchCart();
    } catch (err) {
      setError('Failed to remove item');
    }
  };

  const handleCheckout = async () => {
    if (!shippingAddress.trim()) {
      setError('Please enter a shipping address');
      return;
    }
    
    setIsOrdering(true);
    setError('');
    
    try {
      const order = await ordersApi.create(shippingAddress);
      navigate(`/orders/${order.id}`, { state: { message: 'Order placed successfully!' } });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to place order');
    } finally {
      setIsOrdering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="cart-page">
        <h1>Shopping Cart</h1>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h1>Shopping Cart</h1>
      
      {error && <div className="error-message">{error}</div>}
      
      {!cart || cart.items.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          <div className="cart-items">
            {cart.items.map((item) => (
              <div key={item.id} className="cart-item">
                <div className="item-info">
                  <h3>{item.product_name}</h3>
                  <p className="item-price">${item.unit_price.toFixed(2)}</p>
                </div>
                
                <div className="item-quantity">
                  <button onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}>
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}>
                    +
                  </button>
                </div>
                
                <div className="item-subtotal">
                  ${item.subtotal.toFixed(2)}
                </div>
                
                <button 
                  className="btn-remove" 
                  onClick={() => handleRemoveItem(item.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          
          <div className="cart-total">
            <strong>Total: ${cart.total.toFixed(2)}</strong>
          </div>
          
          <div className="checkout-section">
            <h3>Checkout</h3>
            <div className="form-group">
              <label htmlFor="shipping">Shipping Address</label>
              <textarea
                id="shipping"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Enter your shipping address"
                rows={3}
              />
            </div>
            <button 
              className="btn-primary btn-checkout" 
              onClick={handleCheckout}
              disabled={isOrdering}
            >
              {isOrdering ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
