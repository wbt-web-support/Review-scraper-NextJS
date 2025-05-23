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

  const sidebarBg = 'bg-slate-50';
  const sidebarText = 'text-slate-700';
  const sidebarBorder = 'border-slate-200';

  const logoIconColor = 'text-blue-600';
  const logoTextColor = 'text-gray-800 group-hover:text-blue-600';

  const navItemBase = "flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 group";
  const navItemInactiveText = 'text-slate-600 group-hover:text-slate-900';
  const navItemInactiveBgHover = 'hover:bg-slate-200';
  const navItemActiveClasses = 'bg-blue-500/10 text-blue-700 font-semibold';

  const navIconText = 'text-slate-400 group-hover:text-slate-600';
  const navIconActiveText = 'text-blue-700';

  const userAvatarBg = 'bg-blue-600/20';
  const userAvatarText = 'text-blue-600';
  const userNameTextClass = 'text-gray-900';
  const userEmailTextClass = 'text-slate-500';

  const logoutButtonClasses = `w-full flex items-center justify-start px-3 py-2.5 text-slate-600 hover:text-red-600 hover:bg-red-500/10`;
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
        <div className="flex flex-col h-full">
          <div className="flex items-center px-4 py-3 border-b border-slate-200">
            <a href="/dashboard" className="flex items-center group">
              <span className={`text-2xl mr-2 ${logoIconColor}`}>
                <i className="fas fa-comment-dots"></i>
              </span>
              <span className={`font-bold text-lg ${logoTextColor}`}>ReviewHub</span>
            </a>
          </div>

          <nav className="flex-1 px-2 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = currentPath === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`${navItemBase} ${isActive ? navItemActiveClasses : `${navItemInactiveText} ${navItemInactiveBgHover}`}`}
                >
                  <i className={`fas fa-${item.icon} w-5 ${isActive ? navIconActiveText : navIconText}`}></i>
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>

          {user && (
            <div className="p-4 border-t border-slate-200">
              <div className="flex items-center mb-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${userAvatarBg} ${userAvatarText}`}>
                  {userInitials}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${userNameTextClass}`}>{userDisplayName}</p>
                  <p className={`text-xs ${userEmailTextClass}`}>{user.email}</p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className={logoutButtonClasses}
              >
                <i className="fas fa-sign-out-alt w-5"></i>
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
export default Sidebar;