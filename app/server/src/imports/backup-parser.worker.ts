import { parentPort, workerData } from 'node:worker_threads';
import { BackupError, parseBackup } from './backup-parser';

try {
  parentPort?.postMessage({ backup: parseBackup(Buffer.from(workerData as Uint8Array)) });
} catch (error) {
  parentPort?.postMessage({
    error: error instanceof BackupError ? error.message : 'The backup could not be read',
  });
}
