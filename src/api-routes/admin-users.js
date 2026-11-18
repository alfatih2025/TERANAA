import {
  getConfiguredAdminEmails,
  isFirebaseAdmin,
  requireFirebaseAdmin,
  requireFirebaseAuth,
} from '../lib/apiHelpers/_auth.js';
import supabase from '../lib/apiHelpers/_supabase.js';

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const isAdmin = await isFirebaseAdmin(user);
    if (!isAdmin) {
      return res.status(200).json({
        currentUser: { email: user.email, role: 'user' },
        users: [],
      });
    }

    const { data, error } = await supabase
      .from('app_admin_users')
      .select('email, created_at, invited_by')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Admin Users] Failed to load invited admins:', error.message);
      return res.status(500).json({ error: 'Gagal memuat daftar administrator.' });
    }

    const users = (data || []).map((item) => ({
      id: item.email,
      email: item.email,
      username: item.email.split('@')[0],
      role: 'admin',
    }));
    for (const email of getConfiguredAdminEmails()) {
      if (!users.some((item) => item.email === email)) {
        users.unshift({ id: email, email, username: email.split('@')[0], role: 'admin' });
      }
    }

    return res.status(200).json({
      currentUser: { email: user.email, role: 'admin' },
      users,
    });
  }

  const admin = await requireFirebaseAdmin(req, res);
  if (!admin) return;

  try {
    if (req.method === 'POST') {
      const email = normalizeEmail(req.body?.email);
      if (!isValidEmail(email)) return res.status(400).json({ error: 'Alamat email tidak valid.' });
      if (getConfiguredAdminEmails().includes(email)) {
        return res.status(409).json({ error: 'Email tersebut sudah menjadi administrator utama.' });
      }

      const { error } = await supabase.from('app_admin_users').upsert({
        email,
        invited_by: admin.email,
      }, { onConflict: 'email' });
      if (error) throw error;

      return res.status(201).json({
        user: { id: email, email, username: email.split('@')[0], role: 'admin' },
      });
    }

    if (req.method === 'DELETE') {
      const email = normalizeEmail(req.query?.email);
      if (!isValidEmail(email)) return res.status(400).json({ error: 'Alamat email tidak valid.' });
      if (getConfiguredAdminEmails().includes(email)) {
        return res.status(400).json({ error: 'Administrator utama tidak dapat dihapus.' });
      }

      const { error } = await supabase
        .from('app_admin_users')
        .delete()
        .eq('email', email);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error('[Admin Users] Request failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Gagal mengelola administrator.',
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
