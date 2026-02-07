# Secrets Management

> ⚠️ **NEVER commit real credentials to this repository.**

This document explains how to manage secrets for Kubernetes deployments.

## Overview

All secret manifests in `*/k8s/base/*/secret.yaml` contain **placeholder values** (`CHANGEME`).
These are templates only. Real secrets must be injected at deploy time using one of the methods below.

## Affected Secrets

| Component | Secret Name | Namespace | Keys |
|-----------|-------------|-----------|------|
| postgres-auth | `postgres-auth-secret` | sut | `password` |
| postgres-main | `postgres-main-secret` | sut | `password` |
| backend | `backend-secret` | sut | `secret_key`, `database_url` |
| auth-service | `auth-service-secret` | sut | `database_url` |
| test-reporter server | `server-secret` | test-reporter | `database_url` |
| test-reporter postgres | `postgres-secret` | test-reporter | `username`, `password` |

## Production Secrets Injection

### Option 1: Sealed Secrets (Recommended)

[Bitnami Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) encrypts secrets so they can be safely stored in Git.

```bash
# Install kubeseal CLI
brew install kubeseal

# Create a real secret (don't commit this!)
kubectl create secret generic postgres-auth-secret \
  --namespace=sut \
  --from-literal=password="$(openssl rand -base64 32)" \
  --dry-run=client -o yaml > /tmp/secret.yaml

# Seal it (safe to commit)
kubeseal --format yaml < /tmp/secret.yaml > sut/k8s/overlays/prod/postgres-auth-sealed.yaml

# Clean up
rm /tmp/secret.yaml
```

### Option 2: External Secrets Operator

[External Secrets Operator](https://external-secrets.io/) syncs secrets from external stores (AWS Secrets Manager, HashiCorp Vault, etc.).

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: postgres-auth-secret
  namespace: sut
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: postgres-auth-secret
  data:
    - secretKey: password
      remoteRef:
        key: /prod/sut/postgres-auth
        property: password
```

### Option 3: Kustomize Secret Generator (CI/CD)

For CI/CD pipelines with secure variable injection:

```yaml
# kustomization.yaml
secretGenerator:
  - name: postgres-auth-secret
    namespace: sut
    literals:
      - password=${POSTGRES_AUTH_PASSWORD}  # Injected by CI
    options:
      disableNameSuffixHash: true
```

### Option 4: Helm Values (If Using Helm)

```yaml
# values-prod.yaml (DO NOT commit - use CI secrets)
secrets:
  postgresAuth:
    password: "${POSTGRES_AUTH_PASSWORD}"
```

## Local Development

For local development with k3d/kind, you can use the placeholder values or create a local overlay:

```bash
# Create local secrets (gitignored)
mkdir -p sut/k8s/overlays/local
cat > sut/k8s/overlays/local/secrets.yaml << 'EOF'
apiVersion: v1
kind: Secret
metadata:
  name: postgres-auth-secret
  namespace: sut
type: Opaque
stringData:
  password: "local-dev-password-not-for-prod"
EOF
```

Add to `.gitignore`:
```
**/overlays/local/
```

## Generating Strong Passwords

```bash
# 32-byte base64 password
openssl rand -base64 32

# 48-byte for secret keys
openssl rand -base64 48

# UUID-style
uuidgen | tr -d '-'
```

## Validation

Before deploying, verify no placeholder values remain:

```bash
# Should return nothing in prod
grep -r "CHANGEME" k8s/ && echo "ERROR: Placeholder secrets found!"
```

## Security Checklist

- [ ] No real passwords in Git history
- [ ] Secrets encrypted at rest (Sealed Secrets or external store)
- [ ] RBAC limits who can read secrets
- [ ] Secrets rotated periodically
- [ ] Network policies restrict database access
- [ ] Audit logging enabled for secret access

## References

- [Kubernetes Secrets Best Practices](https://kubernetes.io/docs/concepts/security/secrets-good-practices/)
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [External Secrets Operator](https://external-secrets.io/)
- [SOPS](https://github.com/mozilla/sops) - Alternative encryption tool
