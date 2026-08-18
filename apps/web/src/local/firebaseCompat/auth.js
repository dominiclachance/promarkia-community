import { auth } from '../../firebase/authClient.js';

export const browserLocalPersistence = {};
export class GoogleAuthProvider {}
export const getAuth = () => auth;
export const setPersistence = async () => {};
export const signInWithPopup = async () => ({ user: auth.currentUser });
export const getAdditionalUserInfo = () => ({ isNewUser: false });
export const onAuthStateChanged = (_auth, callback) => auth.onAuthStateChanged(callback);
export const signOut = () => auth.signOut();
