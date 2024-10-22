import { PrismaClient as SmartWalletClient } from '@prisma/client-smart-wallet';
import { PrismaClient as UserClient } from '@prisma/client-telbot';
declare const smartWalletClient: SmartWalletClient<import("@prisma/client-smart-wallet").Prisma.PrismaClientOptions, never, import("@prisma/client-smart-wallet/runtime/library").DefaultArgs>;
declare const telbotClient: UserClient<import("@prisma/client-telbot").Prisma.PrismaClientOptions, never, import("@prisma/client-telbot/runtime/library").DefaultArgs>;
export { smartWalletClient, telbotClient };
