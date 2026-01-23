import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './Unsubscribe.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('pending'); // pending, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Get email from URL query parameter
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
      // Auto-unsubscribe if email is provided
      handleUnsubscribe(emailParam);
    }
  }, [searchParams]);

  const handleUnsubscribe = async (emailToUnsubscribe) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/unsubscribe`, {
        email: emailToUnsubscribe
      });

      if (response.data.success) {
        setStatus('success');
        setMessage('You have been successfully unsubscribed from marketing emails.');
      } else {
        setStatus('error');
        setMessage(response.data.message || 'Failed to unsubscribe. Please try again.');
      }
    } catch (error) {
      setStatus('error');
      if (error.response?.data?.message) {
        setMessage(error.response.data.message);
      } else if (error.response?.status === 404) {
        setMessage('Email address not found in our system.');
      } else {
        setMessage('An error occurred. Please try again later.');
      }
      console.error('Unsubscribe error:', error);
    }
  };

  const handleManualUnsubscribe = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setStatus('pending');
      handleUnsubscribe(email.trim());
    }
  };

  return (
    <div className="unsubscribe-page">
      <div className="unsubscribe-container">
        <div className="unsubscribe-card">
          <h1>☕️ Linked.Coffee</h1>

          {status === 'pending' && (
            <>
              <h2>Unsubscribe from emails</h2>
              <p>Processing your request...</p>
              <div className="spinner"></div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="success-icon">✓</div>
              <h2>Unsubscribed Successfully</h2>
              <p>{message}</p>
              <div className="info-box">
                <p>You will no longer receive reminder emails from Linked.Coffee.</p>
                <p>You can still use the platform by logging in at <a href="https://linked.coffee">linked.coffee</a></p>
              </div>
              <a href="/" className="btn-home">Return to Home</a>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="error-icon">✗</div>
              <h2>Unsubscribe Failed</h2>
              <p className="error-message">{message}</p>

              {!email && (
                <form onSubmit={handleManualUnsubscribe} className="unsubscribe-form">
                  <p>Enter your email address to unsubscribe:</p>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-submit">Unsubscribe</button>
                </form>
              )}

              <a href="/" className="btn-home">Return to Home</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Unsubscribe;
