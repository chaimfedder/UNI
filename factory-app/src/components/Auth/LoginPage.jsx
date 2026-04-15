import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  if (user) {
    navigate('/orders', { replace: true });
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/orders', { replace: true });
    } catch {
      setError(t('auth.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0F0F0F 0%, #1A1A1A 60%, #2A2000 100%)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #E8C84A)' }}
          >
            <svg className="w-8 h-8 text-charcoal-900" fill="none" stroke="#111111" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-charcoal-800">{t('nav.title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('auth.login')}</p>
        </div>

        {/* Language selector */}
        <div className="flex gap-2 justify-center mb-6">
          {['he', 'en', 'pl'].map(lng => (
            <button
              key={lng}
              onClick={() => i18n.changeLanguage(lng)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors
                ${i18n.language === lng
                  ? 'text-charcoal-900 border-gold-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gold-500'}`}
              style={i18n.language === lng ? { backgroundColor: '#C9A84C', color: '#0F0F0F' } : {}}
            >
              {lng === 'he' ? 'עברית' : lng === 'en' ? 'English' : 'Polski'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">{t('auth.email')}</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="form-label">{t('auth.password')}</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="alert-error text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-2.5 text-base"
          >
            {loading ? t('common.loading') : t('auth.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
