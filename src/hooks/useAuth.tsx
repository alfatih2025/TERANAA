import React, { useState, useEffect } from 'react';
import { auth, db, googleAuthProvider } from '../lib/firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, deleteDoc } from 'firebase/firestore';
import { AuthContext, type Role, type User } from './auth-context';

export type { Role, User } from './auth-context';
const OWNER_ADMIN_EMAIL = 'alfatihwibowo264@gmail.com';

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
    if (currentUser?.role !== 'admin') return;
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData: User[] = [];
      snapshot.forEach((d) => usersData.push(d.data() as User));
      setUsers(usersData);
    }, (error) => {
      console.error('Gagal memuat daftar pengguna:', error);
      setAuthError(`Gagal memuat daftar pengguna: ${error.message}`);
    });
    return () => unsubscribeUsers();
  }, [currentUser?.role]);

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
      if (firebaseUser && firebaseUser.email) {
        try {
          const docId = firebaseUser.email.toLowerCase();
          const userDoc = await getDoc(doc(db, 'users', docId));
          const isOwner = docId === OWNER_ADMIN_EMAIL;

          if (userDoc.exists()) {
            const data = userDoc.data();
            const storedRole: Role = data.role === 'admin' ? 'admin' : 'user';
            
            if (isOwner && storedRole !== 'admin') {
              await setDoc(doc(db, 'users', docId), { role: 'admin' }, { merge: true });
            }

            setCurrentUser({
              id: firebaseUser.uid,
              username: data.username || data.email?.split('@')[0] || 'User',
              email: data.email || firebaseUser.email,
              role: isOwner || storedRole === 'admin' ? 'admin' : 'user'
            });
          } else {
            const role: Role = isOwner ? 'admin' : 'user';
            const newUser = {
              id: firebaseUser.uid,
              username: firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email,
              role
            };
            if (isOwner) {
              await setDoc(doc(db, 'users', docId), newUser);
            }
            setCurrentUser(newUser);
          }
        } catch (firestoreError: unknown) {
          console.error('Firestore Error saat login:', firestoreError);
          setCurrentUser({
            id: firebaseUser.uid,
            username: firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            role: firebaseUser.email?.toLowerCase() === OWNER_ADMIN_EMAIL ? 'admin' : 'user'
          });
          setAuthError(`Peringatan Firestore: ${getErrorMessage(firestoreError)} (Login dilanjutkan di memori)`);
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
      const docId = email.toLowerCase().trim();
      const existing = await getDoc(doc(db, 'users', docId));
      if (existing.exists()) return false;

      await setDoc(doc(db, 'users', docId), {
        id: `invited_${Date.now()}`,
        username: email.split('@')[0],
        email: docId,
        role: role
      });
      return true;
    } catch (e) {
      console.error("Gagal menambah user:", e);
      return false;
    }
  };

  const removeUser = async (email: string) => {
    try {
      // Kita hapus berdasarkan ID (yang aslinya adalah email di sistem baru ini)
      // Namun berjaga-jaga jika ID-nya UID lama, kita query berdasarkan ID dokumen
      await deleteDoc(doc(db, 'users', email));
    } catch (e) {
      console.error("Gagal menghapus user:", e);
    }
  };

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ currentUser, users, login, logout, addUser, removeUser, loading, authError }}>
      {children}
    </AuthContext.Provider>
  );
}
