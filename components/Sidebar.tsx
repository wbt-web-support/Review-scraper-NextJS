import Link from 'next/link';
import { Button } from './ui/button';

export interface IUserSessionData {
  id?: string;
  username?: string | null;
  email?: string | null;
  fullName?: string | null;
  name?: string | null; 
  image?: string | null; 
}

interface SidebarProps {
  isMobile: boolean;
  isOpen?: boolean;
  onClose: () => void;
  onLogout: () => void;
  user?: IUserSessionData | null;
  currentPath: string;
  resolvedTheme: "light" | "dark";
}

const Sidebar = ({ isMobile, isOpen, onClose, onLogout, user, currentPath, resolvedTheme }: SidebarProps) => {
  const isDark = resolvedTheme === 'dark';
  const navItems = [
    { label: "Dashboard", icon: "tachometer-alt", href: "/dashboard" },
    { label: "My Widgets", icon: "th-large", href: "/widgets" },
    { label: "Reviews", icon: "star", href: "/reviews" },
    { label: "Settings", icon: "cog", href: "/settings" },
    { label: "Help & Support", icon: "question-circle", href: "/help" },
  ];
  if (isMobile && !isOpen) {
    return null;
  }
  const sidebarBg = isDark ? 'bg-gray-800' : 'bg-slate-50'; 
  const sidebarText = isDark ? 'text-gray-200' : 'text-slate-700';
  const sidebarBorder = isDark ? 'border-gray-700' : 'border-slate-200';

  const logoIconColor = isDark ? 'text-blue-400' : 'text-blue-600'; 
  const logoTextColor = isDark ? 'text-white group-hover:text-blue-400' : 'text-gray-800 group-hover:text-blue-600';

  const navItemBase = "flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 group";
  const navItemInactiveText = isDark ? 'text-gray-400 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900';
  const navItemInactiveBgHover = isDark ? 'hover:bg-gray-700' : 'hover:bg-slate-200'; 
  const navItemActiveClasses = isDark ? 'bg-blue-500/20 text-blue-300 font-semibold' : 'bg-blue-500/10 text-blue-700 font-semibold';

  const navIconText = isDark ? 'text-gray-500 group-hover:text-gray-300' : 'text-slate-400 group-hover:text-slate-600';
  const navIconActiveText = isDark ? 'text-blue-300' : 'text-blue-700';

  const userAvatarBg = isDark ? 'bg-blue-500/30' : 'bg-blue-600/20';
  const userAvatarText = isDark ? 'text-blue-300' : 'text-blue-600';
  const userNameTextClass = isDark ? 'text-white' : 'text-gray-900';
  const userEmailTextClass = isDark ? 'text-gray-400' : 'text-slate-500';

  const logoutButtonClasses = `w-full flex items-center justify-start px-3 py-2.5 ${isDark ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/20' : 'text-slate-600 hover:text-red-600 hover:bg-red-500/10'}`;
  const sidebarContainerClasses = `flex flex-col transition-all duration-300 ease-in-out shadow-lg border-r ${sidebarBg} ${sidebarText} ${sidebarBorder}`;

  const sidebarClasses = isMobile
    ? `fixed inset-0 z-50 w-64 ${sidebarContainerClasses} ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
    : `w-64 fixed inset-y-0 z-30 hidden md:flex ${sidebarContainerClasses}`;

  const userDisplayName = user?.fullName || user?.name || user?.username || "User";
  const userInitials = userDisplayName.split(' ').map(name => name[0]).slice(0, 2).join('').toUpperCase() || 'U';

  return (
    <>
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        ></div>
      )}
      
      <aside className={sidebarClasses}>
        {isMobile && (
          <div className="absolute top-3 right-3">
            <button 
              type="button"
              onClick={onClose}
              className={`p-1 rounded-md ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-slate-500 hover:text-slate-700'}`}
              aria-label="Close Sidebar"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        )}
        <div className={`p-4 border-b flex items-center justify-center h-16 ${sidebarBorder}`}>
          <Link href="/dashboard" className="flex items-center group" >
              <span className={`${logoIconColor} text-2xl mr-2 group-hover:scale-110 transition-transform`}>
                <i className="fas fa-comment-dots"></i>
              </span>
              <h1 className={`font-heading font-bold text-xl transition-colors ${logoTextColor}`}>
                ReviewHub
              </h1>
          </Link>
        </div>
        <nav className="flex-1 pt-4 pb-4 overflow-y-auto space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = currentPath === item.href || (item.href !== "/dashboard" && currentPath.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} onClick={isMobile ? onClose : undefined} className={`${navItemBase} ${isActive ? navItemActiveClasses : `${navItemInactiveText} ${navItemInactiveBgHover}`}`}>
              <i className={`fas fa-${item.icon} w-5 h-5 text-center mr-3 flex-shrink-0 ${isActive ? navIconActiveText : navIconText}`}>
              </i>
              <span>{item.label}</span>
            </Link>
          );
      })}
        </nav>
        <div className={`border-t p-4 mt-auto ${sidebarBorder}`}>
          {user && ( 
            <div className="flex items-center mb-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${userAvatarBg} ${userAvatarText}`}>
                <span>{userInitials}</span>
              </div>
              <div className="ml-3 min-w-0"> 
                <p className={`text-sm font-semibold truncate ${userNameTextClass}`} title={userDisplayName}>
                  {userDisplayName}
                </p>
                <p className={`text-xs truncate ${userEmailTextClass}`} title={user.email || ""}>
                  {user.email || 'No email'}
                </p>
              </div>
            </div>
          )}
          <Button
            variant="ghost" 
            onClick={onLogout}
            className={logoutButtonClasses}
          >
            <i className="fas fa-sign-out-alt mr-3"></i> Logout
          </Button>
        </div>
      </aside>
    </>
  );
};
export default Sidebar;