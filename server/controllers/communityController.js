/**
 * ============================================
 * RutaQuilla - Community Controller
 * ============================================
 *
 * Endpoints para el sistema comunitario Quilla XP:
 * - GET /api/community/leaderboard — Top 10 contribuidores (público)
 * - GET /api/community/me         — Perfil XP del usuario autenticado
 * - GET /api/community/levels     — Tabla de niveles y badges (pública)
 */

const User = require('../models/UserModel');

/**
 * GET /api/community/leaderboard
 * Retorna el top 10 usuarios ordenados por XP.
 * Endpoint público — no requiere autenticación.
 *
 * Query params:
 *   ?limit=10  (máximo 25)
 *   ?period=week|month|all  (por ahora solo 'all' implementado)
 */
async function getLeaderboard(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 25);

    const users = await User.find({ contributions: { $gt: 0 } })
      .select('name avatar xp level badges contributions')
      .sort({ xp: -1, contributions: -1 })
      .limit(limit)
      .lean();

    // Enriquecer con info del nivel actual
    const { XP_LEVELS, BADGE_DEFINITIONS } = User;

    const enriched = users.map((u, idx) => {
      const levelInfo = XP_LEVELS.find(l => l.level === (u.level || 1)) || XP_LEVELS[0];
      const nextLevel = XP_LEVELS.find(l => l.level === (u.level || 1) + 1);
      return {
        rank: idx + 1,
        _id: u._id,
        name: u.name,
        avatar: u.avatar || '',
        xp: u.xp || 0,
        level: u.level || 1,
        levelName: levelInfo.name,
        levelColor: levelInfo.color,
        xpToNext: nextLevel ? nextLevel.minXP - (u.xp || 0) : 0,
        badges: (u.badges || []).slice(0, 3), // Top 3 badges en el leaderboard
        contributions: u.contributions || 0,
      };
    });

    res.json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    console.error('Error en leaderboard:', error);
    res.status(500).json({ success: false, message: 'Error al obtener el ranking' });
  }
}

/**
 * GET /api/community/me
 * Perfil XP completo del usuario autenticado.
 * Incluye: XP, nivel, badges, rango global, XP necesario para el siguiente nivel.
 */
async function getMyProfile(req, res) {
  try {
    const { XP_LEVELS, BADGE_DEFINITIONS } = User;

    const user = await User.findById(req.user._id)
      .select('name email avatar xp level badges contributions role isPremium createdAt')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // Calcular rango global del usuario
    const rank = await User.countDocuments({ xp: { $gt: user.xp || 0 } }) + 1;

    const currentLevelInfo = XP_LEVELS.find(l => l.level === (user.level || 1)) || XP_LEVELS[0];
    const nextLevelInfo = XP_LEVELS.find(l => l.level === (user.level || 1) + 1);

    // Enriquecer badges con la definición completa
    const badgesDetail = (user.badges || []).map(id => {
      const def = BADGE_DEFINITIONS.find(b => b.id === id);
      return def || { id, label: id, desc: '', xpBonus: 0 };
    });

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        isPremium: user.isPremium,
        contributions: user.contributions || 0,
        xp: user.xp || 0,
        level: user.level || 1,
        levelName: currentLevelInfo.name,
        levelColor: currentLevelInfo.color,
        xpToNext: nextLevelInfo ? nextLevelInfo.minXP - (user.xp || 0) : 0,
        nextLevelName: nextLevelInfo ? nextLevelInfo.name : null,
        rank,
        badges: badgesDetail,
        memberSince: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error en perfil comunitario:', error);
    res.status(500).json({ success: false, message: 'Error al obtener el perfil' });
  }
}

/**
 * GET /api/community/levels
 * Devuelve la tabla pública de niveles y todas las insignias disponibles.
 * Útil para que el frontend muestre la progresión sin hardcodear.
 */
async function getLevelsInfo(req, res) {
  try {
    const { XP_LEVELS, BADGE_DEFINITIONS } = User;
    res.json({ success: true, data: { levels: XP_LEVELS, badges: BADGE_DEFINITIONS } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener info de niveles' });
  }
}

module.exports = { getLeaderboard, getMyProfile, getLevelsInfo };
