import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PricingService],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  describe('calculateSurcharge', () => {
    it('should return 0 surcharge when no rules', () => {
      const result = service.calculateSurcharge(100, new Date().toISOString(), []);
      expect(result).toEqual({ surcharge_amount: 0, surcharge_percentage: 0 });
    });

    it('should apply DAY_TYPE surcharge', () => {
      const dt = '2026-02-23T10:00:00.000Z'; // Monday UTC
      const result = service.calculateSurcharge(100, dt, [
        { type: 'DAY_TYPE', days: ['MON'], surcharge_value: 10 },
      ]);
      expect(result.surcharge_amount).toBe(10);
      expect(result.surcharge_percentage).toBe(10);
    });

    it('should sum matching surcharge rules', () => {
      const dt = '2026-02-23T10:00:00.000Z';
      const result = service.calculateSurcharge(200, dt, [
        { type: 'DAY_TYPE', days: ['MON'], surcharge_value: 10 },
        { type: 'DAY_TYPE', days: ['MON'], surcharge_value: 5 },
      ]);
      expect(result.surcharge_percentage).toBe(15);
      expect(result.surcharge_amount).toBe(30);
    });
  });
});
