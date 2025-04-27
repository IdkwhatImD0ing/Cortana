import { promises as fs } from 'fs';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const dataDir = path.join(process.cwd(), 'data');
  const files = await fs.readdir(dataDir);
  const datasets = await Promise.all(
    files
      .filter(f => f.endsWith('.json'))
      .map(async file => {
        const raw = await fs.readFile(path.join(dataDir, file), 'utf8');
        return {
          id: file.replace(/\.json$/, ''),
          data: JSON.parse(raw)
        };
      })
  );
  res.status(200).json(datasets);
}
