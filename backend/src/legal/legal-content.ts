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

function normalizeLegalLocale(locale?: string | null): string | null {
  const normalized = String(locale || '').trim().toLowerCase().split('-')[0];
  return /^[a-z]{2,8}$/.test(normalized) ? normalized : null;
}

function localizedFilenameCandidates(defaultFilename: string, locale?: string | null): string[] {
  const normalizedLocale = normalizeLegalLocale(locale);
  if (!normalizedLocale) return [defaultFilename];

  const match = /^(.*?)(?:\.([a-z]{2,8}))?(\.[^.]+)$/i.exec(defaultFilename);
  if (!match) return [defaultFilename];

  const [, baseName, , extension] = match;
  return [
    `${baseName} (${normalizedLocale})${extension}`,
    `${baseName}.${normalizedLocale}${extension}`,
    defaultFilename,
  ];
}

function resolveLegalDocumentFile(directory: string, defaultFilename: string, locale?: string | null): string {
  return localizedFilenameCandidates(defaultFilename, locale)
    .map((filename) => resolve(directory, filename))
    .find((path) => existsSync(path)) || resolve(directory, defaultFilename);
}

export type PublicLegalContent = {
  termsVersion: string;
  updatedAt: string;
  documents: Record<LegalDocumentKey, { title: string; content: string; updatedAt: string }>;
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
export async function getFileLegalContent(locale?: string): Promise<PublicLegalContent> {
  const directory = getLegalContentDirectory();
  const manifest = parseManifest(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
  const documentEntries = await Promise.all(
    LEGAL_DOCUMENT_KEYS.map(async (key) => {
      const document = manifest.documents[key];
      const content = await readFile(resolveLegalDocumentFile(directory, document.file, locale), 'utf8');
      return [key, { title: document.title, content, updatedAt: manifest.updatedAt }] as const;
    }),
  );

  return {
    termsVersion: manifest.termsVersion,
    updatedAt: manifest.updatedAt,
    documents: Object.fromEntries(documentEntries) as PublicLegalContent['documents'],
  };
}

/** @deprecated Use LegalContentService so imported texts take precedence. */
export async function getPublicLegalContent(locale?: string): Promise<PublicLegalContent> {
  return getFileLegalContent(locale);
}

export async function getTermsOfUseVersion(): Promise<string> {
  return (await getFileLegalContent()).termsVersion;
}
