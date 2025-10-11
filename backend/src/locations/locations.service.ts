import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './entities/location.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
  ) {}

  findAll(active?: boolean): Promise<Location[]> {
    const where = active !== undefined ? { active } : {};
    return this.locationRepository.find({ where });
  }

  findOne(id: string): Promise<Location | null> {
    return this.locationRepository.findOne({ where: { id } });
  }

  create(data: Partial<Location>): Promise<Location> {
    const location = this.locationRepository.create(data);
    return this.locationRepository.save(location);
  }

  async update(id: string, data: Partial<Location>): Promise<Location | null> {
    await this.locationRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.locationRepository.delete(id);
  }
}
