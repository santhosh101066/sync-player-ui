import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WebSocketProvider } from './context/WebSocketContext';
import { Session } from './pages/Session';
import { Login } from './pages/Login';
import { TermsAndPolicy } from './pages/Terms';
import { PrivacyPolicy } from './pages/Privacy';
import { About } from './pages/About';
import { NotFound } from './pages/NotFound';
import './App.css';

function App() {
  return (
    <WebSocketProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/session" element={<Session />} />
          <Route path="/terms" element={<TermsAndPolicy />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </WebSocketProvider>
  );
}

export default App;
