const localUser = {
  uid: 'local',
  email: 'local@promarkia.local',
  displayName: 'Local Owner',
  photoURL: window.defaultAvatar,
  async getIdToken() { return 'local'; },
  async getIdTokenResult() { return { claims: { admin: true, local: true } }; },
};

export const auth = {
  currentUser: localUser,
  onAuthStateChanged(callback) {
    queueMicrotask(() => callback(localUser));
    return () => {};
  },
  async signOut() {},
};
export const firebaseApp = { name: 'promarkia-local' };
export const firebaseConfig = { projectId: 'promarkia-local', storageBucket: 'local' };
export const googleProvider = {};
export const getAnalyticsIfSupported = async () => null;
export const disableInternalAnalytics = async () => {};
