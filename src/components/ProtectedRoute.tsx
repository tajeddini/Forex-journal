import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGuest } from '../contexts/GuestContext';
import { LoadingPage } from './ui/Loading';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { isGuest } = useGuest();
  const location = useLocation();

  if (loading) {
    return <LoadingPage />;
  }

  // Allow access if user is authenticated OR exploring in guest mode
  if (!user && !isGuest) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

interface PublicRouteProps {
  children: React.ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { user, loading } = useAuth();
  const { isGuest } = useGuest();

  if (loading) {
    return <LoadingPage />;
  }

  // Redirect to app only if a real authenticated user is logged in
  if (user && !isGuest) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
}
