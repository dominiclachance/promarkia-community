import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { auth, firebaseApp, firebaseConfig, googleProvider, getAnalyticsIfSupported, disableInternalAnalytics } from './authClient';

export { auth, firebaseApp, firebaseConfig, googleProvider, getAnalyticsIfSupported, disableInternalAnalytics };
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp, `gs://${firebaseConfig.storageBucket}`);
export const functions = getFunctions(firebaseApp, 'us-central1');
