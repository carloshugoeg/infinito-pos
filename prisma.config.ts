import "dotenv/config";
import { defineConfig } from "prisma/config";

// Reemplaza la clave `prisma` de package.json (deprecada, se elimina en Prisma 7).
// Un archivo de config desactiva la carga automatica de .env, por eso importamos
// "dotenv/config" arriba para exponer DATABASE_URL/DIRECT_URL a los comandos prisma.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts"
  }
});
