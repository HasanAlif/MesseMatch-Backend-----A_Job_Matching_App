import admin from "firebase-admin";
import config from "../config";

let firebaseApp: admin.app.App | null = null;

const initializeFirebase = (): admin.app.App => {
  if (firebaseApp) {
    return firebaseApp;
  }

  const { projectId, privateKey, clientEmail } = config.firebase;

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error("Firebase configuration is missing required fields");
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey,
      clientEmail,
    }),
  });

  console.log("Firebase Admin SDK initialized successfully");
  return firebaseApp;
};

const getMessaging = (): admin.messaging.Messaging => {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.messaging();
};

const isFirebaseInitialized = (): boolean => {
  return firebaseApp !== null;
};

export { initializeFirebase, getMessaging, isFirebaseInitialized };
