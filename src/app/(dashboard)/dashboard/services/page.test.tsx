import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('services page cache sync contract', () => {
  it('updates the shared services cache directly for service create and delete flows', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
    const servicesInvalidations = source.match(/invalidateQueries\(\{ queryKey: \['services'\] \}\)/g) ?? [];

    expect(source).toContain('upsertServicesQueryData');
    expect(source).toContain('removeServiceFromQueryData');
    expect(source).toContain("queryClient.setQueryData(\n        ['services']");
    expect(servicesInvalidations).toHaveLength(2);
  });
});
