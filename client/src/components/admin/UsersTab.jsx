import { useState, useEffect } from 'react';
import { Users, Shield, Star, CheckCircle2, Clock } from 'lucide-react';
import { adminAPI } from '../../services/api';

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminAPI.getUsers();
        setUsers(res.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <p style={{ padding: 20, color: '#475569', fontSize: 12 }}>Cargando usuarios...</p>;

  return (
    <div className="animate-fade-in" style={{ padding: 12, overflowY: 'auto', height: '100%' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, padding: '0 4px' }}>
        👥 {users.length} usuarios registrados
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {users.map(u => (
          <div key={u._id} style={{
            padding: '10px 12px', borderRadius: 12,
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: u.role === 'admin' ? 'rgba(239,68,68,0.12)' : u.role === 'premium' ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {u.role === 'admin' ? <Shield size={14} color="#EF4444" /> :
               u.role === 'premium' ? <Star size={14} color="#F59E0B" /> :
               <Users size={14} color="#64748B" />}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.name}
                </p>
                {u.isVerified && <CheckCircle2 size={10} color="#10B981" />}
                {u.isActive && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px rgba(16,185,129,0.5)' }} />
                )}
              </div>
              <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>{u.email}</p>
            </div>

            {/* Role badge */}
            <span style={{
              fontSize: 8, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 6,
              background: u.role === 'admin' ? 'rgba(239,68,68,0.1)' : u.role === 'premium' ? 'rgba(245,158,11,0.1)' : 'rgba(100,116,139,0.08)',
              color: u.role === 'admin' ? '#EF4444' : u.role === 'premium' ? '#F59E0B' : '#64748B',
              border: `1px solid ${u.role === 'admin' ? 'rgba(239,68,68,0.2)' : u.role === 'premium' ? 'rgba(245,158,11,0.2)' : 'rgba(100,116,139,0.15)'}`,
            }}>{u.role}</span>

            {/* Contributions */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', margin: 0 }}>{u.contributions}</p>
              <p style={{ fontSize: 8, color: '#334155', margin: 0 }}>contrib.</p>
            </div>

            {/* Date */}
            <span style={{ fontSize: 9, color: '#334155', flexShrink: 0 }}>
              {new Date(u.createdAt).toLocaleDateString('es-CO')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
