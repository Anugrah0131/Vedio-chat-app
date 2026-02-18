import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AppStateProvider } from './context/AppStateContext.jsx'
import { SocketProvider } from './context/SocketProvider.jsx'

createRoot(document.getElementById('root')).render(
  <AppStateProvider>
    <SocketProvider>
      <App />
    </SocketProvider>
  </AppStateProvider>
)
