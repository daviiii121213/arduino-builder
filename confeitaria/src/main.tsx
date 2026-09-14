import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './store/store';
import { CartProvider } from './store/cart';
import { ToastProvider } from './components/Toast';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <StoreProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </StoreProvider>
    </ToastProvider>
  </StrictMode>,
);
