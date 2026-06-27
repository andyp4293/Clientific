#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

domains=(
  "clientific.app"
  "www.clientific.app"
)

deploy_log="$(mktemp)"
cleanup() {
  rm -f "$deploy_log"
}
trap cleanup EXIT

echo "==> Deploy to Vercel production"
npx vercel --prod --yes | tee "$deploy_log"

deployment_url="$(
  node -e '
    const fs = require("fs");
    const stripAnsi = (value) =>
      value
        .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
        .replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, "");
    const text = stripAnsi(fs.readFileSync(process.argv[1], "utf8"));
    const productionMatches = Array.from(text.matchAll(/Production:\s+(https:\/\/[^\s\[]+)/g));
    if (productionMatches.length > 0) {
      console.log(productionMatches.at(-1)[1].trim());
      process.exit(0);
    }

    const jsonUrlMatches = Array.from(text.matchAll(/"url":\s*"([^"]+)"/g));
    if (jsonUrlMatches.length > 0) {
      const url = jsonUrlMatches.at(-1)[1].trim();
      console.log(url.startsWith("http") ? url : `https://${url}`);
      process.exit(0);
    }

    console.error("Unable to find the production deployment URL in Vercel output.");
    process.exit(1);
  ' "$deploy_log"
)"

deployment_host="${deployment_url#https://}"
deployment_host="${deployment_host#http://}"
deployment_host="${deployment_host%%/*}"
deployment_host="$(printf '%s' "$deployment_host" | tr -d '\r\n')"

if [[ -z "$deployment_host" ]]; then
  echo "Unable to determine deployment host from: $deployment_url" >&2
  exit 1
fi

echo ""
echo "==> Alias production domains to $deployment_host"
for domain in "${domains[@]}"; do
  npx vercel alias set "$deployment_host" "$domain"
done

echo ""
echo "==> Verify production domain aliases"
for domain in "${domains[@]}"; do
  inspect_output="$(npx vercel inspect "$domain")"
  printf '%s\n' "$inspect_output"

  if [[ "$inspect_output" != *"$deployment_host"* ]]; then
    echo "Expected $domain to point at $deployment_host, but Vercel inspect did not confirm it." >&2
    exit 1
  fi
done

echo ""
echo "Production deployment is live on:"
for domain in "${domains[@]}"; do
  echo "  https://$domain"
done
