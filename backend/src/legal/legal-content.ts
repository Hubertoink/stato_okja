import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { basename, resolve } from 'path';

export const LEGAL_DOCUMENT_KEYS = ['imprint', 'privacy', 'terms'] as const;
export type LegalDocumentKey = (typeof LEGAL_DOCUMENT_KEYS)[number];

type LegalManifestDocument = {
  title: string;
  file: string;
};

type LegalManifest = {
  termsVersion: string;
  updatedAt: string;
  documents: Record<LegalDocumentKey, LegalManifestDocument>;
};

export type PublicLegalContent = {
  termsVersion: string;
  updatedAt: string;
  documents: Record<LegalDocumentKey, { title: string; content: string }>;
};

function getLegalContentDirectory() {
  const configuredDirectory = String(process.env.LEGAL_CONTENT_DIR || '').trim();
  if (configuredDirectory) return resolve(configuredDirectory);

  const candidates = [
    resolve(process.cwd(), 'legal'),
    resolve(process.cwd(), '..', 'legal'),
    resolve(__dirname, '..', '..', 'legal'),
  ];
  return candidates.find((directory) => existsSync(directory)) || candidates[0];
}

function parseManifest(raw: string): LegalManifest {
  const parsed = JSON.parse(raw) as Partial<LegalManifest>;
  if (!parsed || typeof parsed !== 'object') throw new Error('Ungültiges Rechtsdokument-Manifest.');
  if (typeof parsed.termsVersion !== 'string' || !parsed.termsVersion.trim()) {
    throw new Error('Im Rechtsdokument-Manifest fehlt termsVersion.');
  }
  if (typeof parsed.updatedAt !== 'string' || !parsed.updatedAt.trim()) {
    throw new Error('Im Rechtsdokument-Manifest fehlt updatedAt.');
  }

  const documents = parsed.documents as Partial<Record<LegalDocumentKey, LegalManifestDocument>> | undefined;
  if (!documents) throw new Error('Im Rechtsdokument-Manifest fehlen die Dokumente.');

  for (const key of LEGAL_DOCUMENT_KEYS) {
    const document = documents[key];
    if (!document || typeof document.title !== 'string' || !document.title.trim()) {
      throw new Error(`Im Rechtsdokument-Manifest fehlt der Titel für ${key}.`);
    }
    if (
      typeof document.file !== 'string' ||
      !document.file.trim() ||
      basename(document.file) !== document.file
    ) {
      throw new Error(`Im Rechtsdokument-Manifest ist die Datei für ${key} ungültig.`);
    }
  }

  return {
    termsVersion: parsed.termsVersion.trim(),
    updatedAt: parsed.updatedAt.trim(),
    documents: documents as Record<LegalDocumentKey, LegalManifestDocument>,
  };
}

/** Reads the deployment-specific legal text files without rendering HTML. */
export async function getPublicLegalContent(): Promise<PublicLegalContent> {
  const directory = getLegalContentDirectory();
  const manifest = parseManifest(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
  const documentEntries = await Promise.all(
    LEGAL_DOCUMENT_KEYS.map(async (key) => {
      const document = manifest.documents[key];
      const content = await readFile(resolve(directory, document.file), 'utf8');
      return [key, { title: document.title, content }] as const;
    }),
  );

  return {
    termsVersion: manifest.termsVersion,
    updatedAt: manifest.updatedAt,
    documents: Object.fromEntries(documentEntries) as PublicLegalContent['documents'],
  };
}

export async function getTermsOfUseVersion(): Promise<string> {
  return (await getPublicLegalContent()).termsVersion;
}
