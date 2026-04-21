import { IsString, Matches } from 'class-validator';

const ORG_NR_REGEX = /^(\d{10}|\d{12})$/;

export class AddTargetListItemDto {
  @IsString()
  @Matches(ORG_NR_REGEX, {
    message: 'organisationNumber must be a 10-digit or 12-digit Swedish organisation number',
  })
  organisationNumber!: string;
}
