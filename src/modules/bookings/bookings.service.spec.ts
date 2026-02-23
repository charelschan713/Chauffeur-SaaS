import { BadRequestException } from '@nestjs/common';

jest.mock('../../config/supabase.config', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
  newSupabaseAdminClient: jest.fn(),
}));

jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { BookingsService } from './bookings.service';

const notificationsService = {
  notifyBookingConfirmed: jest.fn(),
  notifyDriverAssigned: jest.fn(),
  notifyDriverOnTheWay: jest.fn(),
  notifyDriverArrived: jest.fn(),
  notifyTripCompleted: jest.fn(),
  notifyBookingCancelled: jest.fn(),
};

const webhooksService = {
  triggerEvent: jest.fn(),
};

const contactsService = {
  updateStats: jest.fn(),
};

describe('BookingsService', () => {
  let service: BookingsService;

  beforeEach(() => {
    service = new BookingsService(
      notificationsService as any,
      webhooksService as any,
      contactsService as any,
    );
  });

  it('should throw for invalid driver status', async () => {
    await expect(
      service.driverUpdateStatus('booking-1', 'user-1', 'INVALID' as any),
    ).rejects.toThrow(BadRequestException);
  });
});
