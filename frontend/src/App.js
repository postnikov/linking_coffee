import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import Rules from './pages/Rules';
import Prices from './pages/Prices';
import Dashboard from './pages/Dashboard';


import './App.css';

function App() {
    const [user, setUser] = React.useState(null);

    React.useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <Router>
            <div className="app-container">
                <div className="background-decoration">
                    <div className="bg-circle bg-circle-1"></div>
                    <div className="bg-circle bg-circle-2"></div>
                    <div className="bg-circle bg-circle-3"></div>
                </div>

                <Header user={user} onLogout={handleLogout} />

                <Routes>
                    <Route path="/" element={user ? <Dashboard /> : <Home onLogin={(u) => {
                        localStorage.setItem('user', JSON.stringify(u));
                        setUser(u);
                    }} />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/rules" element={<Rules />} />
                    <Route path="/prices" element={<Prices user={user} />} />

                </Routes>

                <Footer />
            </div>
        </Router>
    );
}

export default App;

