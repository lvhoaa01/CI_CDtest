#!/usr/bin/env sh
set -eu

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <image> <version> <commit>" >&2
  exit 2
fi

new_image="$1"
new_version="$2"
new_commit="$3"
service_name="app"

if [ -f .env ]; then
  cp .env .env.previous
fi

previous_image="$(docker inspect --format '{{.Config.Image}}' "$(docker compose ps -q "$service_name")" 2>/dev/null || true)"

echo "Pulling $new_image"
docker pull "$new_image"

echo "Starting version $new_version ($new_commit)"
if APP_IMAGE="$new_image" APP_VERSION="$new_version" COMMIT_SHA="$new_commit" \
  docker compose up -d --no-build --wait --wait-timeout 60; then
  {
    echo "APP_IMAGE=$new_image"
    echo "APP_VERSION=$new_version"
    echo "COMMIT_SHA=$new_commit"
  } > .env
  echo "Deployment is healthy"
  exit 0
fi

echo "Deployment failed health checks" >&2

if [ -n "$previous_image" ]; then
  echo "Rolling back to $previous_image" >&2
  APP_IMAGE="$previous_image" docker compose up -d --no-build --wait --wait-timeout 60
  exit 1
fi

echo "No previous image is available for automatic rollback" >&2
exit 1
