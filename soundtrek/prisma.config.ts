import { defineConfig, env } from "@prisma/config";
import "dotenv/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Transaction pooler (port 6543) — runtime queries
    url: env("DATABASE_URL"),
  },
});
