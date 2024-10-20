import { PrismaClient as SmartWalletClient } from '@prisma/client-smart-wallet';
import { PrismaClient as UserClient } from '@prisma/client-telbot';


const smartWalletClient = new SmartWalletClient();

const telbotClient = new UserClient();

export { smartWalletClient, telbotClient };
