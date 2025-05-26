import { useEffect, useState } from "react";
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import Sidebar from "./Sidebar";
import { useToast } from "../hooks/use-toast";
import { Button } from "./ui/button";

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
    } 
  }, [authStatus, router]);

  const getPageTitle = () => {
    switch (router.pathname) {
      case "/dashboard": return "Dashboard";
      case "/widgets": return "My Widgets";
      case "/reviews": return "Manage Reviews";
      case "/settings": return "Settings";
      default:
        const pathParts = router.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1];
          return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/-/g, ' ');
        }
        return "ReviewHub";
    }
  }

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
  const desktopHeaderClasses = `hidden md:flex items-center justify-between ${headerClasses.replace('px-4', 'px-6')}`;
  const contentWrapperClasses = "flex-grow p-4 sm:p-6 bg-white text-gray-800";
  const primaryTextClass = "text-blue-600";
  const userAvatarClasses = "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold bg-blue-500/20 text-blue-600";
  const desktopUserAvatarClasses = "h-9 w-9 rounded-full flex items-center justify-center text-base font-semibold cursor-pointer bg-blue-500/20 text-blue-600";
  const mutedTextClass = "text-slate-500";
  const hoverTextClass = "hover:text-gray-900";

  return (
    <div className={mainLayoutClasses}>
      <Sidebar
        isMobile={false}
        isOpen={true}
        onClose={() => {}}
        onLogout={handleLogout}
        user={userForDisplay}
        currentPath={router.pathname}
        resolvedTheme="light"
      />
      <Sidebar 
        isMobile={true} 
        isOpen={isMobileSidebarOpen} 
        onClose={() => setIsMobileSidebarOpen(false)} 
        onLogout={handleLogout}
        user={userForDisplay} 
        currentPath={router.pathname}
        resolvedTheme="light"
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
              {userForDisplay && (<div className={userAvatarClasses}>{userInitials}</div>)}
            </div>
          </div>
        </header>
        <header className={desktopHeaderClasses}>
          <h2 className="text-xl font-heading font-semibold text-gray-900">
            {getPageTitle()}
          </h2>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className={`${mutedTextClass} ${hoverTextClass} relative`} aria-label="Notifications">
              <i className="fas fa-bell text-lg"></i>
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-1 bg-red-500 ring-white"></span>
            </Button>
            {userForDisplay && (<div className={desktopUserAvatarClasses} title={userForDisplay.name || userForDisplay.email || ""}>{userInitials}</div>)}
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
