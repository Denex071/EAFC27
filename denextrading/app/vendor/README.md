# Mitgelieferte Bibliotheken

| Datei | Quelle | Version | Lizenz |
|---|---|---|---|
| `tesseract/tesseract.min.js`, `tesseract/worker.min.js` | npm `tesseract.js` | 5.1.1 | Apache-2.0 |
| `tesseract/tesseract-core-*.wasm.js` | npm `tesseract.js-core` | 5.1.x | Apache-2.0 |
| `lang/deu.traineddata.gz` | npm `@tesseract.js-data/deu` (4.0.0_best_int) | 4.0.0 | Apache-2.0 |
| `firebase.js` | npm `firebase` (app, auth, firestore), mit esbuild gebündelt | 10.14.1 | Apache-2.0 |
| `xlsx.full.min.js` | npm `xlsx` (SheetJS Community Edition) | 0.18.5 | Apache-2.0 |

Firebase neu bündeln:
```bash
npm install firebase@10.14.1 esbuild
cat > entry.js <<'EOF'
export { initializeApp } from "firebase/app";
export { getAuth, signInAnonymously } from "firebase/auth";
export { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc,
  onSnapshot, setDoc, deleteDoc, writeBatch, Timestamp } from "firebase/firestore";
EOF
npx esbuild entry.js --bundle --format=esm --minify --target=es2020 --outfile=web/vendor/firebase.js
```
