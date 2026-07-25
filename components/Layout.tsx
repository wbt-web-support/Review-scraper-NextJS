import { useEffect, useState } from "react";
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import Sidebar from "./Sidebar";
import { useToast } from "../hooks/use-toast";
import { Button } from "./ui/button";
import LogoutConfirmationModal from "./LogoutConfirmationModal";

interface LayoutProps {
  children: React.ReactNode;
}

interface IUserSessionData {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  id?: string; 
  username?: string | null | undefined; 
  fullName?: string | null | undefined;
}

const Layout = ({ children }: LayoutProps) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const router = useRouter();
  const { data: session, status: authStatus } = useSession(); 
  const { toast } = useToast();

  const userForDisplay: IUserSessionData | undefined = session?.user;

  const handleLogout = async () => {
    try {
      await signOut({ redirect: false });
      router.push("/login"); 
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated') {
      router.push("/login");
      return;
    }
    // Video-business clients don't belong in the operator app -- send them to their
    // own review dashboard.
    if (session?.user?.role === 'client') {
      router.replace("/my-reviews");
    }
  }, [authStatus, router, session]);

  const userInitials = (userForDisplay?.fullName || userForDisplay?.name || userForDisplay?.username || 'U').charAt(0).toUpperCase();

  if (authStatus === 'loading' || authStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-gray-700">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading Application...</p>
        </div>
      </div>
    );
  }

  const mainLayoutClasses = "flex min-h-screen bg-slate-100 text-gray-800";
  const headerClasses = "shadow-sm py-3 px-4 sticky top-0 z-40 border-b bg-white text-gray-800 border-slate-200";
  const mobileHeaderClasses = `${headerClasses} md:hidden`;
  const contentWrapperClasses = "flex-grow p-4 sm:p-10 bg-gray-50 text-gray-800";
  const primaryTextClass = "text-blue-600";
  const userAvatarClasses = "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold bg-blue-500/20 text-blue-600";
  const mutedTextClass = "text-slate-500";
  const hoverTextClass = "hover:text-gray-900";

  return (
    <div className={mainLayoutClasses}>
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />
      <Sidebar
        isMobile={false}
        isOpen={true}
        onClose={() => {}}
        onLogout={() => setIsLogoutModalOpen(true)}
        user={userForDisplay}
        currentPath={router.pathname}
        _resolvedTheme="light"
      />
      <Sidebar 
        isMobile={true} 
        isOpen={isMobileSidebarOpen} 
        onClose={() => setIsMobileSidebarOpen(false)} 
        onLogout={() => setIsLogoutModalOpen(true)}
        user={userForDisplay} 
        currentPath={router.pathname}
        _resolvedTheme="light"
      />
      <main className="flex-1 md:ml-64 flex flex-col">
        <header className={mobileHeaderClasses}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileSidebarOpen(true)}
                className={`${mutedTextClass} ${hoverTextClass} mr-2`}
                aria-label="Open sidebar"
              >
                <i className="fas fa-bars text-lg"></i>
              </Button>
              <div className="flex items-center">
                <span className={`${primaryTextClass} text-2xl mr-2`}>
                  <i className="fas fa-comment-dots"></i>
                </span>
                <h1 className="font-heading font-bold text-lg text-gray-900">ReviewHub</h1>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {userForDisplay && (
                <div className="flex items-center space-x-2">
                  <div className={userAvatarClasses}>{userInitials}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsLogoutModalOpen(true)}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i>
                    Logout
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className={contentWrapperClasses}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
