import { useLocation, useParams, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();
  const { orgSlug } = useParams<{ orgSlug: string }>();

  useEffect(() => {}, [location.pathname]);

  const dashboardPath = orgSlug ? `/${orgSlug}/dashboard` : "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Página no encontrada</p>
        <Link to={dashboardPath} className="text-primary underline hover:text-primary/90">
          Volver al Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
