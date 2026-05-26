FROM node:22-trixie-slim

RUN apt-get update \
    && apt-get install -y openjdk-21-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g firebase-tools

WORKDIR /workspace

EXPOSE 4000 5000 5001 8080 9099 9199

CMD ["firebase", "emulators:start", "--project", "ouroguel-1190", "--only", "auth,firestore,storage", "--import", "/workspace/.firebase-data", "--export-on-exit", "/workspace/.firebase-data"]
