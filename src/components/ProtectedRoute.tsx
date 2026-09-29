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

  // Allow access if authenticated OR in guest mode
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

  if (loading) {
    return <LoadingPage />;
  }

  if (user) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
}
