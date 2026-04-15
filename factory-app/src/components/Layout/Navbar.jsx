import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  { to: '/orders',        key: 'nav.newOrders',    icon: '📋' },
  { to: '/packing',       key: 'nav.packing',       icon: '📦' },
  { to: '/packing-lists', key: 'nav.packingLists',  icon: '🗂️' },
  { to: '/tracking',      key: 'nav.orderTracking', icon: '🔍' },
];

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { signOut }  = useAuth();

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center gap-2 font-bold text-blue-700 text-lg shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="hidden sm:block">{t('nav.title')}</span>
          </div>

          {/* Tab links */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map(({ to, key, icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                   ${isActive
                     ? 'bg-blue-600 text-white'
                     : 'text-gray-600 hover:bg-gray-100'}`
                }
              >
                <span>{icon}</span>
                <span>{t(key)}</span>
              </NavLink>
            ))}
          </div>

          {/* Right: Language + Logout */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Language switcher */}
            <div className="hidden sm:flex gap-1">
              {['he', 'en', 'pl'].map(lng => (
                <button
                  key={lng}
                  onClick={() => i18n.changeLanguage(lng)}
                  className={`px-2 py-0.5 rounded text-xs font-semibold border transition-colors
                    ${i18n.language === lng
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'text-gray-500 border-gray-300 hover:border-blue-400'}`}
                >
                  {lng === 'he' ? 'ע' : lng === 'en' ? 'EN' : 'PL'}
                </button>
              ))}
            </div>

            {/* Logout */}
            <button
              onClick={signOut}
              className="btn-secondary btn-sm gap-1"
              title={t('nav.logout')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
