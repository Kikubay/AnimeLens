import { safeStorage } from 'electron';
import type { SecretCodec } from './storage';

export function createSafeStorageCodec(): SecretCodec | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    if (safeStorage.getSelectedStorageBackend() === 'basic_text') return null;
  } catch {
    return null;
  }
  return {
    encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
    decrypt: (payload) => safeStorage.decryptString(Buffer.from(payload, 'base64')),
  };
}
