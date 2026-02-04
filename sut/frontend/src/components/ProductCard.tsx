import type { Product } from '../types';
import { cartApi } from '../services/api';
import { useAuth } from '../store/AuthContext';
import { useState } from 'react';

interface ProductCardProps {
  product: Product;
  onAddToCart?: () => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const { isAuthenticated } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState('');

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      setMessage('Please login to add items to cart');
      return;
    }

    setIsAdding(true);
    try {
      await cartApi.addItem(product.id, 1);
      setMessage('Added to cart!');
      onAddToCart?.();
    } catch (error) {
      setMessage('Failed to add to cart');
    } finally {
      setIsAdding(false);
      setTimeout(() => setMessage(''), 2000);
    }
  };

  return (
    <div className="product-card">
      <div className="product-image">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} />
        ) : (
          <div className="placeholder-image">📦</div>
        )}
      </div>
      
      <div className="product-info">
        <h3>{product.name}</h3>
        <p className="product-description">{product.description}</p>
        <p className="product-price">${product.price.toFixed(2)}</p>
        <p className="product-stock">
          {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
        </p>
        
        {message && <p className="product-message">{message}</p>}
        
        <button
          className="btn-add-cart"
          onClick={handleAddToCart}
          disabled={isAdding || product.stock === 0}
        >
          {isAdding ? 'Adding...' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
