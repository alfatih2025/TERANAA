import React, { useState, useEffect } from 'react';
import { auth, db, googleAuthProvider } from '../lib/firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { AuthContext, type Role, type User } from './auth-context';

export type { Role, User } from './auth-context';
const LEGACY_OWNER_EMAIL = 'alfatihwibowo264@gmail.com';

async function fetchAdminUsers(token: string) {
  const response = await fetch('/api/admin-users', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Gagal memverifikasi peran akun.');
  return result;
}

async function migrateLegacyAdminInvites(token: string) {
  const snapshot = await getDocs(collection(db, 'users'));
  for (const userDoc of snapshot.docs) {
    const data = userDoc.data();
    const email = String(data.email || userDoc.id).trim().toLowerCase();
    if (data.role !== 'admin' || !email.includes('@') || email === LEGACY_OWNER_EMAIL) continue;
    const response = await fetch('/api/admin-users', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error || `Gagal memigrasikan undangan ${email}.`);
    }
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getErrorCode(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return 'unknown';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string>('');

  useEffect(() => {
    // Tangkap hasil redirect login saat halaman dimuat kembali dari Google
    getRedirectResult(auth).then((result) => {
       if(result) {
         console.log("Redirect login berhasil:", result.user.email);
       }
    }).catch((error) => {
      console.error('Redirect result error:', error);
      setAuthError(`Error Redirect: ${error.code} - ${error.message}`);
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUsers([]);
      setAuthError('');
      setLoading(true);
      if (firebaseUser && firebaseUser.email) {
        const signedInUser: User = {
          id: firebaseUser.uid,
          username: firebaseUser.displayName || firebaseUser.email.split('@')[0] || 'User',
          email: firebaseUser.email,
          role: 'user',
        };
        try {
          const token = await firebaseUser.getIdToken();
          let result = await fetchAdminUsers(token);
          if (signedInUser.email.toLowerCase() === LEGACY_OWNER_EMAIL && result.currentUser?.role === 'admin') {
            try {
              await migrateLegacyAdminInvites(token);
              result = await fetchAdminUsers(token);
            } catch (migrationError) {
              console.warn('Gagal memigrasikan undangan administrator lama:', migrationError);
            }
          }

          signedInUser.role = result.currentUser?.role === 'admin' ? 'admin' : 'user';
          if (signedInUser.role === 'admin' && Array.isArray(result.users)) {
            setUsers(result.users as User[]);
          }
          setCurrentUser(signedInUser);
        } catch (roleError: unknown) {
          console.error('Gagal memverifikasi peran akun:', roleError);
          setCurrentUser(signedInUser);
          setAuthError(`Akun masuk, tetapi peran administrator tidak dapat diverifikasi: ${getErrorMessage(roleError)}`);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('Auth state error:', error);
      setAuthError(`Auth State Error: ${error.message}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      setAuthError('');
      await signInWithPopup(auth, googleAuthProvider);
      return true;
    } catch (error: unknown) {
      const code = getErrorCode(error);
      const message = getErrorMessage(error);
      if (code === 'auth/popup-blocked') {
        console.warn('Popup diblokir, menggunakan redirect...');
        await signInWithRedirect(auth, googleAuthProvider);
        return true;
      }
      if (code === 'auth/popup-closed-by-user') {
         throw new Error('Proses login dibatalkan.');
      }
      console.error('Login error full:', error);
      setAuthError(`Gagal login: ${code} - ${message}`);
      throw new Error(`Gagal login: ${code} - ${message}`);
    }
  };

  const logout = async () => {
    setAuthError('');
    await signOut(auth);
  };

  const addUser = async (email: string, role: Role = 'user') => {
    try {
      if (role !== 'admin') return false;
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) return false;
      const result = await response.json();
      setUsers((current) => [...current.filter((user) => user.email !== result.user.email), result.user as User]);
      return true;
    } catch (e) {
      console.error('Gagal menambah administrator:', e);
      return false;
    }
  };

  const removeUser = async (email: string) => {
    try {
      const response = await fetch(`/api/admin-users?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` },
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Gagal menghapus administrator.');
      setUsers((current) => current.filter((user) => user.email !== email));
    } catch (e) {
      console.error('Gagal menghapus administrator:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, users, login, logout, addUser, removeUser, loading, authError }}>
      {children}
    </AuthContext.Provider>
  );
}
