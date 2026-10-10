import { BadRequestException } from '@nestjs/common';

export function getActivityCategoryMode(): 'single' | 'multiple' {
  const value = process.env.ACTIVITY_CATEGORY_MODE?.trim().toLowerCase() || 'multiple';
  if (value !== 'single' && value !== 'multiple') {
    throw new Error('ACTIVITY_CATEGORY_MODE must be single or multiple');
  }
  return value;
}

export function assertActivityCategorySelection(ids: string[]) {
  if (getActivityCategoryMode() === 'single' && new Set(ids).size > 1) {
    throw new BadRequestException('Pro Aktivität ist nur eine Kategorie erlaubt. Bitte eine Kategorie auswählen.');
  }
}
