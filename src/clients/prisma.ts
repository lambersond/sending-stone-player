import { PrismaClient } from '@prisma/client'

/*
 * The app's one Prisma client, made once per server process and kept across reloads in
 * development. Its queries go through the database's connection pooler, DB_DATABASE_URL_POOLED
 * (prisma/schema.prisma).
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
