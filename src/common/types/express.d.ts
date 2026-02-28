declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        tenant_id: string | null;
        isPlatformAdmin: boolean;
        role: string | null;
      };
    }
  }
}

export {};
