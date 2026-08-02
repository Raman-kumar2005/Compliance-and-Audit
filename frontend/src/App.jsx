import React, { useState } from 'react';
import LandingPage from './components/LandingPage'
import Login from './Login';
import Dashboard from './Dashboard';

export default function App() {
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'login' | 'dashboard'

  // 1. Authenticated Dashboard View
  if (currentView === 'dashboard') {
    return <Dashboard onLogout={() => setCurrentView('landing')} />;
  }

  // 2. Login Screen View
  if (currentView === 'login') {
    return (
      <Login 
        onLogin={() => setCurrentView('dashboard')} 
        onBack={() => setCurrentView('landing')} 
      />
    );
  }

  // 3. Default Public Landing Page View
  return (
    <LandingPage 
      onGetStarted={() => setCurrentView('login')} 
      onSignIn={() => setCurrentView('login')} 
    />
  );
}