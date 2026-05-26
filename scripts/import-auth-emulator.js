process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

const admin = require("firebase-admin");
const fs = require("fs/promises");
const path = require("path");

admin.initializeApp({
    projectId: "ouroguel-1190",
});

const auth = admin.auth();

const DEFAULT_DEV_PASSWORD = "123456";

async function main() {
    const inputPath = path.resolve(__dirname, "../seed/auth-users.json");
    const raw = await fs.readFile(inputPath, "utf8");
    const data = JSON.parse(raw);

    const users = data.users || [];

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const user of users) {
        const uid = user.localId || user.uid;

        if (!uid) {
            skipped++;
            continue;
        }

        const payload = {
            uid,
            email: user.email,
            emailVerified: Boolean(user.emailVerified),
            displayName: user.displayName,
            photoURL: user.photoUrl,
            disabled: Boolean(user.disabled),
        };

        if (user.email) {
            payload.password = DEFAULT_DEV_PASSWORD;
        }

        Object.keys(payload).forEach((key) => {
            if (payload[key] === undefined || payload[key] === null) {
                delete payload[key];
            }
        });

        try {
            await auth.createUser(payload);
            created++;
        } catch (error) {
            if (error.code === "auth/uid-already-exists") {
                await auth.updateUser(uid, payload);
                updated++;
            } else {
                console.warn(`Usuário ignorado: ${uid}`, error.message);
                skipped++;
            }
        }
    }

    console.log(`Auth importado no emulador`);
    console.log(`Criados: ${created}`);
    console.log(`Atualizados: ${updated}`);
    console.log(`Ignorados: ${skipped}`);
    console.log(`Senha local padrão para usuários com e-mail: ${DEFAULT_DEV_PASSWORD}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
