import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';
import { AccountProvisioningPolicy, SystemSettings } from './entities/system-settings.entity';

const DEFAULT_LOGIN_SUBTITLE = 'OKJA Statistik & Dokumentation';

function optionalText(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

function envPolicy(): AccountProvisioningPolicy {
  const value = String(process.env.ACCOUNT_PROVISIONING_POLICY || 'both').trim().toLowerCase();
  return value === 'invite' || value === 'admin_password' || value === 'both' ? value : 'both';
}

@Injectable()
export class SystemSettingsService {
  constructor(@InjectRepository(SystemSettings) private readonly repo: Repository<SystemSettings>) {}

  private async record() {
    return this.repo.findOne({ where: { id: 'global' } });
  }

  async get() {
    const stored = await this.record();
    return {
      orgName: stored?.orgName ?? optionalText(process.env.PUBLIC_ORG_NAME),
      loginSubtitle: stored?.loginSubtitle ?? String(process.env.PUBLIC_LOGIN_SUBTITLE || DEFAULT_LOGIN_SUBTITLE),
      accountProvisioningPolicy: stored?.accountProvisioningPolicy ?? envPolicy(),
    };
  }

  async update(patch: UpdateSystemSettingsDto) {
    const stored = (await this.record()) || this.repo.create({ id: 'global' });
    if (Object.prototype.hasOwnProperty.call(patch, 'orgName')) stored.orgName = optionalText(patch.orgName);
    if (Object.prototype.hasOwnProperty.call(patch, 'loginSubtitle')) stored.loginSubtitle = optionalText(patch.loginSubtitle);
    if (typeof patch.accountProvisioningPolicy !== 'undefined') {
      stored.accountProvisioningPolicy = patch.accountProvisioningPolicy;
    }
    await this.repo.save(stored);
    return this.get();
  }

  async allowsInviteProvisioning() {
    const { accountProvisioningPolicy } = await this.get();
    return accountProvisioningPolicy === 'invite' || accountProvisioningPolicy === 'both';
  }

  async allowsAdminPasswordProvisioning() {
    const { accountProvisioningPolicy } = await this.get();
    return accountProvisioningPolicy === 'admin_password' || accountProvisioningPolicy === 'both';
  }
}
