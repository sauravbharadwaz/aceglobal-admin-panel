#!/bin/sh
# Started by the AWS Lambda Web Adapter, which is configured as the function's
# exec wrapper. The adapter waits for a listener on AWS_LWA_PORT, then forwards
# each Lambda invocation to it as a normal HTTP request.
#
# Next's standalone server reads PORT and HOSTNAME, so they are set from what
# the adapter expects rather than left to Next's defaults — Next would otherwise
# listen on 3000 while the adapter waited on 8080, and every cold start would
# time out on the readiness check.
#
# This file must be executable inside the zip. Windows has no executable bit, so
# the mode is set explicitly when the archive is written (see scripts/build-lambda.mjs).
set -e

export PORT="${AWS_LWA_PORT:-8080}"
export HOSTNAME="0.0.0.0"

# bootstrap.mjs populates process.env from SSM and only then imports server.js.
# Next reads configuration as it boots, so starting server.js directly would
# leave it with no Supabase credentials and render the setup notice instead of
# the app.
exec node bootstrap.mjs
