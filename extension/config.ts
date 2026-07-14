import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const AUTH_FILE = join(homedir(), ".config", "parallel-web-tools", "auth.json");
const DEFAULT_ORG_ID = "legacy";

export const MISSING_API_KEY_MESSAGE =
  "Parallel API key is not configured. Ask the user to run /parallel-setup and paste their Parallel API key. They can create one at https://platform.parallel.ai.";

interface CliOrgCredentials {
  api_key?: string | null;
  org_name?: string | null;
  control_api?: Record<string, unknown>;
  [key: string]: unknown;
}

interface CliAuth {
  version?: number;
  selected_org_id?: string | null;
  orgs?: Record<string, CliOrgCredentials>;
  client_id?: string | null;
  [key: string]: unknown;
}

export function getAuthPath(): string {
  return AUTH_FILE;
}

export async function getApiKey(): Promise<string | undefined> {
  let auth: CliAuth;
  try {
    auth = await readAuth();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error(`Could not read parallel-cli authentication at ${AUTH_FILE}. Repair or move that file before running /parallel-setup.`);
  }

  const selectedOrgId = auth.selected_org_id;
  if (!selectedOrgId || !auth.orgs || typeof auth.orgs !== "object") return undefined;
  const apiKey = auth.orgs[selectedOrgId]?.api_key;
  return typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : undefined;
}

export async function requireApiKey(): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error(MISSING_API_KEY_MESSAGE);
  return apiKey;
}

export async function saveApiKey(apiKey: string): Promise<void> {
  const normalized = apiKey.trim();
  if (!normalized) throw new Error("API key cannot be empty.");

  let auth: CliAuth;
  try {
    auth = await readAuth();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      auth = {};
    } else {
      throw new Error(`Cannot update ${AUTH_FILE} because the existing parallel-cli authentication could not be read. The file was not changed.`);
    }
  }

  if (auth.version !== undefined && auth.version !== 1) {
    throw new Error(`Cannot update ${AUTH_FILE} because its auth version is not supported. The file was not changed.`);
  }
  if (auth.selected_org_id !== undefined && auth.selected_org_id !== null && typeof auth.selected_org_id !== "string") {
    throw new Error(`Cannot update ${AUTH_FILE} because its selected organization is invalid. The file was not changed.`);
  }
  if (
    auth.orgs !== undefined &&
    (!auth.orgs ||
      typeof auth.orgs !== "object" ||
      Array.isArray(auth.orgs) ||
      Object.values(auth.orgs).some((org) => !org || typeof org !== "object" || Array.isArray(org)))
  ) {
    throw new Error(`Cannot update ${AUTH_FILE} because its organization data is invalid. The file was not changed.`);
  }

  const selectedOrgId =
    typeof auth.selected_org_id === "string" && auth.selected_org_id
      ? auth.selected_org_id
      : DEFAULT_ORG_ID;
  const orgs = auth.orgs && typeof auth.orgs === "object" ? auth.orgs : {};
  const existingOrg = orgs[selectedOrgId] ?? {};

  const nextAuth: CliAuth = {
    ...auth,
    version: typeof auth.version === "number" ? auth.version : 1,
    selected_org_id: selectedOrgId,
    orgs: {
      ...orgs,
      [selectedOrgId]: {
        org_name: null,
        control_api: {
          access_token: null,
          access_token_expires_at: null,
          access_token_scopes: [],
          refresh_token: null,
          refresh_token_expires_at: null,
          authorization_expires_at: null,
        },
        ...existingOrg,
        api_key: normalized,
      },
    },
    client_id: auth.client_id ?? null,
  };

  const tempPath = `${AUTH_FILE}.${process.pid}.${randomUUID()}.tmp`;
  await mkdir(dirname(AUTH_FILE), { recursive: true, mode: 0o700 });
  try {
    await writeFile(tempPath, `${JSON.stringify(nextAuth, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(tempPath, AUTH_FILE);
    await chmod(AUTH_FILE, 0o600);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

async function readAuth(): Promise<CliAuth> {
  const raw = await readFile(AUTH_FILE, "utf8");
  const auth = JSON.parse(raw) as unknown;
  if (!auth || typeof auth !== "object" || Array.isArray(auth)) {
    throw new Error("Invalid parallel-cli auth file.");
  }
  return auth as CliAuth;
}
