import { createClient } from '@sanity/client';

export function sanity(write) {
  return createClient({
    projectId: process.env.SANITY_PROJECT_ID,
    dataset: process.env.SANITY_DATASET || 'production',
    apiVersion: '2024-01-01',
    useCdn: false,
    token: write ? process.env.SANITY_API_TOKEN : undefined,
  });
}
export async function ping() {
  const c = sanity(true);
  const n = await c.fetch('count(*)');
  return { docs: n };
}
