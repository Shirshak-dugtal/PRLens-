import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value !== undefined && value.trim() !== "" ? value.trim() : undefined;
}

export const config = {
  port: Number(optional("PORT") ?? 8787),
  typesafeApiKey: optional("TYPESAFE_API_KEY"),
  typesafeModel: optional("TYPESAFE_MODEL"),
  githubToken: optional("GITHUB_TOKEN"),
  clientOrigin: optional("CLIENT_ORIGIN"),
};

export function assertConfigured(): { typesafeApiKey: string } {
  if (!config.typesafeApiKey) {
    throw new Error(
      "Missing TYPESAFE_API_KEY. Copy server/.env.example to server/.env and set your TypeSafe API key.",
    );
  }
  return { typesafeApiKey: config.typesafeApiKey };
}