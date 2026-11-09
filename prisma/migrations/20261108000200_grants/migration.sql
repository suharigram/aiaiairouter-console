GRANT SELECT ON "profiles", "api_keys", "wallets", "transactions", "usage_events", "request_logs", "security_events", "email_logs", "user_devices" TO authenticated;
GRANT SELECT ON "providers", "models" TO anon, authenticated;
REVOKE UPDATE ON "profiles" FROM authenticated;
GRANT UPDATE (name) ON "profiles" TO authenticated;
