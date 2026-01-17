import firebase from "firebase/compat/app";
import "firebase/compat/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBIZk-vACf3o8k3HHTNi84zwCudpzfWLyc",
  authDomain: "alertiq-2.firebaseapp.com",
  projectId: "alertiq-2",
  storageBucket: "alertiq-2.firebasestorage.app",
  messagingSenderId: "518524201799",
  appId: "1:518524201799:web:b85ab57abffad37f4efa62",
  measurementId: "G-N6FGTFPHN4",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export default firebase;
