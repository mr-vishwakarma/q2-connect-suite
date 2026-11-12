import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HosteliqLogo } from "@/components/common/HosteliqLogo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center app-shell-bg px-4 py-12 text-foreground">
      <div className="glass-card-highlight w-full max-w-md rounded-2xl p-8 text-center">
        <div className="mb-6 flex justify-center">
          <HosteliqLogo variant="wordmark" size="md" />
        </div>
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 border border-primary/25 text-primary">
          <Compass className="h-7 w-7" />
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-[#F0EFF8]">404</h1>
        <p className="mt-2 text-base font-medium text-[#9295AD]">
          Oops! The page you requested could not be found.
        </p>
        <p className="mt-1 text-xs font-mono text-[#74788F] break-all">{location.pathname}</p>
        <div className="mt-6 flex justify-center">
          <Button asChild className="gap-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Return to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
