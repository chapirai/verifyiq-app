import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ALL_INFORMATION_CATEGORIES } from '../integrations/bolagsverket.types';
import { ID_REGEX } from '../utils/identifier-validator';

export class BolagsverketLookupDto {
  @IsString()
  @Matches(ID_REGEX, {
    message: 'identitetsbeteckning must be a 10-digit organisationsnummer, 12-digit personnummer/samordningsnummer, or 10-digit GD-nummer (302XXXXXXX)',
  })
  identitetsbeteckning!: string;

  @IsOptional()
  @IsArray()
  @IsIn([...ALL_INFORMATION_CATEGORIES], { each: true })
  informationCategories?: string[];

  @IsOptional()
  @IsString()
  tidpunkt?: string;
}

export class BolagsverketDocumentListDto {
  @IsString()
  @Matches(ID_REGEX, {
    message: 'identitetsbeteckning must be a valid Swedish identity number',
  })
  identitetsbeteckning!: string;
}

export class BolagsverketArendeDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  arendenummer?: string;

  @IsOptional()
  @IsString()
  @Matches(ID_REGEX, { message: 'organisationIdentitetsbeteckning must be a valid Swedish identity number' })
  organisationIdentitetsbeteckning?: string;

  @IsOptional()
  @IsString()
  fromdatum?: string;

  @IsOptional()
  @IsString()
  tomdatum?: string;
}

export class BolagsverketSignatoryPowerDto {
  @IsString()
  @Matches(ID_REGEX, { message: 'funktionarIdentitetsbeteckning must be a valid Swedish identity number' })
  funktionarIdentitetsbeteckning!: string;

  @IsString()
  @Matches(ID_REGEX, { message: 'organisationIdentitetsbeteckning must be a valid Swedish identity number' })
  organisationIdentitetsbeteckning!: string;
}

export class BolagsverketShareCapitalHistoryDto {
  @IsString()
  @Matches(ID_REGEX, { message: 'identitetsbeteckning must be a valid Swedish identity number' })
  identitetsbeteckning!: string;

  @IsOptional()
  @IsString()
  fromdatum?: string;

  @IsOptional()
  @IsString()
  tomdatum?: string;
}

class PagineringDto {
  @IsInt()
  @Min(1)
  sida!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  antalPerSida!: number;
}

export class BolagsverketEngagemangDto {
  @IsString()
  @Matches(ID_REGEX, { message: 'identitetsbeteckning must be a valid Swedish identity number' })
  identitetsbeteckning!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PagineringDto)
  paginering?: PagineringDto;

  @IsOptional()
  @IsIn(['ORGANISATIONSFORM', 'REGISTRERINGSTIDPUNKT'])
  sortAttribute?: 'ORGANISATIONSFORM' | 'REGISTRERINGSTIDPUNKT';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}

export class BolagsverketFinancialReportsDto {
  @IsString()
  @Matches(ID_REGEX, { message: 'identitetsbeteckning must be a valid Swedish identity number' })
  identitetsbeteckning!: string;

  @IsOptional()
  @IsString()
  fromdatum?: string;

  @IsOptional()
  @IsString()
  tomdatum?: string;
}

export class BvEnrichDto {
  @IsString()
  @Matches(ID_REGEX, {
    message:
      'identitetsbeteckning must be a 10-digit organisationsnummer, 12-digit personnummer/samordningsnummer, or 10-digit GD-nummer (302XXXXXXX)',
  })
  identitetsbeteckning!: string;

  @IsOptional()
  forceRefresh?: boolean;
}

export class BvPersonEnrichDto {
  @IsString()
  @Matches(ID_REGEX, {
    message:
      'personnummer must be a 10-digit or 12-digit Swedish personnummer/samordningsnummer',
  })
  personnummer!: string;

  @IsOptional()
  forceRefresh?: boolean;
}

export class BolagsverketPersonDto {
  @IsString()
  @Matches(ID_REGEX, {
    message:
      'identitetsbeteckning must be a 10-digit organisationsnummer, 12-digit personnummer/samordningsnummer, or 10-digit GD-nummer (302XXXXXXX)',
  })
  identitetsbeteckning!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  personInformationsmangd?: string[];
}
