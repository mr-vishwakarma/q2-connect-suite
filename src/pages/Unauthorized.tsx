import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BuildingBackground } from '@/components/shared/BuildingBackground';
import { ShieldX, Home, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function Unauthorized() {
  const { user, isSuperAdmin, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden flex flex-col">
      <Navbar />
      <BuildingBackground showOnHome={true} />
      
      <div className="flex-1 flex items-center justify-center pt-20 pb-12 px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="w-full max-w-md bg-card/60 backdrop-blur-xl border-destructive/20 shadow-2xl">
            <CardHeader className="text-center pb-4">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="w-16 h-16 rounded-2xl bg-destructive flex items-center justify-center mx-auto mb-4 shadow-lg"
              >
                <ShieldX className="w-8 h-8 text-destructive-foreground" />
              </motion.div>
              <CardTitle className="text-2xl text-foreground">Access Denied</CardTitle>
              <CardDescription className="text-muted-foreground">
                You don't have permission to access this page
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-center text-muted-foreground text-sm">
                You do not have the required permissions or authoritative role to access this portal or resource.
              </p>
              
              <div className="flex flex-col gap-3 pt-4">
                {user ? (
                  <Button asChild variant="default" className="w-full">
                    <Link
                      to={
                        isSuperAdmin || user.role === 'super_admin'
                          ? "/super-admin/dashboard"
                          : isAdmin || user.role === 'admin'
                          ? "/admin/dashboard"
                          : "/student/dashboard"
                      }
                      className="flex items-center justify-center gap-2"
                    >
                      <Home className="w-4 h-4" />
                      Return to Your Authorized Portal
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="default" className="w-full">
                    <Link to="/login" className="flex items-center justify-center gap-2">
                      <LogIn className="w-4 h-4" />
                      Go to Login
                    </Link>
                  </Button>
                )}
                
                <Button asChild variant="outline" className="w-full">
                  <Link to="/login" className="flex items-center justify-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Sign In with Different Role
                  </Link>
                </Button>
                
                <Button asChild variant="ghost" className="w-full text-xs text-muted-foreground">
                  <Link to="/" className="flex items-center justify-center gap-2">
                    Home Page
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      
      <Footer />
    </div>
  );
}
