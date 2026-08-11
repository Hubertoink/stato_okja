import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  getFileLegalContent,
  LEGAL_DOCUMENT_KEYS,
  type LegalDocumentKey,
  type PublicLegalContent,
} from './legal-content';
import { LegalContentOverride } from './entities/legal-content-override.entity';

export type LegalDocumentImport = Record<LegalDocumentKey, string>;

const MAX_DOCUMENT_LENGTH = 500_000;

function validateDocument(key: LegalDocumentKey, value: unknown) {
  if (typeof value !== 'string') {
    throw new BadRequestException(`Die Datei für ${key} konnte nicht gelesen werden.`);
  }
  const content = value.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  if (!content) throw new BadRequestException(`Die Datei für ${key} ist leer.`);
  if (content.length > MAX_DOCUMENT_LENGTH) {
    throw new BadRequestException(`Die Datei für ${key} ist zu groß (maximal 500 KB).`);
  }
  if (content.includes('\0')) throw new BadRequestException(`Die Datei für ${key} enthält ungültige Zeichen.`);
  return content;
}

@Injectable()
export class LegalContentService {
  constructor(
    @InjectRepository(LegalContentOverride)
    private readonly overrides: Repository<LegalContentOverride>,
  ) {}

  async getPublicContent(locale?: string): Promise<PublicLegalContent> {
    const override = await this.latestOverride();
    if (!override) return getFileLegalContent(locale);

    return {
      termsVersion: override.termsVersion,
      updatedAt: override.updatedAt.toISOString(),
      documents: {
        imprint: { title: 'Impressum', content: override.imprint, updatedAt: this.timestamp(override.imprintUpdatedAt, override.updatedAt) },
        privacy: { title: 'Datenschutz & Datenverwendung', content: override.privacy, updatedAt: this.timestamp(override.privacyUpdatedAt, override.updatedAt) },
        terms: { title: 'Nutzungsbedingungen', content: override.terms, updatedAt: this.timestamp(override.termsUpdatedAt, override.updatedAt) },
      },
    };
  }

  async getTermsOfUseVersion() {
    return (await this.getPublicContent()).termsVersion;
  }

  async importDocuments(input: Partial<LegalDocumentImport>, userId: string) {
    const importedKeys = LEGAL_DOCUMENT_KEYS.filter((key) => typeof input[key] !== 'undefined');
    if (!importedKeys.length) {
      throw new BadRequestException('Bitte wähle mindestens eine Markdown-Datei aus.');
    }

    const current = await this.getPublicContent();
    const documents = Object.fromEntries(
      LEGAL_DOCUMENT_KEYS.map((key) => [
        key,
        importedKeys.includes(key) ? validateDocument(key, input[key]) : current.documents[key].content,
      ]),
    ) as LegalDocumentImport;
    const existing = await this.latestOverride();
    const now = new Date();
    // Only a changed terms file requires renewed acceptance from all users.
    const termsVersion = importedKeys.includes('terms') ? now.toISOString() : current.termsVersion;
    const override = this.overrides.create({
      ...(existing || {}),
      ...documents,
      termsVersion,
      imprintUpdatedAt: importedKeys.includes('imprint') ? now : this.toDate(current.documents.imprint.updatedAt),
      privacyUpdatedAt: importedKeys.includes('privacy') ? now : this.toDate(current.documents.privacy.updatedAt),
      termsUpdatedAt: importedKeys.includes('terms') ? now : this.toDate(current.documents.terms.updatedAt),
      updatedByUserId: userId,
    });
    const saved = await this.overrides.save(override);
    return {
      termsVersion: saved.termsVersion,
      updatedAt: saved.updatedAt.toISOString(),
      documents: Object.fromEntries(
        LEGAL_DOCUMENT_KEYS.map((key) => [key, {
          title: this.titleFor(key),
          content: saved[key],
          updatedAt: this.timestamp(saved[`${key}UpdatedAt` as 'imprintUpdatedAt' | 'privacyUpdatedAt' | 'termsUpdatedAt'], saved.updatedAt),
        }]),
      ) as PublicLegalContent['documents'],
    } satisfies PublicLegalContent;
  }

  private titleFor(key: LegalDocumentKey) {
    return key === 'imprint'
      ? 'Impressum'
      : key === 'privacy'
        ? 'Datenschutz & Datenverwendung'
        : 'Nutzungsbedingungen';
  }

  async getDocumentForDownload(key: LegalDocumentKey) {
    const content = await this.getPublicContent();
    return content.documents[key];
  }

  private latestOverride() {
    return this.overrides
      .createQueryBuilder('legalContentOverride')
      .orderBy('legalContentOverride.updatedAt', 'DESC')
      .getOne();
  }

  private timestamp(value: Date | null, fallback: Date) {
    return (value || fallback).toISOString();
  }

  private toDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }
}
