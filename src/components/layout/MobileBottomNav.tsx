'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const mobileNavigation = [
  { 
    name: 'Home', 
    href: '/dashboard', 
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  {
    name: 'Appointments',
    href: '/dashboard/appointments',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    name: 'Customers',
    href: '/dashboard/customers',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  { 
    name: 'Check-In', 
    href: '/dashboard/checkins', 
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    )
  },
];

const morePages = [
  { 
    name: 'Services', 
    href: '/dashboard/services',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    name: 'Business Hours',
    href: '/dashboard/business-hours',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    name: 'Settings', 
    href: '/dashboard/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Check if we're on a "more" page
  const isOnMorePage = morePages.some(page => 
    pathname === page.href || pathname.startsWith(page.href + '/')
  );

  return (
    <>
      {/* More Menu Overlay */}
      {showMoreMenu && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowMoreMenu(false)}
          />          <div className="fixed bottom-16 left-0 right-0 bg-white rounded-t-2xl border-t border-gray-200 shadow-2xl z-50 max-h-80 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">More Pages</h3>
                <button
                  onClick={() => setShowMoreMenu(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="py-2">{morePages.map((page) => {
                const isActive = pathname === page.href || pathname.startsWith(page.href + '/');
                return (
                  <Link
                    key={page.href}
                    href={page.href}
                    onClick={() => setShowMoreMenu(false)}
                    className={`flex items-center px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary border-l-4 border-primary pl-3'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`mr-3 ${isActive ? 'text-primary' : 'text-gray-500'}`}>
                      {page.icon}
                    </span>
                    {page.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation */}
      <nav className="flex justify-around items-center h-16 px-2">
        {mobileNavigation.map((item) => {
          const isActive = item.href === '/dashboard' 
            ? pathname === item.href 
            : pathname === item.href || pathname.startsWith(item.href + '/');
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-0 flex-1 py-2 px-1 transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className={`mb-1 ${isActive ? 'text-primary' : 'text-gray-600'}`}>
                {item.icon}
              </div>
              <span className={`text-[10px] font-medium truncate w-full text-center ${
                isActive ? 'text-primary' : 'text-gray-600'
              }`}>
                {item.name}
              </span>
            </Link>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className={`flex flex-col items-center justify-center min-w-0 flex-1 py-2 px-1 transition-colors ${
            isOnMorePage || showMoreMenu
              ? 'text-primary'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className={`mb-1 ${isOnMorePage || showMoreMenu ? 'text-primary' : 'text-gray-600'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <span className={`text-[10px] font-medium truncate w-full text-center ${
            isOnMorePage || showMoreMenu ? 'text-primary' : 'text-gray-600'
          }`}>
            More
          </span>
        </button>
      </nav>
    </>
  );
}
