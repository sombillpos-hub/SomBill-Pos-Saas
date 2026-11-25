#!/usr/bin/env bash
# Generates the RS256 key pair used for access tokens.
# The main API gets the private key; the gateway and every other service get only the public key.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/infrastructure/secrets"
mkdir -p "$DIR"
if [ -f "$DIR/jwt-private.pem" ] && [ "${1:-}" != "--force" ]; then
  echo "Keys already exist in $DIR (use --force to replace them; this signs everyone out)." >&2
  exit 1
fi
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$DIR/jwt-private.pem"
openssl pkey -in "$DIR/jwt-private.pem" -pubout -out "$DIR/jwt-public.pem"
chmod 600 "$DIR/jwt-private.pem"
echo "Written: $DIR/jwt-private.pem (keep secret), $DIR/jwt-public.pem"
echo "For .env files, base64 values: base64 -w0 $DIR/jwt-public.pem"
