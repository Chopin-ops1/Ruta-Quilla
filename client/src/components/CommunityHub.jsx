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
import { Trophy, X, Star, Users, Zap, Clock, ChevronRight, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { communityAPI } from '../services/api';

export default function CommunityHub({ isOpen, onClose }) {
  const { isAuthenticated, user } = useAuth();
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
    { id: 'ranking', label: '🏆 Ranking', icon: Trophy },
    { id: 'feed', label: '📡 Feed', icon: Zap },
    ...(isAuthenticated ? [{ id: 'profile', label: '👤 Perfil', icon: Star }] : []),
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440,
          maxHeight: '80vh',
          background: 'linear-gradient(160deg, #111827, #0B1120)',
          borderRadius: '20px 20px 0 0',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={15} color="#F59E0B" />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', fontFamily: 'Outfit, sans-serif' }}>
              Comunidad Quilla
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%',
            width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} color="#94A3B8" />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, padding: '10px 16px 0', overflowX: 'auto',
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                background: tab === t.id ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                color: tab === t.id ? '#F59E0B' : '#64748B',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 20px' }}>
          {loading ? (
            <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: 20 }}>Cargando...</p>
          ) : tab === 'ranking' ? (
            <RankingTab data={leaderboard} />
          ) : tab === 'feed' ? (
            <FeedTab data={feed} />
          ) : tab === 'profile' && profile ? (
            <ProfileTab data={profile} />
          ) : (
            <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: 20 }}>
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
        <Trophy size={28} color="#334155" style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Aún no hay contribuidores</p>
        <p style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>¡Sé el primero en capturar una ruta!</p>
      </div>
    );
  }

  const rankIcons = ['🥇', '🥈', '🥉'];

  return data.map((u, i) => {
    const initials = u.name?.charAt(0)?.toUpperCase() || '?';
    const xpMax = data[0]?.xp || 1;
    const barW = Math.max(4, Math.round((u.xp / xpMax) * 100));
    return (
      <div key={u._id} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 0',
        borderBottom: i < data.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
      }}>
        <span style={{ fontSize: 14, width: 24, textAlign: 'center', flexShrink: 0 }}>
          {i < 3 ? rankIcons[i] : `${i + 1}°`}
        </span>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: `${u.levelColor}22`, border: `1.5px solid ${u.levelColor}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: u.levelColor,
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.name}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: u.levelColor, flexShrink: 0 }}>
              {u.xp} XP
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ width: `${barW}%`, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${u.levelColor}88, ${u.levelColor})`, transition: 'width 0.5s' }} />
          </div>
        </div>
        <div style={{
          fontSize: 9, fontWeight: 700, color: u.levelColor,
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
        <Zap size={28} color="#334155" style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Sin actividad reciente</p>
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
        borderBottom: i < data.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
      }}>
        <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>{item.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#E2E8F0', lineHeight: 1.4 }}>{item.text}</p>
          {item.detail && (
            <p style={{ margin: '3px 0 0', fontSize: 11, color: '#64748B' }}>{item.detail}</p>
          )}
        </div>
        <span style={{ fontSize: 10, color: '#334155', flexShrink: 0, paddingTop: 2 }}>{ago}</span>
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
      <div style={{
        padding: 20, borderRadius: 16,
        background: `linear-gradient(135deg, ${data.levelColor}12, rgba(255,255,255,0.02))`,
        border: `1px solid ${data.levelColor}30`,
        marginBottom: 16, textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 10px',
          background: `${data.levelColor}22`, border: `2px solid ${data.levelColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800, color: data.levelColor,
        }}>
          {data.name?.charAt(0)?.toUpperCase() || '?'}
        </div>

        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#F1F5F9', fontFamily: 'Outfit, sans-serif' }}>
          {data.name}
        </h3>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 8,
          background: `${data.levelColor}20`, color: data.levelColor,
          fontSize: 12, fontWeight: 700,
        }}>
          <Star size={12} />
          {data.levelName}
        </div>

        {/* XP Bar */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: data.levelColor }}>{data.xp} XP</span>
            <span style={{ fontSize: 11, color: '#475569' }}>Rango #{data.rank}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{
              width: `${levelProgress}%`, height: '100%', borderRadius: 3,
              background: `linear-gradient(90deg, ${data.levelColor}88, ${data.levelColor})`,
              transition: 'width 0.8s ease-out',
            }} />
          </div>
          {data.nextLevelName && (
            <p style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>
              {nextXP} XP para <strong style={{ color: data.levelColor }}>{data.nextLevelName}</strong>
            </p>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 14 }}>
          {[
            { label: 'Capturas', value: data.contributions },
            { label: 'Miembro desde', value: new Date(data.memberSince).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }) },
          ].map(s => (
            <div key={s.label}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>{s.value}</p>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: '#64748B' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      {data.badges?.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 8 }}>
            <Award size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Insignias ({data.badges.length})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.badges.map(b => (
              <div key={b.id} title={b.desc} style={{
                padding: '6px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12, color: '#E2E8F0',
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
