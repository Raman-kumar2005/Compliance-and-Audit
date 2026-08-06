import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Login from './Login';
import Dashboard from './Dashboard';
import EmployeeDashboard from './components/EmployeeDashboard';

export default function App() {
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'login' | 'hr-dashboard' | 'employee-dashboard'
  const [user, setUser] = useState(null); // { email: string, role: 'Employee' | 'HR' }

  // Client-side route synchronization on page load / popstate
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      if (path === '/employee-dashboard') {
        if (user && user.role === 'Employee') {
          setCurrentView('employee-dashboard');
        } else {
          // Redirect to login if unauthenticated
          setCurrentView('login');
          window.history.replaceState({}, '', '/login');
        }
      } else if (path === '/hr-dashboard') {
        if (user && user.role === 'HR') {
          setCurrentView('hr-dashboard');
        } else {
          // Redirect to login if unauthenticated
          setCurrentView('login');
          window.history.replaceState({}, '', '/login');
        }
      } else if (path === '/login') {
        setCurrentView('login');
      } else {
        setCurrentView('landing');
      }
    };

    // Initial check
    handleLocationChange();

    // Listen for browser forward/back buttons
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, [user]);

  // View Navigation Helpers (routing wrappers)
  const navigateTo = (view, urlPath) => {
    setCurrentView(view);
    window.history.pushState({}, '', urlPath);
  };

  const handleLogin = (authenticatedUser) => {
    setUser(authenticatedUser);
    if (authenticatedUser.role === 'HR') {
      navigateTo('hr-dashboard', '/hr-dashboard');
    } else {
      navigateTo('employee-dashboard', '/employee-dashboard');
    }
  };

  const handleLogout = () => {
    setUser(null);
    navigateTo('landing', '/');
  };

  // 1. Authenticated HR Auditor Dashboard View
  if (currentView === 'hr-dashboard' && user?.role === 'HR') {
    return <Dashboard user={user} onLogout={handleLogout} />;
  }

  // 2. Authenticated Standard Employee Dashboard View
  if (currentView === 'employee-dashboard' && user?.role === 'Employee') {
    return <EmployeeDashboard user={user} onLogout={handleLogout} />;
  }

  // 3. Login Screen View
  if (currentView === 'login') {
    return (
      <Login 
        onLogin={handleLogin} 
        onBack={() => navigateTo('landing', '/')} 
      />
    );
  }

  // 4. Default Public Landing Page View
  return (
    <LandingPage 
      onGetStarted={() => navigateTo('login', '/login')} 
      onSignIn={() => navigateTo('login', '/login')} 
    />
  );
}