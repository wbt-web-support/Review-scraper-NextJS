import { useEffect, useState } from "react";
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import Sidebar from "./Sidebar";
import { useToast } from "../hooks/use-toast";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { useTheme } from "next-themes";

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
  const { resolvedTheme: nextThemesResolvedTheme } = useTheme();

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

  useEffect(() => { if (authStatus === 'loading') return; if (authStatus === 'unauthenticated') { router.push("/login"); } }, [authStatus, router]);

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

  const sidebarResolvedTheme: "light" | "dark" = nextThemesResolvedTheme === "dark" ? "dark" : "light";

  if (authStatus === 'loading' || authStatus === 'unauthenticated') {
    const initialLoadBg = sidebarResolvedTheme  === 'dark' ? 'bg-gray-900' : 'bg-slate-100'; 
    const initialLoadText = sidebarResolvedTheme  === 'dark' ? 'text-gray-300' : 'text-gray-700';
    return (
      <div className={`min-h-screen flex items-center justify-center ${initialLoadBg} ${initialLoadText}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className={`mt-4 ${initialLoadText}`}>Loading Application...</p>
        </div>
      </div>
    );
  }

  const isDark = sidebarResolvedTheme  === 'dark';
  const mainLayoutClasses = `flex min-h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-slate-100 text-gray-800'}`;
  const headerClasses = `shadow-sm py-3 px-4 sticky top-0 z-40 border-b ${isDark ? 'bg-gray-800 text-gray-100 border-gray-700' : 'bg-white text-gray-800 border-slate-200'}`;
  const mobileHeaderClasses = `${headerClasses} md:hidden`;
  const desktopHeaderClasses = `hidden md:flex items-center justify-between ${headerClasses.replace('px-4', 'px-6')}`;
  const contentWrapperClasses = `flex-grow p-4 sm:p-6 ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-800'}`;
  const primaryTextClass = isDark ? 'text-blue-400' : 'text-blue-600'; 
  const userAvatarClasses = `h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${isDark ? 'bg-blue-500/30 text-blue-300' : 'bg-blue-500/20 text-blue-600'}`;
  const desktopUserAvatarClasses = `h-9 w-9 rounded-full flex items-center justify-center text-base font-semibold cursor-pointer ${isDark ? 'bg-blue-500/30 text-blue-300' : 'bg-blue-500/20 text-blue-600'}`;
  const mutedTextClass = isDark ? 'text-gray-400' : 'text-slate-500';
  const hoverTextClass = isDark ? 'hover:text-white' : 'hover:text-gray-900';

  return (
    <div className={mainLayoutClasses}>
      <Sidebar
        isMobile={false}
        isOpen={true}
        onClose={() => {}}
        onLogout={handleLogout}
        user={userForDisplay}
        currentPath={router.pathname}
        resolvedTheme={sidebarResolvedTheme}
      />
      <Sidebar 
        isMobile={true} 
        isOpen={isMobileSidebarOpen} 
        onClose={() => setIsMobileSidebarOpen(false)} 
        onLogout={handleLogout}
        user={userForDisplay} 
        currentPath={router.pathname}
        resolvedTheme={sidebarResolvedTheme}
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
                <h1 className={`font-heading font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>ReviewHub</h1>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <ThemeToggle />
              {userForDisplay && (<div className={userAvatarClasses}>{userInitials}</div>)}
            </div>
          </div>
        </header>
        <header className={desktopHeaderClasses}>
          <h2 className={`text-xl font-heading font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {getPageTitle()}
          </h2>
          
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className={`${mutedTextClass} ${hoverTextClass} relative`} aria-label="Notifications">
              <i className="fas fa-bell text-lg"></i>
              <span className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-1 ${isDark ? 'bg-red-500 ring-gray-800' : 'bg-red-500 ring-white'}`}></span>
            </Button>
            <ThemeToggle />
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
