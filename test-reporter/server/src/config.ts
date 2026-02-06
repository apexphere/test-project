export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  retentionDays: parseInt(process.env.RETENTION_DAYS || '90', 10),
  maxPayloadSize: process.env.MAX_PAYLOAD_SIZE || '10mb',
  env: process.env.NODE_ENV || 'development',
} as const;
