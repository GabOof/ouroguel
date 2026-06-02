const admin = require("firebase-admin");
const fs = require("fs/promises");
const path = require("path");

const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "ouroguel-1190",
});

const db = admin.firestore();

function serialize(value) {
    if (value === null || value === undefined) return value;

    if (value instanceof admin.firestore.Timestamp) {
        return {
            __type: "timestamp",
            seconds: value.seconds,
            nanoseconds: value.nanoseconds,
        };
    }

    if (value instanceof admin.firestore.GeoPoint) {
        return {
            __type: "geopoint",
            latitude: value.latitude,
            longitude: value.longitude,
        };
    }

    if (value instanceof admin.firestore.DocumentReference) {
        return {
            __type: "reference",
            path: value.path,
        };
    }

    if (Array.isArray(value)) {
        return value.map(serialize);
    }

    if (typeof value === "object") {
        const output = {};
        for (const [key, item] of Object.entries(value)) {
            output[key] = serialize(item);
        }
        return output;
    }

    return value;
}

async function dumpCollection(collectionRef, output) {
    const snapshot = await collectionRef.get();

    for (const doc of snapshot.docs) {
        output.push({
            path: doc.ref.path,
            data: serialize(doc.data()),
        });

        const subcollections = await doc.ref.listCollections();

        for (const subcollection of subcollections) {
            await dumpCollection(subcollection, output);
        }
    }
}

async function main() {
    const output = [];
    const collections = await db.listCollections();

    for (const collection of collections) {
        await dumpCollection(collection, output);
    }

    const outputPath = path.resolve(__dirname, "../seed/firestore.json");

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");

    console.log(`Firestore exportado: ${output.length} documentos`);
    console.log(outputPath);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
