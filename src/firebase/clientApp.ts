import { initializeApp } from "firebase/app";

import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA_DNluT8uKK3nx7ohgn3QdNJbs3xJY1dk",
  authDomain: "anomaly-dev-1.firebaseapp.com",
  projectId: "anomaly-dev-1",
  storageBucket: "anomaly-dev-1.firebasestorage.app",
  messagingSenderId: "899603713666",
  appId: "1:899603713666:web:d658b48ec3219e622f6e9b",
  measurementId: "G-MXG6JPYPH1",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
