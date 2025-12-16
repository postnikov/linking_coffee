import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import LoginPage from './pages/LoginPage';
import About from './pages/About';
import Rules from './pages/Rules';
import Prices from './pages/Prices';
import Dashboard from './pages/Dashboard';
import PublicProfile from './pages/PublicProfile';
import AdminPage from './pages/AdminPage';
import TokenProfile from './pages/TokenProfile';
// import AdminHealth from './pages/AdminHealth'; // Now integrated



import './App.css';

const RequireAuth = ({ user, children }) => {
    const location = useLocation();
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return children;
};

function App() {
    const [user, setUser] = React.useState(() => {
        const storedUser = localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });

    const handleLogin = (u) => {
        localStorage.setItem('user', JSON.stringify(u));
        setUser(u);
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        setUser(null);
    };

    const MainLayout = ({ children }) => (
        <div className="app-container">
            <div className="background-decoration">
                <div className="bg-circle bg-circle-1"></div>
                <div className="bg-circle bg-circle-2"></div>
                <div className="bg-circle bg-circle-3"></div>
            </div>

            <Header user={user} onLogout={handleLogout} />

            <main className="main-content">
                {children}
            </main>

            <Footer />
        </div>
    );

    return (
        <Router>
            <Routes>
                {/* Admin Route - Standalone */}
                <Route path="/admin" element={<AdminPage />} />

                {/* Main App Routes - Wrapped in Layout */}
                <Route path="*" element={
                    <MainLayout>
                        <Routes>
                            <Route path="/" element={user ? <Dashboard /> : <Home onLogin={handleLogin} />} />
                            <Route path="/view/:token" element={<TokenProfile />} />
                            <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
                            <Route path="/about" element={<About />} />
                            <Route path="/rules" element={<Rules />} />
                            <Route path="/prices" element={<Prices user={user} />} />
                            <Route path="/profile/:username" element={
                                <RequireAuth user={user}>
                                    <PublicProfile />
                                </RequireAuth>
                            } />
                            {/* Catch all for 404 inside layout if needed, or redirect */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </MainLayout>
                } />
            </Routes>
        </Router>
    );
}

export default App;

