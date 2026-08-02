import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Since it's a dummy login, we just check if fields aren't empty
    if (email && password) {
      onLogin(); 
    } else {
      alert("Please enter a dummy email and password to continue.");
    }
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      height: '100vh', backgroundColor: '#0f172a', color: '#e2e8f0', fontFamily: 'sans-serif'
    }}>
      <div style={{
        backgroundColor: '#1e293b', padding: '40px', borderRadius: '12px', 
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)', width: '100%', maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>Enterprise AI Auditor</h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Sign in to access compliance dashboard</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Corporate Email</label>
            <input 
              type="email" 
              placeholder="admin@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155',
                backgroundColor: '#0f172a', color: 'white', outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155',
                backgroundColor: '#0f172a', color: 'white', outline: 'none'
              }}
            />
          </div>

          <button type="submit" style={{
            width: '100%', padding: '12px', borderRadius: '6px', border: 'none',
            backgroundColor: '#6366f1', color: 'white', fontSize: '16px', fontWeight: 'bold',
            cursor: 'pointer', marginTop: '10px'
          }}>
            Secure Sign In
          </button>
        </form>
      </div>
    </div>
  );
}