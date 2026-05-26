process.env.FIREBASE_STORAGE_EMULATOR_HOST =
    process.env.FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199";

const admin = require("firebase-admin");
const fs = require("fs/promises");
const path = require("path");

admin.initializeApp({
    projectId: "ouroguel-1190",
    storageBucket: "ouroguel-1190.firebasestorage.app",
});

const bucket = admin.storage().bucket();

async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            files.push(...(await walk(fullPath)));
        } else {
            files.push(fullPath);
        }
    }

    return files;
}

async function main() {
    const storageDir = path.resolve(__dirname, "../seed/storage");

    try {
        await fs.access(storageDir);
    } catch {
        console.log("Pasta seed/storage não encontrada. Nada para importar.");
        return;
    }

    const files = await walk(storageDir);

    for (const file of files) {
        const destination = path.relative(storageDir, file).split(path.sep).join("/");

        await bucket.upload(file, {
            destination,
        });

        console.log(`Upload local: ${destination}`);
    }

    console.log(`Storage importado no emulador: ${files.length} arquivos`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
