import { useState, useEffect } from 'react';
import { ordersApi } from '../services/api';
import type { Order } from '../types';

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrders = async () => {
    try {
      const data = await ordersApi.list();
      setOrders(data.orders);
    } catch (err) {
      setError('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCancel = async (orderId: number) => {
    try {
      await ordersApi.cancel(orderId);
      fetchOrders();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to cancel order');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'confirmed': return 'status-confirmed';
      case 'shipped': return 'status-shipped';
      case 'delivered': return 'status-delivered';
      case 'cancelled': return 'status-cancelled';
      default: return '';
    }
  };

  if (isLoading) {
    return (
      <div className="orders-page">
        <h1>My Orders</h1>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <h1>My Orders</h1>
      
      {error && <div className="error-message">{error}</div>}
      
      {orders.length === 0 ? (
        <p>You haven't placed any orders yet.</p>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <span className="order-id">Order #{order.id}</span>
                <span className={`order-status ${getStatusColor(order.status)}`}>
                  {order.status.toUpperCase()}
                </span>
              </div>
              
              <div className="order-date">
                {new Date(order.created_at).toLocaleDateString()}
              </div>
              
              <div className="order-items">
                {order.items.map((item) => (
                  <div key={item.id} className="order-item">
                    <span>{item.product_name} x{item.quantity}</span>
                    <span>${(item.unit_price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="order-footer">
                <strong>Total: ${order.total_amount.toFixed(2)}</strong>
                {order.status === 'pending' && (
                  <button 
                    className="btn-cancel" 
                    onClick={() => handleCancel(order.id)}
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
