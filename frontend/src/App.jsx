import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Login from './Login';
import Dashboard from './Dashboard';
import EmployeeDashboard from './components/EmployeeDashboard';
import OrganizationSetup from './components/OrganizationSetup';

const isHRRole = (role) => {
  if (!role) return false;
  const r = String(role).toUpperCase();
  return r.includes('HR') || r.includes('COMPLIANCE') || r.includes('AUDITOR') || r.includes('ADMIN');
};

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('compliance_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [currentView, setCurrentView] = useState(() => {
    const path = window.location.pathname;
    const savedUser = (() => {
      try {
        const saved = localStorage.getItem('compliance_user');
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    })();

    if (path === '/hr-dashboard') {
      return savedUser ? 'hr-dashboard' : 'login';
    }
    if (path === '/employee-dashboard') {
      return savedUser ? 'employee-dashboard' : 'login';
    }
    if (path === '/setup-organization') return 'setup-org';
    if (path === '/login') return 'login';
    return 'landing';
  });
  const [initialCredentials, setInitialCredentials] = useState(null);

  // Sync user state to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('compliance_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('compliance_user');
    }
  }, [user]);

  // Client-side route synchronization on page load / popstate
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      if (path === '/employee-dashboard') {
        if (user) {
          setCurrentView('employee-dashboard');
        } else {
          setCurrentView('login');
          window.history.replaceState({}, '', '/login');
        }
      } else if (path === '/hr-dashboard') {
        if (user) {
          setCurrentView('hr-dashboard');
        } else {
          setCurrentView('login');
          window.history.replaceState({}, '', '/login');
        }
      } else if (path === '/setup-organization') {
        setCurrentView('setup-org');
      } else if (path === '/login') {
        setCurrentView('login');
      } else {
        setCurrentView('landing');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, [user]);

  // View Navigation Helpers (routing wrappers)
  const navigateTo = (view, urlPath) => {
    setCurrentView(view);
    window.history.pushState({}, '', urlPath);
  };

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

  const handleLogin = (loginResponse) => {
    const isHR = isHRRole(loginResponse.user.role);
    const userProfile = {
      id: loginResponse.user.id || loginResponse.user.user_id,
      user_id: loginResponse.user.user_id || loginResponse.user.id,
      email: loginResponse.user.email,
      name: loginResponse.user.name,
      role: isHR ? 'HR' : 'Employee',
      rawRole: loginResponse.user.role,
      tenant_id: loginResponse.user.tenant_id,
      company_name: loginResponse.user.company_name,
      authorized_tenants: loginResponse.user.authorized_tenants || [
        { tenant_id: loginResponse.user.tenant_id, company_name: loginResponse.user.company_name, role: loginResponse.user.role }
      ],
      token: loginResponse.access_token
    };
    setUser(userProfile);
    if (isHR) {
      navigateTo('hr-dashboard', '/hr-dashboard');
    } else {
      navigateTo('employee-dashboard', '/employee-dashboard');
    }
  };

  const handleSwitchTenant = async (targetTenantId) => {
    if (!user || !user.token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/auth/switch-tenant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ target_tenant_id: targetTenantId })
      });
      const data = await response.json();
      if (response.ok) {
        handleLogin(data);
      }
    } catch (err) {
      console.error('Failed to switch tenant:', err);
    }
  };

  const handleLogout = () => {
    setUser(null);
    navigateTo('landing', '/');
  };

  // 1. Authenticated HR Auditor Dashboard View
  if (currentView === 'hr-dashboard' && user) {
    return <Dashboard user={user} onLogout={handleLogout} onSwitchTenant={handleSwitchTenant} />;
  }

  // 2. Authenticated Standard Employee Dashboard View
  if (currentView === 'employee-dashboard' && user) {
    return <EmployeeDashboard user={user} onLogout={handleLogout} onSwitchTenant={handleSwitchTenant} />;
  }

  // 3. Organization Setup Onboarding View
  if (currentView === 'setup-org') {
    return (
      <OrganizationSetup 
        onCreated={(creds) => {
          setInitialCredentials(creds);
          navigateTo('login', '/login');
        }}
        onBack={() => navigateTo('login', '/login')}
      />
    );
  }

  // 4. Login Screen View (or unauthenticated dashboard view fallback)
  if (currentView === 'login' || ((currentView === 'hr-dashboard' || currentView === 'employee-dashboard') && !user)) {
    return (
      <Login 
        onLogin={handleLogin} 
        onBack={() => navigateTo('landing', '/')} 
        onSetupOrg={() => navigateTo('setup-org', '/setup-organization')}
        initialCredentials={initialCredentials}
      />
    );
  }

  // 5. Default Public Landing Page View
  return (
    <LandingPage 
      onGetStarted={() => navigateTo('login', '/login')} 
      onSignIn={() => navigateTo('login', '/login')} 
    />
  );
}