import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  Users,
  UserSquare2,
  History,
  CreditCard,
  LogOut,
  Menu,
  X,
  Database as DatabaseIcon,
  Settings as SettingsIcon,
  Map as MapIcon,
  Trash2,
  FileText,
  Shield,
  Radio,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { PilotFeedback } from './PilotFeedback';

const navigationGroups = [
  {
    title: 'Command',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Dispatcher Map', href: '/dispatcher', icon: MapIcon, roles: ['admin', 'dispatcher'] },
    ]
  },
  {
    title: 'Operations',
    items: [
      { name: 'Dispatch', href: '/dispatch', icon: Radio, roles: ['admin', 'dispatcher'] },
      { name: 'Dispatch Grid', href: '/loads', icon: Truck },
      { name: 'Dumpyards', href: '/dumpyards', icon: Trash2, roles: ['admin', 'dispatcher'] },
    ]
  },
  {
    title: 'Assets',
    items: [
      { name: 'Dumpsters', href: '/dumpsters', icon: DatabaseIcon, roles: ['admin', 'dispatcher'] },
    ]
  },
  {
    title: 'People',
    items: [
      { name: 'Drivers', href: '/drivers', icon: UserSquare2 },
      { name: 'Team', href: '/team', icon: Shield, roles: ['admin'] },
    ]
  },
  {
    title: 'Customers',
    items: [
      { name: 'Clients', href: '/customers', icon: Users },
    ]
  },
  {
    title: 'Finance',
    items: [
      { name: 'Billing', href: '/fees', icon: CreditCard, roles: ['admin'] },
      { name: 'Dumpster Ledger', href: '/dumpster-ledger', icon: BookOpen, roles: ['admin'] },
    ]
  },
  {
    title: 'Administration',
    items: [
      { name: 'Audit Logs', href: '/audit-logs', icon: History },
      { name: 'Settings', href: '/settings', icon: SettingsIcon, roles: ['admin'] },
    ]
  }
];

export function Sidebar() {
  const { signOut, profile } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);

  const canAccess = (roles?: string[]) => {
    if (!roles) return true;
    return roles.includes(profile?.role || '');
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md bg-white shadow-md text-gray-600 hover:text-gray-900 focus:outline-none"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200">
            <span className="text-2xl font-bold text-blue-600">Debrios</span>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto">
            {navigationGroups.map((group) => {
              const visibleItems = group.items.filter(item => canAccess(item.roles));
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.title} className="space-y-2">
                  <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {group.title}
                  </h3>
                  <div className="space-y-1">
                    {visibleItems.map((item) => (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        onClick={() => setIsOpen(false)}
                        className={({ isActive }) => cn(
                          "flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                          isActive 
                            ? "bg-blue-50 text-blue-700" 
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )}
                      >
                        <item.icon className="mr-3 h-4 w-4" />
                        {item.name}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 space-y-2">
            <PilotFeedback />
            <button
              onClick={() => signOut()}
              className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-gray-600 bg-opacity-50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
