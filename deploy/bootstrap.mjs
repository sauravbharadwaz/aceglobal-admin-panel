// Loads configuration from SSM into process.env, then starts Next.
//
// Next reads process.env as it boots, so this has to finish first — which is
// why the server is imported dynamically rather than required at the top.
//
// Secrets are not passed as Lambda environment variables on purpose: those are
// readable by anyone who can describe the function, and they end up in the
// CloudFormation template that created it. A SecureString fetched at cold start
// is decrypted by KMS under the function's own role and never lands in a
// template, a build artifact or git history.
//
// Parameters are named after the variable they populate, so no mapping table is
// needed:
//
//   /aceglobal/admin/NEXT_PUBLIC_SUPABASE_URL
//   /aceglobal/admin/NEXT_PUBLIC_SUPABASE_ANON_KEY
//   /aceglobal/admin/SUPABASE_SERVICE_ROLE_KEY
//   /aceglobal/admin/STRIPE_SECRET_KEY
//   /aceglobal/admin/RESEND_API_KEY
//   /aceglobal/admin/CRON_SECRET
//   /aceglobal/admin/PORTAL_APP_URL
const PREFIX = process.env.SSM_PARAMETER_PREFIX || "";

if (PREFIX) {
  const { SSMClient, GetParametersByPathCommand } = await import("@aws-sdk/client-ssm");
  const client = new SSMClient({});

  let loaded = 0;
  let NextToken;
  do {
    const page = await client.send(
      new GetParametersByPathCommand({
        Path: PREFIX,
        WithDecryption: true,
        Recursive: false,
        NextToken,
      }),
    );
    for (const p of page.Parameters || []) {
      const name = String(p.Name || "").split("/").pop();
      // An existing value wins, so a Lambda environment variable can override a
      // stored one without editing SSM.
      if (!name || (process.env[name] != null && process.env[name] !== "")) continue;
      process.env[name] = p.Value ?? "";
      loaded++;
    }
    NextToken = page.NextToken;
  } while (NextToken);

  // Names only. A value logged here would sit in CloudWatch long after the key
  // it exposed had been rotated.
  console.log(`Loaded ${loaded} parameter(s) from ${PREFIX}`);
}

// Only now that the environment is populated.
await import("./server.js");
