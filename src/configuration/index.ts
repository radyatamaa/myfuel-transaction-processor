export const APP = {
  name: 'myfuel-transaction-processor',
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  tz: process.env.TZ ?? 'Asia/Jakarta'
};

export default () => ({
  app: APP,
  database: {
    url: process.env.DATABASE_URL ?? ''
  },
  redis: {
    url: process.env.REDIS_URL ?? '',
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'myfuel:cache:',
    db: Number(process.env.REDIS_DB ?? 0)
  },
  security: {
    webhookApiKey: process.env.WEBHOOK_API_KEY ?? '',
    webhookSignatureSecret: process.env.WEBHOOK_SIGNATURE_SECRET ?? '',
    webhookTimestampToleranceSeconds: Number(
      process.env.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS ?? 300
    )
  }
});
