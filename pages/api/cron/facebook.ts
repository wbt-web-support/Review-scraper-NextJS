import type { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { stdout, stderr } = await execAsync('node scripts/scheduled-review-fetch.js --facebook');
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    console.log(`stdout: ${stdout}`);
    res.status(200).json({ message: 'Facebook script executed', output: stdout });
  } catch (error: any) {
    console.error('Facebook script error:', error);
    res.status(500).json({ error: 'Failed to execute Facebook script', details: error.message });
  }
}
