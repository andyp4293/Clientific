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

deployment_host="$(
  node -e '
    const raw = process.argv[1]
      .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
      .replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, "")
      .replace(/[^\x20-\x7e]/g, "");
    const match = raw.match(/[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/);
    if (!match) {
      console.error(`Unable to find a deployment host in: ${raw}`);
      process.exit(1);
    }
    console.log(match[0]);
  ' "$deployment_url"
)"

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
  inspect_output="$(npx vercel inspect "$domain" 2>&1)"
  printf '%s\n' "$inspect_output"
  normalized_inspect_output="$(printf '%s' "$inspect_output" | LC_ALL=C tr -cd '\11\12\15\40-\176')"

  if [[ "$normalized_inspect_output" != *"$deployment_host"* ]]; then
    echo "Expected $domain to point at $deployment_host, but Vercel inspect did not confirm it." >&2
    exit 1
  fi
done

echo ""
echo "Production deployment is live on:"
for domain in "${domains[@]}"; do
  echo "  https://$domain"
done
