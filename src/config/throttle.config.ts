import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttleConfig = (): ThrottlerModuleOptions => ({
  throttlers: [
    {
      ttl: 60000,
      limit: 10,
    },
  ],
});
