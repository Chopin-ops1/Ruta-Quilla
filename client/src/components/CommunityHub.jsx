/**
 * ============================================
 * RutaQuilla - Community Hub
 * ============================================
 *
 * Sidebar/bottom-sheet component showing:
 * - User XP profile card (if logged in)
 * - Leaderboard top 10
 * - Activity feed
 *
 * Mobile-first: appears as a bottom drawer.
 * Desktop: slides in from the right side.
 */

import { useState, useEffect, useCallback } from 'react';
import { Trophy, X, Star, Users, Zap, Award, Activity, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { communityAPI } from '../services/api';

export default function CommunityHub({ isOpen, onClose }) {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState('ranking'); // 'ranking' | 'feed' | 'profile'
  const [leaderboard, setLeaderboard] = useState([]);
  const [feed, setFeed] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [lbRes, feedRes] = await Promise.all([
        communityAPI.getLeaderboard(10),
        communityAPI.getFeed(15),
      ]);
      setLeaderboard(lbRes.data || []);
      setFeed(feedRes.data || []);

      if (isAuthenticated) {
        try {
          const profRes = await communityAPI.getProfile();
          setProfile(profRes.data);
        } catch (_) {}
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const TABS = [
    { id: 'ranking', label: 'Ranking', icon: Trophy },
    { id: 'feed', label: 'Actividad', icon: Activity },
    ...(isAuthenticated ? [{ id: 'profile', label: 'Perfil', icon: User }] : []),
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(13, 16, 20, 0.58)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rq-sheet animate-slide-up"
        style={{
          width: '100%', maxWidth: 440,
          maxHeight: '80vh',
          borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
          borderBottom: 'none',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div className="sheet-handle" style={{ marginTop: 10, marginBottom: 4 }} />
        {/* Header */}
        <div style={{
          padding: '6px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(255, 194, 26, 0.14)',
              border: '1px solid rgba(255, 194, 26, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--brand)',
            }}>
              <Users size={14} />
            </div>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Comunidad Quilla
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rq-icon-btn"
            style={{ width: 30, height: 30 }}
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 6, padding: '10px 16px 8px',
          borderBottom: '1px solid var(--border-color)',
          overflowX: 'auto',
        }}>
          {TABS.map(t => {
            const TabIcon = t.icon;
            const active = tab === t.id;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rq-chip ${active ? 'rq-chip-active' : ''}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
                }}
              >
                <TabIcon size={12} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 20px' }}>
          {loading ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Cargando...</p>
          ) : tab === 'ranking' ? (
            <RankingTab data={leaderboard} />
          ) : tab === 'feed' ? (
            <FeedTab data={feed} />
          ) : tab === 'profile' && profile ? (
            <ProfileTab data={profile} />
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
              Inicia sesión para ver tu perfil
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Ranking Tab ---- */
function RankingTab({ data }) {
  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: 30 }}>
        <Trophy size={28} color="var(--text-muted)" style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Aún no hay contribuidores</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>¡Sé el primero en capturar una ruta!</p>
      </div>
    );
  }

  const podiumColors = ['#FFC21A', '#9CA3AF', '#D97706'];

  return data.map((u, i) => {
    const initials = u.name?.charAt(0)?.toUpperCase() || '?';
    const xpMax = data[0]?.xp || 1;
    const barW = Math.max(4, Math.round((u.xp / xpMax) * 100));
    const topColor = i < 3 ? podiumColors[i] : null;
    return (
      <div key={u._id} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 0',
        borderBottom: i < data.length - 1 ? '1px solid var(--border-color)' : 'none',
      }}>
        <span
          className="tabular-nums font-mono"
          style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
            background: topColor ? `${topColor}1C` : 'var(--bg-surface)',
            border: `1px solid ${topColor ? `${topColor}45` : 'var(--border-color)'}`,
            color: topColor || 'var(--text-muted)',
          }}
        >
          {i + 1}
        </span>
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: `${u.levelColor}1E`, border: `1.5px solid ${u.levelColor}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: u.levelColor,
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.name}
            </span>
            <span className="tabular-nums font-mono" style={{ fontSize: 11, fontWeight: 700, color: u.levelColor, flexShrink: 0 }}>
              {u.xp} XP
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-surface)', overflow: 'hidden' }}>
            <div style={{ width: `${barW}%`, height: '100%', borderRadius: 2, background: u.levelColor, transition: 'width 0.4s ease' }} />
          </div>
        </div>
        <div style={{
          fontSize: 9.5, fontWeight: 700, color: u.levelColor,
          background: `${u.levelColor}15`, border: `1px solid ${u.levelColor}30`,
          borderRadius: 6, padding: '3px 8px', flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {u.levelName}
        </div>
      </div>
    );
  });
}

/* ---- Feed Tab ---- */
function FeedTab({ data }) {
  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: 30 }}>
        <Zap size={28} color="var(--text-muted)" style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Sin actividad reciente</p>
      </div>
    );
  }

  return data.map((item, i) => {
    const ago = item.createdAt
      ? (() => {
          const mins = Math.round((Date.now() - new Date(item.createdAt).getTime()) / 60000);
          if (mins < 1) return 'ahora';
          if (mins < 60) return `hace ${mins} min`;
          const hrs = Math.round(mins / 60);
          if (hrs < 24) return `hace ${hrs}h`;
          return `hace ${Math.round(hrs / 24)}d`;
        })()
      : '';

    return (
      <div key={i} style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 0',
        borderBottom: i < data.length - 1 ? '1px solid var(--border-color)' : 'none',
      }}>
        <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>{item.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>{item.text}</p>
          {item.detail && (
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>{item.detail}</p>
          )}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, paddingTop: 2 }}>{ago}</span>
      </div>
    );
  });
}

/* ---- Profile Tab ---- */
function ProfileTab({ data }) {
  const nextXP = data.xpToNext > 0 ? data.xpToNext : 0;
  const levelProgress = data.nextLevelName
    ? Math.max(5, 100 - Math.round((nextXP / (data.xp + nextXP)) * 100))
    : 100;

  return (
    <div>
      {/* Profile Card */}
      <div className="rq-card" style={{
        padding: 18,
        background: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
        borderTop: `3px solid ${data.levelColor}`,
        marginBottom: 16, textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, margin: '0 auto 10px',
          background: `${data.levelColor}1E`, border: `1.5px solid ${data.levelColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 800, color: data.levelColor,
        }}>
          {data.name?.charAt(0)?.toUpperCase() || '?'}
        </div>

        <h3 className="font-display" style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          {data.name}
        </h3>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 6,
          background: `${data.levelColor}1C`, color: data.levelColor,
          fontSize: 11.5, fontWeight: 700,
        }}>
          <Star size={11} />
          {data.levelName}
        </div>

        {/* XP Bar */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span className="tabular-nums font-mono" style={{ fontSize: 19, fontWeight: 700, color: data.levelColor }}>{data.xp} XP</span>
            <span className="tabular-nums font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rango #{data.rank}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-card)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div style={{
              width: `${levelProgress}%`, height: '100%', borderRadius: 3,
              background: data.levelColor,
              transition: 'width 0.6s ease-out',
            }} />
          </div>
          {data.nextLevelName && (
            <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6 }}>
              {nextXP} XP para <strong style={{ color: data.levelColor }}>{data.nextLevelName}</strong>
            </p>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
          {[
            { label: 'Capturas', value: data.contributions },
            { label: 'Miembro desde', value: new Date(data.memberSince).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }) },
          ].map(s => (
            <div key={s.label}>
              <p className="tabular-nums font-mono" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</p>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      {data.badges?.length > 0 && (
        <div>
          <p className="rq-section-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Award size={12} />
            Insignias ({data.badges.length})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.badges.map(b => (
              <div key={b.id} title={b.desc} style={{
                padding: '6px 10px', borderRadius: 8,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                fontSize: 11.5, color: 'var(--text-primary)',
              }}>
                {b.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
