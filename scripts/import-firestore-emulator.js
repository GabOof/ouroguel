process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

const admin = require("firebase-admin");
const fs = require("fs/promises");
const path = require("path");

admin.initializeApp({
    projectId: "ouroguel-1190",
});

const db = admin.firestore();

function deserialize(value) {
    if (value === null || value === undefined) return value;

    if (Array.isArray(value)) {
        return value.map(deserialize);
    }

    if (typeof value === "object") {
        if (value.__type === "timestamp") {
            return new admin.firestore.Timestamp(value.seconds, value.nanoseconds);
        }

        if (value.__type === "geopoint") {
            return new admin.firestore.GeoPoint(value.latitude, value.longitude);
        }

        if (value.__type === "reference") {
            return db.doc(value.path);
        }

        const output = {};

        for (const [key, item] of Object.entries(value)) {
            output[key] = deserialize(item);
        }

        return output;
    }

    return value;
}

async function commitBatch(batch, count) {
    if (count > 0) {
        await batch.commit();
    }
}

async function main() {
    const inputPath = path.resolve(__dirname, "../seed/firestore.json");
    const raw = await fs.readFile(inputPath, "utf8");
    const documents = JSON.parse(raw);

    let batch = db.batch();
    let count = 0;
    let total = 0;

    for (const item of documents) {
        const ref = db.doc(item.path);
        batch.set(ref, deserialize(item.data));
        count++;
        total++;

        if (count >= 400) {
            await commitBatch(batch, count);
            batch = db.batch();
            count = 0;
        }
    }

    await commitBatch(batch, count);

    console.log(`Firestore importado no emulador: ${total} documentos`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
