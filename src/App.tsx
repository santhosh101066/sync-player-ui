import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WebSocketProvider } from './context/WebSocketContext';
import { ToastProvider } from './context/ToastContext';
import { Session } from './pages/Session';
import { Login } from './pages/Login';
import { TermsAndPolicy } from './pages/Terms';
import { PrivacyPolicy } from './pages/Privacy';
import { About } from './pages/About';
import { NotFound } from './pages/NotFound';
import AdminCookies from './pages/AdminCookies';
import './App.css';

function App() {
  return (
    <WebSocketProvider>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/session" element={<Session />} />
            <Route path="/terms" element={<TermsAndPolicy />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/about" element={<About />} />
            <Route path="/admin/cookies" element={<AdminCookies />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </ToastProvider>
    </WebSocketProvider>
  );
}

export default App;
