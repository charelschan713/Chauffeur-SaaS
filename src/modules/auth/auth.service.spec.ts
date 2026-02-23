import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { AuthService } from './auth.service';
import { NotificationsService } from '../notifications/notifications.service';

const signInWithPassword = jest.fn();
const profileSingle = jest.fn();

jest.mock('../../config/supabase.config', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn(),
        inviteUserByEmail: jest.fn(),
        signOut: jest.fn(),
      },
    },
    from: jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
  supabaseClient: {},
  newSupabaseAdminClient: jest.fn(() => ({
    auth: {
      signInWithPassword,
      refreshSession: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: profileSingle,
    })),
  })),
}));

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: NotificationsService,
          useValue: { notifyTenantPendingApproval: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return access token on success', async () => {
      signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'test@example.com' },
          session: { access_token: 'supabase-token', refresh_token: 'refresh-token' },
        },
        error: null,
      });
      profileSingle.mockResolvedValue({
        data: {
          role: 'TENANT_ADMIN',
          tenant_id: 'tenant-123',
          first_name: 'Test',
          last_name: 'Admin',
          is_active: true,
        },
        error: null,
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('access_token');
      expect(result.user.role).toBe('TENANT_ADMIN');
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials' },
      });

      await expect(
        service.login({ email: 'wrong@example.com', password: 'wrongpass' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
