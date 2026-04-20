import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'rsuite/dist/rsuite-no-reset.min.css';
import './styles/rsuite-overrides.css';
import './index.css'
import App from './App.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CometChatProvider } from './CometChat/context/CometChatContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <CometChatProvider>
        <App />
      </CometChatProvider>
    </QueryClientProvider>
  </BrowserRouter>,
);
