/** Generic envelope wrapping all Bolagsverket API responses. */
export class BolagsverketApiResponseDto<T> {
  requestId!: string;
  requestPayload!: Record<string, unknown>;
  responsePayload!: T;
}

export class HealthCheckResponseDto {
  status!: string;
}
