import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { Category } from './entities/category.entity';
import { Tag } from './entities/tag.entity';
import { Cohort } from './entities/cohort.entity';

@Injectable()
export class TaxonomyService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    @InjectRepository(Cohort)
    private cohortRepository: Repository<Cohort>,
  ) {}

  // Categories
  findAllCategories(active?: boolean): Promise<Category[]> {
    const where = active !== undefined ? { active } : {};
    return this.categoryRepository.find({ where, order: { name: 'ASC' } });
  }

  findOneCategory(id: string): Promise<Category | null> {
    return this.categoryRepository.findOne({ where: { id } });
  }

  createCategory(data: Partial<Category>): Promise<Category> {
    const category = this.categoryRepository.create(data);
    return this.categoryRepository.save(category);
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category | null> {
    await this.categoryRepository.update(id, data);
    return this.findOneCategory(id);
  }

  async removeCategory(id: string): Promise<void> {
    await this.categoryRepository.delete(id);
  }

  // Tags
  findAllTags(active?: boolean, search?: string): Promise<Tag[]> {
    const where: FindOptionsWhere<Tag> = {};
    if (active !== undefined) where.active = active;
    if (search) where.name = Like(`%${search}%`);
    return this.tagRepository.find({ where, order: { name: 'ASC' } });
  }

  findOneTag(id: string): Promise<Tag | null> {
    return this.tagRepository.findOne({ where: { id } });
  }

  createTag(data: Partial<Tag>): Promise<Tag> {
    const tag = this.tagRepository.create(data);
    return this.tagRepository.save(tag);
  }

  async updateTag(id: string, data: Partial<Tag>): Promise<Tag | null> {
    await this.tagRepository.update(id, data);
    return this.findOneTag(id);
  }

  async removeTag(id: string): Promise<void> {
    await this.tagRepository.delete(id);
  }

  // Cohorts
  findAllCohorts(active?: boolean): Promise<Cohort[]> {
    const where = active !== undefined ? { active } : {};
    return this.cohortRepository.find({ where, order: { sortOrder: 'ASC', minAge: 'ASC' } });
  }

  findOneCohort(id: string): Promise<Cohort | null> {
    return this.cohortRepository.findOne({ where: { id } });
  }

  createCohort(data: Partial<Cohort>): Promise<Cohort> {
    const cohort = this.cohortRepository.create(data);
    return this.cohortRepository.save(cohort);
  }

  async updateCohort(id: string, data: Partial<Cohort>): Promise<Cohort | null> {
    await this.cohortRepository.update(id, data);
    return this.findOneCohort(id);
  }

  async removeCohort(id: string): Promise<void> {
    await this.cohortRepository.delete(id);
  }
}
