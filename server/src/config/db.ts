import { PrismaClient } from '@prisma/client';


class DB {
    private static instance: PrismaClient | null = null;

    public static getInstance(): PrismaClient {
        if (!DB.instance) {
            DB.instance = new PrismaClient();
        }
        return DB.instance;
    }
}

// Graceful shutdown: disconnect Prisma on process exit
process.on('beforeExit', async () => {
    await DB.getInstance().$disconnect();
});

export default DB.getInstance();