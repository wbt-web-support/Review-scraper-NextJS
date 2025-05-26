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

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform ${isMobile ? 'translate-x-0' : 'translate-x-0'} ${sidebarBg} ${sidebarText} border-r ${sidebarBorder} transition-transform duration-200 ease-in-out md:translate-x-0`}>
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <span className={`${logoIconColor} text-2xl`}>
              <i className="fas fa-comment-dots"></i>
            </span>
            <span className={`${logoTextColor} text-xl font-bold`}>ReviewHub</span>
          </div>
          {isMobile && (
            <button
              onClick={onClose}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`${navItemBase} ${isActive ? navItemActiveClasses : `${navItemInactiveText} ${navItemInactiveBgHover}`}`}
              >
                <i className={`fas fa-${item.icon} ${isActive ? navIconActiveText : navIconText} mr-3`}></i>
                {item.label}
              </a>
            );
          })}
        </nav>
        {user && (
          <div className="border-t border-slate-200 p-4">
            <div className="flex items-center space-x-3">
              <div className={`${userAvatarBg} ${userAvatarText} h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold`}>
                {(user.fullName || user.name || user.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`${userNameTextClass} text-sm font-medium truncate`}>
                  {user.fullName || user.name || user.username}
                </p>
                <p className={`${userEmailTextClass} text-xs truncate`}>
                  {user.email}
                </p>
              </div>
              <button
                onClick={onLogout}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                title="Logout"
              >
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;