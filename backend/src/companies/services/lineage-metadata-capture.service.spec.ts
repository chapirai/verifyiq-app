import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../../audit/audit.service';
import { LineageMetadataEntity, TriggerType } from '../entities/lineage-metadata.entity';
import {
  LineageCaptureInput,
  LineageMetadataCaptureService,
} from './lineage-metadata-capture.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-abc';
const CORR_ID = 'corr-001';
const USER_ID = 'user-001';

function makeInput(overrides: Partial<LineageCaptureInput> = {}): LineageCaptureInput {
  return {
    tenantId: TENANT_ID,
    userId: USER_ID,
    correlationId: CORR_ID,
    triggerType: TriggerType.API_REQUEST,
    httpMethod: 'POST',
    sourceEndpoint: '/companies/lookup',
    requestParameters: { orgNumber: '5560000001' },
    ...overrides,
  };
}

function makeEntity(overrides: Partial<LineageMetadataEntity> = {}): LineageMetadataEntity {
  const e = new LineageMetadataEntity();
  e.id = 'lineage-1';
  e.tenantId = TENANT_ID;
  e.userId = USER_ID;
  e.correlationId = CORR_ID;
  e.triggerType = TriggerType.API_REQUEST;
  e.httpMethod = 'POST';
  e.sourceEndpoint = '/companies/lookup';
  e.requestParameters = {};
  e.createdAt = new Date();
  return Object.assign(e, overrides);
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('LineageMetadataCaptureService', () => {
  let service: LineageMetadataCaptureService;
  let lineageRepo: { create: jest.Mock; save: jest.Mock };
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    lineageRepo = {
      create: jest.fn((dto) => Object.assign(new LineageMetadataEntity(), dto)),
      save: jest.fn().mockResolvedValue(makeEntity()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LineageMetadataCaptureService,
        {
          provide: getRepositoryToken(LineageMetadataEntity),
          useValue: lineageRepo,
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<LineageMetadataCaptureService>(LineageMetadataCaptureService);
    auditService = module.get(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── capture() ──────────────────────────────────────────────────────────────

  describe('capture()', () => {
    it('persists a lineage record and returns lineageId + correlationId', async () => {
      const saved = makeEntity();
      lineageRepo.save.mockResolvedValue(saved);

      const result = await service.capture(makeInput());

      expect(result).not.toBeNull();
      expect(result!.lineageId).toBe(saved.id);
      expect(result!.correlationId).toBe(saved.correlationId);
      expect(lineageRepo.create).toHaveBeenCalledTimes(1);
      expect(lineageRepo.save).toHaveBeenCalledTimes(1);
    });

    it('sanitizes request parameters before persisting', async () => {
      const input = makeInput({
        requestParameters: {
          orgNumber: '5560000001',
          password: 'secret123',
          apiKey: 'key-abc',
          token: 'tok-xyz',
          normalField: 'value',
        },
      });

      await service.capture(input);

      const createArg = lineageRepo.create.mock.calls[0][0] as any;
      const params = createArg.requestParameters as Record<string, unknown>;

      expect(params['password']).toBe('[REDACTED]');
      expect(params['apiKey']).toBe('[REDACTED]');
      expect(params['token']).toBe('[REDACTED]');
      expect(params['orgNumber']).toBe('5560000001');
      expect(params['normalField']).toBe('value');
    });

    it('stores null userId for unauthenticated captures', async () => {
      await service.capture(makeInput({ userId: null }));

      const createArg = lineageRepo.create.mock.calls[0][0] as any;
      expect(createArg.userId).toBeNull();
    });

    it('emits an audit event after persistence', async () => {
      const saved = makeEntity();
      lineageRepo.save.mockResolvedValue(saved);

      await service.capture(makeInput());

      // Allow microtask queue to flush (audit emit is fire-and-forget).
      await new Promise(setImmediate);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          action: 'lineage.captured',
          resourceType: 'lineage_metadata',
        }),
      );
    });

    it('returns null and does NOT throw when persistence fails', async () => {
      lineageRepo.save.mockRejectedValue(new Error('DB down'));

      const result = await service.capture(makeInput());

      expect(result).toBeNull();
    });

    it('returns null and does NOT throw when repo.create throws', async () => {
      lineageRepo.create.mockImplementation(() => {
        throw new Error('create failed');
      });

      const result = await service.capture(makeInput());

      expect(result).toBeNull();
    });

    it('does NOT rethrow when audit emit fails', async () => {
      const saved = makeEntity();
      lineageRepo.save.mockResolvedValue(saved);
      auditService.log.mockRejectedValue(new Error('audit down'));

      // Should not throw.
      await expect(service.capture(makeInput())).resolves.not.toBeNull();
    });
  });

  // ── capture() – trigger types ──────────────────────────────────────────────

  describe('capture() – trigger types', () => {
    const triggerTypes: TriggerType[] = Object.values(TriggerType);

    it.each(triggerTypes)('persists trigger type %s correctly', async (triggerType) => {
      await service.capture(makeInput({ triggerType }));

      const createArg = lineageRepo.create.mock.calls[0][0] as any;
      expect(createArg.triggerType).toBe(triggerType);
    });
  });

  // ── resolveTriggerType() ───────────────────────────────────────────────────

  describe('resolveTriggerType()', () => {
    it('returns FORCE_REFRESH when forceRefresh=true', () => {
      expect(
        LineageMetadataCaptureService.resolveTriggerType({ forceRefresh: true }),
      ).toBe(TriggerType.FORCE_REFRESH);
    });

    it('returns provided triggerType override when forceRefresh=false', () => {
      expect(
        LineageMetadataCaptureService.resolveTriggerType({
          forceRefresh: false,
          triggerType: TriggerType.SCHEDULED_REFRESH,
        }),
      ).toBe(TriggerType.SCHEDULED_REFRESH);
    });

    it('returns API_REQUEST as default when no overrides given', () => {
      expect(LineageMetadataCaptureService.resolveTriggerType({})).toBe(
        TriggerType.API_REQUEST,
      );
    });

    it('force_refresh takes priority over triggerType override', () => {
      expect(
        LineageMetadataCaptureService.resolveTriggerType({
          forceRefresh: true,
          triggerType: TriggerType.BACKGROUND_JOB,
        }),
      ).toBe(TriggerType.FORCE_REFRESH);
    });
  });

  // ── sanitizeParameters() ─────────────────────────────────────────────────

  describe('sanitizeParameters()', () => {
    it('returns empty object for null/undefined input', () => {
      expect(service.sanitizeParameters(null)).toEqual({});
      expect(service.sanitizeParameters(undefined)).toEqual({});
    });

    it('returns empty object for an empty object input', () => {
      expect(service.sanitizeParameters({})).toEqual({});
    });

    it('redacts password field', () => {
      const result = service.sanitizeParameters({ password: 'secret' });
      expect(result['password']).toBe('[REDACTED]');
    });

    it('redacts token field', () => {
      const result = service.sanitizeParameters({ token: 'abc123' });
      expect(result['token']).toBe('[REDACTED]');
    });

    it('redacts apiKey field (camelCase)', () => {
      const result = service.sanitizeParameters({ apiKey: 'k' });
      expect(result['apiKey']).toBe('[REDACTED]');
    });

    it('redacts api_key field (snake_case)', () => {
      const result = service.sanitizeParameters({ api_key: 'k' });
      expect(result['api_key']).toBe('[REDACTED]');
    });

    it('redacts authorization field', () => {
      const result = service.sanitizeParameters({ authorization: 'Bearer x' });
      expect(result['authorization']).toBe('[REDACTED]');
    });

    it('redacts secret field', () => {
      const result = service.sanitizeParameters({ secret: 'shh' });
      expect(result['secret']).toBe('[REDACTED]');
    });

    it('redacts clientSecret field', () => {
      const result = service.sanitizeParameters({ clientSecret: 's' });
      expect(result['clientSecret']).toBe('[REDACTED]');
    });

    it('does NOT redact non-sensitive fields', () => {
      const result = service.sanitizeParameters({
        orgNumber: '5560000001',
        limit: 10,
        status: 'active',
      });
      expect(result['orgNumber']).toBe('5560000001');
      expect(result['limit']).toBe(10);
      expect(result['status']).toBe('active');
    });

    it('preserves non-sensitive fields alongside redacted ones', () => {
      const result = service.sanitizeParameters({
        orgNumber: '5560000001',
        password: 'secret',
        token: 'tok',
        page: 1,
      });
      expect(result['orgNumber']).toBe('5560000001');
      expect(result['page']).toBe(1);
      expect(result['password']).toBe('[REDACTED]');
      expect(result['token']).toBe('[REDACTED]');
    });

    it('is case-insensitive for sensitive key matching', () => {
      const result = service.sanitizeParameters({ PASSWORD: 'x', Token: 'y' });
      expect(result['PASSWORD']).toBe('[REDACTED]');
      expect(result['Token']).toBe('[REDACTED]');
    });
  });

  // ── correlation ID propagation ─────────────────────────────────────────────

  describe('correlation ID propagation', () => {
    it('stores the provided correlation ID on the entity', async () => {
      const correlationId = 'unique-corr-999';
      await service.capture(makeInput({ correlationId }));

      const createArg = lineageRepo.create.mock.calls[0][0] as any;
      expect(createArg.correlationId).toBe(correlationId);
    });

    it('echoes the correlation ID in the result', async () => {
      const correlationId = 'unique-corr-999';
      const saved = makeEntity({ correlationId });
      lineageRepo.save.mockResolvedValue(saved);

      const result = await service.capture(makeInput({ correlationId }));

      expect(result!.correlationId).toBe(correlationId);
    });
  });
});
