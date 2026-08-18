import { createContext, useContext } from 'react';
import PropTypes from 'prop-types';

export const localUser = {
  uid: 'local',
  email: 'local@promarkia.local',
  displayName: 'Local Owner',
  photoURL: window.defaultAvatar,
  async getIdToken() { return 'local'; },
  async getIdTokenResult() { return { claims: { admin: true, local: true } }; },
};

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export const getAuth = useAuth;

export function AuthProvider({ children }) {
  return (
    <AuthContext.Provider value={{
      currentUser: localUser,
      getUser: () => localUser,
      isAdmin: async () => true,
      loginWithGoogle: async () => ({ user: localUser }),
      signOut: async () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = { children: PropTypes.node };
