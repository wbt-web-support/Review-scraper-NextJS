/**
 * Tags every stored review with its service categories (lib/reviewCategories).
 *
 *   npx tsx --env-file=.env.local scripts/categorize-reviews.ts [--business <id>] [--dry]
 *
 * Reads what is stored and writes only the tags that changed. No crawl, no Apify
 * spend. Reviews tagged by hand are left alone. Safe to re-run: a review whose
 * tags already match the current rules is not touched. --dry only counts.
 */
import dbConnect from '../lib/mongodb';
import * as storage from '../lib/storage';
import GoogleBusinessUrlModel from '../models/GoogleBusinessUrl.model';
import FacebookBusinessUrlModel from '../models/FacebookBusinessUrl.model';
import { servicesFor, type ServiceCategory } from '../lib/reviewCategories';

const DRY = process.argv.includes('--dry');
const only = (() => { const i = process.argv.indexOf('--business'); return i >= 0 ? process.argv[i + 1] : null; })();

interface Row { _id: { toString(): string }; name: string; urlHash: string; services?: ServiceCategory[] | null }

async function main() {
  await dbConnect();
  const totals: Record<string, number> = {};
  let general = 0, checked = 0, changed = 0, businesses = 0;

  for (const [source, Model] of [['google', GoogleBusinessUrlModel], ['facebook', FacebookBusinessUrlModel]] as const) {
    const filter = only ? { _id: only } : {};
    const rows = (await (Model as unknown as { find: (f: object, p: string) => { lean: () => { exec: () => Promise<Row[]> } } })
      .find(filter, 'name urlHash services').lean().exec());
    for (const b of rows) {
      if (!b.urlHash) continue;
      const result = await storage.recategorizeBusiness(b.urlHash, source, servicesFor(b), { dryRun: DRY });
      businesses++;
      checked += result.checked; changed += result.changed; general += result.general;
      for (const [k, n] of Object.entries(result.counts)) totals[k] = (totals[k] ?? 0) + n;
      const parts = Object.entries(result.counts).map(([k, n]) => `${k}=${n}`).join(' ');
      console.log(`${source.padEnd(8)} ${b.name.slice(0, 40).padEnd(40)} checked=${result.checked} changed=${result.changed} general=${result.general} ${parts}`);
    }
  }
  console.log(`\n${DRY ? 'DRY RUN. ' : ''}${businesses} businesses, ${checked} reviews checked, ${changed} ${DRY ? 'would change' : 'changed'}, ${general} general.`);
  console.log('Per category:', totals);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
