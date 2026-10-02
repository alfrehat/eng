-- migration: 027_canonical_token_blacklist.sql
-- Purpose: Create canonical token_blacklist table for secure JWT revocation and session management.
-- Author: Forensic Security Remediation (AIP v1.0)
-- Target: PostgreSQL / PostGIS (public schema)

CREATE TABLE IF NOT EXISTS public.token_blacklist (
    token_hash VARCHAR(255) PRIMARY KEY,
    revoked_by VARCHAR(100) DEFAULT 'SYSTEM',
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_revoked_at ON public.token_blacklist(revoked_at);
