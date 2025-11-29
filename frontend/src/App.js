import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import Rules from './pages/Rules';
import Prices from './pages/Prices';
import Register from './pages/Register';
import './App.css';

function App() {
    return (
        <Router>
            <div className="app-container">
                <div className="background-decoration">
                    <div className="bg-circle bg-circle-1"></div>
                    <div className="bg-circle bg-circle-2"></div>
                    <div className="bg-circle bg-circle-3"></div>
                </div>

                <Header />

                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/rules" element={<Rules />} />
                    <Route path="/prices" element={<Prices />} />
                    <Route path="/register" element={<Register />} />
                </Routes>

                <Footer />
            </div>
        </Router>
    );
}

export default App;

